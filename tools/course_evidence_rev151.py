#!/usr/bin/env python3
"""REV151 fail-closed reproducible race/course transition evidence audit.

This checks bytes and causal ordering, not the semantic truth of an image label.
Human inspection is explicitly required; a pass is NEVER image recognition.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from trace_timeline_rev152 import validate_trace


def _file(root, spec, desc):
    if not isinstance(spec, dict):
        raise ValueError(f'{desc}: missing path/hash object')
    name, expected = spec.get('path'), spec.get('sha256')
    if not isinstance(name, str) or not name or not isinstance(expected, str) or len(expected) != 64:
        raise ValueError(f'{desc}: invalid path or SHA-256')
    p = (root / name).resolve()
    if not p.is_relative_to(root.resolve()):
        raise ValueError(f'{desc}: path escapes evidence directory')
    if not p.is_file():
        raise ValueError(f'{desc}: evidence missing: {name}')
    with p.open('rb') as fh:
        actual = hashlib.file_digest(fh, 'sha256').hexdigest()
    if actual.lower() != expected.lower():
        raise ValueError(f'{desc}: altered content (SHA-256 mismatch)')
    return actual


def check(payload, root):
    root=Path(root).resolve()
    finish=payload.get('finish',{})
    next_race=payload.get('next_race',{})
    out={'status':'NOT_APPROVED','qualified':False,'course_changed':False,
         'image_semantics':'Requires independent human visual review'}
    try:
        if not isinstance(finish.get('lap'),int) or finish['lap']<5:
            raise ValueError('five laps not evidenced')
        rank=finish.get('rank')
        if type(rank) is not int or not 1<=rank<=8:
            raise ValueError('rank not verified as an integer between 1 and 8')
        fframe,nframe=finish.get('frame'),next_race.get('frame')
        if type(fframe) is not int or type(nframe) is not int or nframe<=fframe:
            raise ValueError('nonmonotonic race frames')
        fcourse,ncourse=finish.get('course_id'),next_race.get('course_id')
        if not isinstance(fcourse,str) or not fcourse.strip() or not isinstance(ncourse,str) or not ncourse.strip():
            raise ValueError('course IDs missing')
        fhash=_file(root,finish.get('screenshot'),'finish screenshot')
        scoreboard=_file(root,finish.get('official_result_screenshot'),'official race result scoreboard')
        if scoreboard==fhash:
            raise ValueError('scoreboard and finish screenshots must be different')
        nhash=_file(root,next_race.get('screenshot'),'new race screenshot')
        _file(root,payload.get('input_trace'),'full input trace')
        # A valid SHA-256 alone does not prove the recorded commands are
        # replayable. Reject impossible frame ordering and malformed masks.
        trace_path=(root/payload['input_trace']['path']).resolve()
        out['trace_timeline']=validate_trace(trace_path,race_frame=fframe)
        if fhash==nhash:
            raise ValueError('same screenshot supplied for both courses')
        if rank>4:
            out['status']='FINISHED_NOT_QUALIFIED';return out
        out['qualified']=True
        if fcourse==ncourse:
            out['status']='SAME_COURSE_RESTART';return out
        review=next_race.get('visual_review')
        if not isinstance(review,dict) or review.get('confirmed') is not True or not str(review.get('basis','')).strip():
            out['status']='VISUAL_REVIEW_MISSING';return out
        if payload.get('cold_replay_verified') is not True:
            out['status']='INDEPENDENT_REPLAY_MISSING';return out
        out['course_changed']=True
        out['status']='TRANSITION_EVIDENCE_INTEGRITY_OK'
        out['note']='This verifies the evidence files; the human supplied course labels and review remain a separate assertion.'
        return out
    except (ValueError,OSError) as exc:
        out['status']='INVALID_EVIDENCE';out['detail']=str(exc)
        return out


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('manifest',type=Path)
    p.add_argument('--root',type=Path)
    p.add_argument('--out',type=Path)
    a=p.parse_args()
    result=check(json.loads(a.manifest.read_text()),a.root or a.manifest.parent)
    print(json.dumps(result,indent=2))
    if a.out:
        a.out.parent.mkdir(parents=True,exist_ok=True)
        a.out.write_text(json.dumps(result,indent=2)+'\n')
    return 0 if result['course_changed'] else 3
if __name__=='__main__':raise SystemExit(main())
