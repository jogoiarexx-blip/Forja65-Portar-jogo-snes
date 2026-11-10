#!/usr/bin/env python3
"""Recover one observed C=1 state at a carry-neutral JSL continuation.

Proof requires the ROM JSL opcode and absolute target, a single C=0
handler, a generated continuation whose only carry dependency is a stale
entry guard, and a following label with a carry-neutral E/M/X guard.
Do not alter CPU carry or replace existing dispatcher entries.
"""
import argparse, json, re

FNV_OFFSET = 1469598103934665603
FNV_PRIME = 0x100000001b3

def rom_fingerprint(data: bytes) -> str:
    """Match the FNV-1a ROM identity emitted by forja65-core.js."""
    value = FNV_OFFSET
    for byte in data:
        value = ((value ^ byte) * FNV_PRIME) & 0xffffffffffffffff
    return f"{value:016x}"
from collections import Counter
from pathlib import Path

ROW=re.compile(r'^\{0x([0-9A-F]{6})u,(true|false),(true|false),(true|false),(true|false),(true|false),&([A-Za-z_0-9]+),0x([0-9A-F]{6})u\},$',re.M)
TABLE=re.compile(r'(static const Forja65DispatchEntry kForja65Dispatch\[\]=\{\n)(.*?)(\n\};)',re.S)

def recover(port:Path, entry:int, *, hint:Path, commit:bool=False)->dict:
    if not 0<=entry<0x1000000: raise ValueError('PC out of range')
    observed=hint.read_text().strip()
    match=re.fullmatch(r'rom=([0-9a-f]{16}) target='+f'{entry:06x}'+r' from='+f'{entry:06x}'+r' kind=STATE e=0 m=0 x=0 c=1',observed)
    if not match:
        raise ValueError('no matching observed carry state and ROM fingerprint')
    rom=(port/'assets/cart-data.bin').read_bytes()
    actual_rom=rom_fingerprint(rom)
    if match.group(1) != actual_rom:
        raise ValueError('observed ROM fingerprint does not match cartridge')
    dispatch=port/'src/dispatch.cpp'; src=dispatch.read_text()
    table=TABLE.search(src)
    if table is None:raise ValueError('dispatch table absent')
    old=ROW.findall(table[2]);entries=[m for m in ROW.finditer(table[2]) if int(m[1],16)==entry]
    # We only recover the C=1 variant after seeing an actual C=1 runtime hint.
    if len(entries)!=1:raise ValueError('one prior C=0 dispatch entry required')
    row=entries[0]
    if row[5]!='true' or row[6]!='false':raise ValueError('existing entry is not explicitly C=0')
    if any(r[5]=='false' or r[6]=='true' for r in entries):raise ValueError('other carry variants already registered')
    owner=row[7];root=int(row[8],16); name=row.group(0)
    src_candidates=[]
    for path in (port/'src').glob('*.cpp'):
        if path.name!='dispatch.cpp' and re.search(r'^void\s+'+re.escape(owner)+r'\(CpuState&',path.read_text(),re.M):src_candidates.append(path)
    if len(src_candidates)!=1:raise ValueError('handler owner not unique')
    path=src_candidates[0];whole=path.read_text()
    start_match=re.search(r'^void\s+'+re.escape(owner)+r'\(CpuState&',whole,re.M)
    next_match=re.search(r'^void\s+sub_',whole[start_match.end():],re.M)
    start=start_match.start(); end=start_match.end()+next_match.start() if next_match else len(whole)
    body=whole[start:end]
    label='L_'+f'{entry:06X}'
    section=re.search(r'^'+label+r':\n(.*?)(?=^L_[0-9A-F]{6}:|\Z)',body,re.M|re.S)
    if section is None: raise ValueError('entry label not found')
    original=section.group(1)
    if not re.search(r'^\s*// \$'+f'{entry:06X}'+r' JSL -> \$[0-9A-F]{6} stack real$',original,re.M):raise ValueError('missing generated JSL proof')
    offset=entry & 0x3fffff
    if offset+4>len(rom) or rom[offset]!=0x22:raise ValueError('ROM opcode is not JSL')
    target=rom[offset+1]|rom[offset+2]<<8|rom[offset+3]<<16
    if not re.search(r'// \$'+f'{entry:06X}'+r' JSL -> \$'+f'{target:06X}'+r' stack real',original):raise ValueError('ROM target disagrees with generated source')
    if not re.search(r'forja65_dispatch\(cpu, hw, 0x'+f'{target:06X}'+r'u, 0x'+f'{entry:06X}'+r'u\)',original):raise ValueError('generated call differs from ROM')
    if not re.search(r'goto L_'+f'{entry+4:06X}'+r';\s*$',original):raise ValueError('continuation must be next instruction')
    guard=r'if \(!\(cpu\.e==false && cpu\.m8==false && cpu\.x8==false && cpu\.c==false\)\)'
    guards=list(re.finditer(guard,original))
    if len(guards)!=1:raise ValueError('exact one C0 entry guard required')
    stripped=original[:guards[0].start()]+original[guards[0].end():]
    if re.search(r'\bcpu\.c\b|\bcpu\.setC\s*\(',stripped):raise ValueError('carry-inspecting JSL body cannot be reused')
    # CPU/PB conditions may be checked, but the carry check must only gate entry.
    continuation=re.search(r'^L_'+f'{entry+4:06X}'+r':\n(.*?)(?=^L_[0-9A-F]{6}:|\Z)',body,re.M|re.S)
    if continuation is None:raise ValueError('no continuation label')
    if 'cpu.c==' in continuation[1].split('hw.traceInstruction',1)[0]:raise ValueError('carry-specific continuation')
    fixed=original[:guards[0].start()]+'if (!(cpu.e==false && cpu.m8==false && cpu.x8==false))'+original[guards[0].end():]
    rewritten=whole[:start]+body[:section.start(1)]+fixed+body[section.end(1):]+whole[end:]
    # Exact original line is preserved; new C=1 row points at same handler.
    added=f'{{0x{entry:06X}u,{row[2]},{row[3]},{row[4]},true,true,&{owner},0x{root:06X}u}},'
    original_lines=[x.group(0) for x in ROW.finditer(table[2])]
    new_lines=sorted(original_lines+[added],key=lambda s:int(ROW.fullmatch(s)[1],16))
    if Counter(original_lines)-Counter(new_lines):raise ValueError('lost dispatcher entries')
    updated=src[:table.start(2)]+'\n'.join(new_lines)+src[table.end(2):]
    proof={'schema':1,'kind':'CARRY_NEUTRAL_JSL_CONTINUATION','pc':f'{entry:06X}','rom_opcode':'22','rom_target':f'{target:06X}',
      'handler':owner,'observed_hint':observed,'verified_rom_fingerprint':actual_rom,'existing_dispatch_entries':len(original_lines),'new_dispatch_entries':len(new_lines),'added':1,'preserved':True,'committed':commit}
    if commit:
        path.write_text(rewritten)
        dispatch.write_text(updated)
    return proof

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',required=True,type=Path);p.add_argument('--entry',required=True);p.add_argument('--hint',required=True,type=Path);p.add_argument('--apply',action='store_true');p.add_argument('--report',type=Path)
    a=p.parse_args();out=recover(a.port,int(a.entry.replace(':',''),16),hint=a.hint,commit=a.apply)
    if a.report:a.report.write_text(json.dumps(out,indent=2)+'\n')
    print(json.dumps(out,indent=2))
