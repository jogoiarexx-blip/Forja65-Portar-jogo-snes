#!/usr/bin/env python3
"""Forja65 RIE: bounded, ROM-proven, one-hop CFG prefetch from an integrated routine.

Only JSR calls can be integrated here. JSL and indirect edges are reported for
later analysis, not converted into runtime observations. Dry-run by default.
Every modification is made through Forja65's existing guarded integrator.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[1]
TOOLS = Path(__file__).resolve().parent
ENTRY = re.compile(r'^\{0x([A-F0-9]{6})u,', re.M)


def ensure_root(project: Path, generated: Path) -> tuple[dict, dict, bytes]:
    proof = json.loads((generated/'verified/rom-proof.json').read_text(encoding='utf8'))
    candidates = json.loads((generated/'direct-call-candidates.json').read_text(encoding='utf8'))
    raw = (project/'assets/cart-data.bin').read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    root = str(proof.get('entry','')).upper()
    if not re.fullmatch(r'[0-9A-F]{6}', root):
        raise ValueError('Malformed root entry')
    if sha != proof.get('rom',{}).get('sha256') or sha != candidates.get('rom_sha256'):
        raise ValueError('ROM SHA mismatch; no mutation allowed')
    if candidates.get('schema') != 'forja65.static-direct-call-candidates.v1' or candidates.get('root') != root:
        raise ValueError('Call candidates do not match proven root')
    sources = list((generated/'verified/src').glob('generated_*.cpp'))
    if len(sources) != 1:
        raise ValueError('Expected one authenticated source shard')
    source = sources[0].read_bytes()
    if hashlib.sha256(source).hexdigest() != proof.get('code_sha256'):
        raise ValueError('Generated root code modified')
    installed = project/'src'/f'forja_{root.lower()}.cpp'
    if not installed.is_file() or installed.read_bytes() != source:
        raise ValueError('Port root not installed from this authenticated shard')
    dispatch = (project/'src/dispatch.cpp').read_text(encoding='utf8')
    if f'{{0x{root}u,' not in dispatch:
        raise ValueError('Root not dispatched')
    return proof, candidates, raw


def plan(project: Path, generated: Path, max_new=4) -> dict:
    if max_new<1 or max_new>64:
        raise ValueError('max-new must be 1..64')
    proof, candidates, rom = ensure_root(project,generated)
    dispatch = (project/'src/dispatch.cpp').read_text(encoding='utf8')
    covered = set(ENTRY.findall(dispatch))
    root_source=(project/'src'/f"forja_{proof['entry'].lower()}.cpp").read_text()
    accepted,skipped=[],[]
    seen=set()
    for call in candidates.get('candidates',[]):
        frm, to, kind = (call.get(k) for k in ('source','target','kind'))
        if not (isinstance(frm,str) and isinstance(to,str) and re.fullmatch(r'[0-9A-F]{6}',frm) and re.fullmatch(r'[0-9A-F]{6}',to)):
            raise ValueError('Malformed candidate address')
        if kind not in ('JSR','JSL') or call.get('proof')!='ROM_LITERAL_CALL_NOT_EXECUTED':
            raise ValueError('Candidate proof marker invalid')
        if f'// ${frm} {kind} -> ${to} stack real' not in root_source:
            raise ValueError(f'Candidate {frm} -> {to} not present in authenticated source')
        at=int(frm,16)&0x3fffff
        width=3 if kind=='JSR' else 4
        data=rom[at:at+width]
        dest= (int(frm,16)&0xff0000 | data[1] | (data[2]<<8)) if kind=='JSR' and len(data)==3 else (data[1] | data[2]<<8 | data[3]<<16) if len(data)==4 else -1
        expected=(0x20 if kind=='JSR' else 0x22)
        if not data or data[0]!=expected or dest!=int(to,16) or data.hex(' ').upper()!=call.get('operand_hex'):
            raise ValueError(f'ROM opcode/operand mismatch at {frm}')
        row={'source':frm,'target':to,'kind':kind,'runtime_observed':False}
        if to in covered:
            skipped.append({**row,'reason':'already_dispatched'})
        elif kind!='JSR':
            skipped.append({**row,'reason':'JSL_requires_separate_state_proof'})
        elif to in seen:
            skipped.append({**row,'reason':'duplicate_target'})
        elif len(accepted)>=max_new:
            skipped.append({**row,'reason':'bounded_budget'})
        else:
            accepted.append(row);seen.add(to)
    return {'schema':'forja65.rie-one-hop-jsr-chain.v1', 'rom_sha256':proof['rom']['sha256'],
            'root':proof['entry'], 'runtime_observed':False,'eligible':accepted,
            'skipped':skipped,'limits':['JSR only','Static candidates are not runtime observations',
                                     'Generated C++ and dispatcher require build/replay validation']}


def run(project: Path, generated: Path, output: Path, max_new: int, apply: bool) -> dict:
    result=plan(project, generated,max_new)
    result['apply_requested']=apply
    result['integrations']=[]
    if apply:
        for call in result['eligible']:
            folder=output/'targets'/call['target'].lower()
            folder.mkdir(parents=True,exist_ok=True)
            site=folder/'static-jsr-site.json'
            cmd=[sys.executable,str(TOOLS/'audit-direct-jsr.py'),'--port',str(project),
                 '--caller',call['source'],'--target',call['target'],'--output',str(site)]
            subprocess.run(cmd,check=True,capture_output=True,text=True)
            cmd=['node',str(TOOLS/'generate-observed-flow.js'),str(project/'assets/cart-data.bin'),
                 str(site),call['target'],str(folder),'--static-jsr','--verified-target']
            subprocess.run(cmd,check=True,capture_output=True,text=True)
            cmd=[sys.executable,str(TOOLS/'integrate-generated-cfg.py'),'--project',str(project),
                 '--generated',str(folder/'verified'),'--entry',call['target'],
                 '--proof',str(folder/'verified/rom-proof.json'),'--apply',
                 '--report',str(folder/'integration.json')]
            subprocess.run(cmd,check=True,capture_output=True,text=True)
            result['integrations'].append(json.loads((folder/'integration.json').read_text()))
    output.mkdir(parents=True,exist_ok=True)
    (output/'rie-jsr-chain-report.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project',type=Path,required=True)
    p.add_argument('--generated',type=Path,required=True,help='ROM-authenticated generated target directory')
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--max-new',type=int,default=4)
    p.add_argument('--apply',action='store_true')
    args=p.parse_args()
    try:
        result=run(args.project,args.generated,args.output,args.max_new,args.apply)
        print(json.dumps({'root':result['root'],'eligible':result['eligible'],
           'skipped':result['skipped'],'integrated':len(result['integrations']),
           'runtime_observed':False,'mode':'apply' if args.apply else 'dry-run'},indent=2))
    except (ValueError,KeyError,OSError,subprocess.CalledProcessError,IndexError) as e:
        p.exit(2,f'RIE JSR chain rejected: {e}\n')

if __name__=='__main__': main()
