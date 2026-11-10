#!/usr/bin/env python3
"""Small adversarial tests for cumulative focused-integrator reports."""
from pathlib import Path
import hashlib, importlib.util, json, tempfile
spec=importlib.util.spec_from_file_location('audit_chain',Path(__file__).resolve().parents[1]/'tools/audit-cfg-integration-chain.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
with tempfile.TemporaryDirectory() as d:
 p=Path(d);(p/'src').mkdir();(p/'assets').mkdir()
 (p/'assets/cart-data.bin').write_bytes(b'abc')
 (p/'src/forja_ab1234.cpp').write_bytes(b'a')
 (p/'src/forja_cd5678.cpp').write_bytes(b'b')
 (p/'src/dispatch.cpp').write_text('static constexpr Forja65DispatchEntry kForja65Dispatch[] = {\n'+'\n'.join('{0x%06Xu,true},' % n for n in range(6))+'\n};\n')
 rom=hashlib.sha256(b'abc').hexdigest()
 def report(e,n,before,more):
  name='src/forja_'+e.lower()+'.cpp'
  v={'entry':e,'source_file':name,'rom_sha256':rom,'state_domain_overlap':0,
     'dry_run':False,'new_dispatch_rows':more,'new_instruction_sites':more//2,
     'previous_dispatch_rows':before,'integrated_source_sha256':hashlib.sha256((p/name).read_bytes()).hexdigest()}
  rp=p/f'{e}.json';rp.write_text(json.dumps(v));return rp
 a=report('AB1234',0,0,2);b=report('CD5678',0,2,4)
 assert mod.audit(p,[a,b])['new_rows']==6
 def reject(fn):
  try:fn()
  except ValueError:return
  raise AssertionError('expected rejection')
 reject(lambda:mod.audit(p,[b,a]))
 reject(lambda:mod.audit(p,[a,a]))
 (p/'src/forja_cd5678.cpp').write_bytes(b'tampered')
 reject(lambda:mod.audit(p,[a,b]))
 (p/'src/forja_cd5678.cpp').write_bytes(b'b')
 (p/'src/dispatch.cpp').write_text('{0x000000u,true},\n')
 reject(lambda:mod.audit(p,[a,b]))
 obj=json.loads(b.read_text());obj['dry_run']=True;b.write_text(json.dumps(obj))
 reject(lambda:mod.audit(p,[a,b]))
 print('CFG_CHAIN_AUDIT_PASS: valid chain, wrong ordering, duplicate, tampered source, missing dispatch, preview rejected')
