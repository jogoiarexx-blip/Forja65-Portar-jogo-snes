#!/usr/bin/env python3
"""Fail-closed source audit to catch stale MDMA/HDMA runtime in SNES PC ports.

This is a structural integration gate, not evidence of cycle accuracy or gameplay.
Usage: python tools/verify-port-runtime-rev124.py path/to/src/runtime.hpp
"""
import argparse
import json
from pathlib import Path
import re

CHECKS = {
    'MDMA execution state': r'\bdmaExecuting\b',
    'HDMA channel cancellation mask': r'\bdmaCancelledByHdma\b',
    'HDMA preemption helper': r'void\s+preemptDmaChannelsForHdma\s*\(',
    'HDMA line calls preemption': r'void\s+executeHdmaLine\s*\([^)]*\)\s*\{[\s\S]{0,200}?preemptDmaChannelsForHdma\s*\(',
    'MDMA payload checks cancel mask': r'for\s*\(\s*std::uint32_t\s+k\s*=\s*0\s*;\s*k\s*<\s*count\s*&&\s*!\s*\(\s*dmaCancelledByHdma',
    'DAS guard on indirect preemption': r'if\s*\(\s*!\s*\(\s*dmaCancelledByHdma\s*&\s*\(\s*1u\s*<<\s*ch\s*\)\s*\)\s*\|\|\s*!\s*\(\s*d\.dmap\s*&\s*0x40u\s*\)\s*\)',
}

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('runtime',type=Path)
    ap.add_argument('--json',action='store_true')
    args=ap.parse_args()
    source=args.runtime.read_text(encoding='utf8')
    checks={name:bool(re.search(regex,source)) for name,regex in CHECKS.items()}
    if args.json:print(json.dumps({'path':str(args.runtime),'structurally_compliant':all(checks.values()),'checks':checks},indent=2))
    else:
        for name,ok in checks.items():print(('PASS' if ok else 'FAIL'),name)
        print('STRUCTURAL_GATE', 'PASS' if all(checks.values()) else 'FAIL')
    raise SystemExit(0 if all(checks.values()) else 1)

if __name__=='__main__':main()
