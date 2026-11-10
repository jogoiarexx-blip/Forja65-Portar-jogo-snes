#!/usr/bin/env python3
"""Attach ROM opcode / LoROM offset to observed 65C816 writer PCs (no semantics guessed)."""
import argparse,json
from collections import defaultdict
from pathlib import Path

OPCODES={0x99:('STA','abs,Y',3),0x9D:('STA','abs,X',3),0x8D:('STA','abs',3),
 0x85:('STA','dp',2),0x95:('STA','dp,X',2),0x9F:('STA','long,X',4),0x8F:('STA','long',4),
 0x86:('STX','dp',2),0x8E:('STX','abs',3),0x84:('STY','dp',2),0x8C:('STY','abs',3),
 0x9C:('STZ','abs',3),0x9E:('STZ','abs,X',3),0x64:('STZ','dp',2),0x74:('STZ','dp,X',2),
 0xE6:('INC','dp',2),0xEE:('INC','abs',3),0xF6:('INC','dp,X',2),0xFE:('INC','abs,X',3),
 0xC6:('DEC','dp',2),0xCE:('DEC','abs',3),0xD6:('DEC','dp,X',2),0xDE:('DEC','abs,X',3),
 0x22:('JSL','long',4)}

def enrich(attribution,rom_bytes):
    if attribution.get('schema')!='forja65.wram.writer-attribution/1':raise ValueError('wrong attribution schema')
    pcs=defaultdict(set)
    for item in attribution['addresses']:
        for channel in ('baseline','attack'):
            for pc in item['writer_pcs'][channel]:pcs[pc].add(item['address'])
    ret=[]
    for pc,addresses in sorted(pcs.items()):
        n=int(pc,16);bank=(n>>16)&255;offset=(bank&0x7f)*0x8000+(n&0x7fff)
        if (n&0x8000)==0 or offset>=len(rom_bytes):
            ret.append({'pc':pc,'addresses':sorted(addresses),'rom_mapping':'INVALID'});continue
        code=rom_bytes[offset:offset+4];opcode=code[0];ins=OPCODES.get(opcode)
        row={'pc':pc,'addresses':sorted(addresses),'rom_offset':f'{offset:06X}',
             'bytes':code.hex(' ').upper(),'opcode':f'{opcode:02X}',
             'mnemonic':ins[0] if ins else 'UNKNOWN',
             'addressing':ins[1] if ins else None,
             'direct_write_opcode':bool(ins and ins[0] in ('STA','STX','STY','STZ','INC','DEC')),
             'semantics_proven':False}
        if ins and ins[2]>=2:
            operand=int.from_bytes(code[1:ins[2]],'little')
            row['operand']=f'{operand:0{(ins[2]-1)*2}X}'
        ret.append(row)
    return {'schema':'forja65.wram.writer-opcodes/1','rom_bytes':len(rom_bytes),'pcs':ret,
      'caveat':'The observed effective WRAM address is from the trace. ROM operands may be indexed or in a different data bank; opcode alone does not prove collision, score, or stage semantics.'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--attribution',required=True,type=Path);p.add_argument('--rom',required=True,type=Path);p.add_argument('--out',type=Path)
    a=p.parse_args()
    try:r=enrich(json.loads(a.attribution.read_text()),a.rom.read_bytes())
    except (ValueError,OSError,KeyError) as exc:p.error(str(exc))
    out=json.dumps(r,indent=2)+'\n'
    if a.out:a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(out)
    print(json.dumps({'pcs':len(r['pcs']),'direct_write_opcodes':sum(p['direct_write_opcode'] for p in r['pcs'])},indent=2))
if __name__=='__main__':main()
