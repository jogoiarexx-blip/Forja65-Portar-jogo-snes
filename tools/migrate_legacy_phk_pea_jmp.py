#!/usr/bin/env python3
"""Safely arm PHK; PEA #return-1; JMP [abs] in legacy generated C++.

The Forja65 generator already emits armConstructedLongReturn, but historical
shards may have been generated before the fix. Require immutable ROM opcode
proof at each site. Default is audit/dry-run; --apply changes files with backup.
"""
import argparse
from pathlib import Path
import re

CALL = re.compile(r'(?P<indent>\s*)hw\.requestDispatch\(hw\.read24\(0x(?P<ptr>[0-9a-fA-F]{4})u\),0x(?P<pc>[0-9a-fA-F]{6})u\); return;')

def rom_byte(rom, pc):
    bank, addr = (pc >> 16) & 0xff, pc & 0xffff
    if not (0x40 <= bank <= 0x7d or 0xc0 <= bank <= 0xff or 0x80 <= bank <= 0xbf):
        return None
    # HiROM full-bank mapping for DKC3, including B8:xxxx.
    pos = (bank & 0x3f) * 65536 + addr
    return rom[pos] if pos < len(rom) else None

def proof(rom, pc, ptr):
    return (rom_byte(rom,pc-4)==0x4b and rom_byte(rom,pc-3)==0xf4
            and rom_byte(rom,pc)==0xdc and rom_byte(rom,pc+1)==(ptr&0xff)
            and rom_byte(rom,pc+2)==(ptr>>8) and
            rom_byte(rom,pc-2) is not None and rom_byte(rom,pc-1) is not None)

def migrate(source, rom, target_pc=None):
    patched = []
    def sub(m):
        pc = int(m['pc'],16)
        ptr = int(m['ptr'],16)
        if target_pc is not None and pc != target_pc:
            return m[0]
        if not proof(rom,pc,ptr):
            return m[0]
        arm=f'hw.armConstructedLongReturn(0x{pc:06X}u,cpu);'
        # Legacy code can already contain the arm on preceding line.
        if arm in source[max(0,m.start()-250):m.start()]:
            return m[0]
        patched.append(pc)
        return m['indent']+arm+m[0]
    return CALL.sub(sub,source), patched

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rom',type=Path,required=True)
    p.add_argument('--target-pc',type=lambda s:int(s,0))
    p.add_argument('--apply',action='store_true')
    p.add_argument('sources',type=Path,nargs='+')
    a=p.parse_args()
    rom=a.rom.read_bytes()
    total=[]
    for file in a.sources:
        old=file.read_text()
        new, pcs=migrate(old,rom,a.target_pc)
        print(f'{file}: {[f"{pc:06X}" for pc in pcs]}')
        if a.apply and pcs:
            backup=file.with_suffix(file.suffix+'.rev189.bak')
            if backup.exists():
                p.error(f'backup already exists: {backup}')
            backup.write_text(old)
            file.write_text(new)
        total+=pcs
    print('sites:',len(total),'mode:', 'APPLIED' if a.apply else 'AUDIT_ONLY')

if __name__=='__main__':main()
