#!/usr/bin/env python3
"""RIE DP JMP frontier, opt-in: audit ROM+trace, generate, then merge safely.

Only supports proven STA direct-page + PEA + JMP (abs) sequences and
refuses any mismatched ROM, stale trace, ambiguous latest error or bus state.
"""
import argparse
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path


def run(cmd):
    p=subprocess.run(cmd,text=True,capture_output=True)
    if p.returncode: raise ValueError((p.stderr or p.stdout)[-2500:])
    return p.stdout


def prepare(forja,rom,project,diagnostics,out,apply=False):
    forja,rom,project,diagnostics,out=map(lambda p:Path(p).resolve(),(forja,rom,project,diagnostics,out))
    if out.exists() and any(out.iterdir()):raise ValueError('Output directory must be new/empty to exclude stale proof')
    if diagnostics==out or out in diagnostics.parents or diagnostics in out.parents:raise ValueError('Cannot modify diagnostic directory')
    data=rom.read_bytes()
    if hashlib.sha256(data).digest()!=hashlib.sha256((project/'assets/cart-data.bin').read_bytes()).digest():
        raise ValueError('Project and supplied ROM do not match')
    spec=importlib.util.spec_from_file_location('dp_jmp_audit',forja/'tools/audit-dp-indirect-frontier.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    names=('forja65-crash-trace.txt','forja65-runtime-hints.txt','forja65-last-error.txt')
    trace,hints,error=((diagnostics/name).read_text() for name in names)
    proof=module.audit(data,trace,hints,error)
    dest=proof['target']
    out.mkdir(parents=True,exist_ok=True)
    proof_path=out/'dp-jmp-proof.json'
    proof_path.write_text(json.dumps(proof,indent=2)+'\n')
    generated=out/'generated'
    run(['node',str(forja/'tools/generate-observed-flow.js'),str(rom),str(diagnostics/names[1]),dest,
         str(generated),'--verified-target','--dp-jmp-proof',str(proof_path)])
    cmd=[sys.executable,str(forja/'tools/integrate-generated-cfg.py'),'--project',str(project),
         '--generated',str(generated/'verified'),'--entry',dest,
         '--proof',str(generated/'verified/rom-proof.json'),'--preserve-existing']
    preview=json.loads(run(cmd))
    if preview.get('address_overlap') or preview.get('state_domain_overlap'):
        raise ValueError('Conflicting native handlers')
    if preview['new_instruction_sites']<1:
        raise ValueError('No new destination sites (already integrated or incompatible state)')
    if apply:
        merged=json.loads(run(cmd+['--apply']))
        if merged['new_instruction_sites']!=preview['new_instruction_sites'] or merged.get('address_overlap'):
            raise ValueError('Unexpected integration changes')
    else: merged=preview
    report={'schema':'forja65.rie-dp-indirect-frontier.v1','source':proof['source'],'target':dest,
            'rom_sha256':proof['rom_sha256'],'pointer_absolute':proof['pointer_absolute'],
            'trace_verified':True,'bus_sampled':False,'integration':merged,'applied':apply,
            'full_replay_verified':False,'windows_build_verified':False}
    (out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
    return report

if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument('--forja',type=Path,default=Path(__file__).resolve().parent.parent)
    for n in ('rom','project','diagnostics','out'):a.add_argument('--'+n,required=True,type=Path)
    a.add_argument('--apply',action='store_true')
    t=a.parse_args()
    try: print(json.dumps(prepare(t.forja,t.rom,t.project,t.diagnostics,t.out,t.apply),indent=2))
    except (ValueError,OSError,json.JSONDecodeError) as e:raise SystemExit('RIE DP frontier rejected: '+str(e))
