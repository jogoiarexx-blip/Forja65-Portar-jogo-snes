#!/usr/bin/env python3
"""ROM-backed indexed JMP (abs,X) witness audit for SNES HiROM.

This tool inventories targets, never inserts them into CFG or labels a
ROM-derived target as executed. The X value must come from a CPU trace.
"""
import argparse
import hashlib
import json
from pathlib import Path


def audit(rom, pc, x_values):
    def physical(address):
        bank=(address>>16)&255
        word=address&65535
        if bank in (0x7e,0x7f) or (word<0x8000 and not (0x40<=bank<=0x7d or bank>=0xc0)):
            raise ValueError(f'HiROM unmapped address: {address:06X}')
        off=((bank&63)<<16)|word
        if off>=len(rom):raise ValueError(f'ROM offset out of bounds: {off:06X}')
        return off
    src=physical(pc)
    if rom[src]!=0x7c:
        raise ValueError(f'site {pc:06X} is not JMP (abs,X): {rom[src]:02X}')
    base=rom[physical((pc&0xff0000)|((pc+1)&65535))] | (rom[physical((pc&0xff0000)|((pc+2)&65535))]<<8)
    if any(x<0 or x>65535 for x in x_values):
        raise ValueError('indexed JMP table indices must be 16-bit values')
    rows=[]
    for x in x_values:
        at=(base+x)&65535
        bank=pc&0xff0000
        low=rom[physical(bank|at)]
        high=rom[physical(bank|((at+1)&65535))]
        dest=bank|(low|(high<<8))
        target_offset=physical(dest)
        rows.append({'observed_x':f'{x:04X}', 'table_address':f'{bank|at:06X}',
                     'target':f'{dest:06X}', 'target_rom_offset':f'{target_offset:06X}',
                     'target_first_opcode':f'{rom[target_offset]:02X}',
                     'status':'rom_pointer_resolved_unexecuted'})
    return {'schema':'forja65.rom-indexed-jmp-audit.v1','mapper':'HiROM',
            'rom_sha256':hashlib.sha256(rom).hexdigest(),
            'callsite':f'{pc:06X}', 'opcode':'7C', 'pointer_base':f'{base:04X}',
            'note':'The X values are trace witnesses; targets are statically inferred, not replay-observed.',
            'routes':rows}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--rom',type=Path,required=True)
    ap.add_argument('--site',required=True)
    ap.add_argument('--x',required=True,help='comma-separated observed hex X indices')
    ap.add_argument('--out',type=Path)
    ns=ap.parse_args()
    answer=audit(ns.rom.read_bytes(),int(ns.site.replace(':',''),16),
                 [int(x,16) for x in ns.x.split(',')])
    text=json.dumps(answer,indent=2)+'\n'
    if ns.out:ns.out.write_text(text)
    else:print(text,end='')

if __name__=='__main__':main()
