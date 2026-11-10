#!/usr/bin/env python3
"""REV174 R8: R6 vs R7 CPU-AOT replay gate; exact picture, memory and PCM parity.

The AOT/interpreter split is deliberately allowed to change. A green parity
result is *not* evidence for the entire game or for faster performance.
"""
import argparse
import json
from pathlib import Path
import sys

import hashlib
import os
import shutil
import subprocess
import time
from compare_spc_aot import pcm_fingerprint

QA_SAME = (
    'rom','runtime_started','frames','instructions','nmi_services','irq_services',
    'framebuffer_hash','wram_hash','ppu_forced_blank','apu_aot_instructions',
    'apu_aot_misses','apu_aot_spc_cycles','apu_interpreter_spc_cycles',
    'rom_runtime_reads','dma_bytes','dma_native_bytes','hdma_bytes',
    'hdma_native_bytes','dsp_native_samples','dsp_fallback_samples',
)
NATIVE_SAME = (
    'rom','frames','instructions','nmi_services','irq_services',
    'cpu_interpreter_instructions','cpu_aot_instructions',
    'wram_reads','wram_writes','ppu_reads','ppu_writes','apu_reads',
    'apu_writes','dma_bytes','hdma_bytes','dsp_native_samples',
    'dsp_fallback_samples',
)
AUDIO_SAME = (
    'sample_rate','channels','generated_frames','nonzero_frames','peak',
    'gain_clipped_frames','frames_dropped','dsp_samples','spc_pc',
    'dsp_main_l','dsp_main_r','dsp_flags','wav_requested','wav_opened',
    'wav_frames',
)


def parse(path):
    if not path.is_file():
        raise ValueError(f'Missing report: {path}')
    result={}
    for line in path.read_text(encoding='utf-8-sig').splitlines():
        if '=' in line and not line.startswith('#'):
            key,value=line.split('=',1)
            if key in result:
                raise ValueError(f'Duplicate field {key} in {path}')
            result[key]=value
    return result


def numeric(mapping,key):
    try:return int(mapping[key])
    except (KeyError,ValueError) as error:
        raise ValueError(f'Missing/invalid metric: {key}') from error


def inspect_run(path):
    qa=parse(path/'forja65-qa-status.txt')
    dep=parse(path/'forja65-native-dependency-report.txt')
    audio=parse(path/'forja65-audio-report.txt')
    if qa.get('runtime_started')!='PASS':
        raise ValueError(f'{path}: runtime did not start')
    if dep.get('PPU_REGISTER_MODEL')!='SOFTWARE':
        raise ValueError(f'{path}: PPU register model must be reported transparently')
    if audio.get('backend_error'):
        raise ValueError(f'{path}: audio backend error: {audio["backend_error"]}')
    for key,expected in (('wav_requested','1'),('wav_opened','1')):
        if audio.get(key)!=expected:
            raise ValueError(f'{path}: WAV capture not active ({key})')
    wav_frames,wav_hash=pcm_fingerprint(path/'forja65-native-audio.wav')
    if wav_frames<=0 or numeric(audio,'wav_frames')!=wav_frames:
        raise ValueError(f'{path}: missing or incomplete audio frames')
    if numeric(qa,'frames')<=0 or numeric(dep,'rom_reads')<=0:
        raise ValueError(f'{path}: insufficient gameplay/ROM evidence')
    if numeric(dep,'ppu_writes')<=0:
        raise ValueError(f'{path}: no PPU writes observed')
    return dict(qa=qa,dep=dep,audio=audio,wav_frames=wav_frames,wav_hash=wav_hash)


def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
    return h.hexdigest()


