#!/usr/bin/env python3
"""Forja65 REV154: strict deterministic differential CPU coverage gate."""
import argparse, json
from pathlib import Path

# Import the sibling coverage parser; both tools are portable and stdlib-only.
from cpu_fallback_hotspots_rev154 import parse_interpreter,parse_qa

MUST_MATCH = ('rom','frames','instructions','framebuffer_hash','wram_hash','nmi_services','irq_services')

def compare(base_qa,base_interp,new_qa,new_interp):
    missing=[k for k in MUST_MATCH if k not in base_qa or k not in new_qa]
    if missing: raise ValueError('Missing deterministic QA fields: '+','.join(missing))
    divergent=[k for k in MUST_MATCH if base_qa[k]!=new_qa[k]]
    before=base_interp['instructions'];after=new_interp['instructions']
    total=int(base_qa['instructions'])
    if before>total or after>total: raise ValueError('Invalid interpreter/CPU totals')
    return {
      'schema':'forja65.cpu-native-differential.rev154',
      'pass':not divergent and after<=before,
      'deterministic_fields':{k:base_qa[k] for k in MUST_MATCH},
      'mismatches':{k:{'before':base_qa[k],'after':new_qa[k]} for k in divergent},
      'frames':int(base_qa['frames']),
      'total_cpu_instructions':total,
      'interpreted_before':before,'interpreted_after':after,
      'interpreted_reduction':before-after,
      'interpreted_reduction_percent':round((before-after)*100/before,4) if before else None,
      'native_share_before':round((total-before)*100/total,4) if total else None,
      'native_share_after':round((total-after)*100/total,4) if total else None,
      'fallback_blocks_before':base_interp['blocks'],
      'fallback_blocks_after':new_interp['blocks'],
      'note':'PASS proves equality of selected final QA fields only; not per-frame parity or full game coverage.'
    }

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--old',required=True,help='directory containing QA and interpreter reports')
    ap.add_argument('--new',required=True)
    ap.add_argument('--out',required=True)
    a=ap.parse_args()
    def read(d):
        p=Path(d)
        return parse_qa((p/'forja65-qa-status.txt').read_text()),parse_interpreter((p/'forja65-cpu-interpreter.txt').read_text())
    report=compare(*read(a.old),*read(a.new))
    Path(a.out).parent.mkdir(parents=True,exist_ok=True)
    Path(a.out).write_text(json.dumps(report,indent=2)+'\n')
    print('PASS' if report['pass'] else 'FAIL',report['interpreted_reduction_percent'],'% reduction')
    if not report['pass']:raise SystemExit(2)
if __name__=='__main__':main()
