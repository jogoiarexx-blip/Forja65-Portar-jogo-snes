#!/usr/bin/env python3
"""Forja65 REV156: strict, reusable native port replay verification.

One snapshot directory per frame. Missing interpreter telemetry is an error,
never silently interpreted as zero native fallback. This tool does not claim
per-frame equivalence between milestones.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path

QA_HEADER = 'FORJA65_QA 1'
INTERPRETER_HEADER = 'FORJA65_CPU_INTERPRETER 1'
REQUIRED_QA = ('rom', 'runtime_started', 'frames', 'instructions', 'nmi_services',
               'irq_services', 'wram_hash', 'framebuffer_hash')
HARDWARE_COUNTERS = ('ppu_virtual_accesses', 'apu_virtual_accesses',
                     'rom_runtime_reads', 'dma_bytes', 'hdma_bytes')


def parse_kv(path: Path, header: str) -> dict[str, str]:
    if not path.is_file():
        raise ValueError(f'missing mandatory telemetry: {path}')
    lines = path.read_text(encoding='utf-8').splitlines()
    if not lines or lines[0] != header:
        raise ValueError(f'invalid telemetry header: {path}')
    result = {}
    for line in lines[1:]:
        if not line or line.startswith('#'):
            continue
        if header == INTERPRETER_HEADER and re.fullmatch(
            r'[0-9a-fA-F]{6} (?:E1|M[01]X[01]) from=[0-9a-fA-F]{6} count=\d+', line):
            continue
        if '=' not in line:
            raise ValueError(f'invalid telemetry line: {line[:100]}')
        name, value = line.split('=', 1)
        if not re.fullmatch(r'[a-z][a-z0-9_]*', name):
            raise ValueError(f'invalid telemetry field name: {name[:100]}')
        if name in result:
            raise ValueError(f'duplicate telemetry field: {name}')
        result[name] = value
    return result


def load_snapshot(directory: Path, expected_frame: int | None = None) -> dict:
    qa = parse_kv(directory / 'forja65-qa-status.txt', QA_HEADER)
    interpreter = parse_kv(directory / 'forja65-cpu-interpreter.txt', INTERPRETER_HEADER)
    missing = set(REQUIRED_QA).difference(qa)
    if missing:
        raise ValueError(f'missing QA fields: {sorted(missing)}')
    if qa['runtime_started'] != 'PASS':
        raise ValueError('runtime not successful')
    for field in ('frames', 'instructions', 'nmi_services', 'irq_services'):
        if not re.fullmatch(r'\d+', qa[field]):
            raise ValueError(f'invalid nonnegative integer for {field}')
    for field in ('blocks', 'instructions'):
        if field not in interpreter or not re.fullmatch(r'\d+', interpreter[field]):
            raise ValueError(f'bad interpreter count for {field}')
    frames = int(qa['frames'])
    if expected_frame is not None and frames != expected_frame:
        raise ValueError(f'expected frame {expected_frame}, got {frames}')
    blocks = int(interpreter['blocks'])
    instructions = int(interpreter['instructions'])
    if instructions > int(qa['instructions']):
        raise ValueError('more interpreted than total instructions')
    if (blocks == 0) != (instructions == 0):
        raise ValueError('interpreter block/instruction counters inconsistent')
    return {'qa': qa, 'interpreter_blocks': blocks,
            'interpreter_instructions': instructions}


def verify(reference: dict[int, dict], current: dict[int, dict], zero_fallback: bool = False,
           strict_hardware: bool = False) -> dict:
    if not reference or set(reference) != set(current):
        raise ValueError('milestone frames missing or extra')
    checks = REQUIRED_QA
    if strict_hardware:
        checks += HARDWARE_COUNTERS
    reports = []
    previous = -1
    base_rom = None
    for frame in sorted(reference):
        base = reference[frame]; actual = current[frame]
        if frame <= previous:
            raise ValueError('milestones not increasing')
        previous = frame
        a, b = base['qa'], actual['qa']
        if a['rom'] != base_rom and base_rom is not None:
            raise ValueError('reference ROM changed across milestones')
        if b['rom'] != a['rom']:
            raise ValueError('new ROM changed')
        base_rom = a['rom']
        fields = {name: {'expected': a.get(name), 'actual': b.get(name)}
                  for name in checks if a.get(name) != b.get(name)}
        # A missing hardware counter is not comparable, when strict.
        if strict_hardware:
            for field in HARDWARE_COUNTERS:
                if field not in a or field not in b:
                    fields[field] = {'expected': a.get(field), 'actual': b.get(field)}
        zero = actual['interpreter_blocks'] == 0 and actual['interpreter_instructions'] == 0
        passed = not fields and (zero or not zero_fallback)
        reports.append({'frame': frame, 'pass': passed, 'mismatches': fields,
                        'cpu_interpreted': actual['interpreter_instructions'],
                        'interpreter_blocks': actual['interpreter_blocks'],
                        'native_observed_pct': round(100.0 * (1 - actual['interpreter_instructions'] / int(b['instructions'])), 6) if int(b['instructions']) else None})
    return {'schema': 'forja65.native-milestones.rev156',
            'pass': all(row['pass'] for row in reports),
            'require_zero_fallback': zero_fallback,
            'strict_hardware': strict_hardware,
            'note': 'Compares exact final states of each tested milestone; does not establish untested ROM or per-frame coverage.',
            'milestones': reports}


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--reference', required=True, type=Path)
    p.add_argument('--candidate', required=True, type=Path)
    p.add_argument('--frames', required=True, help='comma-separated exact frame checkpoints')
    p.add_argument('--out', required=True, type=Path)
    p.add_argument('--zero-fallback', action='store_true')
    p.add_argument('--strict-hardware', action='store_true')
    args = p.parse_args()
    frames = [int(s) for s in args.frames.split(',')]
    if not frames or len(frames) != len(set(frames)) or any(x <= 0 for x in frames):
        p.error('invalid frames')
    try:
        reference = {f: load_snapshot(args.reference / str(f), f) for f in frames}
        candidate = {f: load_snapshot(args.candidate / str(f), f) for f in frames}
        report = verify(reference, candidate, args.zero_fallback, args.strict_hardware)
    except (ValueError, OSError) as error:
        report = {'schema': 'forja65.native-milestones.rev156', 'pass': False,
                  'error': str(error)}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(('PASS' if report['pass'] else 'FAIL') + ': ' + json.dumps(report, ensure_ascii=False))
    raise SystemExit(0 if report['pass'] else 2)


if __name__ == '__main__':
    main()
