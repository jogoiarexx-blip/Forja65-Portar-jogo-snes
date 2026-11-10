#!/usr/bin/env python3
from pathlib import Path
import importlib.util

p=Path(__file__).resolve().parents[1]/'tools'/'audit_indexed_jmp_rom.py'
spec=importlib.util.spec_from_file_location('audit_indexed_jmp_rom',p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
rom=bytearray(0x400000)
base=0x369F47
rom[base:base+3]=b'\x7c\x4a\x9f'
rom[0x369F4A:0x369F4E]=b'\x52\x9f\x5b\x9f'
rom[0x369F52]=0xBB
rom[0x369F5B]=0x20
rows=m.audit(rom,0xB69F47,[0,2])['routes']
assert [r['target'] for r in rows]==['B69F52','B69F5B']
# Odd indices are possible; a static analyzer must not make up an evenness rule.
odd_rom=bytearray(rom);odd_rom[0x369F4B]=0x90;odd_rom[0x369F4C]=0x90
assert m.audit(odd_rom,0xB69F47,[1])['routes'][0]['target']=='B69090'
for bad_rom,bad_pc,bad_idx in [(rom,0xB69F47,[0x10000]),(rom,0xB69F48,[0])]:
    try:m.audit(bad_rom,bad_pc,bad_idx);assert False
    except ValueError:pass
bad=bytearray(rom);bad[base]=0xEA
try:m.audit(bad,0xB69F47,[0]);assert False
except ValueError:pass
print('FORJA65_INDEXED_JMP_AUDIT_PASS cases=5')
