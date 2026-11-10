#!/usr/bin/env python3
"""RIE v106: reproduce an observed indexed-JMP frontier with ROM proof.

The evidence chain is deliberately strict: the latest crash, final trace PC,
exact ROM-bound FLOW hint, index register and cartridge pointer must agree.
This is a build-plan / *opt-in* integration tool, not a replay certification.
"""
import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

LAST_ERROR = re.compile(r"^fluxo CFG nao resolvido em pc=(\d+) target=(\d+)\s*$")


def run(command):
    done = subprocess.run(command, capture_output=True, text=True, check=False)
    if done.returncode:
        raise ValueError((done.stderr or done.stdout or 'Unknown tool failure').strip()[-2000:])
    return done.stdout


def identify_frontier(text):
    rows = [line.strip() for line in text.splitlines() if line.strip()]
    if len(rows) != 1:
        raise ValueError('Expected exactly one last-error line, no ambiguous crash frontier')
    match = LAST_ERROR.fullmatch(rows[0])
    if not match:
        raise ValueError('Only unresolved CFG FLOW (not native stack guards) is supported')
    source, target = (int(v) for v in match.groups())
    if source > 0xffffff or target > 0xffffff:
        raise ValueError('SNES addresses exceed 24 bits')
    return source, target


def prepare(forja, rom, project, diagnostics, out, *, apply=False):
    forja, rom, project, diagnostics, out = [Path(p).resolve() for p in (forja, rom, project, diagnostics, out)]
    if out == diagnostics or diagnostics in out.parents or out in diagnostics.parents:
        raise ValueError('Output must be separate from immutable crash diagnostics')
    for name in ('forja65-crash-trace.txt', 'forja65-runtime-hints.txt', 'forja65-last-error.txt'):
        if not (diagnostics/name).is_file():
            raise ValueError('Missing original diagnostic: '+name)
    native_rom = project/'assets/cart-data.bin'
    if not native_rom.is_file() or not rom.is_file():
        raise ValueError('Project ROM or supplied source ROM missing')
    raw = rom.read_bytes()
    source_sha = hashlib.sha256(raw).hexdigest()
    if hashlib.sha256(native_rom.read_bytes()).hexdigest() != source_sha:
        raise ValueError('Project ROM mismatch: refusing to generate or modify any code')
    source, target = identify_frontier((diagnostics/'forja65-last-error.txt').read_text())
    site, destination = f'{source:06X}', f'{target:06X}'
    audit_py = forja/'tools/audit-indexed-jmp-trace.py'
    spec = importlib.util.spec_from_file_location('rie_indexed_audit', audit_py)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    proof = mod.audit(raw,
        (diagnostics/'forja65-crash-trace.txt').read_text(),
        (diagnostics/'forja65-runtime-hints.txt').read_text(),
        (diagnostics/'forja65-last-error.txt').read_text(),
        source, target)
    if proof['target'] != destination or proof['source'] != site:
        raise ValueError('Proof disagrees with requested source/target')
    if out.exists() and any(out.iterdir()):
        raise ValueError('Output directory must be empty: no stale proof or overwritten artifacts')
    out.mkdir(parents=True, exist_ok=True)
    proof_path = out/'indexed-trace-rom-proof.json'
    proof_path.write_text(json.dumps(proof, indent=2)+'\n')
    generated = out/'generated'
    run(['node', str(forja/'tools/generate-observed-flow.js'),str(rom),
         str(diagnostics/'forja65-runtime-hints.txt'),destination,str(generated),
         '--verified-target','--indexed-proof',str(proof_path)])
    code_proof = generated/'verified/rom-proof.json'
    if not code_proof.is_file():
        raise ValueError('Generator produced no authenticated C++ code')
    cmd = [sys.executable,str(forja/'tools/integrate-generated-cfg.py'),
           '--project',str(project),'--generated',str(generated/'verified'),
           '--entry',destination,'--proof',str(code_proof),'--preserve-existing']
    preview = json.loads(run(cmd))
    if preview['new_instruction_sites'] < 1 or preview.get('address_overlap'):
        raise ValueError('No new non-overlapping instruction sites')
    if apply:
        integration = json.loads(run(cmd+['--apply']))
        if integration.get('dry_run') or integration['new_instruction_sites'] != preview['new_instruction_sites']:
            raise ValueError('Committed integration does not match verified preview')
    else:
        integration = preview
    summary = {
        'schema':'forja65.rie-indexed-frontier-integration.v1',
        'source':site,'target':destination,'observed_x':proof['observed_x'],
        'pointer_at':proof['pointer_at'],'pointer_bytes':proof['pointer_bytes'],
        'rom_sha256':source_sha,'evidence':proof['evidence'],
        'integration':integration,'applied':apply,
        'runtime_replay_verified':False,'windows_build_verified':False,
        'limits':['The ROM pointer was not sampled from the live bus',
                  'Does not bypass native stack guards',
                  'A new handler needs a full compile and deterministic replay']}
    (out/'report.json').write_text(json.dumps(summary,indent=2)+'\n')
    return summary


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--forja',type=Path,default=Path(__file__).resolve().parent.parent)
    for a in ('rom','project','diagnostics','out'):
        p.add_argument('--'+a,required=True,type=Path)
    p.add_argument('--apply',action='store_true',help='Commit only after verified dry-run and opcode checks')
    a=p.parse_args()
    try:
        report=prepare(a.forja,a.rom,a.project,a.diagnostics,a.out,apply=a.apply)
    except (ValueError, OSError, json.JSONDecodeError) as e:
        p.exit(2,'RIE indexed frontier rejected: '+str(e)+'\n')
    print(json.dumps(report,indent=2))

if __name__=='__main__':
    main()
