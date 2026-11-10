#!/usr/bin/env python3
"""Regression: ROM aliases must accompany newly integrated dispatcher sites."""
import importlib.util
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'tools/integrate-generated-cfg.py'
spec=importlib.util.spec_from_file_location('integrate_aliases',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
old='''static const Forja65AliasEntry kForja65Aliases[]={
{0x3EC8E0u,0xBEC8E0u},
{0x3ED2FEu,0xBED2FEu},
};'''
new='''static const Forja65AliasEntry kForja65Aliases[]={
{0x3EC8C8u,0xBEC8C8u},
{0x3EC8CBu,0xBEC8CBu},
{0x3EC8E0u,0xBEC8E0u},
{0x3ED2FEu,0xBED2FEu},
};'''
r,n=m.merge_rom_aliases(old,new,{0xBEC8C8,0xBEC8CB})
assert n==2 and '{0x3EC8C8u,0xBEC8C8u}' in r
assert r.index('{0x3EC8C8u') < r.index('{0x3EC8CBu') < r.index('{0x3EC8E0u')
assert m.merge_rom_aliases(r,new,{0xBEC8C8,0xBEC8CB})==(r,0)
assert m.merge_rom_aliases(old,new,{0xBED2FE})==(old,0)
try: m.merge_rom_aliases(old,new.replace('{0x3EC8CBu,0xBEC8CBu},','not-a-valid-row'),{0xBEC8C8})
except ValueError: pass
else: raise AssertionError('garbled alias table accepted')
try: m.merge_rom_aliases(old,new.replace('{0x3EC8CBu,0xBEC8CBu},','{0x3EC8C8u,0xBEC8CBu},'),{0xBEC8C8,0xBEC8CB})
except ValueError: pass
else: raise AssertionError('conflicting alias owner accepted')
print('ROM_ALIAS_INTEGRATION_PASS additions=2 duplicate_prevention=1 old_owners_preserved=1 rejection=2')
