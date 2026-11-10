#!/usr/bin/env python3
"""ROM-based static audit of an observed 65816 routine's immediate call.

Checks bytes in ROM and dispatcher ownership. It does NOT claim the call executes
or that the target is semantically correct. Supports standard HiROM and LoROM.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

ENTRY_RE = re.compile(r'^[0-9A-Fa-f]{6}$')
ROW_RE = re.compile(r'^\{0x([0-9A-Fa-f]{6})u,', re.M)


def offset_of(address: int, mapper: str) -> int:
    if mapper not in ('hirom', 'lorom'):
        raise ValueError('Unsupported mapper')
    if not isinstance(address, int) or isinstance(address, bool) or not 0 <= address <= 0xffffff:
        raise ValueError('CPU address must be a 24-bit integer')
    bank, low = address >> 16, address & 0xffff
    if bank in (0x7e, 0x7f):
        raise ValueError('WRAM banks are not ROM')
    if mapper == 'hirom':
        if low < 0x8000 and bank & 0x40 == 0:
            raise ValueError('HiROM address in bank-mirror lower half; mapper ambiguous')
        return (bank & 0x3f) * 0x10000 + low
    full = 0x40 <= bank <= 0x7d or bank >= 0xc0
    # Without cartridge SRAM metadata, lower 70-7D/F0-FF windows cannot
    # establish immutable-ROM evidence. Prefer a conservative rejection.
    if low < 0x8000 and (0x70 <= bank <= 0x7d or bank >= 0xf0):
        raise ValueError('LoROM lower window may be SRAM; ROM ownership is unproven')
    if low < 0x8000 and not full:
        raise ValueError('LoROM address in WRAM/I/O lower half')
    return (bank & 0x7f) * 0x8000 + (low & 0x7fff)


def audit(rom_bytes: bytes, dispatcher: str, entry: int, mapper='hirom') -> dict:
    off = offset_of(entry, mapper)
    if off >= len(rom_bytes):
        raise ValueError('Routine entry falls outside supplied ROM')
    opcode = rom_bytes[off]
    if opcode == 0x20:
        size, instruction = 3, 'JSR'
    elif opcode == 0x22:
        size, instruction = 4, 'JSL'
    else:
        return {'entry': f'{entry:06X}', 'opcode': f'{opcode:02X}',
                'status': 'not_direct_call', 'scope': 'Static ROM opcode only'}
    # The CPU fetches operands by incrementing PC within PB. A physical
    # ROM slice would cross into the next bank at xx:FFFF instead.
    encoded = bytearray()
    for n in range(size):
        byte_address = (entry & 0xff0000) | ((entry + n) & 0xffff)
        byte_offset = offset_of(byte_address, mapper)
        if byte_offset >= len(rom_bytes):
            raise ValueError('Truncated direct call opcode')
        encoded.append(rom_bytes[byte_offset])
    if opcode == 0x20:
        target = (entry & 0xff0000) | int.from_bytes(encoded[1:3], 'little')
    else:
        target = int.from_bytes(encoded[1:4], 'little')
    continuation = (entry & 0xff0000) | ((entry + size) & 0xffff)
    owners = {int(m.group(1), 16) for m in ROW_RE.finditer(dispatcher)}
    target_mapped = None
    try:
        target_mapped = offset_of(target, mapper) < len(rom_bytes)
    except ValueError:
        target_mapped = False
    return {
        'entry': f'{entry:06X}', 'opcode': f'{opcode:02X}', 'instruction': instruction,
        'instruction_bytes': encoded.hex(' ').upper(),
        'direct_target': f'{target:06X}',
        'target_rom_mapped': target_mapped,
        'target_in_dispatcher': target in owners,
        'continuation': f'{continuation:06X}',
        'continuation_in_dispatcher': continuation in owners,
        'scope': 'Static ROM call decode and dispatch availability only; not observed execution or equivalence'
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rom', type=Path, required=True)
    parser.add_argument('--dispatch', type=Path, required=True)
    parser.add_argument('--entry', required=True)
    parser.add_argument('--mapper', choices=('hirom','lorom'), default='hirom')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    if not ENTRY_RE.fullmatch(args.entry):
        parser.error('entry must be exactly 6 hex digits')
    rom = args.rom.read_bytes()
    result = {'schema': 'forja65.static-direct-call-audit.v1', 'mapper': args.mapper,
              'rom_sha256': hashlib.sha256(rom).hexdigest(),
              **audit(rom, args.dispatch.read_text(encoding='utf-8'), int(args.entry, 16), args.mapper)}
    serialized = json.dumps(result, indent=2)+'\n'
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(serialized, encoding='utf-8')
    print(serialized, end='')

if __name__ == '__main__':
    main()
