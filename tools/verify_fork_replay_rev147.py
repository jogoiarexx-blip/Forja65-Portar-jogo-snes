#!/usr/bin/env python3
"""Prove native fork checkpoint restore by replaying identical inputs twice.

Evidence: same frame, same selected WRAM, same framebuffer bytes after restore;
optional divergent controls are diagnostic only. No implication of level completion.
"""
import argparse, hashlib, json
from pathlib import Path
from datetime import datetime, timezone
from native_control_client_rev147 import PortEmu

def sha(blob):return hashlib.sha256(blob).hexdigest()

def measure(em, out, tag, frames, mask):
    em.run(frames,mask)
    frame=em.frame()
    raw=em.ram(0,0x20000)
    shot=out/(tag+'.ppm')
    em.shot(str(shot))
    return {'frame':frame,'wram_sha256':sha(raw),'framebuffer_sha256':sha(shot.read_bytes())}

def check(game,assets,out,initial,follow,mask):
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    status={'schema':'forja65.fork-replay.rev147','created_utc':datetime.now(timezone.utc).isoformat(),
            'description':'deterministic fork and restore, not gameplay completion','status':'INCOMPLETE'}
    e=PortEmu(game=game,assets=assets)
    try:
        e.run(initial,0)
        status['snapshot_frame']=e.frame()
        e.save('rev147')
        before=measure(e,out,'before_restore',follow,mask)
        e.load('rev147')
        status['restored_frame']=e.frame()
        after=measure(e,out,'after_restore',follow,mask)
        status['before'],status['after']=before,after
        status['status']='PASS' if before==after and status['restored_frame']==status['snapshot_frame'] else 'FAIL'
        return status
    finally:
        e.close()
        (out/'fork-replay-report.json').write_text(json.dumps(status,indent=2)+'\n')

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    for k in ['game','assets','out']:ap.add_argument('--'+k,required=True)
    ap.add_argument('--initial',type=int,default=120)
    ap.add_argument('--follow',type=int,default=90)
    ap.add_argument('--mask',type=lambda v:int(v,0),default=0x8000)
    a=ap.parse_args()
    if a.initial<1 or a.follow<1:ap.error('frame counts must be positive')
    record=check(a.game,a.assets,a.out,a.initial,a.follow,a.mask)
    print(json.dumps(record,indent=2));return 0 if record['status']=='PASS' else 5
if __name__=='__main__':raise SystemExit(main())
