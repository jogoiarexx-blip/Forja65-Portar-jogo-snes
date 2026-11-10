#!/usr/bin/env python3
"""R12 8k proof: SHA-locked R11 baseline, exact per-frame/PCM parity, zero CPU fallback.

Never treat matching final hashes alone as validation; compare every captured frame.
Saved reference is not rerun. CPU instruction accounting must reconcile exactly.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from rev174_r8_cpu_aot_gate import audit, digest, numeric
from rev174_r11_eightk_parity import preflight, proof_file_digests

R11_PROOFS = {'forja65-qa-status.txt': '826fa2689421329b79902a0956d9c86684bc047c15f725e33b3b138bfe31b7d9', 'forja65-native-dependency-report.txt': '732b085b127f4864e0673f1434ccb17ae88bd457db9cf84947d40fc2d78facd1', 'forja65-audio-report.txt': 'f5c887f0119a202f5666a940a93530292a90a745c52f8d17091dad01860aa252', 'forja65-native-audio.wav': '30208c2eae398ebbe092afce22d589d35852e7661b0cf8beda26dfa86de3c8ba', 'forja65-frame-hashes.txt': 'badf251a8d119d1639dc339148d936ce8748d7e184c5eab6ca14577fbd4272f6', 'forja65-cpu-interpreter.txt': '93516d9a619d42da07c57d56007486c4746a842d90cc5dfa98486f37e1001e27'}
ROM_SHA256 = '0838e531fe22c077528febe14cb3ff7c492f1f5fa8de354192bdff7137c27f5b'
REPLAY_SHA256 = 'eab575db6cb6991bda5f941e3960655c5b61e3c0b547b687fedc75d2b282fc5a'
R11_EXE_SHA256 = 'afacd42da1717cf1c12d79170946115b8d523abfcd7c76a57344e098e1afdb47'

def assert_native(candidate):
    d=candidate['dep']
    interpreted=numeric(d,'cpu_interpreter_instructions')
    if interpreted!=0: raise ValueError(f'R12 CPU still interpreted {interpreted} instructions')
    if d.get('CPU_AOT')!='YES' or d.get('CPU_FULLY_NATIVE')!='YES':
        raise ValueError('CPU native-mode flags do not confirm AOT without fallback')
    if numeric(d,'cpu_aot_instructions')!=numeric(d,'instructions'):
        raise ValueError('CPU AOT instruction count does not equal total')

def compare(reference,candidate,oldexe,newexe,rom,trace,frames=8000):
    paths = [reference,candidate,oldexe,newexe,rom,trace]
    if not all(p.exists() for p in paths): raise ValueError('Required source/evidence missing')
    if proof_file_digests(reference)!=R11_PROOFS:
        raise ValueError('R11 evidence is incomplete or its SHA-256 does not match')
    if digest(oldexe)!=R11_EXE_SHA256:raise ValueError('R11 reference executable identity mismatch')
    if digest(oldexe)==digest(newexe):raise ValueError('Same executable used twice')
    if digest(rom)!=ROM_SHA256 or digest(trace)!=REPLAY_SHA256:
        raise ValueError('Wrong ROM or replay')
    a,b,changed=preflight(reference,candidate,frames)
    ret=audit(a,b,1)
    ret['frame_hash_mismatch_count']=len(changed)
    ret['first_mismatched_frame']=changed[0] if changed else None
    if changed:
        ret['status']='FAIL'
        ret['differences'].append('Per-frame WRAM/image/PC mismatch')
    try: assert_native(b)
    except ValueError as e:
        ret['status']='FAIL';ret['differences'].append(str(e))
    ret.update(schema='forja65.r12.zero-cpu-fallback.v1',reference='R11 saved evidence (not rerun)',
        rom_sha256=digest(rom),replay_sha256=digest(trace),
        r11_executable_sha256=digest(oldexe),r12_executable_sha256=digest(newexe),
        r11_evidence_sha256=proof_file_digests(reference),r12_evidence_sha256=proof_file_digests(candidate))
    return ret

def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    for k in ('reference','candidate','r11-bin','r12-bin','rom','replay','result'):
        p.add_argument('--'+k,required=True,type=Path)
    p.add_argument('--frames',type=int,default=8000)
    args=p.parse_args(argv)
    resultfile=args.result.resolve()
    try:
        if args.frames<1:raise ValueError('Invalid frame count')
        result=compare(args.reference.resolve(),args.candidate.resolve(),args.r11_bin.resolve(),
                       args.r12_bin.resolve(),args.rom.resolve(),args.replay.resolve(),args.frames)
    except (OSError, ValueError) as e:
        result={'schema':'forja65.r12.zero-cpu-fallback.v1','status':'FAIL','error':str(e)}
    resultfile.parent.mkdir(parents=True,exist_ok=True)
    resultfile.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(result,indent=2,ensure_ascii=False))
    return 0 if result.get('status')=='PASS' else 1

if __name__=='__main__':sys.exit(main())
