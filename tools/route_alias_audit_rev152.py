#!/usr/bin/env python3
"""REV152: flag geometrically adjacent but logically distant sections of WRAM race routes.

Generic gameplay diagnostic for Forja65 ports. This does not assert route semantics
or classify race outcomes; games must supply checkpoint annotations.
"""
from __future__ import annotations
import argparse,json,math
from pathlib import Path

def detect(route, progress, *, distance_limit=65, checkpoint_separation=5, sample_separation=30, max_examples=12):
    if len(route)!=len(progress) or len(route)<30:raise ValueError('route/progress samples missing or mismatched')
    if any(len(p)!=2 for p in route):raise ValueError('route requires x/y pairs')
    warnings=[];count=0
    for i,(x,y) in enumerate(route):
        for j in range(i+sample_separation,len(route)):
            # Closed routes join their final and initial samples. Do not
            # count that legitimate adjacency as an alias/shortcut.
            if len(route)-(j-i)<sample_separation:continue
            if abs(float(progress[i])-float(progress[j]))<checkpoint_separation:continue
            x2,y2=route[j];dx=((int(x)-int(x2)+32768)&65535)-32768
            dy=((int(y)-int(y2)+32768)&65535)-32768
            distance=math.hypot(dx,dy)
            if distance<=distance_limit:
                count+=1
                if len(warnings)<max_examples:warnings.append({'first_index':i,'second_index':j,'distance':round(distance,2),
                    'first_checkpoint':round(float(progress[i]),2),'second_checkpoint':round(float(progress[j]),2)})
    return {'status':'AMBIGUOUS_ROUTE' if count else 'NO_ALIAS_DETECTED','ambiguous_pairs':count,
            'route_points':len(route),'examples':warnings,'policy':'geometric proximity alone cannot establish circuit progress'}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('route_json',type=Path)
    ap.add_argument('--checkpoint-map',type=Path,help='JSON array of per-point checkpoint progress')
    ap.add_argument('--out',type=Path)
    a=ap.parse_args();line=json.loads(a.route_json.read_text())
    if a.checkpoint_map is None:ap.error('--checkpoint-map is required; source-specific interpretation belongs in each port')
    cp=json.loads(a.checkpoint_map.read_text())
    result=detect(line['route'],cp)
    print(json.dumps(result,indent=2))
    if a.out:
        a.out.parent.mkdir(parents=True,exist_ok=True)
        a.out.write_text(json.dumps(result,indent=2)+'\n')
if __name__=='__main__':main()
