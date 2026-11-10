#!/usr/bin/env python3
"""Audit SPC interpreter vs AOT from one ROM, replay and executable.

Usage: compare_spc_aot.py reference_dir aot_dir [--require-audio]
--require-audio requires valid WAV dumps AND bit-identical PCM. It is not a
substitute for checking perceptual quality against the original SNES.
"""
import argparse
import hashlib
from pathlib import Path
import sys
import wave

QA_KEYS = ('rom','runtime_started','frames','instructions','nmi_services','irq_services',
    'ppu_forced_blank','framebuffer_hash','wram_hash','ppu_accesses','apu_accesses',
    'dsp_native_samples','dsp_fallback_samples','rom_runtime_reads',
    'dma_native_bytes','hdma_native_bytes')
NATIVE_KEYS = ('rom','frames','instructions','cpu_interpreter_instructions',
    'cpu_aot_instructions','rom_reads','rom_fallback_reads','wram_reads',
    'wram_writes','ppu_writes','apu_reads','apu_writes','dma_bytes','hdma_bytes')
AUDIO_KEYS = ('sample_rate','channels','generated_frames','nonzero_frames',
    'peak','gain_clipped_frames','frames_dropped','dsp_samples','spc_pc',
    'dsp_main_l','dsp_main_r','dsp_flags','wav_requested','wav_opened','wav_frames')


def parse(path):
    if not path.is_file():
        raise ValueError(f'Missing report: {path}')
    result = {}
    for line in path.read_text(encoding='utf-8-sig',errors='replace').splitlines():
        if '=' in line:
            key, val = line.split('=',1)
            result[key.strip()] = val.strip()
    return result


def load(directory):
    path=Path(directory)
    return {
        'qa': parse(path/'forja65-qa-status.txt'),
        'native': parse(path/'forja65-native-dependency-report.txt'),
        'spc': parse(path/'forja65-spc-upload.txt'),
        'audio': parse(path/'forja65-audio-report.txt') if (path/'forja65-audio-report.txt').exists() else None,
        'dir': path,
    }


def pcm_fingerprint(path):
    """Hash decoded PCM frame bytes, validating the complete RIFF data."""
    if not path.is_file():
        raise ValueError(f'Missing WAV dump: {path}')
    with wave.open(str(path),'rb') as reader:
        if reader.getcomptype()!='NONE' or reader.getnchannels()!=2 or reader.getsampwidth()!=2:
            raise ValueError(f'Expected stereo 16-bit PCM WAV: {path}')
        if reader.getframerate()!=32000:
            raise ValueError(f'Expected 32000-Hz DSP capture: {path}')
        frames=reader.getnframes()
        hasher=hashlib.sha256()
        seen=0
        while True:
            data=reader.readframes(32768)
            if not data:
                break
            if len(data)%4:
                raise ValueError(f'Partial PCM sample: {path}')
            seen+=len(data)//4
            hasher.update(data)
        if seen!=frames:
            raise ValueError(f'Truncated PCM data: {path} ({seen}/{frames} frames)')
    return frames,hasher.hexdigest()


def compare(left,right,require_audio=False):
    failures=[]
    def expect(label,a,b):
        if a!=b:
            failures.append(f'{label}: reference={a!r} aot={b!r}')
    for keys,section in ((QA_KEYS,'qa'),(NATIVE_KEYS,'native')):
        for key in keys:
            expect(f'{section.upper()} {key}',left[section].get(key),right[section].get(key))
    expect('Reference started',left['qa'].get('runtime_started'),'PASS')
    expect('AOT started',right['qa'].get('runtime_started'),'PASS')
    expect('SPC interpreter only',left['spc'].get('spc_backend'),'interpreter')
    expect('SPC AOT active',right['spc'].get('spc_backend'),'aot_opcode')
    expect('APU backend original',left['native'].get('APU_NATIVE_BACKEND'),'NO')
    expect('APU backend AOT',right['native'].get('APU_NATIVE_BACKEND'),'YES')
    def number(section, key, dataset):
        try: return int(dataset[section][key])
        except (TypeError,ValueError,KeyError) as e:
            raise ValueError(f'Invalid/missing integer {section}.{key}') from e
    if number('native','apu_aot_instructions',right)<=0:
        failures.append('SPC AOT ZERO INSTRUCTIONS')
    expect('Reference AOT instructions',number('native','apu_aot_instructions',left),0)
    expect('Total SPC cycles',number('native','apu_interpreter_spc_cycles',left),
           number('native','apu_aot_spc_cycles',right)+number('native','apu_interpreter_spc_cycles',right))
    if (left['audio'] is None)!=(right['audio'] is None):
        failures.append('Only one mode produced an audio report')
    if require_audio and (left['audio'] is None or right['audio'] is None):
        failures.append('Audio is required; audio report missing')
    if left['audio'] is not None and right['audio'] is not None:
        for key in AUDIO_KEYS:
            expect('AUDIO '+key,left['audio'].get(key),right['audio'].get(key))
        if require_audio:
            for label,d in (('reference',left),('aot',right)):
                expect(label+' DSP native backend',d['native'].get('DSP_NATIVE_BACKEND'),'YES')
                if number('native','dsp_native_samples',d)<=0:
                    failures.append(label+' produced no native DSP samples')
            for label,d in (('reference',left),('aot',right)):
                for k in ('wav_requested','wav_opened'):
                    expect(label+' '+k,d['audio'].get(k),'1')
                if d['audio'].get('backend_error'):
                    failures.append(f'{label} audio error: {d["audio"]["backend_error"]}')
            lf,lh=pcm_fingerprint(left['dir']/'forja65-native-audio.wav')
            rf,rh=pcm_fingerprint(right['dir']/'forja65-native-audio.wav')
            expect('PCM frame count',lf,rf)
            expect('WAV reported frames REF',str(lf),left['audio'].get('wav_frames'))
            expect('WAV reported frames AOT',str(rf),right['audio'].get('wav_frames'))
            expect('PCM SHA256',lh,rh)
            if not lf:
                failures.append('Zero captured PCM frames')
    return failures


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('reference_dir')
    ap.add_argument('aot_dir')
    ap.add_argument('--require-audio',action='store_true',help='require same stereo 32000-Hz 16-bit PCM samples')
    args=ap.parse_args(argv)
    try:
        left,right=load(args.reference_dir),load(args.aot_dir)
        failures=compare(left,right,args.require_audio)
    except (OSError, ValueError, wave.Error) as e:
        print('SPC A/B INVALID:',e)
        return 2
    if failures:
        print(f'SPC A/B FAIL ({len(failures)} divergences):')
        for f in failures:print('  -',f)
        return 1
    print('SPC A/B PASS: CPU/WRAM/PPU/APU counters and hashes match; AOT executed.')
    if args.require_audio:
        frames,digest=pcm_fingerprint(left['dir']/'forja65-native-audio.wav')
        print(f'PCM BIT-EXACT PASS: {frames} stereo frames at 32000 Hz, SHA256={digest}')
    else:
        print('PCM not certified; use --require-audio on captures with WAV dumps.')
    print('Limit: cannot infer game stage completion, SNES sound accuracy, or Windows FPS.')
    return 0

if __name__=='__main__':
    sys.exit(main())