def execute(game,assets,trace,out,label,frames,timeout,env_overrides):
    work=out/label
    if work.exists():raise ValueError(f'Refusing to overwrite existing run: {work}')
    work.mkdir(parents=True)
    shutil.copytree(assets,work/'assets')
    env={k:v for k,v in os.environ.items() if not k.startswith('FORJA65_')}
    env.update(FORJA65_HEADLESS='1',FORJA65_HEADLESS_FRAMES=str(frames),
        FORJA65_AUDIO_MODE='native',FORJA65_AUDIO_DUMP='1',
        FORJA65_AUDIO_PACING='0',FORJA65_AUDIO_SYNC='0',
        FORJA65_UNCAPPED='1',FORJA65_WATCHDOG_INSTRUCTIONS='2000000000',
        FORJA65_SRAM_PATH=str((work/'run-isolated.srm').resolve()),
        FORJA65_SPC_AOT_OFF='0')
    if trace is not None:env['FORJA65_INPUT_REPLAY']=str(trace)
    env.update(env_overrides)
    start=time.monotonic()
    try:
        p=subprocess.run([str(game)],cwd=work,env=env,capture_output=True,text=True,
                         timeout=timeout,errors='replace')
    except subprocess.TimeoutExpired as e:
        raise ValueError(f'{label} timeout after {timeout}s') from e
    duration=time.monotonic()-start
    (work/'console.stdout.txt').write_text(p.stdout,encoding='utf-8')
    (work/'console.stderr.txt').write_text(p.stderr,encoding='utf-8')
    if p.returncode:
        raise ValueError(f'{label} exited {p.returncode}; inspect {work}/console.stderr.txt')
    record=inspect_run(work)
    if numeric(record['qa'],'frames')!=frames:
        raise ValueError(f'{label} ended at frame {record["qa"].get("frames")}; expected {frames}')
    return record,duration



# Require all externally observable state, timing and hardware counters to match.
# Not the CPU execution backend split: that is what we're testing.
DEPENDENCY_SAME=(
 'rom', 'frames', 'instructions', 'nmi_services', 'irq_services',
 'wram_reads', 'wram_writes', 'ppu_reads', 'ppu_writes',
 'ppu_native_reads','ppu_native_writes','ppu_fallback_reads','ppu_fallback_writes',
 'ppu_oam_fast_writes','ppu_cgram_fast_writes',
 'apu_reads', 'apu_writes', 'apu_aot_instructions','apu_aot_misses',
 'apu_aot_spc_cycles','apu_interpreter_spc_cycles','apu_native_master_cycles',
 'apu_fallback_master_cycles', 'dma_bytes','dma_native_bytes','dma_fallback_bytes',
 'hdma_bytes','hdma_native_bytes','hdma_fallback_bytes','dsp_native_samples',
 'dsp_fallback_samples','rom_reads','rom_native_reads','rom_fallback_reads'
)

