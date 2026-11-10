#!/usr/bin/env python3
"""ROM-verified static JSR/JSL dependencies in a generated C++ shard.

This is a static CFG check, NOT proof of having executed the target or of
runtime equivalence. Missing targets are candidates, never interpreted hits.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

CALL = re.compile(r'//\s*\$([0-9A-Fa-f]{6})\s+(JSR|JSL)\s+->\s+\$([0-9A-Fa-f]{6})\b')
ROW = re.compile(r'^\{0x([0-9A-Fa-f]{6})u,(?:true|false),', re.M)


def offset(address: int, size: int, mapping: str) -> int | None:
    bank, addr = (address >> 16) & 255, address & 65535
    if bank in (0x7e, 0x7f) or (addr < 0x8000 and not (0x40 <= bank <= 0x7d or bank >= 0xc0)):
        return None
    if mapping == 'HiROM':
        pos = ((bank & 0x3f) << 16) | addr
    elif mapping == 'LoROM':
        pos = ((bank & 0x7f) << 15) | (addr & 0x7fff)
    else:
        raise ValueError('mapper desconhecido: ' + mapping)
    return pos if pos < size else None


def scan(rom: bytes, shard: str, dispatch: str, mapping: str) -> dict:
    registered = {int(x, 16) for x in ROW.findall(dispatch)}
    candidates = {}
    invalid = []
    for caller, kind, callee in CALL.findall(shard):
        src, dst = int(caller, 16), int(callee, 16)
        key = (src, dst, kind)
        if key in candidates:
            continue
        pos = offset(src, len(rom), mapping)
        need = 3 if kind == 'JSR' else 4
        op = 0x20 if kind == 'JSR' else 0x22
        valid = pos is not None and pos + need <= len(rom) and rom[pos] == op
        if valid:
            immediate = int.from_bytes(rom[pos + 1:pos + need], 'little')
            resolved = ((src & 0xff0000) | immediate) if kind == 'JSR' else immediate
            valid = resolved == dst
        row = {'site': f'{src:06X}', 'target': f'{dst:06X}', 'kind': kind,
               'rom_opcode_verified': bool(valid), 'dispatcher_present': dst in registered,
               'runtime_observed': False}
        if not valid:
            invalid.append(row)
        candidates[key] = row
    rows = sorted(candidates.values(), key=lambda r: (r['target'], r['site'], r['kind']))
    missing = [r for r in rows if r['rom_opcode_verified'] and not r['dispatcher_present']]
    return {'schema': 'forja65.static-jsr-closure.v1', 'mapping': mapping,
            'rom_sha256': hashlib.sha256(rom).hexdigest(), 'call_sites_verified': len(rows)-len(invalid),
            'dispatcher_present': sum(r['rom_opcode_verified'] and r['dispatcher_present'] for r in rows),
            'missing_targets': sorted({r['target'] for r in missing}),
            'invalid_rom_sites': invalid, 'candidates': rows,
            'runtime_execution_certified': False,
            'note': 'Only ROM opcode and static dispatcher coverage verified; requires compilation and AOT gameplay replay.'}


def run(project: Path, shard: Path) -> dict:
    manifest = (project/'forja65-build-manifest.txt').read_text()
    m = re.search(r'^mapping=(HiROM|LoROM)$', manifest, re.M)
    if not m:
        raise ValueError('mapa ROM ausente ou nao suportado no manifesto')
    rom = (project/'assets/cart-data.bin').read_bytes()
    if not rom:
        raise ValueError('ROM vazia')
    report = scan(rom, shard.read_text(), (project/'src/dispatch.cpp').read_text(), m[1])
    report['source'] = str(shard.relative_to(project)) if shard.is_relative_to(project) else str(shard)
    return report


def main() -> int:
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--project', required=True, type=Path)
    ap.add_argument('--shard', required=True, type=Path)
    ap.add_argument('--output', type=Path)
    a=ap.parse_args()
    try:
        result=run(a.project.resolve(),a.shard.resolve())
        output=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
        if a.output:
            a.output.parent.mkdir(parents=True,exist_ok=True)
            a.output.write_text(output)
        print(json.dumps({'verified':result['call_sites_verified'],'missing_targets':result['missing_targets'],
                          'invalid_sites':len(result['invalid_rom_sites']),'runtime_certified':False}))
        return 2 if result['invalid_rom_sites'] else (3 if result['missing_targets'] else 0)
    except (OSError,ValueError) as exc:
        print('Static CFG audit rejected:',exc)
        return 2


if __name__=='__main__':
    raise SystemExit(main())
