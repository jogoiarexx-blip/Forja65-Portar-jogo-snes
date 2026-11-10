#!/usr/bin/env python3
"""Add missing C=0 dispatcher coverage by *proven* carry-independent code reuse.

Very conservative: straight-line 65C816 opcodes SEP/REP (mask never changes
carry), LDA/STA long and RTL only. Rejects calls, branches, arithmetic,
indirect transfers, mismatched code labels and ambiguous ownership.
Does not modify executable code, existing rows, or the PPU.
"""
from pathlib import Path
from collections import Counter
import argparse
import json
import re

ROW=re.compile(r'^\{0x([0-9A-F]{6})u,(true|false),(true|false),(true|false),(true|false),(true|false),&([A-Za-z_0-9]+),0x([0-9A-F]{6})u\},$',re.M)
TABLE=re.compile(r'(static const Forja65DispatchEntry kForja65Dispatch\[\]=\{\n)(.*?)(\n\};)',re.S)
OPCODES={0xE2:('SEP',2),0xC2:('REP',2),0xAF:('LDA',4),0x8F:('STA',4),0x6B:('RTL',1)}

def recover(port:Path,entry:int,*,commit:bool=False,mapper:str='hirom')->dict:
    if mapper!='hirom':raise ValueError('only verified HiROM supported')
    if not (0 <= entry <= 0xffffff):raise ValueError('invalid entry')
    src=(port/'src/dispatch.cpp');text=src.read_text()
    table=TABLE.search(text)
    if not table:raise ValueError('dispatcher not found')
    rows=[(m,m.group(0)) for m in ROW.finditer(table[2])]
    roots=[m for m,line in rows if int(m[1],16)==entry]
    if len(roots)!=1:raise ValueError('root must have exactly one existing entry')
    root=roots[0]
    if root[5]!='true' or root[6]!='true':raise ValueError('root must have existing known C=1 domain')
    name=root[7];rootstr=root[8]
    if int(rootstr,16)!=entry:raise ValueError('root owner mismatch')
    matches=[]
    defn=re.compile(r'^void\s+'+re.escape(name)+r'\(CpuState&',re.M)
    for unit in (port/'src').glob('*.cpp'):
        if unit.name!='dispatch.cpp' and defn.search(unit.read_text()):matches.append(unit)
    if len(matches)!=1:raise ValueError('cannot uniquely identify handler owner')
    whole=matches[0].read_text()
    start=defn.search(whole).start();next_func=re.search(r'^void\s+sub_',whole[start+1:],re.M)
    end=start+1+next_func.start() if next_func else len(whole)
    body=whole[start:end]
    if re.search(r'\bcpu\.c\b|\bcpu\.setC\s*\(',body):raise ValueError('compiled handler inspects/modifies carry')
    sites=[(m,int(m[1],16)) for m,line in rows if m[7]==name and m[8]==rootstr]
    if not sites:raise ValueError('handler absent from dispatcher')
    addresses=sorted({pc for _,pc in sites})
    rom=(port/'assets/cart-data.bin').read_bytes()
    pc=entry
    decoded=[]
    for index in range(len(addresses)):
        off=pc&0x3fffff
        if off>=len(rom):raise ValueError('ROM is truncated')
        op=rom[off]
        if op not in OPCODES:raise ValueError(f'carry-sensitive or unsupported opcode at ${pc:06X}')
        mnemonic,length=OPCODES[op]
        if off+length>len(rom):raise ValueError('truncated ROM instruction')
        if op in (0xE2,0xC2) and (rom[off+1]&1):raise ValueError('SEP/REP modifies carry')
        if pc!=addresses[index]:raise ValueError('nonlinear or missing instruction sequence')
        if not re.search(r'^\s*// \$'+f'{pc:06X}'+r' '+mnemonic+r'\b',body,re.M):
            raise ValueError('opcode/mnemonic source mismatch')
        decoded.append({'pc':f'{pc:06X}','op':f'{op:02X}','mnemonic':mnemonic})
        pc=(pc+length)&0xffffff
    if decoded[-1]['mnemonic']!='RTL':raise ValueError('routine must end with RTL')
    if sorted(addresses)!=[int(x['pc'],16) for x in decoded]:raise ValueError('coverage mismatch')
    for m,site in sites:
        if m[5]!='true' or m[6]!='true':raise ValueError('non-C1 row in candidate routine')
        if not (m[2]==root[2] and m[4]==root[4]):raise ValueError('E/X state changed unexpectedly')
        for other,other_line in rows:
            if int(other[1],16)==site and all(other[k]==m[k] for k in (2,3,4)):
                if other[5]=='false' or (other[5]=='true' and other[6]=='false'):
                    raise ValueError('C=0 already covered at a candidate PC')
    extra=[]
    for m,site in sites:
        extra.append(f'{{0x{m[1]}u,{m[2]},{m[3]},{m[4]},true,false,&{m[7]},0x{m[8]}u}},')
    original=[m.group(0) for m,line in rows]
    combined=sorted(original+extra,key=lambda x:int(ROW.fullmatch(x)[1],16))
    if Counter(original)-Counter(combined):raise ValueError('original dispatch rows changed')
    new=text[:table.start(2)]+'\n'.join(combined)+text[table.end(2):]
    proof={'schema':1,'kind':'CARRY_INDEPENDENT_ALIAS','entry':f'{entry:06X}','owner':name,'sites':len(addresses),'new_dispatch_rows':len(extra),
           'existing_dispatch_rows':len(original),'after_dispatch_rows':len(combined),'decoded':decoded,
           'rom_fingerprint_required':(port/'assets/cart-data.bin').is_file(),'old_rows_preserved':True,'dry_run':not commit}
    if commit:src.write_text(new)
    return proof

def main():
    p=argparse.ArgumentParser();p.add_argument('--port',type=Path,required=True);p.add_argument('--entry',required=True);p.add_argument('--apply',action='store_true');p.add_argument('--report',type=Path)
    a=p.parse_args();out=recover(a.port,int(a.entry.replace(':',''),16),commit=a.apply)
    if a.report:a.report.write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps(out,indent=2))
if __name__=='__main__':main()
