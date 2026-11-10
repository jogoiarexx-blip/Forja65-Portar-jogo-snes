#!/usr/bin/env python3
"""REV183: audit CPU-AOT beyond short boot traces using validated checkpoint chunks.

The final claim is scoped to the exact trace, emulator profile, and observed frames.
The binary itself is unmodified. A restored checkpoint resets instrumentation-only
CPU interpreter counts, so never subtract one segment's counter from another.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import csv
import subprocess
import sys

HASH_RE = re.compile(r'^frame=(\d+)\s+framebuffer=([0-9a-f]+)\s+wram=([0-9a-f]+)\s+pc=([0-9a-f]+)$')
METRIC_RE = re.compile(r'^([a-z_]+)=(\S+)$')


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as inp:
        for block in iter(lambda: inp.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def kv_file(path: Path) -> dict[str, str]:
    if not path.is_file():
        raise ValueError(f'missing required report: {path}')
    data = {}
    for line in path.read_text(errors='replace').splitlines():
        m = METRIC_RE.match(line.strip())
        if m:
            data[m[1]] = m[2]
    return data


def hashes(path: Path) -> list[tuple[int, str, str]]:
    if not path.is_file():
        raise ValueError(f'missing frame hashes: {path}')
    out = []
    for line in path.read_text().splitlines():
        m = HASH_RE.fullmatch(line.strip())
        if not m:
            raise ValueError(f'malformed frame-hash line: {line[:100]}')
        item = (int(m[1]), m[2], m[3])
        if out and item[0] != out[-1][0] + 1:
            raise ValueError(f'frame discontinuity: {out[-1][0]} -> {item[0]}')
        out.append(item)
    if not out:
        raise ValueError('empty frame hash output')
    return out


def partial_run_evidence(folder: Path) -> dict:
    """REV188: preserve observed frame/room and AOT frontier even on failed replays.

    Only complete, consecutive framebuffer+WRAM hashes count as verified frames.
    Stage rows are diagnostic observations, not proof that a level was finished.
    """
    result = {'verified_prefix_frames': 0, 'last_hashed_frame': None,
              'last_wram_hash': None, 'last_framebuffer_hash': None,
              'last_stage_sample': None, 'aot_frontier': None,
              'partial_evidence_error': None}
    frame_file = folder / 'frame-hashes.txt'
    if frame_file.exists():
        try:
            with frame_file.open() as inp:
                for line in inp:
                    m = HASH_RE.fullmatch(line.strip())
                    if not m or int(m[1]) != result['verified_prefix_frames']:
                        raise ValueError('malformed or nonconsecutive partial frame hashes')
                    result['last_hashed_frame'] = int(m[1])
                    result['last_framebuffer_hash'] = m[2]
                    result['last_wram_hash'] = m[3]
                    result['verified_prefix_frames'] += 1
        except (OSError, ValueError) as exc:
            result['partial_evidence_error'] = str(exc)
    stages = folder / 'stage.csv'
    if stages.exists():
        try:
            with stages.open(newline='') as f:
                rows = csv.DictReader(line for line in f if not line.startswith('#'))
                for row in rows:
                    if 'frame' not in row or 'room' not in row:
                        raise ValueError('malformed stage data')
                    int(row['frame'])
                    result['last_stage_sample'] = {key: row.get(key) for key in
                        ('frame', 'reason', 'room', 'level', 'x', 'y', 'lives', 'pc')}
        except (ValueError, KeyError, OSError, csv.Error) as exc:
            result['partial_evidence_error'] = 'stage: ' + str(exc)
    frontier = folder / 'forja65-aot-frontier.txt'
    if frontier.exists():
        result['aot_frontier'] = frontier.read_text(errors='replace')[-4096:]
    return result


def classify_failure(code: int, game_log: Path, progress_csv: Path, checkpoint_expected: bool, checkpoint_exists: bool) -> dict:
    """Forensics only: never claim stage completion from a partial execution."""
    tail = game_log.read_text(errors='replace')[-32768:] if game_log.exists() else ''
    status = 'runtime_error'
    if code == 124:
        status = 'timeout'
    elif ('retorno 65C816 nao corresponde' in tail or 'native return mismatch' in tail):
        status = 'native_return_mismatch'
    elif ('checkpoint unsafe:' in tail or 'checkpoint restore unsafe:' in tail):
        status = 'unsafe_native_checkpoint'
    elif ('FORJA65_CPU_AOT_ONLY' in tail or 'FORJA65_AOT_MISSING' in tail
          or 'AOT-only' in tail or (game_log.parent / 'forja65-aot-frontier.txt').is_file()):
        status = 'aot_route_missing'
    elif code == 0 and checkpoint_expected and not checkpoint_exists:
        status = 'checkpoint_not_written'
    progress = []
    if progress_csv.is_file():
        try:
            with progress_csv.open(newline='') as f:
                for row in csv.DictReader(f):
                    # The runtime writes monotone complete-frame markers.
                    frame = int(row['frame'])
                    if progress and frame <= progress[-1]:
                        raise ValueError('nonmonotone progress frames')
                    progress.append(frame)
        except (ValueError, KeyError, csv.Error):
            status = 'invalid_progress_log'
            progress = []
    return {'reason': status, 'exit_code': code,
            'last_progress_frame': progress[-1] if progress else None,
            'progress_samples': len(progress), 'checkpoint_safe': False,
            'gameplay_completed': False,
            'error_tail': tail[-1200:],
            'partial': partial_run_evidence(game_log.parent)}


def audit(out: Path) -> dict:
    manifest = json.loads((out / 'manifest.json').read_text())
    last_hash = None
    last_frame = -1
    prev_total = 0
    total_interp = 0
    previous_interp_counter = 0
    verified_frames = 0
    for step in manifest['segments']:
        folder = out / step['folder']
        qa = kv_file(folder / 'forja65-qa-status.txt')
        mig = kv_file(folder / 'forja65-cpu-migration.txt')
        samples = hashes(folder / 'frame-hashes.txt')
        first, final = samples[0][0], samples[-1][0]
        if first != last_frame + 1:
            raise ValueError(f'segment has gap or duplicate: {first} after {last_frame}')
        last_frame = final
        last_hash = samples[-1]
        verified_frames += len(samples)
        if int(qa['frames']) != step['frame']:
            raise ValueError(f'segment ended at unexpected frame {qa["frames"]} instead of {step["frame"]}')
        cpu = int(mig['total_instructions'])
        fallback = int(mig['interpreter_instructions'])
        if cpu < prev_total or fallback < 0:
            raise ValueError('invalid instruction counts')
        # CPU total is restored from checkpoints; interpreter instrumentation is not.
        # Sum per-process interpreted counts, but take deltas of CPU total counts.
        step['cpu_delta'] = cpu - prev_total
        if manifest['settings']['fallback_counter'] == 'persistent':
            if fallback < previous_interp_counter:
                raise ValueError('persistent fallback counter decreased between segments')
            fallback_delta = fallback - previous_interp_counter
            previous_interp_counter = fallback
        else:
            fallback_delta = fallback  # old DKC3 checkpoint does not serialize this counter
        step['fallback_delta'] = fallback_delta
        total_interp += fallback_delta
        prev_total = cpu
        step['hash_first'] = first
        step['hash_last'] = final
    return {'frames': verified_frames, 'last_frame': last_frame,
            'cpu_instructions': prev_total, 'interpreted_instructions': total_interp,
            'cpu_aot_percent': round(100 * (prev_total - total_interp) / prev_total, 8) if prev_total else None,
            'last_framebuffer_hash': last_hash[1] if last_hash else None,
            'last_wram_hash': last_hash[2] if last_hash else None,
            'all_segments_verified': (manifest['status'] == 'complete'
                                      and verified_frames == int(manifest['settings']['frames'])
                                      and last_frame == int(manifest['settings']['frames']) - 1
                                      and all(step['hash_last'] == step['frame'] - 1 for step in manifest['segments'])),
            'mode': manifest['settings']['mode'], 'profile': manifest['settings']['profile'],
            'trace_sha256': manifest['settings']['trace_sha256'],
            'game_sha256': manifest['settings']['game_sha256'],
            'segment_details': manifest['segments']}


def run(args: argparse.Namespace) -> int:
    out = args.out.resolve()
    game = args.game.resolve()
    trace = args.trace.resolve()
    assets = args.assets.resolve()
    if not game.is_file() or not os.access(game, os.X_OK):
        raise ValueError('game executable missing or not executable')
    if not trace.is_file() or not assets.is_dir():
        raise ValueError('trace or assets missing')
    if not 1 <= args.progress_every <= 100000:
        raise ValueError('progress-every must be 1..100000')
    if args.frames < 1 or args.chunk < 1:
        raise ValueError('frames and chunk must be positive')
    if args.chunk < args.frames and not args.experimental_checkpoints:
        raise ValueError('checkpoint segmentation is experimental: REV183 detected a non-resumable 65816 return; use --chunk >= --frames for continuous replay')
    settings = dict(mode=args.mode, profile=args.profile, game_sha256=digest(game),
                    trace_sha256=digest(trace), rom_sha256=digest(assets / 'cart-data.bin'),
                    frames=args.frames, chunk=args.chunk, fallback_counter=args.fallback_counter)
    outfile = out / 'manifest.json'
    if outfile.exists():
        if not args.resume:
            raise ValueError('output already has a manifest; use --resume to continue unchanged campaign')
        manifest = json.loads(outfile.read_text())
        if manifest['settings'] != settings:
            raise ValueError('resume refused: binary, ROM, trace, profile, mode or limits changed')
    else:
        if out.exists() and any(out.iterdir()):
            raise ValueError('output directory not empty')
        out.mkdir(parents=True, exist_ok=True)
        manifest = {'format': 'FORJA65_NATIVE_CAMPAIGN_V1', 'status': 'running',
                    'settings': settings, 'segments': []}
        outfile.write_text(json.dumps(manifest, indent=2) + '\n')
    if manifest['status'] == 'complete':
        result = audit(out)
        (out / 'audit.json').write_text(json.dumps(result, indent=2) + '\n')
        if not result['all_segments_verified']:
            raise ValueError('manifest complete but frame hash coverage incomplete')
        print(json.dumps(result, indent=2))
        return 0
    prev_frame = manifest['segments'][-1]['frame'] if manifest['segments'] else -1
    checkpoint = out / manifest['segments'][-1]['checkpoint'] if manifest['segments'] else None
    while prev_frame < args.frames:
        target = min(args.frames, ((max(prev_frame, 0) // args.chunk) + 1) * args.chunk)
        # Prefix starts at zero so a test for 300 ends on frame 300.
        if prev_frame < 0:
            target = min(args.frames, args.chunk)
        final = target == args.frames
        folder = out / f'segment-{len(manifest["segments"]):04d}'
        folder.mkdir(exist_ok=False)
        (folder / 'assets').symlink_to(assets, target_is_directory=True)
        new_checkpoint = (out / f'checkpoint-{target:09d}.f65s').resolve()
        env = os.environ.copy()
        env.update(FORJA65_EXECUTION=args.profile, FORJA65_SPC_PROFILE=args.profile,
                   FORJA65_HEADLESS='1', FORJA65_HEADLESS_FRAMES=str(target if final else target + 1),
                   FORJA65_WATCHDOG_INSTRUCTIONS='0', FORJA65_FRAME_HASHES='1',
                   FORJA65_FRAME_HASH_PATH=str(folder / 'frame-hashes.txt'),
                   FORJA65_INPUT_REPLAY=str(trace), FORJA65_INPUT_REQUIRE_ROM='1',
                   FORJA65_SRAM_PATH=str(folder / 'save.srm'),
                   FORJA65_DKC3_STAGE_PROBE='1', FORJA65_STAGE_PATH=str(folder / 'stage.csv'),
                   FORJA65_STAGE_PERIOD='60',
                   FORJA65_FRAME_PROGRESS_CSV=str(folder / 'frame-progress.csv'),
                   FORJA65_FRAME_PROGRESS_EVERY=str(args.progress_every))
        for k in ('FORJA65_CHECKPOINT_LOAD', 'FORJA65_CHECKPOINT_SAVE_AT',
                  'FORJA65_CHECKPOINT_STOP', 'FORJA65_CHECKPOINT_PATH', 'FORJA65_CPU_AOT_ONLY'):
            env.pop(k, None)
        if args.mode == 'aot':
            env['FORJA65_CPU_AOT_ONLY'] = '1'
        if checkpoint is not None:
            env['FORJA65_CHECKPOINT_LOAD'] = str(checkpoint)
        if not final:
            env['FORJA65_CHECKPOINT_SAVE_AT'] = str(target)
            env['FORJA65_CHECKPOINT_STOP'] = '1'
            env['FORJA65_CHECKPOINT_PATH'] = str(new_checkpoint)
        with (folder / 'game.log').open('w') as log:
            try:
                result = subprocess.run([str(game)], cwd=folder, env=env,
                                        stdout=log, stderr=subprocess.STDOUT,
                                        timeout=args.timeout, check=False)
                code = result.returncode
            except subprocess.TimeoutExpired:
                code = 124
        (folder / 'exit-code.txt').write_text(str(code) + '\n')
        if code != 0 or (not final and not new_checkpoint.is_file()):
            failure = classify_failure(code, folder / 'game.log', folder / 'frame-progress.csv',
                                       not final, new_checkpoint.is_file())
            (folder / 'failure.json').write_text(json.dumps(failure, indent=2) + '\n')
            manifest['status'] = 'blocked'
            manifest['blocked_frame_at_or_before'] = target
            manifest['blocking_log'] = str((folder / 'game.log').relative_to(out))
            manifest['failure'] = {'reason': failure['reason'],
                                   'last_progress_frame': failure['last_progress_frame'],
                                   'report': str((folder / 'failure.json').relative_to(out))}
            outfile.write_text(json.dumps(manifest, indent=2) + '\n')
            print(f'Execucao incompleta ({failure["reason"]}) ate o quadro {target}; '
                  f'ultimo progresso={failure["last_progress_frame"]}; veja {folder / "failure.json"}', file=sys.stderr)
            return 2
        step = {'folder': folder.name, 'frame': target,
                'checkpoint': new_checkpoint.name if not final else None}
        manifest['segments'].append(step)
        manifest['status'] = 'complete' if final else 'running'
        outfile.write_text(json.dumps(manifest, indent=2) + '\n')
        prev_frame = target
        checkpoint = new_checkpoint
    result = audit(out)
    (out / 'audit.json').write_text(json.dumps(result, indent=2) + '\n')
    if not result['all_segments_verified']:
        raise ValueError('frame hash coverage does not match the completed campaign')
    print(json.dumps({k: v for k, v in result.items() if k != 'segment_details'}, indent=2))
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--game', type=Path, required=True)
    p.add_argument('--trace', type=Path, required=True)
    p.add_argument('--assets', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--frames', type=int, required=True)
    p.add_argument('--chunk', type=int, default=3000)
    p.add_argument('--mode', choices=['aot', 'normal'], default='aot')
    p.add_argument('--profile', choices=['reference', 'native'], default='reference')
    p.add_argument('--timeout', type=int, default=300)
    p.add_argument('--progress-every', type=int, default=60,
                   help='write completed-frame progress markers, including on timeout')
    p.add_argument('--fallback-counter', choices=['reset', 'persistent'], default='reset',
                   help='legacy DKC3 checkpoint resets this counter; current Forja generator serializes it')
    p.add_argument('--resume', action='store_true')
    p.add_argument('--experimental-checkpoints', action='store_true',
                   help='EXPERIMENTAL: checkpoint saves may be rejected if native return frames are pending')
    args = p.parse_args()
    try:
        return run(args)
    except (ValueError, OSError, KeyError, json.JSONDecodeError) as exc:
        print(f'Campanha nativa invalida: {exc}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
