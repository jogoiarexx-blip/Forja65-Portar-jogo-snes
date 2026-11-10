#!/usr/bin/env python3
"""Safety gate for reusing compiled Forja65 C++ objects.

Checks the reference CMake/Ninja compile flags and the reused sources/header
bytes.  This is a *necessary*, not sufficient, ABI equivalence check.  Do
not use it as a substitute for linking and deterministic replay comparison.
"""
import argparse
import hashlib
import json
import re
import shlex
from pathlib import Path

REQUIRED = ('runtime.hpp', 'generated.hpp', 'native_hooks.cpp', 'main.cpp')


def build_flags(ninja: Path):
    content = ninja.read_text(encoding='utf-8')
    pattern = r'^build CMakeFiles/forja65_generated\.dir/src/dispatch\.cpp\.o:.*(?:\n  .*)*'
    match = re.search(pattern, content, re.M)
    if not match:
        raise ValueError('dispatcher object is absent from reference build.ninja')
    block = match.group(0)
    result = []
    for field in ('DEFINES', 'FLAGS'):
        m = re.search(r'^  '+field+r' = (.+)$', block, re.M)
        if not m:
            raise ValueError('missing '+field+' in reference Ninja object')
        result.extend(shlex.split(m.group(1)))
    return result


def normalized_abi(args):
    # Only flags with known binary-layout or calling-semantics consequences.
    # Optimization settings and build-specific include/PCH paths are excluded.
    d = {}
    for a in args:
        if a.startswith('-DFORJA65_ENABLE_TRACE='):
            d['FORJA65_ENABLE_TRACE'] = a.split('=', 1)[1]
        elif a == '-DNDEBUG':
            d['NDEBUG'] = '1'
        elif a.startswith('-std='):
            d['standard'] = a.split('=', 1)[1]
        elif a in ('-fshort-enums', '-fpack-struct', '-fno-rtti', '-fno-exceptions') or a.startswith('-mabi='):
            d[a] = True
    # Missing trace macro has a materially different runtime.hpp default (1).
    d.setdefault('FORJA65_ENABLE_TRACE', '1')
    d.setdefault('NDEBUG', '0')
    if 'standard' not in d:
        raise ValueError('language standard missing')
    return d


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(reference_project, candidate_project, ninja, compiler_args, reused):
    original = normalized_abi(build_flags(ninja))
    candidate = normalized_abi(shlex.split(compiler_args))
    if original != candidate:
        raise ValueError(f'incompatible compiler ABI settings: reference={original} candidate={candidate}')
    for name in [*REQUIRED, *reused]:
        relative = Path(name)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('reused source paths must be project/src relative')
        a = reference_project/'src'/relative
        b = candidate_project/'src'/relative
        if not a.is_file() or not b.is_file() or file_hash(a) != file_hash(b):
            raise ValueError(f'object reuse rejected because source differs or is missing: {relative}')
    return {'abi': original, 'checked_files': len(REQUIRED)+len(reused),
            'verified_source_bytes': True, 'limits': 'not a runtime or link-equivalence proof'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference-project', type=Path, required=True)
    parser.add_argument('--candidate-project', type=Path, required=True)
    parser.add_argument('--reference-ninja', type=Path, required=True)
    parser.add_argument('--compiler-args', required=True)
    parser.add_argument('--reused-source', action='append', default=[])
    args = parser.parse_args()
    try:
        result = verify(args.reference_project, args.candidate_project,
                        args.reference_ninja, args.compiler_args, args.reused_source)
    except (OSError, ValueError) as e:
        parser.exit(2, 'Forja65 ABI reuse rejected: '+str(e)+'\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
