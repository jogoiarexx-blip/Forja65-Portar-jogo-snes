#!/usr/bin/env python3
"""REV153 generic fail-closed audit of fork-based controller sector searches.

Verifies experiment provenance, deterministic checkpoint-selection reports and
monotone progress. Never infers race rank or a stage transition from checkpoint
counts. Hardware scores must not be changed on this evidence alone.
"""
from __future__ import annotations
import argparse,hashlib,json,re
from pathlib import Path

HEX64=re.compile(r'[0-9a-f]{64}\Z')

def audit(data,trace_path=None):
    errors=[]
    for k in ('rom_sha256','source_trace_sha256','start_wram_sha256'):
        if not HEX64.fullmatch(str(data.get(k,''))):errors.append(f'missing/invalid {k}')
    segs=data.get('segments')
    if not isinstance(segs,list) or not segs:errors.append('no observed checkpoint segments');segs=[]
    previous_frame=None;previous_progress=None
    for ix,s in enumerate(segs):
        if s.get('n')!=ix:errors.append(f'segment {ix}: index mismatch')
        try:
            start=int(s['start_progress']);goal=int(s['goal']);end=int(s['progress']);frame=int(s['frame'])
            if any(type(s[k]) is not int for k in ('start_progress','goal','progress','frame')):raise ValueError('noninteger progress')
        except (ValueError,KeyError,TypeError):errors.append(f'segment {ix}: malformed progress');continue
        if goal<=start or start<0 or end<start or end>170:errors.append(f'segment {ix}: implausible progress')
        if previous_progress is not None and start!=previous_progress:errors.append(f'segment {ix}: discontinuous progress')
        if previous_frame is not None and frame<=previous_frame:errors.append(f'segment {ix}: nonmonotonic frame')
        if s.get('target_met') is not (end>=goal):errors.append(f'segment {ix}: inconsistent target result')
        if end<goal and ix!=len(segs)-1:errors.append(f'segment {ix}: subsequent segment after stalled attempt')
        if end>=170 and any(p.get('lap',5)<5 for p in s.get('trials',[]) if p.get('progress',0)>=170):
            errors.append(f'segment {ix}: progress 170 without observed lap 5')
        trials=s.get('trials')
        if not isinstance(trials,list) or not trials:errors.append(f'segment {ix}: no branch trials');continue
        try:
            def score(p):return (not p['target_met'],-p['progress'],p['frames'],p['rejected_shortcuts'])
            if any(type(p['target_met']) is not bool or p['frames']<=0 or p['ahead']<1 or p['ahead']>50
                   or p['rejected_shortcuts']<0 or p['progress']<start or p['progress']>170 for p in trials):
                errors.append(f'segment {ix}: invalid trial metrics')
            chosen=min(trials,key=score)
            if s.get('ahead')!=chosen['ahead'] or frame!=chosen['frame'] or end!=chosen['progress']:
                errors.append(f'segment {ix}: selected branch does not match shortest replayed checkpoint path')
            if any(p['target_met']!=(p['progress']>=goal) for p in trials):errors.append(f'segment {ix}: trial target inconsistent')
        except (KeyError,TypeError,ValueError):errors.append(f'segment {ix}: malformed trial records')
        previous_progress=end;previous_frame=frame
    if 'finish_frame' in data and segs and data['finish_frame']!=segs[-1].get('frame'):
        errors.append('finish frame does not match final checkpoint segment')
    if data.get('five_laps_observed') and data.get('end_racer',{}).get('lap',-1)<5:errors.append('five laps not confirmed by recorded WRAM')
    if trace_path is not None:
        p=Path(trace_path)
        if not p.is_file():errors.append('replay missing')
        else:
            sha=hashlib.sha256(p.read_bytes()).hexdigest()
            if data.get('trace_sha256')!=sha:errors.append('replay SHA-256 mismatch')
            try:
                from trace_timeline_rev152 import validate_trace
                validate_trace(p,race_frame=data.get('finish_frame'))
            except (ValueError,OSError) as exc:errors.append('invalid input timeline: '+str(exc))
    status='SEARCH_EVIDENCE_VALID' if not errors else 'SEARCH_EVIDENCE_INVALID'
    return {'status':status,'segment_count':len(segs),'five_laps_observed':bool(data.get('five_laps_observed',False)),
            'classification':'UNVERIFIED','hardware_regression':'NOT_TESTED','errors':errors}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('report');ap.add_argument('--trace');ap.add_argument('--out')
    a=ap.parse_args()
    try:
        data=json.loads(Path(a.report).read_text())
        res=audit(data,a.trace)
    except (OSError,ValueError,TypeError) as exc:res={'status':'SEARCH_EVIDENCE_INVALID','errors':[str(exc)]}
    print(json.dumps(res,indent=2))
    if a.out:Path(a.out).write_text(json.dumps(res,indent=2)+'\n')
    return 0 if res['status']=='SEARCH_EVIDENCE_VALID' else 3
if __name__=='__main__':raise SystemExit(main())
