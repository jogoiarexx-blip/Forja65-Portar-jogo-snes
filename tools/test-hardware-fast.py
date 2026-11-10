#!/usr/bin/env python3
"""Directed regression battery; run tools/test.js and Python regressions for the full suite."""
import os, pathlib, subprocess, sys, time
root=pathlib.Path(__file__).resolve().parents[1]
node=os.environ.get('NODE','node')
tests=[('CPU RMW bus','rmw-bus-order-v043622-regression.js'),('CPU block move','blockmove-v043621-regression.js'),('CPU arithmetic','arithmetic-decimal-v043620-regression.js'),('CPU generated branch','arithmetic-generated-v043620-regression.js'),('CPU stack','stack-boundary-v043619-regression.js'),('CFG stack cache','stack-cache-v043619-regression.js'),('CPU','cpu-generated-differential-v043618-regression.js'),('CPU/PPU/DMA','hardware-differential-v043618-regression.js'),('PPU','dkc3-bg-obj-provenance-v04362-regression.js'),('CFG cache','hardware-cache-v043618-regression.js'),('CFG overlap','integrate-generated-cfg-v0396-regression.py'),('trace/replay','hardware-event-compare-v043618-regression.py')]
failures=[]
for domain,name in tests:
 start=time.monotonic();print(f'[{domain}] {name}',flush=True)
 result=subprocess.run([sys.executable if name.endswith('.py') else node,str(root/'tests'/name)],cwd=root)
 print(f'{"PASS" if result.returncode==0 else "FAIL"} {time.monotonic()-start:.2f}s',flush=True)
 if result.returncode:failures.append(name)
print(f'{len(tests)-len(failures)}/{len(tests)} passed')
sys.exit(bool(failures))
