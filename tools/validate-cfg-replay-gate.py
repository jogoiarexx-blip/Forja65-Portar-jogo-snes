#!/usr/bin/env python3
"""Fail-closed evidence gate for deterministic native-port CFG replays.

Compares complete sequential frame signatures, not just frame counts. It can
prove an identical prefix and additional complete frames; it cannot prove
playability, stage completion, or assign an overall CFG quality score.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

LINE = re.compile(r'^frame=(\d+) framebuffer=([a-fA-F0-9]{1,16}) wram=([a-fA-F0-9]{1,16}) pc=([a-fA-F0-9]{1,6})$')


def load_frames(path: Path) -> list[tuple[str, str, str]]:
    frames=[]
    with path.open('r',encoding='utf-8-sig') as stream:
        for number, raw in enumerate(stream):
            match=LINE.fullmatch(raw.rstrip('\r\n'))
            if not match or int(match[1])!=number:
                raise ValueError(f'Invalid or missing frame #{number} in {path.name}')
            frames.append((match[2].lower(),match[3].lower(),match[4].lower()))
    if not frames:
        raise ValueError(f'Empty replay: {path.name}')
    return frames


def evaluate(baseline: Path, candidate: Path, *, baseline_rom: str|None=None,
             candidate_rom: str|None=None, candidate_exit_code: int|None=None) -> dict:
    if (baseline_rom is None) != (candidate_rom is None):
        raise ValueError('Both ROM SHA-256 hashes are required for a ROM comparison')
    if baseline_rom is not None:
        for rom in (baseline_rom,candidate_rom):
            if not re.fullmatch(r'[0-9a-fA-F]{64}',rom):
                raise ValueError('Invalid ROM SHA-256')
        if baseline_rom.lower()!=candidate_rom.lower():
            raise ValueError('Cannot compare replays produced from different ROM hashes')
    if candidate_exit_code is not None and candidate_exit_code<0:
        raise ValueError('Invalid candidate exit code')
    a,b=load_frames(baseline),load_frames(candidate)
    identical=0
    for old,new in zip(a,b):
        if old!=new:break
        identical+=1
    consistent=identical>=len(a)
    gain=len(b)-len(a)
    status=('diverged' if identical<min(len(a),len(b)) else
            'truncated' if gain<0 else 'extended' if gain>0 else 'unchanged')
    return {
        'schema':'forja65.cfg.replay-gate.v1',
        'status':status,
        'baseline_frames':len(a), 'candidate_frames':len(b),
        'identical_prefix_frames':identical,
        'first_unmatched_frame':identical if not consistent else None,
        'gain_complete_frames':gain,
        'baseline_preserved':consistent,
        'verified_execution_advance':bool(consistent and gain>0),
        'candidate_exit_code':candidate_exit_code,
        'replay_completed_without_error':candidate_exit_code==0 if candidate_exit_code is not None else None,
        'rom_sha256':baseline_rom.lower() if baseline_rom else None,
        'baseline_file_sha256':hashlib.sha256(baseline.read_bytes()).hexdigest(),
        'candidate_file_sha256':hashlib.sha256(candidate.read_bytes()).hexdigest(),
        'cfg_global_grade_certified':False,
        'scope':'Exact deterministic framebuffer/WRAM/PC prefix only; not proof of game completion or overall CFG quality'
    }


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('baseline',type=Path)
    p.add_argument('candidate',type=Path)
    p.add_argument('--baseline-rom')
    p.add_argument('--candidate-rom')
    p.add_argument('--exit-code',type=int)
    p.add_argument('--output',type=Path)
    args=p.parse_args()
    try:
        result=evaluate(args.baseline,args.candidate,baseline_rom=args.baseline_rom,
                        candidate_rom=args.candidate_rom,candidate_exit_code=args.exit_code)
    except (OSError,ValueError) as error:
        p.error(str(error))
    txt=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:
        args.output.parent.mkdir(exist_ok=True,parents=True)
        args.output.write_text(txt,encoding='utf-8')
    print(txt,end='')
    if not result['baseline_preserved']:raise SystemExit(2)

if __name__=='__main__': main()
