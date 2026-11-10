#!/usr/bin/env python3
"""REV148: deterministic input-sequence checkpoint audit.

Tests the *same* multi-input sequence before/after restoration, not only one
held button. The optional negative control reports whether changing a button
produces any observable WRAM/framebuffer difference; no divergence is not a
failure (some controls are ignored in menus). This cannot prove race progress.
"""
import argparse, hashlib, json
from pathlib import Path
from datetime import datetime, timezone
from native_control_client_rev147 import PortEmu

def sha(blob):return hashlib.sha256(blob).hexdigest()

def parse_sequence(s):
    events=[]
    for raw in s.split(','):
        pair=raw.strip().split(':')
        if len(pair)!=2:raise ValueError('expected frames:mask,frames:mask')
        frames=int(pair[0]);mask=int(pair[1],0)
        if frames<1 or not 0<=mask<=0xffff:raise ValueError('positive frames / 16-bit mask required')
        events.append((frames,mask))
    if not events:raise ValueError('empty sequence')
    return events

def measure(e,seq,out,tag):
    for frames,mask in seq:e.run(frames,mask)
    frame=e.frame(); w=e.ram(0,0x20000)
    file=out/(tag+'.ppm');e.shot(str(file))
    return {'frame':frame,'wram_sha256':sha(w),'framebuffer_sha256':sha(file.read_bytes()),'image':file.name}

def check(game,assets,out,initial,sequence,negative_control=False,trace=None):
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    status={'schema':'forja65.fork-multi.rev148','created_utc':datetime.now(timezone.utc).isoformat(),
            'meaning':'CPU/PPU state determinism only; no race qualification',
            'test_inputs':sequence,'status':'INCOMPLETE','witness':[],
            'bootstrap':'replay' if trace else 'idle',
            'bootstrap_trace_sha256':sha(Path(trace).read_bytes()) if trace else None}
    e=PortEmu(game=game,assets=assets)
    try:
        (e.trace(trace,initial) if trace else e.run(initial,0));at=e.frame();e.save('rev148')
        for i in range(3):
            if i:e.load('rev148')
            if e.frame()!=at:raise AssertionError('restored at wrong frame')
            mem_start=sha(e.ram(0,0x20000));
            w=measure(e,sequence,out,f'pass-{i}')
            status['witness'].append({'restored_frame':at,'initial_wram_sha256':mem_start,**w})
        eq=lambda w:(w['frame'],w['wram_sha256'],w['framebuffer_sha256'],w['initial_wram_sha256'])
        status['status']='PASS' if len(set(map(eq,status['witness'])))==1 else 'FAIL'
        if negative_control:
            e.load('rev148')
            altered=list(sequence)
            n,mask=altered[0];altered[0]=(n,mask^0x8000)
            status['negative_control']={'sequence':altered,**measure(e,altered,out,'negative-control')}
            status['negative_control']['diverged']=any(status['negative_control'][k]!=status['witness'][0][k]
                                                       for k in ('wram_sha256','framebuffer_sha256'))
        return status
    finally:
        e.close();(out/'fork-multi-report.json').write_text(json.dumps(status,indent=2)+'\n')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for x in ('game','assets','out'):p.add_argument('--'+x,required=True)
    p.add_argument('--initial',type=int,default=120)
    p.add_argument('--sequence',default='30:0x8000,30:0x8200,30:0x8000')
    p.add_argument('--negative-control',action='store_true')
    p.add_argument('--trace',help='use verified full input trace to reach --initial before snapshot')
    args=p.parse_args()
    if args.initial<1:p.error('--initial must be positive')
    sequence=parse_sequence(args.sequence)
    report=check(args.game,args.assets,args.out,args.initial,sequence,args.negative_control,args.trace)
    print(json.dumps(report,indent=2));return 0 if report['status']=='PASS' else 4
if __name__=='__main__':raise SystemExit(main())
