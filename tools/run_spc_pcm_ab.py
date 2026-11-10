#!/usr/bin/env python3
"""Capture paired SPC reference/AOT WAVs from the SAME built game and ROM assets.

Usage: python tools/run_spc_pcm_ab.py GAME_EXE ASSETS_DIR --frames 120 --out DIR
Both runs are clean and independent; audio dump is intentionally headless.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

# The comparator in the same directory is authoritative.
from compare_spc_aot import load, compare, pcm_fingerprint


def sha256(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(2**20),b''):
            h.update(b)
    return h.hexdigest()


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('game',type=Path,help='Linux/Windows game executable with linked SPC AOT')
    p.add_argument('assets',type=Path,help='Folder containing cart-data.bin')
    p.add_argument('--out',type=Path,required=True)
    p.add_argument('--frames',type=int,default=120)
    p.add_argument('--timeout',type=int,default=300)
    a=p.parse_args()
    if not 1<=a.frames<=1000000:
        p.error('frames must be between 1 and 1000000')
    game,assets,out=a.game.resolve(),a.assets.resolve(),a.out.resolve()
    if not game.is_file() or not (assets/'cart-data.bin').is_file():
        p.error('Missing executable or assets/cart-data.bin')
    if out==game.parent or out==assets or assets in out.parents:
        p.error('Output must not overwrite the executable or original assets')
    out.mkdir(parents=True,exist_ok=True)
    execution=[]
    for label,off in (('ref','1'),('aot',None)):
        directory=out/label
        if directory.exists():
            p.error(f'Output already exists: {directory}; choose a fresh --out')
        directory.mkdir()
        shutil.copytree(assets,directory/'assets')
        env={k:v for k,v in os.environ.items() if not k.startswith('FORJA65_')}
        env.update(FORJA65_HEADLESS='1',FORJA65_HEADLESS_FRAMES=str(a.frames),
            FORJA65_AUDIO_MODE='native',FORJA65_AUDIO_DUMP='1',
            FORJA65_AUDIO_PACING='0',FORJA65_AUDIO_SYNC='0',FORJA65_UNCAPPED='1',
            FORJA65_WATCHDOG_INSTRUCTIONS='250000000')
        if off is not None:
            env['FORJA65_SPC_AOT_OFF']=off
        print(f'Running {label}: {a.frames} frames',flush=True)
        try:
            run=subprocess.run([str(game)],cwd=directory,env=env,capture_output=True,
                               text=True,timeout=a.timeout,errors='replace')
        except subprocess.TimeoutExpired as e:
            print(f'{label}: timeout ({a.timeout}s)',file=sys.stderr)
            return 2
        (directory/'execution.stdout.txt').write_text(run.stdout,encoding='utf-8')
        (directory/'execution.stderr.txt').write_text(run.stderr,encoding='utf-8')
        execution.append(dict(mode=label,exit=run.returncode))
        if run.returncode!=0:
            print(f'{label}: game exit {run.returncode}; see {directory}/execution.stderr.txt')
            return 2
    result=compare(load(out/'ref'),load(out/'aot'),require_audio=True)
    manifest={'game_sha256':sha256(game),'rom_sha256':sha256(assets/'cart-data.bin'),
        'frames_requested':a.frames,'mode_results':execution,'pcm_verified':not result}
    if not result:
        frames,digest=pcm_fingerprint(out/'ref'/'forja65-native-audio.wav')
        manifest['pcm_frames']=frames
        manifest['pcm_sha256']=digest
    else:
        manifest['failures']=result
    (out/'comparison.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    if result:
        print('SPC PCM A/B FAIL:',*result,sep='\n - ')
        return 1
    print(f'SPC PCM A/B PASS: {manifest["pcm_frames"]} samples SHA256={manifest["pcm_sha256"]}')
    return 0

if __name__=='__main__':
    sys.exit(main())
