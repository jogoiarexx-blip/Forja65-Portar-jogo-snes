#!/usr/bin/env python3
"""B9/BE target crossfeed: provenance metadata and ABI-safe generated variants.

This validates that focused BE:D99E translation is the one recorded in the
ROM proof. The target port's build/replay are independently required.
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
preview = ROOT/'reports/validation-crossfeed-0396/bed99e-preview'
applied = ROOT/'reports/validation-crossfeed-0396/bed99e-integrated'
p = json.loads((applied/'bed99e-rom-proof.json').read_text())
a = json.loads((applied/'integration-report.json').read_text())
code = (preview/'generated/src'/a['generated_shard']).read_bytes()
assert hashlib.sha256(code).hexdigest() == p['code_sha256'] == a['generated_cpp_sha256']
assert p['rom']['sha256'] == a['rom_sha256'] == a['source_rom_sha256']
assert p['entry'] == a['entry'] == 'BED99E'
assert p['rom_opcode_mismatches'] == 0
assert p['unique_rom_opcodes'] == a['new_instruction_sites'] == 11
assert p['total_emitted_opcode_traces'] == a['new_dispatch_rows'] == 22
assert a['previous_dispatch_rows'] == 113053
assert a['address_overlap'] == 0 and not a['dry_run']
assert a['variants'] == ['sub_BED99E_E0M0X0C0', 'sub_BED99E_E0M0X0CQ']
assert set(re.findall(rb'^void (sub_BED99E_[A-Za-z0-9_]+)\(', code, re.M)) == {v.encode() for v in a['variants']}
assert not a['compile_and_replay_verified'], 'Static integration report must not assert runtime behavior'
print('FORJA65_BED99E_PROVENANCE_PASS: 11 ROM opcodes, 22 traces, applied safely')
