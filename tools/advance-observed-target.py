#!/usr/bin/env python3
"""Reproduce a single ROM-bound Forja65 CFG target and safely stage its port integration.

A focused observation avoids losing a newly observed target under an unrelated
CFG analysis budget. No semantic/runtime-equivalence claim is made here.
"""
import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

TARGET = re.compile(r'^[0-9A-F]{6}$')
CACHE_CEILING = re.compile(r'CFG cache variant ceiling \((\d+) > (\d+)\)')
OBS = re.compile(
    r'^rom=([0-9a-f]{16}) target=([0-9a-f]{6}) from=([0-9a-f]{6}) '
    r'kind=(FLOW|CALL|STATE|RUNTIME|STACK-RTS|STACK-RTL|STACK-PEA-BOOTSTRAP|STACK-RTS-LOWBYTE-TABLE|STACK-RTS-PEI|JUMP|RETURN|JML-RAM-VECTOR|JSR-TABLE|JMP-TABLE|JSL|JSR|JML|JMP) '
    r'e=([01]) m=([01]) x=([01]) c=([01]) observed=1$', re.I
)


def observation(hint: str, target: str) -> tuple[str, str]:
    lines = [line.strip() for line in hint.splitlines() if line.strip() and not line.lstrip().startswith('#')]
    if len(lines) != 1:
        raise ValueError('Require exactly one observed, ROM-bound hint for a focused run')
    match = OBS.fullmatch(lines[0])
    if not match or match.group(2).upper() != target:
        raise ValueError('Hint must contain an exact observed ROM, target, source, type and CPU M/X/C state')
    return lines[0], match.group(1).lower()


def run(args, cwd=None):
    result = subprocess.run(args, check=False, cwd=cwd, text=True, capture_output=True)
    if result.returncode:
        # Keep the actual guardrail reason (overlap, ROM mismatch, etc.) visible.
        # Do not mask it behind a generic CalledProcessError with no stderr.
        detail = (result.stderr or result.stdout or '').strip()[-1200:]
        raise ValueError(f'{Path(args[0]).name} failed ({result.returncode}): {detail}')
    return result


def analysis_limits(max_sites: int, cache_limit: int | None = None) -> tuple[int, int]:
    # Keep focused runs within the same bounded CFG semantics as the generator.
    # A 512-site budget tends to exhaust before a valid observed target in a large ROM.
    if not 1 <= max_sites <= 50000:
        raise ValueError('Focused site budget must be between 1 and 50000')
    limit = max(8192, max_sites) if cache_limit is None else cache_limit
    if limit < max_sites or limit > 50000:
        raise ValueError('CFG cache limit must cover the focused budget (max 50000)')
    return max_sites, limit



def run_analysis_with_cache_retry(forja: Path, rom: Path, focused: Path, gen: Path,
                                  max_sites: int, cache_limit: int) -> int:
    """Retain all CFG cache variants when another run grew the persistent cache.

    Only retry the precise cache-ceiling failure. Never retry a ROM/proof error,
    never discard cache and never raise the instruction discovery budget.
    """
    def command(limit: int) -> list[str]:
        return ['node', str(forja/'tools/forja65.js'), 'analyze', str(rom),
                '--hints', str(focused), '--max', str(max_sites),
                '--cache-limit', str(limit), '--out', str(gen)]
    try:
        run(command(cache_limit))
        return cache_limit
    except ValueError as exc:
        match = CACHE_CEILING.search(str(exc))
        if not match:
            raise
        required, reported = map(int, match.groups())
        if reported != cache_limit or required <= cache_limit or required > 50000:
            raise
        # Choose capacity only. The max-sites bound and preservation guards stay
        # unchanged. Do not accept partial output from an unsuccessful run.
        if gen.exists():
            raise ValueError('Cache retry refused: generation directory already exists') from exc
        new_limit = min(50000, max(required, cache_limit * 2))
        run(command(new_limit))
        return new_limit


