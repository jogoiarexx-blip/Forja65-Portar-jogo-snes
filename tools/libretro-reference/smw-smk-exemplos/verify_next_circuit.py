#!/usr/bin/env python3
"""Verify that finishing two SMK tracks really loads a third race, no WRAM edits."""
import argparse,json,sys
from pathlib import Path
from portemu import PortEmu
from smk_pilot import Racer, B

def main():
    a=argparse.ArgumentParser();a.add_argument('--game',required=True);a.add_argument('--assets',required=True);a.add_argument('--trace',required=True);a.add_argument('--out',required=True)
    args=a.parse_args();out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    report={'race1_replay':'input trace','race2_rank':3,'race3_started':False,'observations':[]}
    e=PortEmu(game=args.game,assets=args.assets)
    try:
        e.trace(args.trace,18000)
        p=Racer.parse(e.ram(0x1000,0x800));print('SECOND FINISH',e.frame(),'lap',p.lap,flush=True)
        report['initial_frame']=e.frame()
        e.shot(str(out/'01-finish-stage2.ppm'))
        seen_lap5=p.lap>=5
        prior=(p.x,p.y)
        for i in range(65):
            e.run(4,B);e.run(100,0)
            buf=e.ram(0x1000,0x800);p=Racer.parse(buf)
            row={'frame':e.frame(),'lap':p.lap,'checkpoints':p.checkpoints,'x':p.x,'y':p.y}
            report['observations'].append(row)
            if i%3==0:print('advance',row,flush=True)
            if seen_lap5 and p.lap<=1 and (p.x,p.y)!=prior:
                e.run(120,0);next_p=Racer.parse(e.ram(0x1000,0x800))
                report['third_race_snapshot']={'frame':e.frame(),'lap':next_p.lap,'x':next_p.x,'y':next_p.y}
                e.shot(str(out/'02-third-race.ppm'))
                report['race3_started']=True
                print('THIRD RACE STARTED',report['third_race_snapshot'],flush=True)
                break
        if not report['race3_started']:
            report['failure']='Did not observe new active race or lap reset after qualification'
        return 0 if report['race3_started'] else 5
    finally:
        (out/'third-race-verification.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
        e.close()
if __name__=='__main__':raise SystemExit(main())
