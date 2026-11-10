#!/usr/bin/env python3
"""Audit R10 vs R11 across all 8,000 replayed frames, with PCM and HW counters.

The R10 source is a hash-sealed *saved* execution, not rerun by this program.
Difference between interpreter and native CPU probes is allowed only in CPU mix
and measured number of auxiliary ROM fetches, never in image/WRAM/PCM or core
hardware/timing counters. No claim of whole-game completion or Windows test.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from rev174_r8_cpu_aot_gate import inspect_run, audit, digest
from rev174_r11_checkpoint_pcm_gate import indexed_frames

EXPECTED_R10_EVIDENCE_SHA256 = {'forja65-audio-report.txt': 'f5c887f0119a202f5666a940a93530292a90a745c52f8d17091dad01860aa252', 'forja65-cpu-interpreter.txt': '8b350724a3a191322355591bdb730c1c16fe446c3d8ef3cec6c4946f8e15d69c', 'forja65-frame-hashes.txt': 'badf251a8d119d1639dc339148d936ce8748d7e184c5eab6ca14577fbd4272f6', 'forja65-native-audio.wav': '30208c2eae398ebbe092afce22d589d35852e7661b0cf8beda26dfa86de3c8ba', 'forja65-native-dependency-report.txt': '48f756c0a4b3d785de6a62881a82e728774996c4bccac11ace6a01ac6a7d78d0', 'forja65-qa-status.txt': 'b0c04085dd7448e2d038171876072490cb6086b05876def78223b3fe7b527515'}

FILES = ('forja65-qa-status.txt','forja65-native-dependency-report.txt',
         'forja65-audio-report.txt','forja65-native-audio.wav',
         'forja65-frame-hashes.txt', 'forja65-cpu-interpreter.txt')


def proof_file_digests(directory):
    return {file: digest(directory/file) for file in FILES if (directory/file).is_file()}


def preflight(reference, candidate, expected_frames):
    identity = {}
    for src in (reference,candidate):
        if not src.is_dir(): raise ValueError('Evidence directory missing: '+str(src))
        for file in FILES[:-1]:
            if not (src/file).is_file(): raise ValueError('Evidence file missing: '+str(src/file))
    a=inspect_run(reference)
    b=inspect_run(candidate)
    if int(a['qa'].get('frames',-1)) != expected_frames or int(b['qa'].get('frames',-1)) != expected_frames:
        raise ValueError('Inconsistent frame count')
    if a['qa'].get('rom') != b['qa'].get('rom'):
        raise ValueError('Different ROM fingerprints in QA reports')
    for name, record in [('R10',a),('R11',b)]:
        if record['dep'].get('rom_fallback_reads')!='0':
            raise ValueError(name + ' has ROM fallback reads')
        if record['audio'].get('wav_frames') != str(record['wav_frames']):
            raise ValueError(name+' WAV frame count differs from audio report')
    a_frames=indexed_frames(reference/'forja65-frame-hashes.txt')
    b_frames=indexed_frames(candidate/'forja65-frame-hashes.txt')
    desired=set(range(expected_frames))
    if set(a_frames)!=desired or set(b_frames)!=desired:
        raise ValueError('Missing/noncontiguous frame hashes in eight-thousand-frame replay')
    differences=[f for f in range(expected_frames) if a_frames[f]!=b_frames[f]]
    return a,b, differences


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for key in ('reference','candidate','r10-bin','r11-bin','rom','replay','result'):
        parser.add_argument('--'+key,required=True,type=Path)
    parser.add_argument('--frames',type=int,default=8000)
    parser.add_argument('--min-saving',type=int,default=1)
    args=parser.parse_args()
    for name in ('reference','candidate','r10_bin','r11_bin','rom','replay','result'):
        setattr(args,name,getattr(args,name).resolve())
    if args.frames < 1 or args.min_saving<0:
        parser.error('Invalid frames/min-saving')
    base={
        'schema':'forja65.r11.extended-cpu-aot-gate.v1',
        'reference_mode':'R10 SAVED REPORTS (not rerun)',
        'frames':args.frames,
        'r10_exe_sha256':digest(args.r10_bin),
        'r11_exe_sha256':digest(args.r11_bin),
        'rom_sha256':digest(args.rom),
        'replay_sha256':digest(args.replay),
        'r10_evidence_sha256':proof_file_digests(args.reference),
        'r11_evidence_sha256':proof_file_digests(args.candidate),
    }
    try:
        if proof_file_digests(args.reference) != EXPECTED_R10_EVIDENCE_SHA256:
            raise ValueError('R10 eight-thousand-frame baseline files changed or incomplete')
        a,b,mismatches=preflight(args.reference,args.candidate,args.frames)
        if base['r10_exe_sha256'] == base['r11_exe_sha256']:
            raise ValueError('Same executable supplied twice; no native promotion can be proven')
        if base['rom_sha256'] != '0838e531fe22c077528febe14cb3ff7c492f1f5fa8de354192bdff7137c27f5b':
            raise ValueError('ROM is not the captured SMW image')
        if base['replay_sha256'] != 'eab575db6cb6991bda5f941e3960655c5b61e3c0b547b687fedc75d2b282fc5a':
            raise ValueError('Replay identity differs from R10 capture')
        if base['r10_exe_sha256'] != '22b424ad6df132791f323b02ed61455231bf181a95ef792bbfed186ad9798cad':
            raise ValueError('R10 baseline executable hash mismatch')
        if a['qa']['rom']!='4d7bc08f726d10cb':
            raise ValueError('Unexpected SNES ROM fingerprint')
        result=audit(a,b,args.min_saving)
        result['frame_hash_mismatch_count']=len(mismatches)
        result['first_frame_hash_mismatch']=mismatches[0] if mismatches else None
        if mismatches:
            result['status']='FAIL'
            result['differences'].append(f'Frame-level image/WRAM/PC mismatch at {mismatches[0]}')
        base.update(result)
    except (ValueError,OSError) as e:
        base.update(status='FAIL',error=str(e))
    args.result.parent.mkdir(parents=True,exist_ok=True)
    args.result.write_text(json.dumps(base,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(base,indent=2),flush=True)
    return 0 if base['status']=='PASS' else 1

if __name__=='__main__':sys.exit(main())
