#!/usr/bin/env python3
"""Unit checks for strict ROM-bound focused-observation parsing."""
import importlib.util
from pathlib import Path
p=Path(__file__).resolve().parent.parent/'tools/advance-observed-target.py'
s=importlib.util.spec_from_file_location('focus_observed_target',p)
m=importlib.util.module_from_spec(s)
s.loader.exec_module(m)
hint='rom=3a574807afbad761 target=B89001 from=B88304 kind=FLOW e=0 m=0 x=0 c=0 observed=1'
assert m.observation(hint,'B89001') == (hint, '3a574807afbad761')
for bad in [hint+'\n'+hint, hint.replace('observed=1','observed=0'),
            hint.replace('target=B89001','target=B80000'),hint.replace('3a574807afbad761','foobar')]:
    try: m.observation(bad,'B89001')
    except ValueError: pass
    else: raise AssertionError('Invalid observation accepted: '+bad)
print('FOCUSED_OBSERVED_TARGET_PASS (wrong ROM/target/unobserved/multiple hints rejected)')

# A focused observation deeper in a large ROM must not be silently excluded by
# the old default budget of 512 instruction sites.
assert m.analysis_limits(8192) == (8192, 8192)
assert m.analysis_limits(20000) == (20000, 20000)
assert m.analysis_limits(512, 8192) == (512, 8192)
for max_sites, cache_limit in [(8193,8192),(0,None),(50001,None),(512,50100)]:
    try: m.analysis_limits(max_sites, cache_limit)
    except ValueError: pass
    else: raise AssertionError('Invalid focus/cache budget accepted')
print('FOCUSED_CFG_BUDGET_PASS (large observed targets and cache ceilings)')
