#!/usr/bin/env python3
"""Cross-check an indexed JMP (abs,X) against *real trace lines* and ROM.

Requires an observed CPU X at the callsite, a ROM-bound runtime hint, and the
matching unresolved-flow error. ROM table evidence is corroboration, not a
replacement for runtime execution or an authorization to patch the jump.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path


def _rom_fingerprint(raw):
    # Existing Forja65 fnv1a64Bytes offset basis, intentionally not standard FNV.
    value = 1469598103934665603
    for byte in raw:
        value = ((value ^ byte) * 1099511628211) & ((1 << 64) - 1)
    return f'{value:016x}'


def _physical(rom, addr):
    bank, word = (addr >> 16) & 0xff, addr & 0xffff
    if bank in (0x7e, 0x7f) or (word < 0x8000 and not (0x40 <= bank <= 0x7d or bank >= 0xc0)):
        raise ValueError(f'HiROM address cannot map to ROM: {addr:06X}')
    off = ((bank & 0x3f) << 16) | word
    if off >= len(rom):
        raise ValueError(f'ROM offset outside input: {addr:06X}')
    return off


def _one_trace_observation(trace, callsite):
    pattern = re.compile(rf'^{callsite:06x}\s+A=([0-9a-f]+)\s+X=([0-9a-f]+)\s+Y=([0-9a-f]+)\s+S=([0-9a-f]+)\s+D=([0-9a-f]+)\s+DB=([0-9a-f]+)\s+PB=([0-9a-f]+)\s+P=([0-9a-f]+)\s+E=([01])\s+M=([01])\s+X8=([01])\s+C=([01])\s*$', re.I | re.M)
    matches = list(pattern.finditer(trace))
    # A historic occurrence is not evidence for the *current* unresolved jump.
    # The crash trace must terminate on this callsite; later CPU instruction
    # entries could otherwise make a stale X value look current.
    instruction_rows = list(re.finditer(r'^([0-9a-f]{6})\s+A=', trace, re.I | re.M))
    if not instruction_rows or int(instruction_rows[-1].group(1), 16) != callsite:
        raise ValueError('Final CPU trace instruction is not the unresolved indexed JMP')
    if not matches:
        raise ValueError('Crash trace has no CPU register line at indexed JMP callsite')
    # The trace is a chronological instruction stream: the final instruction
    # is the crash-site witness. Earlier visits may legitimately have another
    # X value (another branch of the same jump table). Do not treat a previous
    # visit as the current failing state; only the terminal row can attest it.
    m = matches[-1]
    # Require the *terminal* instruction row itself to parse in full. A
    # malformed final row at the same PC cannot reuse a prior valid visit.
    if m.start() != instruction_rows[-1].start():
        raise ValueError('Terminal indexed instruction row is malformed or incomplete')
    if int(m.group(7), 16) != ((callsite >> 16) & 0xff):
        raise ValueError('Trace PB does not match indexed JMP program bank')
    state = dict(zip(('e', 'm', 'x', 'c'), map(int, m.groups()[8:])))
    return int(m.group(2), 16), state


def audit(raw_rom, trace, hints, last_error, callsite, expected_target=None):
    callsite &= 0xffffff
    rom_sha = hashlib.sha256(raw_rom).hexdigest()
    fp = _rom_fingerprint(raw_rom)
    x, cpu = _one_trace_observation(trace, callsite)
    if cpu['x'] and (x & ~0xff):
        raise ValueError('Trace has X8 set but X exceeds 8-bit range')
    op_offset = _physical(raw_rom, callsite)
    if raw_rom[op_offset] != 0x7c:
        raise ValueError('ROM opcode is not JMP (abs,X)')
    base = raw_rom[_physical(raw_rom, (callsite & 0xff0000) | ((callsite + 1) & 0xffff))] | raw_rom[_physical(raw_rom, (callsite & 0xff0000) | ((callsite + 2) & 0xffff))] << 8
    pointer = (base + x) & 0xffff
    bank = callsite & 0xff0000
    low = raw_rom[_physical(raw_rom, bank | pointer)]
    high = raw_rom[_physical(raw_rom, bank | ((pointer + 1) & 0xffff))]
    target = bank | low | (high << 8)
    _physical(raw_rom, target)
    if expected_target is not None and target != (expected_target & 0xffffff):
        raise ValueError('Runtime-expected target differs from ROM table bytes')
    observed = []
    expr = re.compile(r'\brom=([0-9a-f]{16})\s+target=([0-9a-f]{6})\s+from=([0-9a-f]{6})\s+kind=(\S+)\s+e=([01])\s+m=([01])\s+x=([01])\s+c=([01])\b', re.I)
    for match in expr.finditer(hints):
        digest, dst, src, kind, *flags = match.groups()
        if int(src, 16) == callsite:
            observed.append((digest.lower(), int(dst, 16), kind, tuple(map(int, flags))))
    if not observed:
        raise ValueError('Missing ROM-bound runtime hint for the callsite')
    if any(digest != fp or dst != target or kind != 'FLOW' or flags != tuple(cpu[k] for k in ('e', 'm', 'x', 'c')) for digest, dst, kind, flags in observed):
        raise ValueError('Runtime hints do not agree with trace state / table / ROM fingerprint')
    expected_error = f'fluxo CFG nao resolvido em pc={callsite} target={target}'
    if expected_error not in last_error.splitlines():
        raise ValueError('Missing exact unresolved-flow error for the observed target')
    frame_match = re.search(r'\bframe=(\d+)\b', trace)
    return {'schema': 'forja65.indexed-jmp-trace-crosscheck.v1', 'mapper': 'HiROM',
            'rom_sha256': rom_sha, 'rom_fingerprint': fp, 'source': f'{callsite:06X}',
            'opcode': '7C', 'observed_x': f'{x:04X}', 'cpu_state': cpu,
            'pointer_base': f'{base:04X}', 'pointer_at': f'{bank|pointer:06X}',
            'pointer_bytes': f'{low:02X} {high:02X}', 'target': f'{target:06X}',
            'target_opcode': f'{raw_rom[_physical(raw_rom, target)]:02X}',
            'frame': int(frame_match.group(1)) if frame_match else None,
            'evidence': {'rom_opcode': True, 'cpu_trace_x': True, 'runtime_hint': True, 'last_error': True},
            'status': 'INDEXED_TARGET_ROM_AND_TRACE_CROSSCHECKED',
            'limitations': ['Target selected from ROM plus observed X and matching runtime report, not independently sampled bus bytes.',
                            'Does not prove that target handler works or that gameplay advances.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for arg in ('rom', 'trace', 'hints', 'last-error'):
        parser.add_argument('--'+arg, required=True, type=Path)
    parser.add_argument('--site', required=True)
    parser.add_argument('--target')
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    result = audit(args.rom.read_bytes(), args.trace.read_text(), args.hints.read_text(), args.last_error.read_text(),
                   int(args.site.replace(':', ''), 16), int(args.target.replace(':', ''), 16) if args.target else None)
    output = json.dumps(result, indent=2) + '\n'
    if args.out:
        args.out.write_text(output)
    else:
        print(output, end='')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as e:
        raise SystemExit(f'Indexed JMP audit rejected: {e}')
