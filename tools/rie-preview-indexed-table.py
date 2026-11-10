#!/usr/bin/env python3
"""Read-only RIE preview of an SNES indexed-JSR ROM pointer table.

Consumes two or more previously authenticated indexed-JSR trace proofs for the
same callsite. Finds a *possible* table boundary only when the earliest
observed target follows the pointer table in the same bank. No generated code
is installed, and unobserved entries are never marked as executed.
"""
import argparse
import hashlib
import json
from pathlib import Path


def physical(rom: bytes, address: int) -> int:
    bank = (address >> 16) & 255
    word = address & 0xffff
    if bank in (0x7e, 0x7f) or (word < 0x8000 and not (0x40 <= bank <= 0x7d or bank >= 0xc0)):
        raise ValueError(f'not a valid HiROM ROM address: {address:06X}')
    offset = ((bank & 0x3f) << 16) | word
    if offset >= len(rom):
        raise ValueError('ROM address out of bounds')
    return offset


def read16(rom: bytes, address: int) -> int:
    bank = address & 0xff0000
    lo = rom[physical(rom, address)]
    hi = rom[physical(rom, bank | ((address + 1) & 0xffff))]
    return lo | hi << 8


def preview(rom: bytes, proofs: list[dict], max_entries: int = 32) -> dict:
    if len(proofs) < 2:
        raise ValueError('at least two independent observed target proofs required')
    if not (2 <= max_entries <= 128):
        raise ValueError('max_entries must be 2..128')
    sha = hashlib.sha256(rom).hexdigest()
    first = proofs[0]
    site = int(first['source'], 16)
    base = int(first['pointer_base'], 16)
    bank = site & 0xff0000
    if rom[physical(rom, site)] != 0xfc or read16(rom, site+1) != base:
        raise ValueError('ROM no longer contains the reported JSR indexed callsite')
    validated = {}
    for proof in proofs:
        if (proof.get('schema') != 'forja65.indexed-jsr-trace-crosscheck.v1'
                or proof.get('status') != 'INDEXED_JSR_TARGET_ROM_AND_TRACE_CROSSCHECKED'
                or proof.get('rom_sha256') != sha):
            raise ValueError('proof is not bound to the supplied ROM and schema')
        if int(proof['source'], 16) != site or int(proof['pointer_base'], 16) != base:
            raise ValueError('proofs do not describe the same indexed callsite')
        if proof.get('evidence') != {'rom_opcode': True, 'cpu_trace_x': True, 'runtime_hint': True, 'last_error': True}:
            raise ValueError('incomplete runtime evidence')
        x = int(proof['observed_x'], 16)
        if x < 0 or x & 1 or x >= 2*max_entries or x > 0xffff - base:
            raise ValueError('unsafe/unaligned indexed pointer offset')
        addr = bank | (base + x)
        dest = bank | read16(rom, addr)
        if addr != int(proof['pointer_at'], 16) or dest != int(proof['target'], 16):
            raise ValueError('indexed proof no longer agrees with ROM bytes')
        if proof['pointer_bytes'].upper() != ' '.join(f'{rom[physical(rom, bank | (base+x+i))]:02X}' for i in (0,1)):
            raise ValueError('pointer bytes mismatch')
        if proof.get('return_pc') != f'{(site+3) & 0xffffff:06X}':
            raise ValueError('proof return address mismatch')
        if x in validated and validated[x] != dest:
            raise ValueError('conflicting observed destination for index')
        validated[x] = dest
    if len(validated) < 2 or 0 not in validated:
        raise ValueError('two distinct observations including X=0000 are needed')
    # The earliest observed target may be the first instruction after a table.
    # If it is not aligned at an entry boundary, do not infer the length.
    nearest = min(t & 0xffff for t in validated.values())
    span = nearest - base
    if span < 2 or (span & 1) or span > 2 * max_entries:
        raise ValueError('no safe bounded table size inferred from observed targets')
    count = span // 2
    if max(validated) // 2 >= count:
        raise ValueError('observed pointer sits outside inferred table boundary')
    entries = []
    for i in range(count):
        x = 2 * i
        address = bank | (base + x)
        target = bank | read16(rom, address)
        # Do not infer that an arbitrary value is executable code. Only show
        # plausible addresses outside the detected table itself.
        plausible = (target & 0xffff) >= nearest
        entries.append({'index_x': f'{x:04X}', 'pointer_at': f'{address:06X}',
                        'target': f'{target:06X}', 'target_opcode': f'{rom[physical(rom, target)]:02X}',
                        'runtime_observed': x in validated,
                        'classification': 'OBSERVED_TRACE_ROM' if x in validated else
                                          'UNOBSERVED_STATIC_CANDIDATE' if plausible else 'INVALID_TABLE_OVERLAP'})
    return {
        'schema': 'forja65.rie-indexed-table-preview.v1', 'rom_sha256': sha,
        'source': f'{site:06X}', 'opcode': 'FC', 'pointer_base': f'{bank|base:06X}',
        'inferred_table_end_exclusive': f'{bank|nearest:06X}',
        'inference': 'Bound from earliest observed same-bank target; heuristic, not proven table length',
        'entries': entries,
        'limits': ['Never execute or integrate unobserved entries based on this preview alone',
                   'Static candidates require independent trace/state verification before integration',
                   'No inference of gameplay stability, runtime sprites, or FPS']}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rom', required=True, type=Path)
    p.add_argument('--proof', required=True, type=Path, action='append', help='Repeat for independent observed X values')
    p.add_argument('--out', type=Path)
    p.add_argument('--max-entries', type=int, default=32)
    a=p.parse_args()
    try:
        output = json.dumps(preview(a.rom.read_bytes(), [json.loads(x.read_text()) for x in a.proof], a.max_entries),indent=2)+'\n'
        if a.out: a.out.write_text(output)
        else: print(output,end='')
    except (KeyError, ValueError, OSError, json.JSONDecodeError) as exc:
        p.exit(2,f'RIE indexed-table preview rejected: {exc}\n')

if __name__ == '__main__':
    main()