def advance(forja, rom, project, hint_path, target, out, apply=False, max_sites=8192, preserve_existing=False, missing_states=False, cache_limit=None, source_unit=None):
    if not TARGET.fullmatch(target):
        raise ValueError('Invalid observed target address')
    max_sites, cache_limit = analysis_limits(max_sites, cache_limit)
    raw = hint_path.read_text(encoding='utf-8')
    line, fingerprint = observation(raw, target)
    project_rom = project/'assets/cart-data.bin'
    if not project_rom.is_file() or not rom.is_file():
        raise ValueError('Missing ROM for target port or Forja65 analysis')
    if hashlib.sha256(project_rom.read_bytes()).digest() != hashlib.sha256(rom.read_bytes()).digest():
        raise ValueError('Project and analysis ROM differ')
    out.mkdir(parents=True, exist_ok=True)
    focused = out/'focused-observation.txt'
    focused.write_text(line+'\n', encoding='utf-8')
    gen = out/'generated'
    cache_limit = run_analysis_with_cache_retry(forja, rom, focused, gen, max_sites, cache_limit)
    candidates = [p for p in (gen/'src').glob('generated_*.cpp')
                  if f'void sub_{target}_' in p.read_text(encoding='utf-8')]
    if not candidates:
        raise ValueError(f'Target {target} not generated with max-sites={max_sites}; check CFG budget')
    candidates.sort()
    proof_path = out/f'{target.lower()}-rom-proof.json'
    if len(candidates) == 1:
        run(['node', str(forja/'tools/verify-generated-rom.js'), str(rom), str(candidates[0]),
             target, fingerprint, str(proof_path)])
    else:
        run(['node', str(forja/'tools/verify-generated-shards.js'), str(rom),
             target, fingerprint, str(proof_path), *map(str,candidates)])
    result = json.loads(run([sys.executable, str(forja/'tools/integrate-generated-cfg.py'),
           '--project', str(project), '--generated', str(gen), '--entry', target,
           '--proof', str(proof_path)] + (['--apply'] if apply else []) + (['--preserve-existing'] if preserve_existing else []) + (['--missing-states'] if missing_states else []) + (['--source-unit', source_unit] if source_unit is not None else [])).stdout)
    result.update({'schema': 'forja65.observed-target-integration.v1',
                   'hint': line, 'focus_max': max_sites, 'focus_cache_limit': cache_limit,
                   'generated_shards': [p.name for p in candidates],
                   'source_rom_sha256': json.loads(proof_path.read_text())['rom']['sha256'],
                   'compile_and_replay_verified': False})
    (out/'integration-report.json').write_text(json.dumps(result, indent=2)+'\n', encoding='utf-8')
    return result


def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument('--forja', type=Path, default=Path(__file__).resolve().parent.parent)
    for key in ('rom','project','hint','out'):
        a.add_argument('--'+key, type=Path, required=True)
    a.add_argument('--target', required=True)
    a.add_argument('--max-sites', type=int, default=8192)
    a.add_argument('--cache-limit', type=int, default=None)
    a.add_argument('--apply', action='store_true')
    a.add_argument('--preserve-existing', action='store_true')
    a.add_argument('--missing-states', action='store_true')
    a.add_argument('--source-unit', help='Source filename suffix for an additional CPU state variant')
    args = a.parse_args()
    try:
        info = advance(args.forja.resolve(), args.rom.resolve(), args.project.resolve(),
                       args.hint.resolve(), args.target.upper(), args.out.resolve(),
                       args.apply, args.max_sites, args.preserve_existing, args.missing_states, args.cache_limit, args.source_unit)
    except (ValueError, subprocess.CalledProcessError, OSError) as e:
        a.exit(2, f'Forja65 focused target rejected: {e}\n')
    print(json.dumps(info, indent=2))

if __name__ == '__main__':
    main()
