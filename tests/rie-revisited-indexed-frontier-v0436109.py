#!/usr/bin/env python3
"""Regression: a prior visit with a different X must not veto a terminal witness.

Synthetic HiROM only; demonstrates two indexed opcodes and keeps guards strict.
"""
import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]

def load(filename):
    spec = importlib.util.spec_from_file_location('a_'+filename.replace('-','_').replace('.','_'), ROOT/'tools'/filename)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

checks = 0
for filename, opcode in [('audit-indexed-jmp-trace.py',0x7c),('audit-indexed-jsr-trace.py',0xfc)]:
    tool=load(filename)
    rom = bytearray([0xea]*0x400000)
    site=0xb89f4d
    offset=(site&0x3fffff)
    rom[offset:offset+3]=bytes([opcode,0x91,0xa1])
    # 0x0000 -> B8A500, 0x0024 -> B8A53B
    rom[0x38a191:0x38a193]=bytes([0x00,0xa5])
    rom[0x38a1b5:0x38a1b7]=bytes([0x3b,0xa5])
    def line(x,pb='b8',x8=0):
        return f'b89f4d A=24 X={x:x} Y=878 S=1fc D=0 DB=b8 PB={pb} P=4 E=0 M=0 X8={x8} C=0\n'
    past=line(0)
    current=line(0x24)
    trace='FORJA65 RUNTIME TRACE\nframe=14925\n'+past+current
    fingerprint=tool._rom_fingerprint(rom)
    hint=f'rom={fingerprint} target=b8a53b from=b89f4d kind=FLOW e=0 m=0 x=0 c=0\n'
    err=f'fluxo CFG nao resolvido em pc={site} target={0xb8a53b}\n'
    result=tool.audit(rom,trace,hint,err,site,0xb8a53b)
    assert result['observed_x']=='0024' and result['target']=='B8A53B'
    checks+=1
    # Tampered current X, current PB, stale trace, conflicting hint, bad ROM target, X8 overflow
    negatives=[
        ('x-mismatch',rom,'FORJA65 RUNTIME TRACE\n'+past+line(0),hint,err),
        ('bank-mismatch',rom,'FORJA65 RUNTIME TRACE\n'+past+line(0x24,pb='b7'),hint,err),
        ('stale-current',rom,trace+'b89f4e A=0 X=24 Y=0 S=1fc D=0 DB=b8 PB=b8 P=4 E=0 M=0 X8=0 C=0\n',hint,err),
        ('malformed-terminal',rom,trace+'b89f4d A=0 X=24 Y=0 S=1fc D=0 DB=b8 PB=b8 P=4 E=0 M=0 X8=0 C=no\n',hint,err),
        ('hint-mismatch',rom,trace,hint.replace('target=b8a53b','target=b8a500'),err),
        ('error-mismatch',rom,trace,hint,err.replace(f'target={0xb8a53b}', 'target=0')),
        ('x8-overflow',rom,'FORJA65 RUNTIME TRACE\n'+past+line(0x124,x8=1),hint.replace('x=0 c=0','x=1 c=0'),err),
    ]
    for name,data,t,h,e in negatives:
        try: tool.audit(data,t,h,e,site,0xb8a53b)
        except ValueError: checks+=1
        else: raise AssertionError(f'Invalid {filename} evidence accepted: {name}')
print(f'RIE_REVISITED_INDEXED_PASS checks={checks} modes=JMP,JSR')
