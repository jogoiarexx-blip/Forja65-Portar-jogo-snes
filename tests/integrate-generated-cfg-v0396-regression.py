#!/usr/bin/env python3
"""Regression test for safe, ROM-locked Forja65 CFG crossfeed."""
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile

script = Path(__file__).resolve().parents[1]/'tools/integrate-generated-cfg.py'
spec = importlib.util.spec_from_file_location('forja_cfg', script)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def rejects(fn, needle):
    try: fn()
    except ValueError as exc: assert needle in str(exc), (needle, str(exc))
    else: raise AssertionError('Expected failure: '+needle)

with tempfile.TemporaryDirectory() as temp:
    root = Path(temp)
    project = root/'port'; generated=root/'generated'
    (project/'assets').mkdir(parents=True); (project/'src').mkdir()
    (generated/'src').mkdir(parents=True)
    rom=b'\xEA\x01\x02\x03'
    (project/'assets/cart-data.bin').write_bytes(rom)
    # Keep this legacy fixture aligned with the alias contract added in v0.4.36.90.
    def write_generated_dispatch(content):
        (generated/'src/dispatch.cpp').write_text('static const Forja65AliasEntry kForja65Aliases[]={\n{0x000001u,0x009000u},\n};\n'+content)
    (project/'src/dispatch.cpp').write_text('static const Forja65AliasEntry kForja65Aliases[]={\n{0x000000u,0x008000u},\n{0x000002u,0x00A000u},\n};\n'
       'static const Forja65DispatchEntry kForja65Dispatch[]={\n'
       '{0x008000u,false,false,false,false,false,&sub_008000_E0M0X0CQ,0x008000u},\n'
       '{0x00A000u,false,false,false,false,false,&sub_00A000_E0M0X0CQ,0x00A000u},\n};\n')
    (project/'src/generated_existing.cpp').write_text('void sub_008000_E0M0X0CQ(CpuState&, SnesRuntime&, std::uint32_t entryPc) {}\nL_008000:\n// $008000 NOP\n')
    (project/'CMakeLists.txt').write_text('add_library(core src/dispatch.cpp)\n')
    cpp = '#include "generated.hpp"\nvoid sub_009000_E0M0X0C1(CpuState&, SnesRuntime&, std::uint32_t entryPc) {}\nL_009000:\n// $009000 NOP\nL_008000:\n// $008000 NOP\n'
    (generated/'src/generated_000.cpp').write_text(cpp)
    write_generated_dispatch('{0x009000u,false,false,false,true,true,&sub_009000_E0M0X0C1,0x009000u},\n')
    proof = root/'proof.json'
    data={'entry':'009000','rom_opcode_mismatches':0,'code_sha256':hashlib.sha256(cpp.encode()).hexdigest(),
          'rom':{'sha256':hashlib.sha256(rom).hexdigest()}}
    proof.write_text(json.dumps(data))
    original = (project/'src/dispatch.cpp').read_bytes()
    result = module.integrate(project, generated, '009000', proof, commit=False)
    assert result['new_dispatch_rows']==1 and result['dry_run']
    assert (project/'src/dispatch.cpp').read_bytes()==original
    altered=dict(data); altered['code_sha256']='0'*64; proof.write_text(json.dumps(altered))
    rejects(lambda:module.integrate(project,generated,'009000',proof,commit=False),'do not match')
    proof.write_text(json.dumps(data))
    (project/'assets/cart-data.bin').write_bytes(b'bad!')
    rejects(lambda:module.integrate(project,generated,'009000',proof,commit=False),'ROM mismatch')
    (project/'assets/cart-data.bin').write_bytes(rom)
    write_generated_dispatch('{0x008000u,false,false,false,true,true,&sub_009000_E0M0X0C1,0x009000u},\n'
                                                '{0x009000u,false,false,false,true,true,&sub_009000_E0M0X0C1,0x009000u},\n')
    rejects(lambda:module.integrate(project,generated,'009000',proof,commit=False),'conflicts')
    safe = module.integrate(project, generated, '009000', proof, commit=False, preserve_existing=True)
    assert safe['preserved_existing_sites']==1 and safe['new_dispatch_rows']==1 and safe['new_dispatch_owner_sites']==1
    assert (project/'src/dispatch.cpp').read_bytes()==original
    # A complete, authenticated overlap must still reject changed semantics or width.
    bad = cpp.replace('// $008000 NOP', '// $008000 LDA')
    (generated/'src/generated_000.cpp').write_text(bad)
    proof.write_text(json.dumps(dict(data,code_sha256=hashlib.sha256(bad.encode()).hexdigest())))
    rejects(lambda:module.integrate(project,generated,'009000',proof,commit=False,preserve_existing=True),'opcode mismatch')
    missing=cpp.replace('// $008000 NOP\n','')
    (generated/'src/generated_000.cpp').write_text(missing)
    proof.write_text(json.dumps(dict(data,code_sha256=hashlib.sha256(missing.encode()).hexdigest())))
    rejects(lambda:module.integrate(project,generated,'009000',proof,commit=False,preserve_existing=True),'mnemonic is missing')
    (generated/'src/generated_000.cpp').write_text(cpp);proof.write_text(json.dumps(data))
    incompatible=(generated/'src/dispatch.cpp').read_text().replace('{0x008000u,false,false,false,','{0x008000u,false,true,false,')
    write_generated_dispatch(incompatible)
    rejects(lambda:module.integrate(project,generated,'009000',proof,commit=False,preserve_existing=True),'missing compatible CPU state')
    write_generated_dispatch('{0x008000u,false,false,false,true,true,&sub_009000_E0M0X0C1,0x009000u},\n'
                                                '{0x009000u,false,false,false,true,true,&sub_009000_E0M0X0C1,0x009000u},\n')
    # Reject an actually generated entry that would usurp a previous owner.
    own='#include "generated.hpp"\nvoid sub_008000_E0M0X0C1(CpuState&, SnesRuntime&, std::uint32_t entryPc) {}\nL_008000:\n// $008000 NOP\n'
    (generated/'src/generated_000.cpp').write_text(own)
    write_generated_dispatch('{0x008000u,false,false,false,true,true,&sub_008000_E0M0X0C1,0x008000u},\n')
    owned_proof=dict(data, entry='008000', code_sha256=hashlib.sha256(own.encode()).hexdigest())
    proof.write_text(json.dumps(owned_proof))
    rejects(lambda:module.integrate(project,generated,'008000',proof,commit=False,preserve_existing=True),'already owned')
    assert (project/'src/dispatch.cpp').read_bytes()==original
    (generated/'src/generated_000.cpp').write_text(cpp)
    proof.write_text(json.dumps(data))
    write_generated_dispatch('{0x008000u,false,false,false,true,true,&sub_009000_E0M0X0C1,0x009000u},\n'
                                                '{0x009000u,false,false,false,true,true,&sub_009000_E0M0X0C1,0x009000u},\n')

    write_generated_dispatch('{0x009000u,false,false,false,true,true,&sub_009000_E0M0X0C1,0x009000u},\n')
    applied=module.integrate(project, generated, '009000', proof, commit=True)
    content=(project/'src/dispatch.cpp').read_text()
    assert applied['new_instruction_sites']==1 and content.index('0x008000')<content.index('0x009000')<content.index('0x00A000')
    assert 'src/forja_009000.cpp' in (project/'CMakeLists.txt').read_text()
    rejects(lambda:module.integrate(project,generated,'009000',proof,commit=True),'already integrated')
print('FORJA65_SAFE_CFG_CROSSFEED_PASS (dryrun/apply/duplicate/ROM/proof/overlap)')