def audit(reference, candidate, minimum_saving=1):
    differences=[]
    for group, fields in [('qa',QA_SAME),('dep',DEPENDENCY_SAME),('audio',AUDIO_SAME)]:
        for field in fields:
            if (group=='qa' and field=='rom_runtime_reads') or (group=='dep' and field in ('rom_reads','rom_native_reads')):
                continue  # CPU interpreter performs extra instrumentation/code-read probes.
            left=reference[group].get(field); right=candidate[group].get(field)
            if left is None or right is None or left!=right:
                differences.append(f'{group}.{field}: {left} != {right}')
    for field in ('wav_hash','wav_frames'):
        if reference.get(field)!=candidate.get(field):
            differences.append(f'PCM {field} differs')
    before=numeric(reference['dep'],'cpu_interpreter_instructions')
    after=numeric(candidate['dep'],'cpu_interpreter_instructions')
    orig_aot=numeric(reference['dep'],'cpu_aot_instructions')
    new_aot=numeric(candidate['dep'],'cpu_aot_instructions')
    ref_total=numeric(reference['dep'],'instructions')
    candidate_total=numeric(candidate['dep'],'instructions')
    if ref_total!=before+orig_aot or candidate_total!=after+new_aot:
        differences.append('CPU AOT+interpreter accounting does not match total instructions')
    # AOT replaces interpreter dispatch and may avoid auxiliary code-read probes.
    # ROM is immutable and counts of those probes are not observable game state.
    # Require both runs to source EVERY measured ROM read from the complete native pack.
    read_counts={}
    for label,capture in [('reference',reference),('candidate',candidate)]:
        dep=capture['dep']
        reads=numeric(dep,'rom_reads'); native=numeric(dep,'rom_native_reads')
        fallback=numeric(dep,'rom_fallback_reads')
        read_counts[label]=reads
        if reads<=0 or native!=reads or fallback!=0 or dep.get('ROM_NATIVE_READY')!='YES':
            differences.append(f'{label}: native ROM pack not exclusively active')
    saving=before-after
    if saving<minimum_saving:
        differences.append(f'CPU fallback saving {saving} < required {minimum_saving}')
    return {'status':'PASS' if not differences else 'FAIL',
        'frames':numeric(reference['qa'],'frames'),
        'cpu_instructions':ref_total, 'interpreted_before':before,
        'interpreted_after':after,'saved_interpreter_instructions':saving,
        'cpu_aot_before':orig_aot,'cpu_aot_after':new_aot,
        'rom_read_counts':read_counts,
        'rom_read_delta':read_counts['candidate']-read_counts['reference'],
        'rom_read_delta_note':'Diagnostic count can differ when AOT avoids interpreter code-fetch probes; not claimed identical',
        'pcm_stereo_frames':reference['wav_frames'],
        'pcm_sha256':reference['wav_hash'],
        'framebuffer_hash':reference['qa']['framebuffer_hash'],
        'wram_hash':reference['qa']['wram_hash'],
        'differences':differences,
        'scope':'exact same replay and configuration on Linux; not full game equivalence or FPS benchmark'}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--reference',required=True,type=Path)
    p.add_argument('--candidate',required=True,type=Path)
    p.add_argument('--assets',required=True,type=Path)
    p.add_argument('--trace',required=True,type=Path)
    p.add_argument('--frames',type=int,default=1200)
    p.add_argument('--timeout',type=int,default=900)
    p.add_argument('--out',required=True,type=Path)
    p.add_argument('--min-saving',type=int,default=1)
    args=p.parse_args()
    if not 1<=args.frames<=200000 or args.min_saving<0:
        p.error('Invalid frames/min-saving')
    if not args.trace.is_file() or not args.reference.is_file() or not args.candidate.is_file():
        p.error('Missing executable or replay')
    out=args.out.resolve()
    if out.exists() and any(out.iterdir()):p.error('Refusing to overwrite existing evidence')
    out.mkdir(parents=True,exist_ok=True)
    same_env={'FORJA65_ROM_MODE':'native','FORJA65_PPU_FAST_DATA':'1','FORJA65_PPU_FAST_VRAM':'1'}
    metadata={'reference_sha256':digest(args.reference), 'candidate_sha256':digest(args.candidate),
       'trace_sha256':digest(args.trace),'rom_sha256':digest(args.assets/'cart-data.bin')}
    try:
        print('Running reference...',flush=True)
        ref,ref_time=execute(args.reference.resolve(),args.assets.resolve(),args.trace.resolve(),out,'reference',args.frames,args.timeout,same_env)
        print('Running candidate...',flush=True)
        cand,cand_time=execute(args.candidate.resolve(),args.assets.resolve(),args.trace.resolve(),out,'candidate',args.frames,args.timeout,same_env)
        result={**metadata,**audit(ref,cand,args.min_saving),'reference_elapsed_seconds':round(ref_time,3),'candidate_elapsed_seconds':round(cand_time,3)}
    except (ValueError,OSError) as exc:
        result={**metadata,'status':'FAIL','error':str(exc)}
    (out/'result.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2),flush=True)
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':sys.exit(main())
