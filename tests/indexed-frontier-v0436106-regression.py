#!/usr/bin/env python3
"""Synthetic ROM / trace tests, no proprietary ROM or executable required."""
import importlib.util
import sys
from pathlib import Path

root=Path(__file__).resolve().parent.parent

def module(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

audit=module(root/'tools/audit-indexed-jmp-trace.py','indexedaudit')
frontier=module(root/'tools/resolve-indexed-frontier.py','indexedfrontier')
raw=bytearray([0xff])*0x400000
O=0x3e0000
raw[0xffd5]=0x31
raw[O+0xd690:O+0xd693]=bytes.fromhex('7c93d6')
raw[O+0xd693:O+0xd695]=bytes.fromhex('aed6')
raw[O+0xd6ae]=0x20
rom=bytes(raw)
fp=audit._rom_fingerprint(rom)
hint=f'rom={fp} target=bed6ae from=bed690 kind=FLOW e=0 m=0 x=0 c=0'
error=f'fluxo CFG nao resolvido em pc={int("bed690",16)} target={int("bed6ae",16)}'
row=lambda pc,x='0',pb='be':f'{pc} A=0 X={x} Y=0 S=1fc D=0 DB=be PB={pb} P=6 E=0 M=0 X8=0 C=0'
trace=row('bed68e')+'\n'+row('bed690')+'\n'
positive=audit.audit(rom,trace,hint,error,0xbed690,0xbed6ae)
assert positive['pointer_bytes']=='AE D6' and positive['observed_x']=='0000'
assert positive['source']=='BED690' and positive['target']=='BED6AE'
assert frontier.identify_frontier(error)==(0xbed690,0xbed6ae)
checks=0

def reject(fn):
    global checks
    try:fn()
    except ValueError:checks+=1
    else:raise AssertionError('Invalid evidence accepted')

reject(lambda: audit.audit(rom,trace+row('bed692')+'\n',hint,error,0xbed690))
reject(lambda: audit.audit(rom,row('bed690',pb='bd'),hint,error,0xbed690))
reject(lambda: audit.audit(rom,row('bed690',x='2'),hint,error,0xbed690))
reject(lambda: audit.audit(rom,trace,hint.replace(fp,'0000000000000000'),error,0xbed690))
reject(lambda: audit.audit(rom,trace,hint,error.replace('target='+str(0xbed6ae),'target=1'),0xbed690))
wrong=bytearray(rom);wrong[O+0xd690]=0xea
reject(lambda: audit.audit(bytes(wrong),trace,hint,error,0xbed690))
wrong=bytearray(rom);wrong[O+0xd693]=0xaf
reject(lambda: audit.audit(bytes(wrong),trace,hint,error,0xbed690))
reject(lambda: frontier.identify_frontier('stack RTL error'))
reject(lambda: frontier.identify_frontier(error+'\n'+error))
reject(lambda: frontier.identify_frontier('fluxo CFG nao resolvido em pc=16777216 target=1'))
print(f'INDEXED_FRONTIER_V0436106_PASS: 1 positive, {checks} negative rejection cases')
