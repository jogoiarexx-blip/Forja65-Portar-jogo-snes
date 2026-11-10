#!/usr/bin/env python3
"""Fail-closed circuit progression grader for SNES port runs.

Rank is a *manual visual observation* backed by a retained HUD screenshot.
Five observed laps without a ranked result never count as qualification.
"""
import argparse,json,sys
from pathlib import Path

def grade(run,rank=None,evidence=None):
    laps=bool(run.get('completed_laps')) and int(run.get('max_lap_observed',-1))>=5
    path=Path(evidence) if evidence else None
    image_present=bool(path and path.is_file() and path.suffix.lower() in ('.ppm','.png','.jpg','.jpeg'))
    out={'five_laps_observed':laps,'rank_manual':rank,'rank_hud_screenshot':str(path) if path else None,
         'evidence_exists':image_present,'qualified_top4':False,'status':'NOT_FINISHED'}
    if laps:
        out['status']='FINISHED_RANK_UNVERIFIED'
        if rank is not None:
            if rank<1 or rank>8:raise ValueError('rank must be 1..8')
            if not image_present:raise ValueError('rank observation requires a retained screenshot')
            out['qualified_top4']=rank<=4
            out['status']='QUALIFIED' if rank<=4 else 'FINISHED_UNQUALIFIED'
    return out

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--report',required=True);ap.add_argument('--rank',type=int)
    ap.add_argument('--hud-evidence');ap.add_argument('--out',required=True)
    a=ap.parse_args()
    source=Path(a.report)
    result=grade(json.loads(source.read_text()),a.rank,a.hud_evidence)
    result['source']=str(source)
    target=Path(a.out);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
    print(result['status'],'qualified_top4='+str(result['qualified_top4']))
    return 0 if result['status']=='QUALIFIED' else 6
if __name__=='__main__':sys.exit(main())
