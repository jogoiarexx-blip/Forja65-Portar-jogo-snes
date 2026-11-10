#!/usr/bin/env python3
"""Audit a 65C816 PEA + JMP (absolute,X) trampoline against original LoROM bytes.

This tool does not patch the game or claim semantic equivalence. It finds every
ROM-backed table target within an explicitly provided table length, checks the
physical return address, and optionally compares the project's dispatch table.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path


def audit(rom_path: Path, source: int, count: int, dispatch_path: Path | None = None,
          expected_sha256: str | None = None) -> dict:
    data = rom_path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if expected_sha256 is not None and digest.lower() != expected_sha256.lower():
        raise ValueError('ROM SHA256 differs from the expected cartridge')
    if not data or len(data) % 0x8000 or source < 0x808000 or count not in range(1, 257):
        raise ValueError('Invalid LoROM image, source or table length')

    def byte(address: int) -> int:
        bank, low = (address >> 16) & 0xFF, address & 0xFFFF
        if low < 0x8000 or bank in (0x7E, 0x7F):
            raise ValueError(f'Address {address:06X} is not in LoROM program space')
        offset = (bank & 0x7F) * 0x8000 + (low - 0x8000)
        if offset >= len(data):
            raise ValueError(f'Address {address:06X} outside cartridge')
        return data[offset]

    bank = source & 0xFF0000
    if byte(source) != 0x7C:  # JMP (abs,X), 65C816
        raise ValueError('Selected source is not JMP (abs,X)')
    if byte(source - 3) != 0xF4:  # PEA imm16
        raise ValueError('No immediately preceding PEA continuation')
    pushed = byte(source - 2) | byte(source - 1) << 8
    if pushed != ((source + 2) & 0xFFFF):
        raise ValueError('PEA does not encode return address after indirect JMP')
    table = byte(source + 1) | byte(source + 2) << 8
    continuation = bank | ((pushed + 1) & 0xFFFF)
    if continuation != source + 3:
        raise ValueError('Trampoline continuation crosses program bank unexpectedly')

    dispatched = None
    if dispatch_path is not None:
        source_code = dispatch_path.read_text(encoding='utf-8')
        dispatched = {int(v, 16) for v in re.findall(r'^\{0x([0-9A-F]{6})u,', source_code, re.M)}
        if not dispatched:
            raise ValueError('No generated dispatch entries in supplied file')
    entries = []
    for index in range(count):
        address = bank | ((table + index * 2) & 0xFFFF)
        target_low = byte(address) | byte(bank | ((address+1) & 0xFFFF)) << 8
        target = bank | target_low
        opcode = byte(target)
        entries.append({'index': index, 'target': f'{target:06X}',
                        'first_opcode': f'{opcode:02X}',
                        'compiled': None if dispatched is None else target in dispatched})
    return {'schema':'forja65.indexed-jmp-trampoline.v1',
            'rom_sha256':digest, 'source':f'{source:06X}', 'pea_pc':f'{source-3:06X}',
            'table_start':f'{bank|table:06X}', 'continuation':f'{continuation:06X}',
            'continuation_compiled': None if dispatched is None else continuation in dispatched,
            'table_count':count, 'entries':entries,
            'warning':'ROM opcode/dispatch coverage only; execution and stack behavior require runtime tests'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rom',type=Path,required=True)
    p.add_argument('--source',required=True,help='Six-digit SNES hex PC')
    p.add_argument('--count',type=int,required=True)
    p.add_argument('--dispatch-cpp',type=Path)
    p.add_argument('--expect-rom-sha256')
    p.add_argument('--out',type=Path)
    args=p.parse_args()
    if not re.fullmatch('[0-9a-fA-F]{6}',args.source):p.error('--source must be 6 hex digits')
    try:
        result=audit(args.rom,int(args.source,16),args.count,args.dispatch_cpp,args.expect_rom_sha256)
    except (ValueError,OSError) as exc:
        p.error(str(exc))
    value=json.dumps(result,indent=2)+'\n'
    if args.out:args.out.write_text(value,encoding='utf-8')
    print(value,end='')

if __name__=='__main__':main()
