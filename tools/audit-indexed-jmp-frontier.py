#!/usr/bin/env python3
"""Bounded ROM-backed expansion of an indexed JMP pointer table.

Infers a *conservative upper bound*, not a complete table: the earliest
ROM-proven code entry immediately after a table can terminate its extent.
Only X indices explicitly listed in the witness audit are called witnessed;
all newly scanned offsets remain STATIC CANDIDATES, never runtime evidence.
Nothing here patches dispatch or grants return authorization.
"""
import argparse
import hashlib
import importlib.util
import json
import re
from pathlib import Path

MODULE = Path(__file__).with_name('audit_indexed_jmp_rom.py')
spec = importlib.util.spec_from_file_location('index_audit', MODULE)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)


def physical(pc: int, data: bytes):
    bank, word = (pc >> 16) & 255, pc & 65535
    if bank in (0x7e, 0x7f) or (word < 0x8000 and not (0x40 <= bank <= 0x7d or bank >= 0xc0)):
        raise ValueError(f'Unmapped HiROM address {pc:06X}')
    offset = ((bank & 63) << 16) | word
    if offset >= len(data):
        raise ValueError(f'ROM offset outside data {offset:06X}')
    return offset


def scan(data: bytes, witness: dict, max_entries: int = 32, trace_indices=None):
    if not 1 <= max_entries <= 32:
        raise ValueError('max_entries out of bounds (1..32)')
    if (witness.get('schema') != 'forja65.rom-indexed-jmp-audit.v1' or
            witness.get('mapper') != 'HiROM' or
            witness.get('rom_sha256') != hashlib.sha256(data).hexdigest() or
            witness.get('opcode') != '7C'):
        raise ValueError('Invalid, unsupported or stale ROM witness audit')
    site = int(witness['callsite'], 16)
    base = int(witness['pointer_base'], 16)
    if base != (data[physical(site + 1, data)] | data[physical(site + 2, data)] << 8):
        raise ValueError('Pointer base does not match JMP operand')
    evidence = {}
    for row in witness.get('routes', []):
        x = int(row['observed_x'], 16)
        if x & 1 or x >= max_entries * 2:
            raise ValueError('Witness index is not an in-range word-table offset')
        recomputed = legacy.audit(data, site, [x])['routes'][0]
        for name in ('target', 'table_address', 'target_first_opcode'):
            if row.get(name) != recomputed[name]:
                raise ValueError('Witness table or target disagrees with ROM')
        evidence[x] = recomputed
    if not evidence or 0 not in evidence:
        raise ValueError('Need verified X=0 anchor to derive table extent')
    table_start = (site & 0xff0000) | base
    # A code target immediately following the pointers is a conservative end.
    # If no witnessed entry proves that boundary, do not guess a table length.
    starts = sorted(int(v['target'], 16) for v in evidence.values()
                    if (int(v['target'], 16) >> 16) == (site >> 16)
                    and int(v['target'], 16) > table_start)
    if not starts:
        raise ValueError('No ROM-backed code entry beyond pointer-table base')
    limit = starts[0]
    table_bytes = (limit & 65535) - base
    if not 2 <= table_bytes <= max_entries * 2 or table_bytes & 1:
        raise ValueError('Cannot bound candidate table from code entry')
    if trace_indices is not None and not set(evidence).issubset(trace_indices):
        raise ValueError('Supplied ROM indices lack a CPU trace witness')
    rows = []
    for x in range(0, table_bytes, 2):
        item = legacy.audit(data, site, [x])['routes'][0]
        item['status'] = ('trace_index_witness_rom_target' if x in evidence and trace_indices is not None else
                          'externally_supplied_index_rom_verified_only' if x in evidence else
                          'candidate_from_bounded_rom_table_unexecuted')
        rows.append(item)
    return {
        'schema': 'forja65.rom-indexed-jmp-frontier.v1',
        'rom_sha256': hashlib.sha256(data).hexdigest(),
        'callsite': witness['callsite'],
        'pointer_base': witness['pointer_base'],
        'table_end_exclusive': f'{limit:06X}',
        'candidate_count': len(rows),
        'witnessed_count': len(evidence) if trace_indices is not None else 0,
        'externally_supplied_indices': len(evidence),
        'note': ('Finite candidate prefix only, bounded by ROM-proven code entry. '
                 'Never assume full table coverage or executable validity.'),
        'routes': rows,
    }


def parse_trace_indices(trace_paths, site):
    result = set()
    for trace in trace_paths:
        for line in trace.read_text().splitlines():
            if not line.lower().startswith(f'{site:06x} '):
                continue
            xmatch = re.search(r'\bX=([0-9a-f]+)\b', line, re.I)
            mode = re.search(r'\bX8=([01])\b', line, re.I)
            if not xmatch or not mode:
                continue
            x = int(xmatch[1], 16)
            if x <= (255 if mode[1] == '1' else 65535):
                result.add(x)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rom', required=True, type=Path)
    parser.add_argument('--witness-audit', required=True, type=Path)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--max-entries', type=int, default=32)
    parser.add_argument('--trace', type=Path, action='append', default=[], help='CPU trace proving an X index at the indexed JMP instruction; repeatable')
    args = parser.parse_args()
    try:
        witness = json.loads(args.witness_audit.read_text())
        observed = parse_trace_indices(args.trace, int(witness['callsite'], 16)) if args.trace else None
        result = scan(args.rom.read_bytes(), witness, args.max_entries, observed)
    except (ValueError, KeyError, OSError) as err:
        parser.exit(2, f'REJECTED: {err}\n')
    serialized = json.dumps(result, indent=2) + '\n'
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(serialized)
    else:
        print(serialized, end='')


if __name__ == '__main__':
    main()
