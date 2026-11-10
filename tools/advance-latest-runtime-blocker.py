#!/usr/bin/env python3
"""Select the *observed* failing CFG destination and stage a ROM-verified integration.

Fails closed if the error and observation disagree, or if evidence is ambiguous.
Defaults to preview, never silently mutates an existing native port.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

OBS = re.compile(
    r'^rom=([0-9a-f]{16}) target=([0-9a-f]{6}) from=([0-9a-f]{6}) '
    r'kind=([A-Z-]+) e=([01]) m=([01]) x=([01]) c=([01])(?: observed=1)?$', re.I
)
ERR = re.compile(r'fluxo CFG nao resolvido em pc=(\d+) target=(\d+)', re.I)
STATE_ERR = re.compile(r'estado M/X/C nao recompilado em pc=(\d+)', re.I)
KINDS = {'FLOW','CALL','STATE','RUNTIME','JSL','JSR','JML','JMP','JUMP','RETURN',
         'STACK-RTS','STACK-RTL','STACK-PEA-BOOTSTRAP','STACK-RTS-LOWBYTE-TABLE',
         'STACK-RTS-PEI','JML-RAM-VECTOR','JSR-TABLE','JMP-TABLE'}


def select(hints: str, last_error: str) -> tuple[str, str]:
    errors = list(ERR.finditer(last_error))
    state_errors = list(STATE_ERR.finditer(last_error))
    if not errors and not state_errors:
        raise ValueError('No observed CFG or missing CPU state error in last-error log; refusing to guess')
    if state_errors and (not errors or state_errors[-1].start() > errors[-1].start()):
        src = dst = int(state_errors[-1].group(1))
        required_kind = 'STATE'
    else:
        error = errors[-1]
        src, dst = (int(error.group(i)) for i in (1, 2))
        required_kind = None
    if not 0 <= src <= 0xFFFFFF or not 0 <= dst <= 0xFFFFFF:
        raise ValueError('CFG address outside the 24-bit 65C816 space')
    matches = []
    for raw in hints.splitlines():
        line = raw.strip()
        m = OBS.fullmatch(line)
        if not m or m.group(4).upper() not in KINDS:
            continue
        # No unobserved/inferred targets: the runtime writes plain hints; mark
        # an otherwise exact line observed only after matching last-error.
        if int(m.group(2), 16) == dst and int(m.group(3), 16) == src and (required_kind is None or m.group(4).upper() == required_kind):
            matches.append((line, m.group(1).lower()))
    if not matches:
        raise ValueError(f'No ROM-bound runtime observation for {src:06X} -> {dst:06X}')
    if len(set(matches)) != 1:
        raise ValueError('Ambiguous CPU states for last failure; focused run requires explicit choice')
    line, fingerprint = matches[-1]
    if not line.endswith('observed=1'):
        line += ' observed=1'
    return line, dst.to_bytes(3,'big').hex().upper()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for n in ('project','rom','hints','last-error','out'):
        p.add_argument('--'+n, type=Path, required=True)
    p.add_argument('--forja', type=Path, default=Path(__file__).resolve().parent.parent)
    p.add_argument('--max-sites', type=int, default=8192)
    p.add_argument('--apply', action='store_true')
    p.add_argument('--preserve-existing', action='store_true')
    a = p.parse_args()
    try:
        line, target = select(a.hints.read_text(encoding='utf8'),a.last_error.read_text(encoding='utf8'))
        a.out.mkdir(parents=True, exist_ok=True)
        note = a.out/'selected-runtime-observation.txt'
        note.write_text(line+'\n',encoding='utf8')
        cmd = [sys.executable,str(a.forja/'tools/advance-observed-target.py'),
               '--forja',str(a.forja),'--rom',str(a.rom),
               '--project',str(a.project),'--hint',str(note),
               '--out',str(a.out/'target-integration'), '--target',target,
               '--max-sites',str(a.max_sites)]
        if ' kind=STATE ' in (' '+line+' '):
            cmd.extend(['--missing-states','--source-unit','state_'+line.split(' c=')[-1].split()[0]])
        if a.apply: cmd.append('--apply')
        if a.preserve_existing: cmd.append('--preserve-existing')
        done = subprocess.run(cmd,check=False)
        if done.returncode:
            raise ValueError('Focused ROM proof/integrator rejected target; port unchanged by this tool')
        print(json.dumps({'observed_target':target,'runtime_observation':line,
                          'applied':a.apply,'output':str(a.out/'target-integration')}))
    except (OSError, ValueError) as exc:
        p.exit(2,'Refused latest runtime CFG integration: '+str(exc)+'\n')


if __name__ == '__main__': main()
