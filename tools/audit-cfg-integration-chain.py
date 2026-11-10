#!/usr/bin/env python3
"""Audit an ordered chain of ROM-proven CFG integrations against an updated port.

Checks structural provenance, monotonically growing dispatch and on-disk source
hashes. Static assurance only; successful replay and gameplay require separate tests.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ROW = re.compile(r'^\{0x([0-9A-F]{6})u,', re.M)
TABLE = re.compile(r'static const(?:expr)?\s+Forja65DispatchEntry\s+kForja65Dispatch\[\]\s*=\s*\{(.*?)\n\};', re.S)
TARGET = re.compile(r'^[0-9A-F]{6}$')

def audit(project: Path, reports: list[Path]) -> dict:
    if not reports:
        raise ValueError('At least one report required')
    rom_file = project / 'assets/cart-data.bin'
    disp_file = project / 'src/dispatch.cpp'
    if not rom_file.is_file() or not disp_file.is_file():
        raise ValueError('Project ROM or dispatcher missing')
    romhash = hashlib.sha256(rom_file.read_bytes()).hexdigest()
    seen = set()
    prior = None
    stages = []
    for rp in reports:
        data = json.loads(rp.read_text(encoding='utf-8'))
        entry = data.get('entry')
        if not isinstance(entry, str) or not TARGET.fullmatch(entry) or entry in seen:
            raise ValueError('Invalid or duplicated CFG entry')
        seen.add(entry)
        if data.get('rom_sha256') != romhash or data.get('state_domain_overlap') != 0:
            raise ValueError(f'ROM identity or state ownership failed at {entry}')
        if data.get('dry_run') is not False:
            raise ValueError(f'Not an applied integration at {entry}')
        before, added = data.get('previous_dispatch_rows'), data.get('new_dispatch_rows')
        if not isinstance(before,int) or not isinstance(added,int) or added<=0:
            raise ValueError(f'Invalid dispatcher counts at {entry}')
        if prior is not None and before != prior:
            raise ValueError(f'Dispatcher discontinuity at {entry}: {before} != {prior}')
        prior = before+added
        srcname = data.get('source_file','')
        if not re.fullmatch(r'src/forja_[a-z0-9_]+\.cpp', srcname):
            raise ValueError(f'Unsafe source name at {entry}')
        src = project/srcname
        if not src.is_file() or hashlib.sha256(src.read_bytes()).hexdigest() != data.get('integrated_source_sha256'):
            raise ValueError(f'Changed/missing integrated handler {entry}')
        if data.get('new_instruction_sites',-1)<0:
            raise ValueError('Invalid instruction site count')
        stages.append({'entry':entry,'new_rows':added,'new_sites':data['new_instruction_sites'],'row_total':prior})
    table = TABLE.search(disp_file.read_text(encoding='utf-8'))
    if not table:
        raise ValueError('Forja65 dispatcher table not located')
    rows = len(ROW.findall(table.group(1)))
    if rows != prior:
        raise ValueError(f'Dispatcher count differs from integrated chain: {rows} != {prior}')
    return {'schema':'forja65.cfg-integration-chain.v1', 'verified':True,
            'rom_sha256':romhash,'integrations':len(stages),'new_rows':sum(s['new_rows'] for s in stages),
            'new_sites':sum(s['new_sites'] for s in stages),'dispatch_rows':rows,
            'stages':stages,
            'proof_scope':'ROM identity, integrated handler hashes, ordered dispatch row totals; not CPU/gameplay equivalence'}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project',required=True,type=Path)
    p.add_argument('--reports',required=True,nargs='+',type=Path)
    p.add_argument('--output',type=Path)
    args=p.parse_args()
    try:
        result=audit(args.project,args.reports)
    except (ValueError,OSError,KeyError,json.JSONDecodeError) as e:
        p.exit(2,'CFG integration chain REJECTED: '+str(e)+'\n')
    rendered=json.dumps(result,indent=2)+'\n'
    if args.output: args.output.write_text(rendered,encoding='utf-8')
    print(rendered,end='')
if __name__=='__main__': main()
