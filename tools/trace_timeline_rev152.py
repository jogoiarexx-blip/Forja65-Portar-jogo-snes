#!/usr/bin/env python3
"""REV152: fail-closed controller trace validation for causal replay manifests.

Validates event ordering and masks; does NOT prove any gameplay outcome.
"""
from pathlib import Path
import re

_EVENT=re.compile(r'frame=(\d+)\s+joy1=([0-9a-fA-F]{4})\s+joy2=([0-9a-fA-F]{4})\Z')

def validate_trace(path, *, race_frame=None, max_events=2_000_000):
    if race_frame is not None and (type(race_frame) is not int or race_frame<0):
        raise ValueError('invalid race frame')
    n=0;last=-1;before_finish=False;first=None
    try:
        stream=Path(path).open('rt',encoding='utf-8')
        with stream:
            for lineno,raw in enumerate(stream,1):
                line=raw.strip()
                if not line or line.startswith('#'):continue
                hit=_EVENT.fullmatch(line)
                if not hit:raise ValueError(f'malformed controller event on line {lineno}')
                frame=int(hit.group(1))
                if frame<=last:raise ValueError(f'out-of-order or repeated event at frame {frame}')
                if frame>100_000_000:raise ValueError('implausible frame value')
                last=frame;n+=1
                if n>max_events:raise ValueError('controller event limit exceeded')
                if first is None:first=frame
                if race_frame is not None and frame<=race_frame:before_finish=True
    except (UnicodeError,PermissionError) as exc:
        raise ValueError(f'cannot read input trace: {exc}') from exc
    if n==0:raise ValueError('no controller events')
    if race_frame is not None and not before_finish:
        raise ValueError('no input event before recorded finish')
    return {'event_count':n,'first_frame':first,'last_frame':last,'strictly_increasing':True}

if __name__=='__main__':
    import argparse, json
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('trace',type=Path)
    ap.add_argument('--finish-frame',type=int)
    ap.add_argument('--out',type=Path)
    args=ap.parse_args()
    try:
        info=validate_trace(args.trace,race_frame=args.finish_frame)
        status={'status':'TRACE_TIMELINE_PASS',**info}
    except (ValueError,OSError) as ex:
        status={'status':'TRACE_TIMELINE_INVALID','reason':str(ex)}
    print(json.dumps(status,indent=2))
    if args.out:
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(json.dumps(status,indent=2)+'\n')
    raise SystemExit(0 if status['status']=='TRACE_TIMELINE_PASS' else 3)
