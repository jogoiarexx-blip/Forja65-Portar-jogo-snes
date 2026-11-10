#!/usr/bin/env python3
"""Prepare ROM-verified static JSR/JSL seeds for the next bounded CFG generation.

Seeds are *static CFG evidence*, never fabricated runtime observations.
This command does not alter the native port, nor assume that a call is taken.
Use its knowledge JSON as --knowledge for tools/forja65.js analyze, then run
integrate-cfg-closure.py with ROM proofs, compile, and replay.
"""
import argparse
import hashlib
import json
from pathlib import Path


def rom_offset(rom_size, address, mapping):
    bank, off = (address >> 16) & 0xff, address & 0xffff
    if bank in (0x7e,0x7f): return None
    full = 0x40 <= bank <= 0x7d or bank >= 0xc0
    if mapping == 'HiROM':
        if off < 0x8000 and not full: return None
        physical = ((bank & 0x3f) << 16) | off
    elif mapping == 'LoROM':
        if off < 0x8000 and not full: return None
        physical = ((bank & 0x7f) << 15) | (off & 0x7fff)
    else:
        raise ValueError('Unsupported ROM mapping for strict static seed validation')
    if physical >= rom_size: return None  # reject unsafe mirrors, not infer
    return physical


def validate_call(rom, from_address, target, kind, mapping):
    if kind not in ('JSR','JSL'): return False
    pos=rom_offset(len(rom),from_address,mapping)
    width=3 if kind=='JSR' else 4
    if pos is None or pos+width>len(rom):return False
    ins=rom[pos:pos+width]
    if kind=='JSR':
        if ins[0]!=0x20:return False
        expected=(from_address&0xff0000)|(ins[1]|(ins[2]<<8))
    else:
        if ins[0]!=0x22:return False
        expected=ins[1]|(ins[2]<<8)|(ins[3]<<16)
    return expected==target


def collect(analysis, rom, mapping, max_new=16, max_per_target=3, root=None):
    if max_new<1 or max_per_target<1:raise ValueError('Invalid bounded seed limits')
    existing={fn['start'] for fn in analysis.get('functions',[]) if isinstance(fn.get('start'),int)}
    seen=set(); accepted=[]; rejected=[]
    for fn in analysis.get('functions',[]):
        if root is not None and fn.get('start')!=root:continue
        for c in fn.get('calls',[]):
            site,target,kind=c.get('from'),c.get('target'),c.get('kind')
            if kind not in ('JSR','JSL') or not isinstance(site,int) or not isinstance(target,int):continue
            if target in existing:continue
            state=c.get('state') or {}
            normalized=tuple((state.get(k) if k!='carry' else state.get('carry')) for k in ('emulation','m8','x8','carry'))
            key=(site,target,kind,normalized)
            if key in seen:continue
            seen.add(key)
            if not validate_call(rom,site,target,kind,mapping):
                rejected.append({'from':f'{site:06X}','target':f'{target:06X}','reason':'Opcode/operand/ROM mismatch'})
                continue
            accepted.append({'from':f'{site:06X}','target':f'{target:06X}','kind':kind,'state':{
                'emulation':bool(state.get('emulation',False)),
                'm8':bool(state.get('m8',False)),
                'x8':bool(state.get('x8',False)),
                'carry':state.get('carry')}})
    # Preserve observed per-call CPU state when available; deterministic budget.
    selected=[]; per_target={}; targets=set()
    for row in sorted(accepted,key=lambda x:(x['target'],x['from'],str(x['state']))):
        address=row['target']
        if per_target.get(address,0)>=max_per_target:continue
        if address not in targets and len(targets)>=max_new:continue
        selected.append(row);targets.add(address);per_target[address]=per_target.get(address,0)+1
    return selected,rejected,len(accepted),len(targets)


def run(rom_path,analysis_path,out,mapping,fnv,max_new,max_per_target,root=None):
    rom=rom_path.read_bytes(); analysis=json.loads(analysis_path.read_text())
    rows,rejected,total,target_count=collect(analysis,rom,mapping,max_new,max_per_target,root)
    if not rows:raise ValueError('No ROM-verified missing direct call targets found')
    entries=[{'address':int(row['target'],16),'name':'static_call_'+row['target'],
              'category':'UNKNOWN','priority':80,'state':row['state'],
              'source':'ROM-verified static JSR/JSL','evidence':['static-only',
              f"{row['kind']} at {row['from']} -> {row['target']}"]} for row in rows]
    # Prioritize the already decoded source routine too, so newly prioritized
    # dependencies do not hide their parent under the global CFG budget.
    if root is not None:
        parents=[f for f in analysis.get('functions',[]) if f.get('start')==root]
        if not parents or rom_offset(len(rom),root,mapping) is None:
            raise ValueError('CFG root absent or outside ROM')
        import re
        match=re.fullmatch(r'\d+\|([01])([01])([01])([01Q])',parents[0].get('stateSig',''))
        if not match:raise ValueError('CFG root has no unambiguous entry CPU state')
        e,m,x,c=match.groups()
        entries.insert(0,{'address':root,'name':'static_call_'+f'{root:06X}',
             'category':'UNKNOWN','priority':81,
             'state':{'emulation':e=='1','m8':m=='1','x8':x=='1','carry':None if c=='Q' else c=='1'},
             'source':'Previously decoded ROM CFG entry',
             'evidence':['static-only',f'generated function start {root:06X}']})
    out.mkdir(parents=True,exist_ok=True)
    pack={'schema':'forja65.knowledge.v1','rom':{'fnv1a64':fnv.lower(),
          'sha256':hashlib.sha256(rom).hexdigest()},'producer':{'tool':'expand-static-direct-calls.py'},
          'entries':entries,'dataRegions':[],'dispatch':[],
          'limits':['Static ROM call sites, not runtime execution observations',
                    'Do not replace dynamic indirect-call evidence','Regenerate and replay before using in ports']}
    (out/'static-direct-call-knowledge.json').write_text(json.dumps(pack,indent=2)+'\n')
    report={'schema':'forja65.static-direct-call-seeds.v1','rom_sha256':hashlib.sha256(rom).hexdigest(),
            'mapping':mapping,'selected_seed_states':len(rows),'selected_targets':target_count,
            'verified_candidates':total,'rejected':rejected,'seeds':rows,'runtime_observed':False}
    (out/'static-direct-call-report.json').write_text(json.dumps(report,indent=2)+'\n')
    return report


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for k in ('rom','analysis','out'):p.add_argument('--'+k,type=Path,required=True)
    p.add_argument('--mapping',choices=['HiROM','LoROM'],required=True)
    p.add_argument('--rom-fnv1a64',required=True,help='From generated ROM fingerprint')
    p.add_argument('--root',help='Restrict static evidence to one generated function start (hex)')
    p.add_argument('--max-new',type=int,default=16)
    p.add_argument('--max-per-target',type=int,default=3)
    a=p.parse_args()
    try:
        result=run(a.rom,a.analysis,a.out,a.mapping,a.rom_fnv1a64,a.max_new,a.max_per_target,int(a.root,16) if a.root else None)
        print(json.dumps({'selected_targets':result['selected_targets'], 'selected_seed_states':result['selected_seed_states'], 'rejected':len(result['rejected'])}))
    except (OSError,ValueError,KeyError) as e:p.exit(2,'Static CFG expansion rejected: '+str(e)+'\n')

if __name__=='__main__':main()
