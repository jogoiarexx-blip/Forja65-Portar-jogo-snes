#!/usr/bin/env python3
"""Extract actual CPU rival racing lines from an existing cold replay.

This is offline QA; observes RAM and never modifies game RAM/progress. CPU
reference trajectories are reusable for deterministic input-only pilots.
"""
import argparse, bisect, json, hashlib
from pathlib import Path
from portemu import PortEmu
from smk_pilot import Racer

def trace_events(path):
    events=[]
    for line in Path(path).read_text().splitlines():
        if line.startswith('frame='):
            parts=dict(i.split('=',1) for i in line.split())
            events.append((int(parts['frame']),int(parts['joy1'],16)))
    return events

def main():
    p=argparse.ArgumentParser();p.add_argument('--game',required=True);p.add_argument('--assets',required=True)
    p.add_argument('--trace',required=True);p.add_argument('--out',required=True)
    p.add_argument('--start',type=int,default=9400);p.add_argument('--end',type=int,default=16000)
    p.add_argument('--step',type=int,default=12)
    a=p.parse_args(); events=trace_events(a.trace); frames=[f for f,_ in events]; routes={str(k):{} for k in range(1,8)}
    e=PortEmu(game=a.game,assets=a.assets)
    try:
        e.trace(a.trace,a.start)
        for frame in range(a.start,a.end+1,a.step):
            i=bisect.bisect_right(frames,e.frame())-1
            mask=events[i][1] if i>=0 else 0
            remaining=frame-e.frame()
            while remaining>0:
                next_f=events[i+1][0] if i+1<len(events) else frame
                n=min(remaining, max(1,next_f-e.frame()))
                e.run(n,mask)
                remaining=frame-e.frame()
                i=bisect.bisect_right(frames,e.frame())-1
                mask=events[i][1] if i>=0 else 0
            memory=e.ram(0x1000,0x800)
            for k in range(1,8):
                r=Racer.parse(memory,k)
                if 0<=r.lap<=3:
                    routes[str(k)].setdefault(str(r.lap),[]).append([r.x,r.y,r.checkpoints,frame])
            if (frame-a.start)%(a.step*50)==0:
                print(f'scout frame={frame}: '+ ' '.join(f'k{k}:{Racer.parse(memory,k).lap}' for k in range(1,8)), flush=True)
        out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps({'source':'native input-only replay','frame_window':[a.start,a.end],
            'sample_step':a.step,'cart_data_sha256': hashlib.sha256((Path(a.assets)/'cart-data.bin').read_bytes()).hexdigest(),'routes':routes},indent=1)+'\n',encoding='utf8')
        for k,ls in routes.items():
            print(k,' '.join(f'lap{lap}={len(samples)}pts frame={samples[0][3]}..{samples[-1][3]}' for lap,samples in ls.items()))
    finally:e.close()
if __name__=='__main__':main()
