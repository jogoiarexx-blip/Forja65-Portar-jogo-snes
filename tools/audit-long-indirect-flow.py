#!/usr/bin/env python3
"""Revalidate runtime-logged 65816 JMP [abs] pointer triplets against a ROM.

The only dynamic evidence comes from the opt-in runtime observer. ROM bytes can
prove the jump site, but cannot prove the values of a RAM-backed pointer.
This tool does NOT modify dispatch, invent targets, or authorize stack returns.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

SCHEMA = 'forja65.long-indirect-flow-audit.v1'
REQUIRED = {'rom', 'from', 'ptr', 'bytes', 'target', 'e', 'm', 'x', 'c', 'd', 'frame', 'instruction'}


def fnv64(data):
    h = 1469598103934665603
    for b in data:
        h ^= b
        h = h * 0x100000001b3 & 0xffffffffffffffff
    return f'{h:016x}'


def hirom_offset(addr, rom_length):
    bank, word = (addr >> 16) & 0xff, addr & 0xffff
    if bank in (0x7e, 0x7f) or (word < 0x8000 and not (0x40 <= bank <= 0x7d or bank >= 0xc0)):
        raise ValueError('source not HiROM mapped ROM')
    offset = ((bank & 0x3f) << 16) | word
    if offset + 2 >= rom_length:
        raise ValueError('source outside ROM')
    return offset


def parse_record(line):
    record = dict(re.findall(r'(?<!\S)([a-z]+)=([^\s]+)', line))
    if set(record) != REQUIRED:
        raise ValueError('missing/extra runtime fields')
    data = {k: int(record[k], 10 if k in ('frame', 'instruction', 'e', 'm', 'x', 'c') else 16)
            for k in REQUIRED - {'rom', 'bytes'}}
    if not re.fullmatch(r'[0-9a-f]{16}', record['rom']):
        raise ValueError('invalid ROM identity')
    if not re.fullmatch(r'[0-9a-f]{1,2}(?:,[0-9a-f]{1,2}){2}', record['bytes']):
        raise ValueError('invalid pointer-byte evidence')
    values = [int(part, 16) for part in record['bytes'].split(',')]
    if any(v > 255 for v in values):
        raise ValueError('invalid byte width')
    if not (0 <= data['from'] <= 0xffffff and 0 <= data['ptr'] <= 0xffff and
            0 <= data['target'] <= 0xffffff and 0 <= data['d'] <= 0xffff and
            data['frame'] >= 0 and data['instruction'] >= 0 and
            all(data[k] in (0, 1) for k in ('e', 'm', 'x', 'c'))):
        raise ValueError('invalid CPU state/range')
    if data['e'] and (data['m'] != 1 or data['x'] != 1):
        raise ValueError('illegal emulation flag combination')
    if (values[0] | values[1] << 8 | values[2] << 16) != data['target']:
        raise ValueError('triplet does not reconstruct target')
    return record, data, values


def audit(rom, lines, site=None, expected_target=None):
    sha = hashlib.sha256(rom).hexdigest()
    rom_id = fnv64(rom)
    approved = []
    rejected = []
    for lineno, line in enumerate(lines, 1):
        if not line.strip():
            continue
        try:
            row, values, parts = parse_record(line)
            origin = values['from']
            if row['rom'] != rom_id:
                raise ValueError('ROM runtime fingerprint mismatch')
            if site is not None and origin != site:
                raise ValueError('unexpected jump site')
            start = hirom_offset(origin, len(rom))
            if rom[start] != 0xdc:
                raise ValueError('not a JMP [abs] opcode in supplied ROM')
            pointer = rom[start+1] | rom[start+2] << 8
            if values['ptr'] != pointer:
                raise ValueError('pointer address differs from ROM operand')
            if expected_target is not None and values['target'] != expected_target:
                raise ValueError('destination differs from requested observation')
            approved.append({'from': f'{origin:06X}', 'pointer_bank0': f'{pointer:04X}',
                             'pointer_bytes': [f'{v:02X}' for v in parts],
                             'target': f'{values["target"]:06X}',
                             'emulation': bool(values['e']), 'm8': bool(values['m']),
                             'x8': bool(values['x']), 'carry': bool(values['c']),
                             'direct_page': f'{values["d"]:04X}', 'frame': values['frame'],
                             'instruction': values['instruction'],
                             'evidence': 'live-runtime-logged-pointer-triplet'})
        except (ValueError, KeyError) as exc:
            rejected.append({'line': lineno, 'reason': str(exc)})
    return {'schema': SCHEMA, 'rom_sha256': sha, 'rom_fnv1a64': rom_id,
            'validated_log_records': len(approved), 'rejected_records': rejected,
            'status': 'LIVE_EVIDENCE_REVALIDATED' if approved and not rejected else
                      'PARTIAL_REJECTED' if approved else 'NO_VERIFIED_LIVE_EVIDENCE',
            'observations': approved,
            'scope': 'Only pointer triplet and CPU flag snapshot, not proof that target handler is compiled or correct.'}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rom', required=True, type=Path)
    p.add_argument('--observations', required=True, type=Path)
    p.add_argument('--from-pc', type=lambda x: int(x, 16))
    p.add_argument('--expected-target', type=lambda x: int(x, 16))
    p.add_argument('--out', type=Path)
    args = p.parse_args()
    result = audit(args.rom.read_bytes(), args.observations.read_text().splitlines(), args.from_pc, args.expected_target)
    out = json.dumps(result, indent=2) + '\n'
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(out)
    else:
        print(out, end='')
    if result['status'] != 'LIVE_EVIDENCE_REVALIDATED':
        p.exit(2, 'REJECTED: no complete consistent set of observed indirect targets\n')


if __name__ == '__main__':
    main()
