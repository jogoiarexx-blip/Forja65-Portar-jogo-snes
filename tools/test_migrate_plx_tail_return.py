from migrate_plx_tail_return import rom_is_compatible,patch,migrate,ANCHOR,INSERT,anchor,insert,SITES
from pathlib import Path
import tempfile
import sys

base='#include "generated.hpp"\n'+''.join(('rtl '+anchor(site)+' rtl\n')*2 for site in SITES)
updated,n=patch(base)
assert n==4 and all(updated.count(insert(site))==2 for site in SITES)
assert patch(updated)==(updated,0)
for bad in (base.replace(ANCHOR,'',1),base.replace('generated.hpp','other.hpp')):
    try: patch(bad); assert False,'must reject incompatible source'
    except ValueError:pass
rom=bytearray(0x400000)
from migrate_plx_tail_return import PROOF
for addr,byte in PROOF.items():rom[((addr>>16)&0x3f)*65536+(addr&65535)]=byte
assert rom_is_compatible(rom)
rom[((0xB9>>0)&0x3f)*65536+0xE7B6]^=1
assert not rom_is_compatible(rom)
print('PLX_TAIL_MIGRATION_PASS dry-run idempotence opcode-proof two-handlers')
with tempfile.TemporaryDirectory() as temp:
    port=Path(temp)
    (port/'src').mkdir();(port/'assets').mkdir()
    source=port/'src/forja_learned_r135_003.cpp'
    source.write_text(base)
    (port/'assets/cart-data.bin').write_bytes(rom)
    try:migrate(port,'#pragma once\n',apply=True);assert False,'wrong ROM accepted'
    except ValueError:pass
    for address,value in PROOF.items():rom[((address>>16)&0x3f)*65536+(address&65535)]=value
    (port/'assets/cart-data.bin').write_bytes(rom)
    assert migrate(port,'#pragma once\n',apply=False)==4
    assert source.read_text()==base
    assert migrate(port,'#pragma once\n',apply=True)==4
    assert source.read_text()==updated
    assert (port/'src/plx_tail_rtl.hpp').read_text()=='#pragma once\n'
    assert migrate(port,'#pragma once\n',apply=True)==0
