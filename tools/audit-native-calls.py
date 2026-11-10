#!/usr/bin/env python3
"""Static preflight for *direct* calls from newly integrated SNES handlers.

A nonzero exit indicates a direct ROM call from generated C++ lacks an exact
entry in native dispatch. A pass is NOT execution or gameplay proof.
"""
import argparse
import json
import re
import sys
from pathlib import Path

CALL = re.compile(r'//\s*\$([0-9a-f]{6})\s+(JSR|JSL|JMP|JML)\s*->\s*\$([0-9a-f]{6})\b', re.I)
DISPATCH_ROW = re.compile(r'^\s*\{\s*0x([0-9a-f]{6})u\s*,[^\n]*&sub_[a-z0-9_]+\s*,', re.I | re.M)


def audit(source: str, dispatch: str) -> dict:
    compiled = {int(h, 16) for h in DISPATCH_ROW.findall(dispatch)}
    calls = sorted({(int(src, 16), kind.upper(), int(dst, 16))
                    for src, kind, dst in CALL.findall(source)})
    missing = [{'source': f'{src:06X}', 'operation': kind, 'target': f'{dst:06X}'}
               for src, kind, dst in calls if dst not in compiled]
    return {'schema': 'forja65.native-call-preflight.v1',
            'direct_calls': len(calls), 'dispatcher_entries': len(compiled),
            'missing_direct_targets': missing, 'passed': not missing,
            'scope': 'Direct static calls only; does not analyze indirect jumps, state equivalence or gameplay'}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project', required=True, type=Path)
    p.add_argument('--source-unit', required=True)
    p.add_argument('--report', type=Path)
    a = p.parse_args()
    if not re.fullmatch(r'forja_[a-z0-9_]+\.cpp', a.source_unit):
        p.error('Unsafe source unit name')
    src = a.project/'src'/a.source_unit
    dispatcher = a.project/'src'/'dispatch.cpp'
    if not src.is_file() or not dispatcher.is_file():
        p.error('Missing generated source or dispatcher')
    result = audit(src.read_text(encoding='utf-8'), dispatcher.read_text(encoding='utf-8'))
    result['source_unit'] = a.source_unit
    if a.report:
        a.report.parent.mkdir(parents=True, exist_ok=True)
        a.report.write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(result, indent=2))
    return 0 if result['passed'] else 2


if __name__ == '__main__':
    sys.exit(main())
