#!/usr/bin/env python3
"""Verify one *compiled* Forja65 port checkpoint in an isolated directory.

This is a runtime smoke gate, not proof of SNES/gameplay equivalence. The
analysis/integration tools cannot mark an observed target validated until
its generated program actually builds and runs with matching input.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

HASH = re.compile(r'^[0-9a-f]{16}$')


def run_checkpoint(game, frames, out, *, expected_rom, replay=None, assets=None,
                   timeout=1800, override_env=()):
    game = Path(game).resolve()
    out = Path(out).resolve()
    if not game.is_file():
        raise ValueError('Compiled executable not found: ' + str(game))
    if frames < 1 or frames > 1_000_000:
        raise ValueError('Frame count out of permitted range')
    if not HASH.fullmatch(expected_rom):
        raise ValueError('Expected ROM FNV64 must be 16 lowercase hexadecimal digits')
    if timeout < 1:
        raise ValueError('Timeout must be at least 1 second')
    if replay is not None and not Path(replay).is_file():
        raise ValueError('Input replay file does not exist')
    assets = Path(assets).resolve() if assets is not None else (game.parent/'assets')
    if not assets.is_dir():
        raise ValueError('Assets directory not found: '+str(assets))
    if not (assets/'cart-data.bin').is_file():
        raise ValueError('The assets directory is missing cart-data.bin')
    out.mkdir(parents=True, exist_ok=True)
    # Never allow an earlier PASS to be accidentally reused as evidence for
    # another run. A new QA directory makes reports independently auditable.
    for suffix in ('forja65-qa-status.txt', 'forja65-runtime-hints.txt',
                   'forja65-oracle-hints.txt', 'forja65-last-error.txt'):
        if (out/suffix).exists():
            raise ValueError('QA directory has previous diagnostics: '+str(out))
    if not (out/'assets').exists():
        shutil.copytree(assets, out/'assets')
    env = os.environ.copy()
    for key in ('FORJA65_INPUT_REPLAY', 'FORJA65_HEADLESS_FRAMES',
                'FORJA65_CAPTURE_FRAMES', 'FORJA65_CAPTURE_FRAME',
                'FORJA65_CAPTURE_STOP'):
        env.pop(key, None)
    env.update(FORJA65_HEADLESS='1', FORJA65_UNCAPPED='1',
               FORJA65_HEADLESS_FRAMES=str(frames), FORJA65_PROGRESS_EVERY='3000')
    if replay is not None:
        env['FORJA65_INPUT_REPLAY'] = str(Path(replay).resolve())
    for item in override_env:
        if '=' not in item:
            raise ValueError('Override must have KEY=VALUE syntax')
        key, val = item.split('=',1)
        if not re.fullmatch(r'FORJA65_[A-Z0-9_]+',key):
            raise ValueError('Override only supports FORJA65_* keys')
        if key in ('FORJA65_HEADLESS','FORJA65_HEADLESS_FRAMES','FORJA65_INPUT_REPLAY'):
            raise ValueError('Override cannot change mandatory replay fields')
        env[key]=val
    timed_out=False
    with (out/'replay.log').open('w',encoding='utf8') as logfile:
        try:
            completed=subprocess.run([str(game)],cwd=out,env=env,
                                     stdout=logfile,stderr=subprocess.STDOUT,timeout=timeout)
            exit_code=completed.returncode
        except subprocess.TimeoutExpired:
            timed_out=True
            exit_code=None
    path=out/'forja65-qa-status.txt'
    qa={}
    if path.is_file():
        qa=dict(line.split('=',1) for line in path.read_text(errors='replace').splitlines() if '=' in line)
    hint_files=[p.name for name in ('forja65-runtime-hints.txt','forja65-oracle-hints.txt')
                if (p:=out/name).is_file() and p.stat().st_size>0]
    problems=[]
    if timed_out:problems.append('timeout')
    if exit_code!=0:problems.append('nonzero_exit')
    if qa.get('runtime_started')!='PASS':problems.append('qa_runtime_failed')
    if qa.get('rom')!=expected_rom:problems.append('rom_fingerprint_mismatch')
    if qa.get('frames')!=str(frames):problems.append('frame_target_not_met')
    if hint_files:problems.append('new_unresolved_flow')
    result={'schema':1,'kind':'forja65.compiled-checkpoint-gate',
            'claimed_equivalence_to_snes':False,'game':str(game),'frames_requested':frames,
            'replay':str(Path(replay).resolve()) if replay else None,
            'qa':qa,'exit_code':exit_code,'timed_out':timed_out,
            'hint_files':hint_files,'problems':problems,'passed':not problems}
    (out/'checkpoint-result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--game',type=Path,required=True)
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--frames',type=int,required=True)
    p.add_argument('--expected-rom',required=True)
    p.add_argument('--replay',type=Path)
    p.add_argument('--assets',type=Path)
    p.add_argument('--timeout',type=int,default=1800)
    p.add_argument('--env',action='append',default=[])
    a=p.parse_args()
    try:
        result=run_checkpoint(a.game,a.frames,a.out,expected_rom=a.expected_rom,
                              replay=a.replay,assets=a.assets,timeout=a.timeout,
                              override_env=a.env)
    except (OSError,ValueError) as e:
        p.exit(2,'Checkpoint refused: '+str(e)+'\n')
    print(json.dumps({k:result[k] for k in ('passed','frames_requested','problems','exit_code')},indent=2))
    if not result['passed']:
        raise SystemExit(1)

if __name__=='__main__':
    main()
