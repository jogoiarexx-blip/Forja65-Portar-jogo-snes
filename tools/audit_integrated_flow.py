#!/usr/bin/env python3
"""Audit ROM-backed CFG patches against *installed* generated native sources.

Reusable by Forja65 and standalone ports. This is coverage/integrity validation,
not a gameplay result. Never writes to a port.
"""
import argparse
import importlib.util
import json
import re
from pathlib import Path


def load_integrator(script_dir):
    path = Path(script_dir)/'integrate-observed-flow.py'
    spec = importlib.util.spec_from_file_location('forja65_integrator_audit', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def audit(port, evidence, routine, expected_rom, integrator):
    port = Path(port)
    evidence = Path(evidence)
    routine = routine.upper().replace(':', '').removeprefix('0X')
    if not re.fullmatch(r'[0-9A-F]{6}', routine):
        raise ValueError('invalid routine address')
    folder = evidence / routine
    proof_path = folder / 'proof.json'
    shard = folder / 'shard.cpp'
    proof = json.loads(proof_path.read_text())
    pcs = {int(pc) for state in proof['decoded'] for pc in state['pcs']}
    funcs = integrator.code_functions(shard.read_text(), routine)
    integrator.validate_proof(proof_path, routine, funcs, pcs, expected_rom)
    cmake = (port/'CMakeLists.txt').read_text()
    rel = f'src/forja_{routine.lower()}.cpp'
    if rel not in cmake:
        raise ValueError('routine is missing from CMake: '+routine)
    installed = (port/rel).read_text()
    for _, body in funcs:
        if body not in installed:
            raise ValueError('generated function body differs from installed source: '+routine)
    disp = integrator.get_array((port/'src/dispatch.cpp').read_text(), 'Forja65DispatchEntry').group(2)
    coverage = {int(x, 16) for x in re.findall(r'^\{0x([0-9a-fA-F]+)u,', disp, re.M)}
    missing = pcs - coverage
    if missing:
        raise ValueError(f'dispatch is missing {len(missing)} PCs for {routine}: '+', '.join(f'{x:06X}' for x in sorted(missing)[:5]))
    return {'routine': routine, 'rom': proof['rom'], 'pcs': len(pcs), 'functions': len(funcs), 'status': 'installed-and-covered'}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--port', required=True)
    ap.add_argument('--evidence', required=True)
    ap.add_argument('--expected-rom', required=True)
    ap.add_argument('routines', nargs='+')
    args = ap.parse_args()
    mod = load_integrator(Path(__file__).parent)
    for routine in args.routines:
        print(json.dumps(audit(args.port, args.evidence, routine, args.expected_rom, mod), sort_keys=True))


if __name__ == '__main__':
    main()
