#!/usr/bin/env python3
"""Deterministic regression for bounded, evidence-only direct CFG closure."""
import importlib.util
import tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'tools'/file)
    mod=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

cfg=load('forja_cfg_closure','integrate-cfg-closure.py')
stack=load('forja_stack_bridge','stack-runtime-compat.py')
checks=0

def check(ok,why):
    global checks
    assert ok,why
    checks+=1

functions={'functions':[
 {'start':0x8000,'calls':[{'kind':'JSR','target':0x8020},{'kind':'JSL','target':0x8040},
                           {'kind':'JMP-TABLE','target':0x8060},{'kind':'JSR-TABLE','target':0x8080}]},
 {'start':0x8020,'calls':[{'kind':'JSL','target':0x8060},{'kind':'JSL','target':0x8000}]},
 {'start':0x8040,'calls':[{'kind':'JMP-TABLE','target':0x8080}]},
 {'start':0x8060,'calls':[]},
 {'start':0x8080,'calls':[]},
]}
plan=cfg.dependency_closure(functions,0x8000,2,9)
check([int(p['target'],16) for p in plan]==[0x8000,0x8020,0x8040,0x8060],
      'bounded BFS imports direct JSR/JSL reachability only')
check([x['depth'] for x in plan]==[0,1,1,2],'depth preservation')
check(all(x['target']!='008080' for x in plan),'unproven indirect domain never imported')
check(len(cfg.dependency_closure(functions,0x8000,2,2))==2,'handler quota')
check(len(cfg.dependency_closure(functions,0x8000,0,12))==1,'zero depth root only')
check(cfg.dependency_closure(functions,0x8000,2,9)==plan,'deterministic traversal')
for args in [(functions,0x9000,2,9),(functions,0x8000,-1,9),(functions,0x8000,2,0)]:
    try:cfg.dependency_closure(*args)
    except ValueError:checks+=1
    else:raise AssertionError('invalid closure not rejected')
with tempfile.TemporaryDirectory() as root:
    f=Path(root)/'runtime.hpp'
    f.write_text('struct CpuState { '+stack.DECL+' };\n'+stack.ANCHOR+'\n',encoding='utf8')
    check(stack.install(f),'additive ABI patch applied')
    content=f.read_text()
    check('popLongReturn(SnesRuntime&);' in content and 'push16Value(SnesRuntime&,std::uint16_t,bool full);' in content,
          'all required extended stack signatures staged')
    check(stack.install(f) is False,'stack compat is idempotent')
    check(content==f.read_text(),'second pass preserved source bytes')
    f.write_text('unknown runtime',encoding='utf8')
    try:stack.install(f)
    except ValueError:checks+=1
    else:raise AssertionError('unsupported runtime accepted')
print('CFG_DIRECT_CALL_CLOSURE_V043690_PASS checks='+str(checks))
