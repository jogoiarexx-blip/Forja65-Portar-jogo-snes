#!/usr/bin/env python3
"""Recover a missing ROM-bound FLOW hint using one crash's CPU trace.

Never guesses processor flags: requires a trace instruction at the exact caller PC,
matching unresolved-target pair, and exactly one ROM fingerprint in fresh hints.
Outputs both a derived hint and a provenance manifest for review.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

UNRESOLVED = re.compile(r'^([0-9a-fA-F]{6})\s*->\s*([0-9a-fA-F]{6})$', re.M)
TRACE = re.compile(r'^([0-9a-fA-F]{6})\s+.*\bE=([01])\s+M=([01])\s+X8=([01])\s+C=([01])$', re.M)
HASH = re.compile(r'\brom=([0-9a-fA-F]{16})\b')
TRACE_PC = re.compile(r'^([0-9a-fA-F]{6})\s+', re.M)


def recover(report: Path, output: Path, proof_path: Path):
    input_names = ('forja65-unresolved-targets.txt', 'forja65-crash-trace.txt', 'forja65-runtime-hints.txt')
    inputs = {name: (report/name).read_bytes() for name in input_names}
    unresolved_text = inputs[input_names[0]].decode('utf-8')
    # Never silently ignore a second unresolved record with another format.
    meaningful = [line.strip() for line in unresolved_text.splitlines()
                  if line.strip() and not line.lstrip().startswith(('#', ';'))]
    if len(meaningful) != 1 or not UNRESOLVED.fullmatch(meaningful[0]):
        raise ValueError('requires exactly one unresolved caller -> target in this isolated capture')
    src, dst = (a.lower() for a in UNRESOLVED.fullmatch(meaningful[0]).groups())
    trace_text = inputs[input_names[1]].decode('utf-8')
    trace_rows = TRACE.findall(trace_text)
    trace_pcs = TRACE_PC.findall(trace_text)
    if not trace_rows or not trace_pcs or trace_pcs[-1].lower() != src:
        raise ValueError('last CPU trace entry must match unresolved caller PC')
    # A newer trace instruction without full E/M/X/C state cannot be ignored.
    if trace_rows[-1][0].lower() != trace_pcs[-1].lower() or len(trace_rows) != len(trace_pcs):
        raise ValueError('latest CPU trace entry lacks reliable processor flags')
    caller, e, m, x, c = trace_rows[-1]
    if e == '1' and (m != '1' or x != '1'):
        raise ValueError('inconsistent emulation CPU flags in trace')
    roms = {value.lower() for value in HASH.findall(inputs[input_names[2]].decode('utf-8'))}
    if len(roms) != 1:
        raise ValueError('requires a unique ROM fingerprint from this capture')
    rom = next(iter(roms))
    # Refuse to overwrite the diagnostic evidence, even via a symlink.
    if output.resolve() == proof_path.resolve() or any(
        target.resolve() == (report/name).resolve()
        for target in (output, proof_path) for name in input_names
    ):
        raise ValueError('outputs must not overwrite source evidence')
    row = f'rom={rom} target={dst} from={src} kind=FLOW e={e} m={m} x={x} c={c}'
    manifest = {
        'schema': 1, 'source': 'CPU trace recovery, not a native runtime hint',
        'rom': rom, 'from': src, 'target': dst,
        'processor_flags': {'e': int(e), 'm': int(m), 'x': int(x), 'c': int(c)},
        'input_files': list(input_names),
        'input_sha256': {name: hashlib.sha256(data).hexdigest() for name, data in inputs.items()},
        'checks': ['single_unresolved_pair','last_trace_pc_matches_caller','latest_trace_has_full_flags', 'consistent_cpu_flags','unique_rom_identity','outputs_do_not_overwrite_evidence'],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    proof_path.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(row+'\n')
    proof_path.write_text(json.dumps(manifest,indent=2)+'\n')
    return row


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--report',required=True,type=Path)
    p.add_argument('--output',required=True,type=Path)
    p.add_argument('--provenance',required=True,type=Path)
    a = p.parse_args()
    print(recover(a.report,a.output,a.provenance))

if __name__ == '__main__':
    main()
