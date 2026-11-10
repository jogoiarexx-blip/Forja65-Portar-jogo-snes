#!/usr/bin/env python3
"""Audit a ROM-backed absolute 65C816 JSR edge before focused CFG recovery.

This is a *static* code/ROM consistency check, not a measurement of CPU flags
at the crash and not a claim that the callee behaves correctly. Never writes
any files to the port unless an output JSON path is explicitly provided.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

ENTRY = re.compile(r'^\{0x([0-9A-F]{6})u,(false|true),(false|true),(false|true),(false|true),(false|true),&([^,]+),0x([0-9A-F]{6})u\},$',re.M)

def audit(port:Path, caller:int, target:int, mapper:str='hirom') -> dict:
    if not 0 <= caller <= 0xffffff or not 0 <= target <= 0xffffff:
        raise ValueError('caller and target must be 24-bit SNES addresses')
    if mapper not in {'hirom','lorom'}:raise ValueError('unsupported mapper')
    if caller>>16 != target>>16:raise ValueError('JSR must stay in same program bank')
    rom=(port/'assets'/'cart-data.bin').read_bytes()
    if mapper=='hirom':
        off=caller & 0x3fffff
    else:
        if (caller&0x8000)==0:raise ValueError('LoROM requires caller >= $8000')
        off=((caller>>16)&0x7f)*0x8000+(caller&0x7fff)
    if off+3>len(rom):raise ValueError('caller outside ROM')
    opcode=rom[off:off+3]
    if opcode[0]!=0x20:raise ValueError('ROM caller is not an absolute JSR ($20)')
    decoded=(caller&0xff0000)|(opcode[1]|opcode[2]<<8)
    if decoded!=target:raise ValueError(f'ROM JSR points to ${decoded:06X}, not ${target:06X}')
    dispatch=(port/'src'/'dispatch.cpp').read_text()
    entries=list(ENTRY.finditer(dispatch))
    callers=[m for m in entries if int(m[1],16)==caller]
    if not callers:raise ValueError('caller lacks dispatcher coverage')
    if any(int(m[1],16)==target for m in entries):raise ValueError('target already has dispatcher coverage')
    sources=[]
    for m in callers:
        name=m[7]
        if name not in sources:sources.append(name)
    states=[]
    for m in callers:
        flags={'e':int(m[2]=='true'),'m':int(m[3]=='true'),'x':int(m[4]=='true')}
        carry=[int(m[6]=='true')] if m[5]=='true' else [0,1]
        for c in carry:
            state={**flags,'c':c}
            if state not in states:states.append(state)
    for function in sources:
        definition=re.compile(r'^void\s+'+re.escape(function)+r'\(CpuState&',re.M)
        owners=[]
        for path in (port/'src').glob('*.cpp'):
            if path.name!='dispatch.cpp' and definition.search(path.read_text()):owners.append(path)
        if len(owners)!=1:raise ValueError(f'no unique definition for {function}')
        content=owners[0].read_text()
        token=f'// ${caller:06X} JSR -> ${target:06X} stack real'
        if token not in content:raise ValueError('source-generated JSR edge differs from ROM')
        # Actual 65C816 JSR pushes (PC + 2). Verify emitter does too.
        if f'cpu.push16Value(hw,0x{(caller+2)&0xffff:04X}u)' not in content:
            raise ValueError('generated JSR lacks expected 65C816 return address')
    return {'schema':1,'kind':'STATIC_JSR_SITE','caller':f'{caller:06X}',
            'target':f'{target:06X}','rom_sha256':hashlib.sha256(rom).hexdigest(),
            'mapper':mapper,'physical_offset':off,'opcode':opcode.hex(),
            'caller_dispatch_rows':len(callers),'caller_function_owners':sources,
            'possible_entry_states':states,
            'runtime_state_measured':False,
            'note':'Possible states come from existing dispatcher coverage, not from a captured crash trace.'}

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--port',required=True,type=Path)
    p.add_argument('--caller',required=True)
    p.add_argument('--target',required=True)
    p.add_argument('--mapper',choices=['hirom','lorom'],default='hirom')
    p.add_argument('--output',type=Path)
    a=p.parse_args()
    result=audit(a.port,int(a.caller.replace(':',''),16),int(a.target.replace(':',''),16),a.mapper)
    if a.output:
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
