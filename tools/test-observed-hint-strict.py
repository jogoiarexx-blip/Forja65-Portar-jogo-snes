#!/usr/bin/env python3
"""Smoke regression for strict, ROM-bound observed CFG evidence."""
import importlib.util
from pathlib import Path
modpath = Path(__file__).with_name('advance-observed-target.py')
spec = importlib.util.spec_from_file_location('observed_target', modpath)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
valid = 'rom=2f095d162726b5ea target=c2088d from=c042ef kind=FLOW e=0 m=0 x=0 c=1 observed=1'
assert module.observation(valid+'\n', 'C2088D') == (valid, '2f095d162726b5ea')
invalid = [
    valid.replace(' observed=1', ''),
    valid.replace('c=1', 'c=2'),
    valid.replace('from=c042ef ', ''),
    valid.replace('kind=FLOW', 'kind=UNKNOWN'),
    valid+' bogus=1',
    valid.replace('target=c2088d', 'target=ffffff'),
    valid+'\n'+valid,
]
for raw in invalid:
    try:
        module.observation(raw, 'C2088D')
    except ValueError:
        continue
    raise AssertionError(f'Accepted malformed or unverified observation: {raw}')
print('PASS: strict observed CFG hint parser validates source, target, ROM, CPU flags and provenance')
