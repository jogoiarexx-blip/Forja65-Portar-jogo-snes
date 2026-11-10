#!/usr/bin/env python3
"""Independent, fail-closed SMK two-track grading.

An observed lap counter is NOT proof of classification. Ranking requires an
explicit HUD/WRAM observation bound to a retained screenshot, and cold replay
integrity is separately reported. This script never writes game memory.
"""
import argparse
from pathlib import Path
import json


def grade(report, rank=None, evidence=None, replay=None):
    finished = bool(report.get('race2_completed')) and int(report.get('completed_laps', -1)) >= 5
    result={'five_laps':finished,'rank_observed':rank,'classified_top4':False,
            'replay_exists':bool(replay and Path(replay).is_file()),
            'evidence_exists':bool(evidence and Path(evidence).is_file()),
            'status':'NO_COMPLETION'}
    if finished:
        result['status']='LAPS_ONLY_UNVERIFIED_RANK'
        if rank is not None:
            if not 1<=rank<=8:raise ValueError('observed race rank must be 1..8')
            if not result['evidence_exists']:raise ValueError('a rank needs a saved HUD screenshot')
            result['status']='QUALIFIED' if rank<=4 else 'FINISHED_UNQUALIFIED'
            result['classified_top4']=rank<=4
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--report',required=True);p.add_argument('--observed-rank',type=int)
    p.add_argument('--hud-evidence');p.add_argument('--replay');p.add_argument('--out',required=True)
    a=p.parse_args();source=json.loads(Path(a.report).read_text(encoding='utf8'))
    result=grade(source,a.observed_rank,a.hud_evidence,a.replay)
    result['report_source']=str(a.report)
    result['rank_evidence']=a.hud_evidence or None
    out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print(json.dumps(result,ensure_ascii=False))
    return 0 if result['status']=='QUALIFIED' else 1

if __name__=='__main__':raise SystemExit(main())
