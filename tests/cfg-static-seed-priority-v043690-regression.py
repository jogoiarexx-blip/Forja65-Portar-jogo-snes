#!/usr/bin/env python3
"""Static seed provenance + 65816 JSR/JSL limits regression."""
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('mod',Path(__file__).resolve().parents[1]/'tools/expand-static-direct-calls.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
checks=0
def good(condition,label):
 global checks
 assert condition,label
 checks+=1
# HiROM full bank: $C0:8120 -> offset $008120
rom=bytearray(0x20000)
rom[0x8120:0x8124]=bytes([0x22,0x34,0x92,0xC0])
rom[0x8130:0x8133]=bytes([0x20,0x50,0x93])
good(mod.validate_call(rom,0xC08120,0xC09234,'JSL','HiROM'),'valid JSL')
good(mod.validate_call(rom,0xC08130,0xC09350,'JSR','HiROM'),'valid JSR')
good(not mod.validate_call(rom,0xC08120,0xC09235,'JSL','HiROM'),'reject wrong target')
good(not mod.validate_call(rom,0xC08130,0xC09350,'JSL','HiROM'),'reject wrong type')
good(not mod.validate_call(rom,0x7E8120,0xC09234,'JSL','HiROM'),'reject WRAM')
good(not mod.validate_call(rom,0x808120,0xC09234,'JSL','LoROM'),'reject wrong ROM map')
a={'functions':[{'start':0xC08100,'calls':[{'from':0xC08120,'target':0xC09234,'kind':'JSL','state':{'emulation':False,'m8':True,'x8':False,'carry':True}}, {'from':0xC08130,'target':0xC09350,'kind':'JSR','state':{'emulation':False,'m8':False,'x8':False,'carry':False}}, {'from':0xC08130,'target':0xC09351,'kind':'JMP-TABLE','state':{}}]}]}
selected,rejected,verified,total=mod.collect(a,rom,'HiROM',2,3,0xC08100)
good(verified==2 and total==2 and not rejected,'accept ROM-backed direct only')
good(set(x['target'] for x in selected)=={'C09234','C09350'},'root filtering')
good(mod.collect(a,rom,'HiROM',1,3,0xC08100)[3]==1,'target cap')
try:mod.collect(a,rom,'HiROM',0,3)
except ValueError:checks+=1
else:raise AssertionError('invalid budget accepted')
print(f'CFG_STATIC_SEEDS_PASS checks={checks}')
