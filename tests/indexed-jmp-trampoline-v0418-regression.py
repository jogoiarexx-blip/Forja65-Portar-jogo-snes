#!/usr/bin/env python3
"""Synthetic LoROM regression for PEA/JMP return and table completeness."""
import importlib.util
import tempfile
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'tools/analyze-indexed-jmp-trampoline.py'
spec=importlib.util.spec_from_file_location('indirect_jmp',p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
    root=Path(temp)
    rom=bytearray([0xFF]*0x8000)
    # PEA $8105 ; JMP ($810A,X) ; RTS at $8106
    rom[0x100:0x106]=bytes.fromhex('f4 05 81 7c 0a 81')
    rom[0x106]=0x60
    rom[0x10A:0x10E]=bytes.fromhex('00 90 10 90')
    rom[0x1000]=0xA9;rom[0x1010]=0x60
    rp=root/'synthetic.sfc';rp.write_bytes(rom)
    d=root/'dispatch.cpp';d.write_text('{0x809000u,false,false,false,false,false,nullptr,0x809000u},\n')
    result=m.audit(rp,0x808103,2,d)
    assert result['continuation']=='808106' and not result['continuation_compiled']
    assert result['entries'][0]['compiled'] and not result['entries'][1]['compiled']
    rom[0x100]=0xEA;rp.write_bytes(rom)
    try:m.audit(rp,0x808103,2,d)
    except ValueError:pass
    else:raise AssertionError('Missing PEA was accepted')
print('indexed JMP/PEA return and bounded table regression PASS')
