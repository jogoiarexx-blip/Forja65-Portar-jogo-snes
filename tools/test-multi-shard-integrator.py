#!/usr/bin/env python3
"""Forja65: multi-shard integration, full-proof, missing-source and tampering checks."""
from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
import hashlib
import json
import shutil
p=Path(__file__).with_name('integrate-generated-cfg.py')
spec=importlib.util.spec_from_file_location('cfg_integrator_v06',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with TemporaryDirectory() as td:
 r=Path(td); port=r/'port'; g=r/'generated'
 (port/'src').mkdir(parents=True);(port/'assets').mkdir();(g/'src').mkdir(parents=True)
 (port/'assets/cart-data.bin').write_bytes(b'ROM_TEST_4')
 (port/'CMakeLists.txt').write_text('target_sources(x PRIVATE src/dispatch.cpp)')
 (port/'src/dispatch.cpp').write_text('static const Forja65DispatchEntry kForja65Dispatch[] = {\n{0xABC999u,false,false,false,false,false,&sub_old,0xABC999u},\n};\n')
 names=['generated_001.cpp','generated_010.cpp']
 functions=['sub_ABC000_E0M0X0C0_part0','sub_ABC000_E0M0X0C0_part1']
 sites=['ABC000','ABC003']
 for fn,name,site in zip(functions,names,sites):
  (g/'src'/name).write_text('#include "generated.hpp"\n'+
     f'void {fn}(CpuState& cpu, SnesRuntime& hw, std::uint32_t pc) {{\n'
     f'  switch(pc){{case 0x{site}u: goto L_{site}; default: return;}}\n'
     f'L_{site}:\n  return;\n}}\n')
 (g/'src/dispatch.cpp').write_text('static const Forja65DispatchEntry kForja65Dispatch[] = {\n'+
   ''.join(f'{{0x{s}u,false,false,false,false,false,&{fn},0xABC000u}},\n' for s,fn in zip(sites,functions))+'};\n')
 sources=[(g/'src'/f).read_text() for f in names]
 proof={'entry':'ABC000','rom_opcode_mismatches':0,
        'code_sha256':hashlib.sha256('\n'.join(sources).encode()).hexdigest(),
        'source_shards':[{'name':n,'sha256':hashlib.sha256(t.encode()).hexdigest()} for n,t in zip(names,sources)],
        'rom':{'sha256':hashlib.sha256(b'ROM_TEST_4').hexdigest()}}
 pp=r/'proof.json';pp.write_text(json.dumps(proof))
 result=m.integrate(port,g,'ABC000',pp,commit=True)
 assert result['shard_count']==2 and result['new_dispatch_rows']==2
 body=(port/'src/forja_abc000.cpp').read_text()
 assert all(fn in body for fn in functions)
 # Partial proof MUST fail, even when another shard happens to contain entry.
 (port/'src/forja_abc000.cpp').unlink()
 (port/'src/dispatch.cpp').write_text('static const Forja65DispatchEntry kForja65Dispatch[] = {\n{0xABC999u,false,false,false,false,false,&sub_old,0xABC999u},\n};\n')
 (port/'CMakeLists.txt').write_text('target_sources(x PRIVATE src/dispatch.cpp)')
 pp.write_text(json.dumps({**proof,'source_shards':proof['source_shards'][:1]}))
 try:m.integrate(port,g,'ABC000',pp,commit=True)
 except ValueError as e:assert 'authenticate every' in str(e)
 else:raise AssertionError('accepted partial proof')
 pp.write_text(json.dumps(proof))
 f=g/'src/generated_010.cpp';f.write_text(f.read_text().replace('L_ABC003:','L_FFFFFF:'))
 try:m.integrate(port,g,'ABC000',pp,commit=True)
 except ValueError as e:assert 'authenticate every' in str(e)
 else:raise AssertionError('accepted modified shard')
 print('PASS: two-part import, complete provenance required, tampering rejected')
