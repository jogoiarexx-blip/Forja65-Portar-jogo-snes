#!/usr/bin/env python3
"""Missing states may be added only without shadowing an existing domain."""
import hashlib, importlib.util, json, tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('cfg',Path(__file__).resolve().parents[1]/'tools/integrate-generated-cfg.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
    r=Path(temp);p=r/'port';g=r/'gen'
    (p/'src').mkdir(parents=True);(p/'assets').mkdir();(g/'src').mkdir(parents=True)
    rom=b'test';(p/'assets/cart-data.bin').write_bytes(rom)
    alias='static const Forja65AliasEntry kForja65Aliases[]={\n{0x000000u,0x009000u},\n};\n'
    def write_gen(text):
        (g/'src/dispatch.cpp').write_text(alias+text)
    old='{0x009000u,false,true,false,false,false,&sub_old,0x009000u},\n'
    (p/'src/dispatch.cpp').write_text(alias+'static const Forja65DispatchEntry kForja65Dispatch[]={\n'+old+'};\n')
    (p/'CMakeLists.txt').write_text('add_library(core src/dispatch.cpp)\n')
    cpp='#include "generated.hpp"\nvoid sub_009000_E0M0X0C0(CpuState&, SnesRuntime&, std::uint32_t) {}\n'
    (g/'src/generated_000.cpp').write_text(cpp)
    row='{0x009000u,false,false,false,true,false,&sub_009000_E0M0X0C0,0x009000u},\n'
    write_gen(row)
    proof=r/'proof.json';proof.write_text(json.dumps({'entry':'009000','rom_opcode_mismatches':0,'code_sha256':hashlib.sha256(cpp.encode()).hexdigest(),'rom':{'sha256':hashlib.sha256(rom).hexdigest()}}))
    try:m.integrate(p,g,'009000',proof,commit=False)
    except ValueError:pass
    else:raise AssertionError('Default must reject shared PCs')
    # Partial overlap is not subtracted from a generated carry wildcard.
    initial=(p/'src/dispatch.cpp').read_text()
    (p/'src/dispatch.cpp').write_text(initial.replace('false,true,false,false,false,&sub_old','false,false,false,true,false,&sub_old'))
    write_gen(row.replace('true,false,&','false,false,&'))
    try:m.integrate(p,g,'009000',proof,commit=False,missing_states=True)
    except ValueError as exc:assert 'already owned' in str(exc)
    else:raise AssertionError('Partially overlapping carry wildcard must be rejected')
    (p/'src/dispatch.cpp').write_text(initial);write_gen(row)
    result=m.integrate(p,g,'009000',proof,commit=True,missing_states=True)
    assert result['new_dispatch_owner_sites']==0
    assert result['new_instruction_sites']==0 and result['new_state_sites']==1 and result['state_domain_overlap']==0
    assert old in (p/'src/dispatch.cpp').read_text()
    # A wildcard partially overlapping C0 must be rejected conservatively.
    assert m.state_domains_overlap(row.strip(),row.replace('true,false,&','false,false,&').strip())
    assert not m.state_domains_overlap(row.strip(),row.replace('true,false,&','true,true,&').strip())
    prior_source=(p/'src/forja_009000.cpp').read_bytes()
    prior_dispatch=(p/'src/dispatch.cpp').read_text()
    cpp1=cpp.replace('E0M0X0C0','E0M0X0C1')
    row1=row.replace('true,false,&','true,true,&').replace('E0M0X0C0','E0M0X0C1')
    (g/'src/generated_000.cpp').write_text(cpp1);write_gen(row1)
    proof.write_text(json.dumps({'entry':'009000','rom_opcode_mismatches':0,'code_sha256':hashlib.sha256(cpp1.encode()).hexdigest(),'rom':{'sha256':hashlib.sha256(rom).hexdigest()}}))
    result=m.integrate(p,g,'009000',proof,commit=True,missing_states=True,source_unit='e0m0x0c1')
    assert result['source_file']=='src/forja_009000_e0m0x0c1.cpp'
    assert (p/'src/forja_009000.cpp').read_bytes()==prior_source
    assert all(line in (p/'src/dispatch.cpp').read_text() for line in prior_dispatch.splitlines() if line.startswith('{'))
    assert (p/result['source_file']).read_text()==cpp1
    before=(p/'src/dispatch.cpp').read_text()
    try:m.integrate(p,g,'009000',proof,commit=True,missing_states=True,source_unit='duplicate')
    except ValueError:pass
    else:raise AssertionError('Duplicate global function must still be rejected')
    assert (p/'src/dispatch.cpp').read_text()==before and not (p/'src/forja_009000_duplicate.cpp').exists()
    try:m.integrate(p,g,'009000',proof,commit=True,missing_states=True,source_unit='../unsafe')
    except ValueError:pass
    else:raise AssertionError('Unsafe source unit must be rejected')
print('MISSING_STATE_INTEGRATOR_PASS: default rejection, disjoint widths, carry domains, preservation')
