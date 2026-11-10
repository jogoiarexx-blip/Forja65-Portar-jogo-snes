#!/usr/bin/env python3
"""Strict 65816 HiROM RAM-pointer JMP proof using terminal CPU trace and ROM.

Recognizes exactly the local pattern STA dp (16-bit), PEA return-1,
JMP (abs), with matching last-error and ROM-fingerprinted runtime hint.
It does NOT pretend to have a sampled WRAM/bus trace. Proof only authorizes
an opt-in native handler merge; no bypass of dispatcher or stack guards.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path


def fingerprint(raw):
    v=1469598103934665603
    for b in raw:
        v=((v ^ b)*1099511628211)&0xffffffffffffffff
    return f'{v:016x}'


def rom_offset(raw, pc):
    bank=(pc>>16)&255; low=pc&65535
    if bank in (0x7e,0x7f) or (low<0x8000 and not (0x40<=bank<=0x7d or bank>=0xc0)):
        raise ValueError('Source/target is not HiROM cartridge space')
    off=((bank&63)<<16)|low
    if off>=len(raw): raise ValueError('Cartridge address beyond ROM')
    return off

TRACE=re.compile(r'^([0-9a-f]{6}) A=([0-9a-f]+) X=([0-9a-f]+) Y=([0-9a-f]+) S=([0-9a-f]+) D=([0-9a-f]+) DB=([0-9a-f]+) PB=([0-9a-f]+) P=([0-9a-f]+) E=([01]) M=([01]) X8=([01]) C=([01])$',re.I)
HINT=re.compile(r'^rom=([0-9a-f]{16}) target=([0-9a-f]{6}) from=([0-9a-f]{6}) kind=(\S+) e=([01]) m=([01]) x=([01]) c=([01])$',re.I)
ERR=re.compile(r'^fluxo CFG nao resolvido em pc=(\d+) target=(\d+)$')

def audit(raw, trace, hints, last_error, expected_site=None, expected_target=None):
    matches=last_error.strip().splitlines()
    if len(matches)!=1 or not ERR.fullmatch(matches[0]): raise ValueError('Exactly one unresolved CFG flow required')
    site,target=map(int,ERR.fullmatch(matches[0]).groups())
    if site>0xffffff or target>0xffffff: raise ValueError('Address exceeds SNES range')
    if expected_site is not None and site!=expected_site: raise ValueError('Unexpected callsite')
    if expected_target is not None and target!=expected_target: raise ValueError('Unexpected destination')
    if (site>>16)!=(target>>16): raise ValueError('Absolute-indirect JMP must remain in program bank')
    at=lambda pc: raw[rom_offset(raw,pc)]
    if (site&65535)<5: raise ValueError('Unsupported bank-crossing prelude')
    store,pea=site-5,site-3
    if at(site)!=0x6c or at(store)!=0x85 or at(pea)!=0xf4: raise ValueError('Not a STA dp, PEA, JMP (abs) prelude')
    dp=at(store+1)
    vector=at(site+1)|(at(site+2)<<8)
    push_word=at(pea+1)|(at(pea+2)<<8)
    if vector != dp or push_word!=((site+2)&65535): raise ValueError('Pointer or pushed return word does not match verified prelude')
    rows=[]
    for line in trace.splitlines():
        if re.match(r'^[0-9a-f]{6}\s+A=',line,re.I):
            m=TRACE.fullmatch(line.strip())
            if not m: raise ValueError('Malformed CPU trace row')
            vals=[int(x,16) for x in m.groups()[:9]]+list(map(int,m.groups()[9:]))
            rows.append(dict(zip(('pc','a','x','y','s','d','db','pb','p','e','m','x8','c'),vals)))
    if len(rows)<3 or [x['pc'] for x in rows[-3:]]!=[store,pea,site]: raise ValueError('Last three executed instructions are not adjacent STA/PEA/JMP')
    s,p,j=rows[-3:]
    if any(x['pb']!=site>>16 for x in (s,p,j)): raise ValueError('Trace program bank mismatch')
    if any(x['e']!=0 or x['m']!=0 or x['d']+dp!=vector for x in (s,p,j)):
        raise ValueError('CPU not in verified 16-bit accumulator/direct page state')
    if any(x['a']!=s['a'] for x in (p,j)) or (s['a']&65535)!=(target&65535):
        raise ValueError('Accumulator written to DP does not equal observed JMP destination')
    if not (s['s']==p['s'] and (p['s']-2)&65535==j['s']): raise ValueError('PEA stack effect does not match trace')
    if any((x['e'],x['m'],x['x8'],x['c']) != (j['e'],j['m'],j['x8'],j['c']) for x in (s,p)):
        raise ValueError('State changed in STA/PEA/JMP sequence')
    fp=fingerprint(raw)
    observations=[]
    for line in hints.strip().splitlines():
        m=HINT.fullmatch(line.strip())
        if m and int(m.group(3),16)==site:
            observations.append(m.groups())
    if len(observations)!=1: raise ValueError('Exactly one ROM-bound hint for site required')
    h=observations[0]
    if h[0].lower()!=fp or int(h[1],16)!=target or h[3]!='FLOW' or tuple(map(int,h[4:]))!=(j['e'],j['m'],j['x8'],j['c']):
        raise ValueError('Runtime observation/ROM fingerprint/state mismatch')
    rom_offset(raw,target)
    return dict(schema='forja65.dp-indirect-frontier.v1', status='DP_JMP_LOCAL_WRITER_TRACE_ATTESTED',mapper='HiROM',
                rom_sha256=hashlib.sha256(raw).hexdigest(),rom_fingerprint=fp,
                source=f'{site:06X}',target=f'{target:06X}',source_opcode='6C',target_opcode=f'{at(target):02X}',
                store_site=f'{store:06X}',store_opcode='85',pea_site=f'{pea:06X}',pea_opcode='F4',
                pointer_absolute=f'{vector:04X}',written_value=f'{s["a"]&65535:04X}',
                return_word=f'{push_word:04X}',cpu_state=dict(e=j['e'],m=j['m'],x=j['x8'],c=j['c']),
                stack_before=f'{p["s"]:04X}',stack_after=f'{j["s"]:04X}',
                trace_sha256=hashlib.sha256(trace.encode()).hexdigest(),
                evidence=dict(rom_opcode=True, local_store_trace=True, pea_stack_trace=True,runtime_hint=True,last_error=True),
                limitations=['Derived from instruction trace and exact ROM opcode sequence, not a direct WRAM bus snapshot.',
                             'Only this observed destination, CPU state, and ROM hash are certified for code generation.',
                             'Full deterministic replay is required to prove gameplay or RTS-stack safety.'])

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    for n in ('rom','trace','hints','last-error'):ap.add_argument('--'+n,type=Path,required=True)
    ap.add_argument('--site');ap.add_argument('--target');ap.add_argument('--out',type=Path)
    a=ap.parse_args()
    parse=lambda s: int(s.replace(':','').removeprefix('0x'),16) if s else None
    result=audit(a.rom.read_bytes(),a.trace.read_text(),a.hints.read_text(),a.last_error.read_text(),parse(a.site),parse(a.target))
    payload=json.dumps(result,indent=2)+'\n'
    if a.out:a.out.write_text(payload)
    else: print(payload,end='')
if __name__=='__main__':
    try: main()
    except (OSError,ValueError) as exc:raise SystemExit(f'RIE DP audit rejected: {exc}')
