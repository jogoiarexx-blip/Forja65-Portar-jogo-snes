#!/usr/bin/env python3
"""Standalone positive and negative evidence tests, without commercial ROM assets."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location('audit', Path(__file__).resolve().parents[1]/'tools'/'audit-indexed-jmp-trace.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
rom = bytearray(0x400000)
rom[0x388304:0x388307] = bytes((0x7c, 0x00, 0x80))
rom[0x388010:0x388012] = bytes((0xa1, 0x8d))
rom[0x388da1] = 0x22
fingerprint = audit._rom_fingerprint(rom)
trace = 'FORJA65 RUNTIME TRACE\nframe=14834 instruction=96374408\nb88304 A=10 X=10 Y=0 S=1f9 D=0 DB=b8 PB=b8 P=4 E=0 M=0 X8=0 C=0\n'
hint = f'rom={fingerprint} target=b88da1 from=b88304 kind=FLOW e=0 m=0 x=0 c=0\n'
error = f'fluxo CFG nao resolvido em pc={int("B88304",16)} target={int("B88DA1",16)}\n'
res = audit.audit(rom, trace, hint, error, 0xb88304, 0xb88da1)
assert res['target'] == 'B88DA1' and res['observed_x']=='0010' and all(res['evidence'].values())

def fail(*args, **kw):
    try:
        audit.audit(*args, **kw)
    except ValueError:
        return
    raise AssertionError('An inconsistent witness was incorrectly accepted')

fail(rom, trace.replace('X=10', 'X=12'), hint, error, 0xb88304, 0xb88da1)
fail(rom, trace.replace('C=0', 'C=1'), hint, error, 0xb88304, 0xb88da1)
fail(rom, trace, hint.replace(fingerprint,'bad0bad0bad0bad0'), error, 0xb88304, 0xb88da1)
fail(rom, trace, hint, error.replace('target=12094881', 'target=1'), 0xb88304, 0xb88da1)
fail(rom, trace.replace('b88304 A=', 'b88303 A='), hint, error, 0xb88304, 0xb88da1)
fail(rom, trace, hint, error, 0xb88304, 0xb88da2)
rom[0x388304]=0xea
fail(rom, trace, hint, error, 0xb88304, 0xb88da1)
print('INDEXED_JMP_TRACE_CROSSCHECK_PASS 1 positive / 7 rejected tamper cases')
