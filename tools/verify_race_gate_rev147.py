#!/usr/bin/env python3
"""Fail-closed advancement gate: a lap reset is NOT proof of a new track.

Inputs are observations supplied by a game-specific probe. The tool itself
cannot certify the truth of the observations; retain source screenshots and
independent reproduction for that purpose.
"""
import argparse, json
from pathlib import Path

def validate(data):
    f=data.get('finish',{});p=data.get('post_finish',{})
    laps=int(f.get('laps',-1));rank=f.get('rank')
    out={'qualified':False,'stage_advanced':False,'status':'MISSING_EVIDENCE',
         'note':'Game-specific state + independently reviewed screenshots required.'}
    if laps<5:
        out['status']='FIVE_LAPS_NOT_PROVEN';return out
    if rank is None:
        out['status']='RANK_UNVERIFIED';return out
    if not isinstance(rank,int) or not 1<=rank<=8:
        raise ValueError('rank must be integer 1..8')
    if rank>4:
        out['status']='FINISHED_NOT_QUALIFIED';return out
    out['qualified']=True
    # Placement is necessary, not sufficient. Need a new course ID and a real
    # post-transition observation; a reset within the SAME course is RESTART.
    prev=f.get('course_id');nxt=p.get('course_id')
    if prev is None or nxt is None:
        out['status']='COURSE_IDS_MISSING';return out
    if prev==nxt:
        out['status']='SAME_COURSE_RESTART_OR_RETRY';return out
    if int(p.get('frame',-1))<=int(f.get('frame',-1)):
        out['status']='NONMONOTONIC_OBSERVATION';return out
    if not p.get('screenshot_verified'):
        out['status']='NEXT_COURSE_VISUAL_NOT_VERIFIED';return out
    out['stage_advanced']=True;out['status']='COURSE_CHANGED_PER_OBSERVATION'
    return out

def main():
    pa=argparse.ArgumentParser(description=__doc__)
    pa.add_argument('observations',type=Path);pa.add_argument('--out',type=Path)
    a=pa.parse_args();v=validate(json.loads(a.observations.read_text()))
    if a.out:a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(v,indent=2)+'\n')
    print(json.dumps(v,indent=2));return 0 if v['stage_advanced'] else 3
if __name__=='__main__':raise SystemExit(main())
