#!/usr/bin/env python3
"""Reproduce ROM-bound native CPU specializations from immutable analysis + profiles."""
import argparse, pathlib, subprocess, sys
p=argparse.ArgumentParser(description=__doc__)
p.add_argument('--port',type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[1])
p.add_argument('--node',default='node')
p.add_argument('--cpu-profile',action='append',default=[])
p.add_argument('--strict-hints',action='append',default=[])
a=p.parse_args();port=a.port.resolve();base=port/'reports/v0.60/generation-inputs';analysis=port/'analysis/legacy-observed-aot.json'
cmd=[a.node,str(port/'tools/export-legacy-observed-analysis.js'),'--port',str(port),'--base-analysis',str(base/'legacy-observed-base-analysis.json'),'--out',str(analysis)]
for option,values in [('--cpu-profile',a.cpu_profile),('--strict-hints',a.strict_hints)]:
 for value in values:cmd.extend([option,str(pathlib.Path(value).resolve())])
subprocess.run(cmd,check=True)
subprocess.run([sys.executable,str(port/'tools/compile-legacy-observed-aot.py'),'--port',str(port),'--analysis',str(analysis),'--baseline-dir',str(base),'--native-unit-count','43'],check=True)
