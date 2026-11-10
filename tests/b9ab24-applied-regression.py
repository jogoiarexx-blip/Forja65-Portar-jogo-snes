#!/usr/bin/env python3
"""Guard focused ROM evidence independently of runtime success claims."""
from pathlib import Path
import json
r=Path(__file__).resolve().parents[1]/'reports/validation-crossfeed-0396/b9ab24-applied'
a=json.loads((r/'integration-report.json').read_text())
p=json.loads((r/'b9ab24-rom-proof.json').read_text())
f=json.loads((r/'b9ab24-observed-flow.json').read_text())
assert a['entry']==p['entry']=='B9AB24' and a['rom_sha256']==p['rom']['sha256']==f['rom_sha256']
assert a['new_dispatch_rows']==10 and a['new_instruction_sites']==5 and a['preserved_existing_sites']==36
assert not a['dry_run'] and a['proof_level'].startswith('ROM opcode match')
assert p['rom_opcode_mismatches']==0 and p['unique_rom_opcodes']==41
assert f['instruction']=='JMP ($0042)' and f['runtime_verified']
assert not f['semantic_equivalence_proven']
print('PASS Forja B9:AB24 applied integration; runtime equivalence separate')
