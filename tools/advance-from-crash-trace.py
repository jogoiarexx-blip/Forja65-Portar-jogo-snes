#!/usr/bin/env python3
"""Select a unique *observed* Forja65 CFG hint using a CPU crash trace.

The crash trace alone has no target address: require exactly one matching
runtime-hint source and state. Avoid blindly inferring a target from ROM bytes.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys

CPU_LINE=re.compile(r'^([0-9a-f]{6})\s+A=',re.I)
HINT_LINE=re.compile(
    r'^rom=([0-9a-f]{16}) target=([0-9a-f]{6}) from=([0-9a-f]{6}) '
    r'kind=(FLOW|JMP|JUMP|CALL|JSL|JML|JSR) e=([01]) m=([01]) x=([01]) c=([01])(?: observed=1)?$', re.I)

def select(crash_text, hint_text):
    if not re.search(r'^reason=unresolved-flow\s*$',crash_text,re.M):
        raise ValueError('Crash trace must record reason=unresolved-flow')
    instructions=[m.group(1).lower() for line in crash_text.splitlines() if (m:=CPU_LINE.match(line))]
    if not instructions:
        raise ValueError('Missing CPU instruction trace')
    from_pc=instructions[-1]
    matches={line.strip() for line in hint_text.splitlines()
             if (m:=HINT_LINE.fullmatch(line.strip())) and m.group(3).lower()==from_pc}
    if len(matches)!=1:
        raise ValueError(f'Require exactly one ROM-bound observed target at last PC {from_pc}; found {len(matches)}')
    line=next(iter(matches))
    m=HINT_LINE.fullmatch(line)
    assert m is not None
    if not line.endswith('observed=1'):line+=' observed=1'
    return line,m.group(2).upper()

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for name in ('project','rom','trace','hints','out'):
        p.add_argument('--'+name,type=Path,required=True)
    p.add_argument('--forja',type=Path,default=Path(__file__).resolve().parent.parent)
    p.add_argument('--max-sites',type=int,default=8192)
    p.add_argument('--apply',action='store_true')
    p.add_argument('--preserve-existing',action='store_true')
    args=p.parse_args()
    try:
        line,target=select(args.trace.read_text(encoding='utf8'),args.hints.read_text(encoding='utf8'))
        out=args.out.resolve()
        out.mkdir(parents=True,exist_ok=True)
        hint_file=out/'selected-observation.txt'
        hint_file.write_text(line+'\n',encoding='utf8')
        cmd=[sys.executable,str(args.forja/'tools/advance-observed-target.py'),
             '--forja',str(args.forja),'--rom',str(args.rom),'--project',str(args.project),
             '--hint',str(hint_file),'--out',str(out/'generated-integration'),
             '--target',target,'--max-sites',str(args.max_sites)]
        if args.apply:cmd.append('--apply')
        if args.preserve_existing:cmd.append('--preserve-existing')
        status=subprocess.run(cmd,check=False).returncode
        if status:raise ValueError('ROM-proof or conflict guardrails refused integration')
        print(json.dumps({'observed_target':target,'selected_observation':line,'applied':args.apply}))
    except (OSError,ValueError) as e:
        p.exit(2,'Trace-based integration refused: '+str(e)+'\n')

if __name__=='__main__':main()
