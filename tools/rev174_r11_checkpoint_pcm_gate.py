#!/usr/bin/env python3
"""R11: cold replay vs checkpoint/resume, auditing per-frame state and PCM.

A checkpoint is an emulator-runtime state, not a completed SMW level.
An exact match is evidence only for the configured frame interval and platform.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import wave


def sha256(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def kv(path):
    if not path.is_file():
        raise ValueError('Missing report: ' + str(path))
    result = {}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            if k in result:
                raise ValueError(f'Duplicate field {k} in {path}')
            result[k] = v
    return result


def indexed_frames(path):
    if not path.is_file():
        raise ValueError('No frame hashes: ' + str(path))
    entries = {}
    for line in path.read_text().splitlines():
        m = re.fullmatch(r'frame=(\d+) framebuffer=([0-9a-f]+) wram=([0-9a-f]+) pc=([0-9a-f]+)', line.strip())
        if not m:
            raise ValueError('Invalid per-frame record: ' + line[:100])
        frame = int(m.group(1))
        if frame in entries:
            raise ValueError('Duplicate frame hash: ' + str(frame))
        entries[frame] = (m.group(2), m.group(3), m.group(4))
    return entries


def pcm(path):
    with wave.open(str(path), 'rb') as w:
        if w.getnchannels() != 2 or w.getsampwidth() != 2 or w.getframerate() != 32000:
            raise ValueError('Unexpected PCM format: ' + str(path))
        n = w.getnframes()
        data = w.readframes(n)
    if len(data) != n * 4 or not data:
        raise ValueError('Invalid/empty PCM data')
    return n, data


def execute(args, name, checkpoint):
    work = args.out / name
    work.mkdir(parents=True, exist_ok=False)
    shutil.copytree(args.assets, work / 'assets')
    env = {k: v for k, v in os.environ.items() if not k.startswith('FORJA65_')}
    env.update(FORJA65_HEADLESS='1', FORJA65_HEADLESS_FRAMES=str(args.limit),
               FORJA65_AUDIO_MODE='native', FORJA65_AUDIO_DUMP='1',
               FORJA65_AUDIO_PACING='0', FORJA65_AUDIO_SYNC='0',
               FORJA65_UNCAPPED='1', FORJA65_SPC_AOT_OFF='0',
               FORJA65_ROM_MODE='native', FORJA65_PPU_FAST_DATA='1',
               FORJA65_PPU_FAST_VRAM='1',
               FORJA65_INPUT_REPLAY=str(args.trace),
               FORJA65_SRAM_PATH=str(work / 'isolated.srm'),
               FORJA65_FRAME_HASHES='1',
               FORJA65_FRAME_HASH_PATH=str(work / 'frame-hashes.txt'),
               FORJA65_WATCHDOG_INSTRUCTIONS='2000000000')
    if name == 'create':
        env.update(FORJA65_CHECKPOINT_SAVE_AT=str(args.at),
                   FORJA65_CHECKPOINT_PATH=str(checkpoint),
                   FORJA65_CHECKPOINT_STOP='1')
    elif name == 'resume':
        env['FORJA65_CHECKPOINT_LOAD'] = str(checkpoint)
    start = time.monotonic()
    try:
        result = subprocess.run([str(args.exe)], cwd=work, env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                text=True, timeout=args.timeout, errors='replace')
        code, output = result.returncode, result.stdout
    except subprocess.TimeoutExpired as e:
        raise ValueError(f'{name}: timeout after {args.timeout}s') from e
    (work / 'run.log').write_text(output, encoding='utf-8')
    if code:
        raise ValueError(f'{name}: process returned {code}; see run.log')
    if name == 'create' and 'FORJA65_CHECKPOINT_SAVED' not in output:
        raise ValueError('Checkpoint was not reported saved')
    if name == 'resume' and 'FORJA65_CHECKPOINT_LOADED' not in output:
        raise ValueError('Checkpoint was not reported loaded')
    return {'duration_s': round(time.monotonic() - start, 2),
            'qa': kv(work / 'forja65-qa-status.txt'),
            'dep': kv(work / 'forja65-native-dependency-report.txt'),
            'audio': kv(work / 'forja65-audio-report.txt'),
            'hashes': indexed_frames(work / 'frame-hashes.txt'),
            'pcm': pcm(work / 'forja65-native-audio.wav')}


def audit(reference, resumed, at, limit):
    issues = []
    rh = reference['hashes']
    ch = resumed['hashes']
    overlap = sorted(set(rh) & set(ch))
    expected = list(range(at, limit))
    if overlap != expected:
        issues.append(f'Frame overlap mismatch: got {len(overlap)}, expected {len(expected)}')
    mismatches = [f for f in overlap if rh[f] != ch[f]]
    if mismatches:
        issues.append(f'Frame hash diverged at frame {mismatches[0]}')
    for section, keys in [
        ('qa', ['frames','instructions','framebuffer_hash','wram_hash',
                'nmi_services','irq_services','rom_fallback_reads']),
        ('dep', ['cpu_interpreter_instructions','cpu_aot_instructions',
                 'ppu_writes','rom_fallback_reads','dma_bytes','hdma_bytes',
                 'apu_aot_instructions','apu_aot_spc_cycles','apu_interpreter_spc_cycles',
                 'dsp_native_samples']),
    ]:
        for key in keys:
            if reference[section].get(key) != resumed[section].get(key):
                issues.append(f'{section}.{key}: {reference[section].get(key)} != {resumed[section].get(key)}')
    nr, br = reference['pcm']
    ns, bs = resumed['pcm']
    # After a restored SNES DSP state, a new host WAV begins at the cut.
    # Match the resumed PCM to the *exact byte suffix* of uninterrupted playback.
    if nr < ns:
        issues.append('Resume WAV longer than cold WAV')
    elif br[-len(bs):] != bs:
        issues.append('PCM resumed WAV is not the exact suffix of cold WAV')
    return {'status': 'PASS' if not issues else 'FAIL',
            'from_frame': at, 'to_frame': limit,
            'overlap_frames': len(overlap), 'frame_hash_mismatches': len(mismatches),
            'pcm_cold_frames': nr, 'pcm_resumed_frames': ns,
            'pcm_resume_sha256': hashlib.sha256(bs).hexdigest(),
            'pcm_cold_suffix_sha256': hashlib.sha256(br[-len(bs):]).hexdigest(),
            'cold_interpreted_cpu': reference['dep'].get('cpu_interpreter_instructions'),
            'resume_interpreted_cpu': resumed['dep'].get('cpu_interpreter_instructions'),
            'failures': issues}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--exe', type=Path, required=True)
    p.add_argument('--assets', type=Path, required=True)
    p.add_argument('--trace', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--at', type=int, default=120)
    p.add_argument('--limit', type=int, default=300)
    p.add_argument('--timeout', type=int, default=600)
    a = p.parse_args()
    a.exe, a.assets, a.trace, a.out = [x.resolve() for x in (a.exe, a.assets, a.trace, a.out)]
    if not 1 <= a.at < a.limit <= 46682 or a.timeout < 1:
        p.error('Invalid frame range/timeout')
    if a.out.exists():
        p.error('Output directory must not exist: ' + str(a.out))
    if not a.exe.is_file() or not (a.assets/'cart-data.bin').is_file() or not a.trace.is_file():
        p.error('Missing executable/ROM/trace')
    a.out.mkdir(parents=True)
    evidence = {'schema': 'forja65.checkpoint-pcm-gate.v1',
                'exe_sha256': sha256(a.exe),
                'rom_sha256': sha256(a.assets/'cart-data.bin'),
                'trace_sha256': sha256(a.trace),
                'at_frame': a.at, 'target_frames': a.limit,
                'checkpoint_audio_note': 'PCM suffix parity tests state continuity, not gameplay completion'}
    checkpoint = a.out / 'snapshot.f65s'
    try:
        print('Creating checkpoint...', flush=True)
        created = execute(a, 'create', checkpoint)
        if not checkpoint.is_file():
            raise ValueError('No checkpoint file created')
        evidence['checkpoint_sha256'] = sha256(checkpoint)
        print('Resuming checkpoint...', flush=True)
        resumed = execute(a, 'resume', checkpoint)
        print('Running uninterrupted control...', flush=True)
        reference = execute(a, 'cold', checkpoint)
        evidence.update(audit(reference, resumed, a.at, a.limit))
        evidence['times_seconds'] = {k:v['duration_s'] for k,v in
                                     [('create', created), ('resume', resumed), ('cold', reference)]}
        evidence['create_at_frames'] = created['qa'].get('frames')
        if evidence['create_at_frames'] != str(a.at):
            evidence['failures'].append('Creation did not stop at the requested frame')
            evidence['status'] = 'FAIL'
        if reference['qa'].get('frames') != str(a.limit) or resumed['qa'].get('frames') != str(a.limit):
            evidence['failures'].append('Final frame counter mismatch')
            evidence['status'] = 'FAIL'
    except (OSError, ValueError, wave.Error) as e:
        evidence.update(status='FAIL', error=str(e))
    (a.out/'result.json').write_text(json.dumps(evidence, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(evidence, indent=2), flush=True)
    return 0 if evidence['status'] == 'PASS' else 1

if __name__ == '__main__':
    sys.exit(main())
