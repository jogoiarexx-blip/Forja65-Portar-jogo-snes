#!/usr/bin/env python3
"""Forja65 REV154: audit real CPU interpreter fallback hot spots.

Entry counts are NOT instruction counts. Classify exact dispatch variants without
assuming ROM mirrors are uncovered; compare actual interpreter instruction totals.
"""
import argparse
import collections
import json
from pathlib import Path
import re

ENTRY = re.compile(r'^([0-9a-fA-F]{6})\s+(E1|M[01]X[01])\s+from=([0-9a-fA-F]{6})\s+count=(\d+)$')
NATIVE = re.compile(r'^\{0x([0-9A-Fa-f]+)u,(true|false),(true|false),(true|false),(true|false),(true|false),&sub_[A-Za-z0-9_]+,0x[0-9a-fA-F]+u\},$', re.M)

def parse_interpreter(text):
    if not text.startswith('FORJA65_CPU_INTERPRETER 1\n'):
        raise ValueError('Unrecognized interpreter report')
    values = dict(re.findall(r'^(blocks|instructions)=(\d+)\s*$', text, re.M))
    if set(values) != {'blocks','instructions'}:
        raise ValueError('Report missing blocks or instructions')
    entries = []
    for lineno, line in enumerate(text.splitlines(), 1):
        if not line or line[0] == '#' or '=' in line and (line.startswith('blocks=') or line.startswith('instructions=')) or line == 'FORJA65_CPU_INTERPRETER 1':
            continue
        m = ENTRY.fullmatch(line.strip())
        if not m:
            raise ValueError(f'Malformed interpreter entry at line {lineno}: {line[:80]}')
        pc, state, source, count = m.groups()
        entries.append({'pc': pc.upper(), 'state': state, 'from': source.upper(), 'count': int(count)})
    return {'blocks': int(values['blocks']), 'instructions': int(values['instructions']), 'entries': entries}

def parse_dispatch(text):
    native = collections.defaultdict(set)
    for pc,e,m,x,carry_known,carry in NATIVE.findall(text):
        key = ('E1' if e == 'true' else f'M{int(m == "true")}X{int(x == "true")}')
        native[f'{int(pc, 16):06X}'].add(key)
    return native

def parse_qa(text):
    result = {}
    for line in text.splitlines():
        if '=' in line and not line.startswith('#'):
            k,v = line.split('=',1)
            result[k] = v
    return result

def build_report(interpreter, dispatch, qa=None, limit=20):
    agg = collections.defaultdict(lambda: {'entries':0, 'dispatches':0, 'sources': set()})
    for row in interpreter['entries']:
        key=(row['pc'],row['state']); item=agg[key]
        item['entries'] += 1
        item['dispatches'] += row['count']
        item['sources'].add(row['from'])
    ranked=[]
    for (pc,state), v in sorted(agg.items(),key=lambda kv:(-kv[1]['dispatches'],kv[0])):
        possibilities=dispatch.get(pc,set())
        status='exact_native_state' if state in possibilities else ('exact_pc_state_missing' if possibilities else 'no_exact_pc_or_possible_alias')
        ranked.append({'pc':pc,'state':state,'dispatches':v['dispatches'],'entry_sources':len(v['sources']),'native_exact_state': status,'available_states':sorted(possibilities)})
    result={'schema':'forja65.cpu-fallback-hotspots.rev154',
      'interpreter_blocks':interpreter['blocks'],'interpreter_instructions':interpreter['instructions'],
      'fallback_dispatches_reported':sum(x['count'] for x in interpreter['entries']),
      'unique_sites':len(agg), 'hotspots':ranked[:limit], 'total_ranked_sites':len(ranked),
      'interpretation_note':'dispatch counts are entry frequency, not executed instructions; native_exact_state does not model ROM alias or carry.'}
    if qa:
        total=int(qa['instructions'])
        interp=interpreter['instructions']
        if total < interp: raise ValueError('Interpreter instructions exceed total CPU instructions')
        result['total_cpu_instructions']=total
        result['native_share_percent']=round((total-interp)*100/total,4) if total else None
        result['interpreted_share_percent']=round(interp*100/total,4) if total else None
        result['frames']=int(qa.get('frames','0'))
    return result

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--interpreter',required=True)
    ap.add_argument('--dispatch',required=True)
    ap.add_argument('--qa')
    ap.add_argument('--out',required=True)
    ap.add_argument('--limit',type=int,default=30)
    args=ap.parse_args()
    rep=build_report(parse_interpreter(Path(args.interpreter).read_text()),parse_dispatch(Path(args.dispatch).read_text()),parse_qa(Path(args.qa).read_text()) if args.qa else None,args.limit)
    Path(args.out).parent.mkdir(parents=True,exist_ok=True)
    Path(args.out).write_text(json.dumps(rep,indent=2,ensure_ascii=False)+'\n')
    print('hotspots=',rep['total_ranked_sites'],'interpreter_instructions=',rep['interpreter_instructions'],'native_share=',rep.get('native_share_percent'))
if __name__=='__main__': main()
