#!/usr/bin/env python3
"""Guard the observed BE:D8E7 target; never mistake opcode match for gameplay proof."""
import hashlib,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tools'))
from importlib.machinery import SourceFileLoader
mod=SourceFileLoader('advance','%s'% (root/'tools/advance-observed-target.py')).load_module()
hint='rom=3a574807afbad761 target=BED8E7 from=BED42E kind=FLOW e=0 m=0 x=0 c=0 observed=1'
line,ident=mod.observation(hint+'\n','BED8E7')
assert line==hint and ident=='3a574807afbad761'
for bad in ('rom=wrong target=BED8E7 observed=1',hint.replace('observed=1','observed=0'), hint+'\n'+hint):
    try:mod.observation(bad,'BED8E7')
    except ValueError: pass
    else:raise AssertionError('Accepted invalid or multiple observations')
base=root/'reports/validation-crossfeed-0396/bed8e7-integrated'
proof=json.loads((base/'bed8e7-rom-proof.json').read_text())
report=json.loads((base/'integration-report.json').read_text())
assert proof['rom_opcode_mismatches']==0 and proof['entry']=='BED8E7'
assert proof['rom']['sha256']==report['rom_sha256']
assert report['new_dispatch_rows']==30 and report['new_instruction_sites']==14 and not report['dry_run']
assert report['proof_level'].startswith('ROM opcode match')
assert report['compile_and_replay_verified'] is False
assert 'sub_BB8567_E0M0X0CQ' in report['ignored_non_target_functions']
print('PASS Forja65 BE:D8E7 observed target provenance and guardrails')
