#!/usr/bin/env python3
"""Reproducible F65R version-1/version-2 native ROM pack generator and trust gate.

The game runtime uses virtual SNES addressing even in native ROM mode; this
utility only replaces byte data lookup, not the PPU/APU/DSP emulation.
"""
import argparse
import hashlib
import json
import struct
from pathlib import Path

MAGIC = b'F65R'
HEADER = struct.Struct('<4sIIQI')
REGION = struct.Struct('<II')
FNV_OFFSET = 1469598103934665603
FNV_PRIME = 1099511628211


def fnv64(data):
    h = FNV_OFFSET
    for b in data:
        h = ((h ^ b) * FNV_PRIME) & 0xFFFFFFFFFFFFFFFF
    return h


def make_pack(rom):
    if not rom or len(rom) > 0xFFFFFFFF:
        raise ValueError('invalid ROM size')
    return HEADER.pack(MAGIC, 1, len(rom), fnv64(rom), 1) + REGION.pack(0, len(rom)) + rom


def inspect_pack(raw, expected_rom=None, require_full=True):
    if len(raw) < HEADER.size:
        raise ValueError('truncated F65R header')
    magic, version, logical_size, source_hash, region_count = HEADER.unpack_from(raw)
    if magic != MAGIC or version not in (1, 2):
        raise ValueError('bad F65R magic or version')
    if not 0 < logical_size <= 128*1024*1024 or not 0 < region_count <= 131072:
        raise ValueError('invalid logical size or region count')
    cursor, last_end, covered = HEADER.size, 0, 0
    integrity = FNV_OFFSET
    for i in range(region_count):
        if len(raw) - cursor < REGION.size:
            raise ValueError(f'truncated region descriptor {i}')
        offset, size = REGION.unpack_from(raw, cursor)
        cursor += REGION.size
        end = offset + size
        if size == 0 or offset < last_end or end > logical_size:
            raise ValueError(f'overlapping, unsorted or out-of-bounds region {i}')
        if len(raw) - cursor < size:
            raise ValueError(f'truncated region data {i}')
        if expected_rom is not None and expected_rom[offset:end] != raw[cursor:cursor+size]:
            raise ValueError(f'ROM byte mismatch in region {i}')
        if version == 2:
            for byte in raw[cursor-REGION.size:cursor+size]:
                integrity = ((integrity ^ byte) * FNV_PRIME) & 0xFFFFFFFFFFFFFFFF
        covered += size
        last_end = end
        cursor += size
    if version == 2:
        if len(raw) - cursor < 8 or struct.unpack_from("<Q", raw, cursor)[0] != integrity:
            raise ValueError("invalid F65R v2 integrity trailer")
        cursor += 8
    if cursor != len(raw):
        raise ValueError('trailing data in native ROM pack')
    if expected_rom is not None:
        if logical_size != len(expected_rom) or source_hash != fnv64(expected_rom):
            raise ValueError('ROM identity mismatch')
    if require_full and covered != logical_size:
        raise ValueError(f'partial ROM coverage {covered}/{logical_size}')
    return dict(version=version, bytes=logical_size, regions=region_count,
                covered=covered, coverage_percent=100*covered/logical_size,
                fnv64=f'{source_hash:016x}', sha256=hashlib.sha256(raw).hexdigest())


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('mode', choices=['build', 'verify'])
    p.add_argument('--rom', type=Path, required=True)
    p.add_argument('--pack', type=Path, required=True)
    p.add_argument('--report', type=Path)
    args = p.parse_args(argv)
    try:
        rom = args.rom.read_bytes()
        if args.mode == 'build':
            data = make_pack(rom)
            args.pack.parent.mkdir(parents=True, exist_ok=True)
            args.pack.write_bytes(data)
        else:
            data = args.pack.read_bytes()
        result = inspect_pack(data, rom)
        result['rom_sha256'] = hashlib.sha256(rom).hexdigest()
        result['pack_file'] = args.pack.name
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(result, indent=2, sort_keys=True)+'\n')
        print(json.dumps(result, sort_keys=True))
        return 0
    except (OSError, ValueError) as e:
        print(f'REV157_ROM_PACK_FAIL: {e}')
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
