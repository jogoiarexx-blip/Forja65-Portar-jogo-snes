#!/usr/bin/env python3
"""Reproducible per-address 65C816 writer capture for two isolated replays.

Do not patch WRAM, score or level. Requires a previously built local port binary.
"""
import argparse
import csv
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from wram_snapshot_ab_v19 import parse_qa

HEAD=['frame','address','old','new','writer_pc','bus','joy1','nmi']
SCHEMA='forja65.wram.targeted-writers/2'

def plan(report):
    if report.get('schema')!='forja65.wram.structure-triage/2':raise ValueError('need v2.2 structure report')
    x=report.get('new_targeted_writer_plan',{})
    addrs=x.get('addresses')
    if not isinstance(addrs,list) or not 1<=len(addrs)<=256 or len(set(addrs))!=len(addrs):
        raise ValueError('invalid targeted list')
    for addr in addrs:
        if not isinstance(addr,str) or len(addr)!=6 or not all(c in '0123456789ABCDEF' for c in addr) or not 0x7e0000<=int(addr,16)<=0x7fffff:
            raise ValueError('invalid target WRAM address')
    first,last,cap=x['frames_start'],x['frames_end'],x['max_records']
    if not 0<=first<=last or not 1<=cap<=1000000:raise ValueError('invalid capture window/cap')
    return {'schema':SCHEMA,'addresses':addrs,'start_frame':first,'end_frame':last,'cap':cap,
            'require_changes_only':True,'independent_replays':True}

def validate_capture(folder,conf,frames):
    qa=parse_qa(folder)
    if int(qa['frames'])<frames:raise ValueError('incomplete QA frames')
    src=folder/'writers.csv'
    if not src.is_file():raise ValueError('writer CSV is missing; cannot assert no writes')
    n=0;last=-1;pcs=Counter();addr_counts=Counter()
    with src.open(newline='',encoding='utf-8-sig') as stream:
        r=csv.DictReader(stream)
        if r.fieldnames!=HEAD:raise ValueError('bad writer CSV header')
        for row in r:
            n+=1
            f=int(row['frame'])
            addr=row['address'].upper().zfill(6)
            pc=row['writer_pc'].upper().zfill(6)
            old,new=int(row['old']),int(row['new'])
            if f<last or not conf['start_frame']<=f<=conf['end_frame']:
                raise ValueError('nonmonotonic/out-of-window writer frame')
            if addr not in conf['addresses'] or not 0<=old<=255 or not 0<=new<=255 or old==new:
                raise ValueError('unexpected address/value or idempotent write')
            if row['bus'] not in ('bus','2180') or len(pc)!=6 or any(c not in '0123456789ABCDEF' for c in pc):
                raise ValueError('malformed PC/bus')
            last=f;pcs[pc]+=1;addr_counts[addr]+=1
    if n>=conf['cap']:raise ValueError('WRAM write trace cap reached: evidence may be truncated')
    if n==0:raise ValueError('empty targeted writer trace; no claim of absent writer')
    return {'rows_validated':n,'last_writer_frame':last,'writer_pcs':dict(pcs),
            'target_counts':dict(addr_counts),'csv_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),
            'qa_rom_fingerprint':qa['rom']}

def run(binary,root,conf,baseline_trace,attack_trace,frames,timeout,out):
    if frames<=conf['end_frame'] or timeout<=0:raise ValueError('insufficient frames/timeout')
    if not binary.is_file():raise ValueError('portable port binary not found')
    if not (root/'assets/cart-data.bin').is_file():raise ValueError('missing cartridge data')
    results={}
    for mode,trace in (('baseline',baseline_trace),('attack',attack_trace)):
        if not trace.is_file():raise ValueError(f'missing input replay: {trace}')
        folder=out/mode;folder.mkdir(parents=True,exist_ok=True)
        (folder/'assets').mkdir(exist_ok=True)
        shutil.copy2(root/'assets/cart-data.bin',folder/'assets/cart-data.bin')
        (folder/'writers.csv').unlink(missing_ok=True)
        (folder/'forja65-qa-status.txt').unlink(missing_ok=True)
        env={k:v for k,v in os.environ.items() if not k.startswith('FORJA65_WRAM_')}
        env.update(FORJA65_HEADLESS='1',FORJA65_HEADLESS_FRAMES=str(frames),
           FORJA65_CPU_INTERPRETER='1',FORJA65_INPUT_REPLAY=str(trace.resolve()),
           FORJA65_WRAM_WRITE_CSV=str((folder/'writers.csv').resolve()),
           FORJA65_WRAM_WRITE_ADDRS=','.join(conf['addresses']),
           FORJA65_WRAM_WRITE_START=str(conf['start_frame']),
           FORJA65_WRAM_WRITE_END=str(conf['end_frame']),
           FORJA65_WRAM_WRITE_MAX=str(conf['cap']),
           FORJA65_WRAM_WRITE_CHANGES_ONLY='1')
        try:
            result=subprocess.run([str(binary.resolve())],cwd=folder,env=env,
                    stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            raise ValueError(f'{mode}: execution timeout, no validated writer report') from exc
        (folder/'run.log').write_bytes(result.stdout)
        if result.returncode:raise ValueError(f'{mode}: process exit={result.returncode}')
        results[mode]=validate_capture(folder,conf,frames)
    if results['baseline']['qa_rom_fingerprint']!=results['attack']['qa_rom_fingerprint']:
        raise ValueError('ROM mismatch between writer traces')
    return {'schema':SCHEMA,'status':'COMPLETE_TARGETED_WRITER_TRACES',
            'config':conf,'replays':results,
            'validated':{'writer_traces':True,'collision':False,'score':False,'board_clear':False,'stage':False},
            'warning':'Observed writer PCs are not gameplay-rule oracle.'}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--triage',type=Path,required=True)
    ap.add_argument('--binary',type=Path)
    ap.add_argument('--baseline-trace',type=Path)
    ap.add_argument('--attack-trace',type=Path)
    ap.add_argument('--frames',type=int,default=2230)
    ap.add_argument('--timeout',type=int,default=1200)
    ap.add_argument('--out',type=Path,default=Path('reports/bust-a-move/rev136-v22/targeted-writers'))
    ap.add_argument('--dry-run',action='store_true',help='export validated target plan without running binary')
    args=ap.parse_args()
    try:
        conf=plan(json.loads(args.triage.read_text(encoding='utf-8')))
        if args.dry_run:result={'status':'PLAN_ONLY_NOT_EXECUTED',**conf}
        else:
            if not all((args.binary,args.baseline_trace,args.attack_trace)):
                raise ValueError('binary and both traces required for execution')
            root=Path(__file__).resolve().parents[1]
            result=run(args.binary,root,conf,args.baseline_trace,args.attack_trace,args.frames,args.timeout,args.out)
        args.out.mkdir(parents=True,exist_ok=True)
        (args.out/'capture-status.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'status':result['status'],'addresses':len(conf['addresses'])},indent=2))
        return 0
    except (OSError,ValueError,TypeError,KeyError,json.JSONDecodeError) as exc:
        print('NOT_VALIDATED:',exc,file=sys.stderr);return 2
if __name__=='__main__':raise SystemExit(main())
