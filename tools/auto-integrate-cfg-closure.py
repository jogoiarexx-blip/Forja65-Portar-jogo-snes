#!/usr/bin/env python3
"""ROM-bound latest-crash -> CFG regeneration -> bounded direct-call closure.

The missing CPU target MUST be observed in both last-error and runtime hints.
Default mode is preview; --apply exports a separate project copy. Indirect
calls and speculative return destinations are not silently authorized.
"""
import argparse
import importlib.util
import json
import subprocess
from pathlib import Path


def module(path, name):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def run(project,rom,hints,error,forja,out,max_sites,max_depth,max_handlers,apply=False,stack_compat=False):
    selector=module(forja/'tools/advance-latest-runtime-blocker.py','cfg_observed_selector')
    closure=module(forja/'tools/integrate-cfg-closure.py','cfg_observed_closure')
    selected,target=selector.select(hints.read_text(encoding='utf8'),error.read_text(encoding='utf8'))
    out.mkdir(parents=True,exist_ok=True)
    note=out/'observed-runtime-hint.txt'
    note.write_text(selected+'\n',encoding='utf8')
    gen=out/'generated'
    command=['node',str(forja/'tools/forja65.js'),'analyze',str(rom),
             '--hints',str(note),'--max',str(max_sites),'--out',str(gen)]
    completed=subprocess.run(command,capture_output=True,text=True,check=False)
    if completed.returncode:
        raise ValueError('Forja analysis rejected: '+(completed.stderr or completed.stdout)[-500:])
    report=closure.stage(project,gen,rom,forja,target,out/'closure',max_depth,
                         max_handlers,apply,stack_compat)
    return {'schema':'forja65.auto-cfg-closure.v1','observed_target':target,
            'source_hint':selected,'direct_dependency_candidates':report['total_candidates'],
            'staged_handlers':report['staged_handlers'],'exported':report['exported'],
            'report':str(out/'closure/closure-report.json'),
            'limits':'Static ROM/ABI checks only; compile and replay the resulting port.'}


def main():
    a=argparse.ArgumentParser(description=__doc__)
    for k in ('project','rom','hints','last-error','out'):
        a.add_argument('--'+k,type=Path,required=True)
    a.add_argument('--forja',type=Path,default=Path(__file__).resolve().parent.parent)
    a.add_argument('--max-sites',type=int,default=8192)
    a.add_argument('--max-depth',type=int,default=2)
    a.add_argument('--max-handlers',type=int,default=16)
    a.add_argument('--apply',action='store_true')
    a.add_argument('--stack-compat',action='store_true')
    p=a.parse_args()
    try:
        if p.max_sites<256 or p.max_sites>50000:raise ValueError('Invalid CFG budget')
        report=run(p.project.resolve(),p.rom.resolve(),p.hints.resolve(),
                   getattr(p,'last_error').resolve(),p.forja.resolve(),p.out.resolve(),
                   p.max_sites,p.max_depth,p.max_handlers,p.apply,p.stack_compat)
        print(json.dumps(report,indent=2))
    except (OSError,ValueError) as exc:
        a.exit(2,'Auto CFG closure rejected: '+str(exc)+'\n')

if __name__=='__main__':main()
