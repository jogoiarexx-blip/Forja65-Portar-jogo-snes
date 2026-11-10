#!/usr/bin/env python3
"""Synthetic tests for the non-mutating indexed-JSR table preview."""
import copy
import hashlib
import importlib.util
import sys
from pathlib import Path

p = Path(__file__).resolve().parent.parent/'tools/rie-preview-indexed-table.py'
spec=importlib.util.spec_from_file_location('preview_indexed',p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
r=bytearray(65536)
r[0x9000:0x9003]=bytes.fromhex('FC 06 90')
r[0x9006:0x900C]=bytes.fromhex('0C 90 16 90 24 90')
r[0x900c]=0x60; r[0x9016]=0x60; r[0x9024]=0x60
rom=bytes(r)
sha=hashlib.sha256(rom).hexdigest()
def proof(x, target):
    pointer=0x9006+x
    return {'schema':'forja65.indexed-jsr-trace-crosscheck.v1',
      'status':'INDEXED_JSR_TARGET_ROM_AND_TRACE_CROSSCHECKED', 'rom_sha256':sha,
      'source':'C09000','pointer_base':'9006','observed_x':f'{x:04X}',
      'pointer_at':f'C0{pointer:04X}', 'target':f'C0{target:04X}',
      'pointer_bytes':f'{target&255:02X} {target>>8:02X}', 'return_pc':'C09003',
      'evidence': {'rom_opcode':True,'cpu_trace_x':True,'runtime_hint':True,'last_error':True}}
a=proof(0,0x900c); b=proof(2,0x9016)
report=m.preview(rom,[a,b])
assert [e['classification'] for e in report['entries']]==['OBSERVED_TRACE_ROM','OBSERVED_TRACE_ROM','UNOBSERVED_STATIC_CANDIDATE'],report
assert report['entries'][2]['target']=='C09024'
checks=1
for key,value in [('rom_sha256','bad'),('pointer_at','C09007'),('pointer_base','A000'),('return_pc','C09004')]:
    c=copy.deepcopy(b); c[key]=value
    try: m.preview(rom,[a,c]); raise AssertionError('accepted '+key)
    except ValueError: checks+=1
for aa,bb in [(a,a),(b,b),(a,dict(b,observed_x='0003')), (a,dict(b, evidence={})),(a,dict(b,source='C09002'))]:
    try: m.preview(rom,[aa,bb]); raise AssertionError('accepted inconsistent observations')
    except ValueError: checks+=1
try: m.preview(rom,[a,b],max_entries=2); raise AssertionError('accepted invalid truncation')
except ValueError: checks+=1
print('RIE_INDEXED_TABLE_PREVIEW_PASS checks=',checks)
