#!/usr/bin/env python3
"""Regression test: importing one CFG root must never duplicate neighboring roots.

Self-contained, no ROM redistribution or C++ compiler required.
"""
import hashlib
import importlib.util
import json
import tempfile
from pathlib import Path

p = Path(__file__).with_name('integrate-generated-cfg.py')
spec = importlib.util.spec_from_file_location('forja_cfg_integrator', p)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

with tempfile.TemporaryDirectory() as t:
    root = Path(t)
    project, generated = root/'port', root/'forja'
    (project/'assets').mkdir(parents=True)
    (project/'src').mkdir(parents=True)
    (generated/'src').mkdir(parents=True)
    (project/'assets/cart-data.bin').write_bytes(b'ROM TEST ONLY')
    (project/'CMakeLists.txt').write_text('target_sources(port PRIVATE src/dispatch.cpp)\n')
    (project/'src/generated_002.cpp').write_text('void sub_ABC999_E0M0X0CQ(CpuState&,SnesRuntime&,unsigned) {}\n')
    dispatch = ('#include "generated.hpp"\n'
                'static const Forja65DispatchEntry kForja65Dispatch[] = {\n'
                '{0xABC001u,false,false,false,false,false,&sub_old,0xABC001u},\n'
                '{0xABC999u,false,false,false,false,false,&sub_old,0xABC999u},\n'
                '};\n')
    (project/'src/dispatch.cpp').write_text(dispatch)
    src = ('#include "generated.hpp"\n'
           'void sub_ABC123_E0M0X0C0(CpuState& cpu, SnesRuntime& hw, std::uint32_t pc) { }\n'
           'void sub_ABC123_E0M0X0CQ(CpuState& cpu, SnesRuntime& hw, std::uint32_t pc) { }\n'
           'void sub_ABC999_E0M0X0CQ(CpuState& cpu, SnesRuntime& hw, std::uint32_t pc) { }\n')
    (generated/'src/generated_002.cpp').write_text(src)
    (generated/'src/dispatch.cpp').write_text(
        'static const Forja65DispatchEntry kForja65Dispatch[] = {\n'
        '{0xABC123u,false,false,false,false,false,&sub_ABC123_E0M0X0C0,0xABC123u},\n'
        '{0xABC123u,false,false,false,false,true,&sub_ABC123_E0M0X0CQ,0xABC123u},\n'
        '{0xABC999u,false,false,false,false,true,&sub_ABC999_E0M0X0CQ,0xABC999u},\n'
        '};\n')
    proof = root/'proof.json'
    proof.write_text(json.dumps({'entry':'ABC123',
        'rom_opcode_mismatches':0,
        'code_sha256':hashlib.sha256(src.encode()).hexdigest(),
        'rom':{'sha256':hashlib.sha256(b'ROM TEST ONLY').hexdigest()}}))
    # Hidden duplicate function not listed in the dispatcher must also fail.
    other = project/'src/old_hidden.cpp'
    other.write_text('void sub_ABC123_E0M0X0C0(CpuState&,SnesRuntime&,unsigned) {}\n')
    try:
        mod.integrate(project, generated, 'ABC123', proof, commit=True, preserve_existing=True)
    except ValueError as e:
        assert 'already defined' in str(e)
    else:
        raise AssertionError('Unregistered duplicate definition was not detected')
    other.unlink()
    # Import only the two target variants, not the extra function the CFG discovered.
    r = mod.integrate(project, generated, 'ABC123', proof, commit=True, preserve_existing=True)
    assert r['new_dispatch_rows'] == 2, r
    assert r['ignored_non_target_functions'] == ['sub_ABC999_E0M0X0CQ'], r
    assert 'sub_ABC999_' not in (project/'src/forja_abc123.cpp').read_text()
    assert (project/'src/dispatch.cpp').read_text().count('0xABC999u') == 2, 'Existing dispatch overwritten'
    assert (project/'src/dispatch.cpp').read_text().count('0xABC123u') == 4
    assert 'src/forja_abc123.cpp' in (project/'CMakeLists.txt').read_text()
    try:
        mod.integrate(project, generated, 'ABC123', proof, commit=True, preserve_existing=True)
    except ValueError as e:
        assert 'already integrated' in str(e) or 'already defined' in str(e)
    else:
        raise AssertionError('Duplicate integration unexpectedly succeeded')
print('PASS focused integration strips foreign global symbols, keeps dispatcher and rejects duplicates')
