#!/usr/bin/env python3
"""REV155: transactional, replay-gated incremental 65C816 AOT learning.

Never authorizes a native code change unless the same recorded inputs preserve
ROM, frame count, instruction count, NMI/IRQ services and WRAM/framebuffer hashes.
Use short deterministic replays for iteration; a separate full-game replay is required.
"""
import argparse
import json
import re
import shutil
import subprocess
from pathlib import Path

FIELDS = ('rom', 'frames', 'instructions', 'nmi_services', 'irq_services', 'wram_hash', 'framebuffer_hash')

def parse_qa(path):
    result={}
    for line in Path(path).read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k,v=line.split('=',1)
            if k in result: raise ValueError('duplicated QA field: '+k)
            result[k]=v
    missing=[k for k in FIELDS if k not in result]
    if missing:raise ValueError('missing QA fields: '+','.join(missing))
    return result

def parse_interpreter(path, zero_allowed=False):
    if not Path(path).exists():
        if zero_allowed:
            return {'blocks':0, 'instructions':0, 'entries':[]}
        raise ValueError('missing interpreter report (zero fallback not verified)')
    text=Path(path).read_text()
    if not text.startswith('FORJA65_CPU_INTERPRETER 1\n'):raise ValueError('invalid interpreter report')
    b=re.search(r'^blocks=(\d+)$',text,re.M)
    n=re.search(r'^instructions=(\d+)$',text,re.M)
    if not b or not n:raise ValueError('missing counts')
    return {'blocks':int(b.group(1)), 'instructions':int(n.group(1)),
            'entries':[line for line in text.splitlines() if re.match(r'^[A-Fa-f0-9]{6} (?:M[01]X[01]|E1) from=',line)]}

def approve(baseline, prior, new_qa, new_interp):
    mismatches={k:[baseline[k],new_qa[k]] for k in FIELDS if baseline[k] != new_qa[k]}
    if mismatches:return False, 'QA_DIVERGENCE '+json.dumps(mismatches,sort_keys=True)
    if new_interp['instructions'] >= prior['instructions']:
        return False, 'FALLBACK_NOT_REDUCED'
    return True,'PASS'

def command(args, log, cwd=None):
    with open(log, 'w') as output:
        subprocess.run(args,cwd=cwd,stdout=output,stderr=subprocess.STDOUT,check=True)

def run(options):
    forja=Path(options.forja).resolve(); port=Path(options.port).resolve()
    compile_src=Path(options.compile_source).resolve()
    build=Path(options.build).resolve(); out=Path(options.out).resolve()
    out.mkdir(parents=True,exist_ok=True)
    reference=parse_qa(options.reference)
    interpreter=Path(options.interpreter).resolve()
    results=[]; current_bin=port/'bin/game-linux-rev155-qa'
    rom=port/'assets/cart-data.bin'
    if not current_bin.is_file() or not rom.is_file():raise ValueError('missing ROM data or tested binary')
    for index in range(options.rounds):
        tag='r155'+chr(ord(options.start_tag)+index)
        stage=out/tag;stage.mkdir(exist_ok=True)
        original_dispatch=(port/'src/dispatch.cpp').read_bytes()
        original_cmake=(port/'CMakeLists.txt').read_bytes()
        original_bin=current_bin.read_bytes()  # rollback-safe checkpoint
        previous=parse_interpreter(interpreter)
        if previous['instructions']==0:break
        integration_cmd=['node',str(forja/'tools/learn-from-interpreter.js'),'--rom',str(rom),
                         '--log',str(interpreter),'--out',str(stage/'learning'),
                         '--tag',tag,'--budget',str(options.budget),'--port',str(port)]
        verdict={'tag':tag,'before':previous['instructions'],'status':'PENDING'}
        new_shards=[]
        try:
            command(integration_cmd,stage/'learn.log')
            report=json.loads((stage/'learning/forja65-learned-report.json').read_text())
            new_shards=report.get('integracao',{}).get('arquivos',[])
            if not new_shards:raise RuntimeError('no new native routines')
            shutil.copy2(port/'src/dispatch.cpp',compile_src/'src/dispatch.cpp')
            shutil.copy2(port/'CMakeLists.txt',compile_src/'CMakeLists.txt')
            for shard in new_shards:shutil.copy2(port/shard,compile_src/shard)
            command(['cmake','-S',str(compile_src),'-B',str(build),'-G','Ninja',
                     '-DCMAKE_CXX_FLAGS_RELEASE=-O0 -DNDEBUG -g0'],stage/'cmake.log')
            command(['ninja','-C',str(build),'-j','3','game'],stage/'build.log')
            shutil.copy2(build/'game',current_bin)
            test=stage/'qa';test.mkdir()
            (test/'assets').symlink_to(port/'assets')
            envcmd=['env','FORJA65_INPUT_REPLAY='+str(Path(options.trace).resolve()),
                    'FORJA65_HEADLESS_FRAMES='+str(options.frames),str(current_bin)]
            command(envcmd,test/'run.log',cwd=test)
            next_qa=parse_qa(test/'forja65-qa-status.txt')
            # This runtime intentionally omits the interpreter report if no fallback ran.
            # Only infer zero if the exact known implementation is present AND
            # QA was written with all required fields after successful exit.
            reporter_source=(port/'src/forja_cpu_interpreter.cpp').read_text()
            zero_allowed='if(!s.blocks)return;' in reporter_source
            next_interpreter=parse_interpreter(test/'forja65-cpu-interpreter.txt',zero_allowed)
            approved,reason=approve(reference,previous,next_qa,next_interpreter)
            verdict.update({'status':reason,'after':next_interpreter['instructions'],
                            'new_routines':report['integracao']['rotinas'],
                            'discovered_fallbacks':next_interpreter['entries']})
            if not approved:raise RuntimeError(reason)
            interpreter=test/'forja65-cpu-interpreter.txt'
            results.append(verdict)
            (out/'status.json').write_text(json.dumps(results,indent=2)+'\n')
            print(json.dumps(verdict,ensure_ascii=False),flush=True)
            if next_interpreter['instructions']==0:break
        except Exception as exc:
            (port/'src/dispatch.cpp').write_bytes(original_dispatch)
            (port/'CMakeLists.txt').write_bytes(original_cmake)
            current_bin.write_bytes(original_bin)
            for shard in new_shards:
                (port/shard).unlink(missing_ok=True)
                (compile_src/shard).unlink(missing_ok=True)
            shutil.copy2(port/'src/dispatch.cpp',compile_src/'src/dispatch.cpp')
            shutil.copy2(port/'CMakeLists.txt',compile_src/'CMakeLists.txt')
            # Build directory will be reconciled on next cmake/ninja invocation.
            verdict.update({'status':'REJECTED','reason':str(exc)})
            results.append(verdict)
            (out/'status.json').write_text(json.dumps(results,indent=2)+'\n')
            print(json.dumps(verdict,ensure_ascii=False),flush=True)
            break
    return results

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    for arg in ('forja','port','compile-source','build','out','reference','interpreter','trace'):
        p.add_argument('--'+arg,required=True)
    p.add_argument('--frames',type=int,default=600)
    p.add_argument('--rounds',type=int,default=5)
    p.add_argument('--start-tag',choices=list('cdefghijklmnop'),default='c')
    p.add_argument('--budget',type=int,default=30000)
    run(p.parse_args())
