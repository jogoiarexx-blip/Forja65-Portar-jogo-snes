#!/usr/bin/env python3
"""Minimal ROM pack v2 validation: wrong ROM/profile must be rejected."""
import struct, subprocess, sys, tempfile
from pathlib import Path
# Standalone runner has no external builder argument: compile the generated tool.
# An explicit builder path remains supported for generated-project workflows.
if len(sys.argv)>1:
    builder = Path(sys.argv[1]).resolve()
else:
    _build_tmp = tempfile.TemporaryDirectory(prefix='forja-rom-pack-r4-')
    _build_root = Path(_build_tmp.name)
    _script = "const fs=require('fs'),F=require('./forja65-core');const r=F.loadRom(F.makeSyntheticRom());const p=F.generateProject(r,F.analyze(r,96));fs.writeFileSync(process.argv[1],p['tools/rom_pack_builder.cpp']);"
    subprocess.run(['node','-e',_script,str(_build_root/'builder.cpp')],cwd=Path(__file__).resolve().parents[1],check=True,capture_output=True)
    builder = _build_root/'rom-pack-builder'
    subprocess.run(['g++','-std=c++20','-O0',str(_build_root/'builder.cpp'),'-o',str(builder)],check=True,capture_output=True)

with tempfile.TemporaryDirectory() as t:
    root = Path(t)
    cart = bytes((i*23 + 9) & 255 for i in range(1024))
    (root/'cart.bin').write_bytes(cart)
    h=1469598103934665603
    for x in cart:
        h ^= x
        h = (h * 1099511628211) & ((1<<64)-1)
    def profile(hash_value=h, size=len(cart), line='range=0x20 length=0x48'):
        (root/'ranges.txt').write_text(f'FORJA65_ROM_READ_RANGES 1\nrom={hash_value:016x}\nlogical_size={size}\n{line}\n')
    def run(*args):
        return subprocess.run([str(builder),str(root/'cart.bin'),*map(str,args),str(root/'packed.bin')],capture_output=True,text=True)
    profile()
    assert run(root/'ranges.txt').returncode == 0
    data = (root/'packed.bin').read_bytes()
    assert data[:4] == b'F65R' and struct.unpack_from('<I',data,4)[0] == 2
    assert struct.unpack_from('<Q',data,12)[0] == h
    before = data
    profile(hash_value=h^1)
    assert run(root/'ranges.txt').returncode != 0
    assert (root/'packed.bin').read_bytes()==before
    profile(size=len(cart)-1)
    assert run(root/'ranges.txt').returncode != 0
    profile(line='range=0x3fa length=0x40')
    assert run(root/'ranges.txt').returncode != 0
    assert run('--full').returncode == 0
    data = (root/'packed.bin').read_bytes()
    assert len(data)==len(cart)+40
    print('FORJA65_ROM_PACK_R4_REGRESSION_OK profile_fingerprint size bounds output_preserved full_pack_v2')
