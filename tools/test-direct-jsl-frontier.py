#!/usr/bin/env python3
"""JSL cross-check regression; use --fixture-dir for real DKC3 trace fixture."""
from __future__ import annotations
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from copy import deepcopy

root=Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('direct_jsl_audit',root/'tools/audit-direct-jsl-frontier.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def run(fixture_dir:Path,rom_file:Path, port:Path=None):
    trace=(fixture_dir/'forja65-crash-trace.txt').read_text()
    hints=(fixture_dir/'forja65-runtime-hints.txt').read_text()
    err=(fixture_dir/'forja65-last-error.txt').read_text()
    rom=rom_file.read_bytes()
    src,dst=0xB6878E,0xB68081
    proof=mod.audit(rom,trace,hints,err,src,dst)
    assert proof['return_pc']=='B68792' and proof['stack_return_word']=='8791'
    assert proof['cpu_state']=={'e':0,'m':0,'x':0,'c':1}
    def bad(label,*args):
        try:
            mod.audit(*args)
        except ValueError: return
        raise AssertionError('tampered evidence accepted: '+label)
    arguments=(rom,trace,hints,err,src,dst)
    def replace_at(i,value):
        a=list(arguments);a[i]=value;return a
    r=bytearray(rom);r[src&0x3fffff]=0xEA
    bad('not a JSL',*replace_at(0,bytes(r)))
    r=bytearray(rom);r[(src&0x3fffff)+1]^=1
    bad('wrong target bytes',*replace_at(0,bytes(r)))
    bad('wrong target',rom,trace,hints,err,src,dst+1)
    bad('wrong origin',rom,trace,hints,err,src+1,dst)
    bad('stale trace',*replace_at(1,'\n'.join(trace.splitlines()[:-1])))
    bad('trace carry altered',*replace_at(1,trace.replace('b6878e A=', 'b6878e A=').replace('C=1\n','C=0\n')))
    bad('missing hints',*replace_at(2,''))
    bad('wrong hint carry',*replace_at(2,hints.replace('c=1','c=0')))
    bad('wrong error',*replace_at(3,'fluxo CFG nao resolvido em pc=1 target=2'))
    bad('non ROM bank',rom,trace,hints,err,0x7E878E,dst)
    with tempfile.TemporaryDirectory() as temp:
        out=Path(temp)/'generated'
        proofpath=Path(temp)/'proof.json'
        proofpath.write_text(json.dumps(proof))
        script=root/'tools/generate-observed-flow.js'
        cmd=['node',str(script),str(rom_file),str(fixture_dir/'forja65-runtime-hints.txt'), 'B68081',str(out),'--verified-target','--direct-jsl-proof',str(proofpath)]
        ok=subprocess.run(cmd,capture_output=True,text=True)
        assert ok.returncode==0,(ok.stdout,ok.stderr)
        emitted=json.loads((out/'proof.json').read_text())
        assert emitted['direct_jsl_trace_crosscheck']['source']==src
        for label,path,new in [
            ('sha','rom_sha256','0'*64),
            ('flags','cpu_state',{'e':0,'m':0,'x':0,'c':0}),
            ('opcode','opcode','22 00 00 00'),
            ('return','return_pc','B68793'),
            ('fingerprint','rom_fingerprint','0'*16),
        ]:
            altered=deepcopy(proof);altered[path]=new;proofpath.write_text(json.dumps(altered))
            rejected=subprocess.run(cmd,capture_output=True,text=True)
            assert rejected.returncode!=0,'generator accepted tampered '+label
        if port is not None:
            integrator_spec=importlib.util.spec_from_file_location('observed_integrator',root/'tools/integrate-observed-flow.py')
            integrator=importlib.util.module_from_spec(integrator_spec)
            integrator_spec.loader.exec_module(integrator)
            proofpath.write_text(json.dumps(emitted))
            integrator.verify_direct_jsl_proof(port,proofpath,'B68081')
            for key,value in [('source',src+1),('target',dst+1),('rom_sha256','0'*64),('state',{'e':0,'m':0,'x':0,'c':0})]:
                fake=deepcopy(emitted)
                fake['direct_jsl_trace_crosscheck'][key]=value
                proofpath.write_text(json.dumps(fake))
                try: integrator.verify_direct_jsl_proof(port,proofpath,'B68081')
                except ValueError: pass
                else: raise AssertionError('integrator accepted forged '+key)
    print('DIRECT_JSL_FRONTIER_PASS: 1 valid + 10 auditor negatives + 5 emitter negatives' + (' + 4 integrator negatives' if port else ''))

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser()
    p.add_argument('--fixture-dir',type=Path,required=True)
    p.add_argument('--rom',type=Path,required=True)
    p.add_argument('--port',type=Path)
    a=p.parse_args()
    run(a.fixture_dir,a.rom,a.port)
