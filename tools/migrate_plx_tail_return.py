#!/usr/bin/env python3
"""Safe, ROM-proven migration for the DKC3 B9:E03C JSR/PLX/RTL tail.

Default is audit-only. --apply patches the exact two legacy RTL handlers;
no generic return bypasses or interpreter fallback are introduced.
"""
import argparse
from pathlib import Path
import re

PROOF={0xB5F195:0x22,0xB5F196:0x00,0xB5F197:0xE0,0xB5F198:0xB9,
       0xB9E03C:0xFC,0xB9E03D:0x42,0xB9E03E:0xE0,
       0xB9E7B6:0xFA,0xB9E7CF:0x6B,0xB9E7DD:0x6B}
SITE='0xB9E7DDu'
SITES=('0xB9E7CFu','0xB9E7DDu')
def anchor(site):
    return f'if(hw.consumeConstructedLongReturn(dst,cpu)){{cpu.dropStack(3u,true);cpu.pb=bank;hw.requestDispatch(dst,{site});return;}} '
def insert(site):
    return f'if(retirePlxDiscardedJsrLongReturn(hw, {site},dst,cpu)){{cpu.dropStack(3u,true);cpu.pb=bank;hw.requestDispatch(dst,{site});return;}} '
ANCHOR=anchor(SITES[1]);INSERT=insert(SITES[1])
HEADER='#include "plx_tail_rtl.hpp"\n'

def rom_is_compatible(rom):
    if len(rom)<0x400000: return False
    return all(rom[((a>>16)&0x3f)*65536+(a&0xffff)]==value for a,value in PROOF.items())

def patch(code):
    if all(insert(site) in code for site in SITES): return code,0
    if not code.startswith('#include "generated.hpp"'):raise ValueError('unexpected generated header')
    count=0
    for site in SITES:
        if insert(site) in code: continue
        if code.count(anchor(site))!=2:raise ValueError(f'expected exactly two {site} handlers')
        code=code.replace(anchor(site),anchor(site)+insert(site));count+=2
    if HEADER not in code:code=code.replace('#include "generated.hpp"','#include "generated.hpp"\n'+HEADER.rstrip(),1)
    return code,count

def migrate(port, header, *, apply=False):
    port=Path(port); src=port/'src/forja_learned_r135_003.cpp';rom=port/'assets/cart-data.bin'
    if not src.is_file() or not rom.is_file(): raise ValueError('port source or ROM pack missing')
    if not rom_is_compatible(rom.read_bytes()):raise ValueError('ROM opcode provenance does not match')
    original=src.read_text(); updated,count=patch(original)
    if apply:
        h=port/'src/plx_tail_rtl.hpp'
        if h.exists() and h.read_text()!=header:raise ValueError('existing helper is different')
        h.write_text(header)
        if count:src.write_text(updated)
    return count

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('port',type=Path)
    p.add_argument('--apply',action='store_true')
    a=p.parse_args()
    helper=Path(__file__).with_name('plx_tail_rtl.hpp').read_text()
    count=migrate(a.port,helper,apply=a.apply)
    print(f'PLX-RTL migration: {count} handler(s) '+('updated' if a.apply else 'eligible (dry-run)'))

if __name__=='__main__':main()
