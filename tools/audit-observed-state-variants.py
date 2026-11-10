#!/usr/bin/env python3
"""Classify a ROM-bound 65816 state miss without changing existing dispatcher owners.

Only identifies missing state variants. Does NOT synthesize a CPU fix or claim
that a generated path will continue correctly after an interrupt.
"""
import argparse
import json
import re
from pathlib import Path

ROW=re.compile(r'^\{0x([A-F0-9]{6})u,(true|false),(true|false),(true|false),(true|false),(true|false),&([^,]+),0x[A-F0-9]{6}u\},$',re.M)
FNV_OFFSET=1469598103934665603
FNV_PRIME=0x100000001b3

def fingerprint(buf: bytes) -> str:
    n=FNV_OFFSET
    for b in buf: n=((n^b)*FNV_PRIME)&0xFFFFFFFFFFFFFFFF
    return f'{n:016x}'

def audit(rom, dispatch, hints):
    content=Path(hints).read_text(encoding='utf-8')
    candidates=[line.strip() for line in content.splitlines() if 'kind=STATE' in line]
    if len(candidates)!=1:
        raise ValueError('Expected one observed STATE hint')
    pairs=dict(re.findall(r'\b(rom|target|from|kind|e|m|x|c)=([0-9a-fA-F]+|STATE)\b',candidates[0]))
    needed={'rom','target','from','kind','e','m','x','c'}
    if set(pairs)!=needed or pairs['kind']!='STATE' or any(pairs[k] not in ('0','1') for k in ('e','m','x','c')):
        raise ValueError('Incomplete or malformed CPU STATE observation')
    if len(pairs['target'])>6 or len(pairs['rom'])!=16:
        raise ValueError('Invalid target or ROM fingerprint')
    buf=Path(rom).read_bytes(); digest=fingerprint(buf)
    if digest!=pairs['rom'].lower():
        raise ValueError('Observation belongs to a different ROM')
    pc=int(pairs['target'],16)
    variants=[]
    for match in ROW.finditer(Path(dispatch).read_text(encoding='utf-8')):
        if int(match.group(1),16)!=pc:continue
        e,m,x,known,c=(field=='true' for field in match.groups()[1:6])
        compatible=(e==bool(int(pairs['e'])) and m==bool(int(pairs['m'])) and x==bool(int(pairs['x']))
                    and (not known or c==bool(int(pairs['c']))))
        variants.append({'e':int(e),'m':int(m),'x':int(x),'carry_constrained':known,'carry':int(c),
                         'symbol':match.group(7),'compatible':compatible})
    status=('covered' if any(v['compatible'] for v in variants) else
            'variant_missing' if variants else 'entry_missing')
    return {'schema':'forja65.observed-cpu-state-audit.v1','target':f'{pc:06X}',
            'origin':pairs['from'].upper(),'rom_fnv1a64':digest,
            'required_state':{k:int(pairs[k]) for k in ('e','m','x','c')},
            'dispatcher_entry_count':len(variants),'variants':variants,'status':status,
            'action':'generate_and_validate_missing_state_variant' if status=='variant_missing' else
                     'analyze_unobserved_entry' if status=='entry_missing' else 'investigate_dispatch_selection',
            'semantics_proven':False}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for field in ('rom','dispatch','hints','out'):p.add_argument('--'+field,type=Path,required=True)
    args=p.parse_args()
    try: result=audit(args.rom,args.dispatch,args.hints)
    except (OSError,ValueError) as e:p.exit(2,f'State audit rejected: {e}\n')
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
