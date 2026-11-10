#!/usr/bin/env python3
"""Do not mark a ROM-proven indirect target as functionally integrated."""
from pathlib import Path
import json
base=Path(__file__).resolve().parents[1]/'reports/validation-crossfeed-0396/bed8e7-integrated'
p=json.loads((base/'b9ab24-integration-preview.json').read_text())
f=json.loads((base/'b9ab24-observed-flow.json').read_text())
r=json.loads((base/'b9ab24-rom-proof.json').read_text())
assert p['entry']==r['entry']=='B9AB24' and p['dry_run'] and p['compile_and_replay_verified'] is False
assert p['new_instruction_sites']==5 and p['preserved_existing_sites']==36 and p['new_dispatch_rows']==10
assert r['rom_opcode_mismatches']==0 and r['rom']['sha256']==f['rom_sha256']
assert f['instruction']=='JMP ($0042)' and f['target_source'].startswith('runtime CPU')
assert f['runtime_verified'] and not f['semantic_equivalence_proven']
print('PASS Forja65 B9:AB24 preliminary integration remains unapplied')
