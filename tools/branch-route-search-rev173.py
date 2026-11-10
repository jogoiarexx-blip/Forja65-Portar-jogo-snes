#!/usr/bin/env python3
"""REV173: read-only, checkpoint-based route exploration for Forja65 ports.

Only Linux/macOS FORJA65_CONTROL ports support fork-based save/load. This
explores INPUTS, never patches RAM/ROM or alters the CPU/PPU. Position is a
heuristic, not evidence of a level clear; verify boss defeat independently.

Example:
 python3 tools/branch-route-search-rev173.py --game bin/linux/game \
     --checkpoint tests/intro-2838-rev172.f65s \
     --config tests/branch-route-rev173.json --output reports/rev173-search
"""
from __future__ import annotations
import argparse
import json
import os
import select
import subprocess
import sys
from pathlib import Path

MAX_FRAMES_PER_ACTION = 300
MAX_TOTAL_FRAMES = 10000
MAX_CANDIDATES = 96


def parse_mask(value):
    """Hex joypad mask. No memory patching or process scripting."""
    if not isinstance(value, str) or not 1 <= len(value) <= 4:
        raise ValueError('mask must be a 1-4 digit hexadecimal string')
    if not all(c in '0123456789abcdefABCDEF' for c in value):
        raise ValueError('invalid hexadecimal joypad mask')
    return int(value, 16)


def expand_actions(actions):
    if not isinstance(actions, list):
        raise ValueError('expected list of actions')
    expanded = []
    for item in actions:
        if not isinstance(item, dict):
            raise ValueError('invalid action')
        count = item.get('repeat', 1)
        frames = item.get('frames')
        if type(count) is not int or not 1 <= count <= 200:
            raise ValueError('repeat outside 1-200')
        if type(frames) is not int or not 1 <= frames <= MAX_FRAMES_PER_ACTION:
            raise ValueError('frames outside 1-300')
        mask = parse_mask(item.get('mask'))
        expanded += [(frames, mask)] * count
    if sum(n for n, _ in expanded) > MAX_TOTAL_FRAMES:
        raise ValueError('too many frames')
    return expanded


def load_config(path):
    cfg = json.loads(Path(path).read_text(encoding='utf-8'))
    candidates = cfg.get('candidates', [])
    if not isinstance(candidates, list) or not 1 <= len(candidates) <= MAX_CANDIDATES:
        raise ValueError('candidates must contain 1-96 entries')
    prefix = expand_actions(cfg.get('prefix', []))
    result = []
    names = set()
    for c in candidates:
        if not isinstance(c, dict) or not isinstance(c.get('name'), str):
            raise ValueError('each candidate requires a name')
        name = c['name']
        if not name or len(name) > 48 or not all(ch.isascii() and (ch.isalnum() or ch in '-_') for ch in name):
            raise ValueError('unsafe candidate name')
        if name in names:
            raise ValueError('duplicate candidate')
        names.add(name)
        actions = expand_actions(c.get('actions', []))
        if not actions or sum(n for n, _ in prefix + actions) > MAX_TOTAL_FRAMES:
            raise ValueError('empty or too long candidate')
        result.append((name, actions))
    return prefix, result


def summarize(trajectory, min_x=None):
    if not trajectory:
        raise ValueError('empty trajectory')
    # Treat camera/respawn jumps as suspicious; never mislabel a death as progress.
    resets = [x['frame'] for a, x in zip(trajectory, trajectory[1:])
              if abs(x['x'] - a['x']) > 192 or abs(x['y'] - a['y']) > 192]
    valid = [s for s in trajectory if s['x'] and s['y']]
    if not valid:
        raise ValueError('no nonzero position observed')
    peak = max(valid, key=lambda s: s['x'])
    eligible = [s for s in valid if min_x is None or s['x'] >= min_x]
    top = min(eligible, key=lambda s: s['y']) if eligible else None
    return {'max_x_observed': peak['x'], 'max_x_frame': peak['frame'],
            'min_y_near_target': top['y'] if top else None,
            'min_y_frame': top['frame'] if top else None,
            'last': trajectory[-1], 'suspicious_discontinuities': resets,
            'phase_cleared': 'NOT_VERIFIED'}


def rank(summary, objective='horizontal'):
    # Choice depends on obstacle: horizontal coverage or upper wall climbing.
    clean = not summary['suspicious_discontinuities']
    y = summary['min_y_near_target']
    if objective == 'climb':
        return (clean, y is not None, -(y if y is not None else 65536), summary['max_x_observed'])
    return (clean, summary['max_x_observed'], -(y if y is not None else 65536))


class Controller:
    def __init__(self, game, checkpoint, game_dir, x_offset, y_offset, mode_offset, timeout):
        if os.name != 'posix':
            raise RuntimeError('fork snapshots currently require POSIX')
        env = {**os.environ, 'FORJA65_HEADLESS': '1',
               'FORJA65_HEADLESS_FRAMES': '999999', 'FORJA65_CONTROL': '1',
               'FORJA65_CHECKPOINT_LOAD': str(checkpoint),
               'SDL_AUDIODRIVER': 'dummy', 'SDL_VIDEODRIVER': 'dummy'}
        env.pop('FORJA65_INPUT_REPLAY', None)
        env.pop('FORJA65_CHECKPOINT_BRANCH_REPLAY', None)
        self.p = subprocess.Popen([str(game)], cwd=game_dir, env=env,
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, bufsize=0)
        self.timeout = timeout
        self.x_offset, self.y_offset, self.mode_offset = x_offset, y_offset, mode_offset
        try:
            first, ready = self.recv(), self.recv()
            if not first.startswith('FORJA65_CHECKPOINT_LOADED') or not ready.startswith('ready '):
                raise RuntimeError(f'checkpoint or control failure: {first}, {ready}')
            self.start_frame = int(ready.split()[-1])
            self.snapshot_frames = {}
            self.save('root173')
        except Exception:
            self.close(); raise

    def recv(self):
        if not select.select([self.p.stdout], [], [], self.timeout)[0]:
            raise TimeoutError('control response exceeded timeout')
        data = self.p.stdout.readline()
        if not data:
            raise RuntimeError('game stopped answering control commands')
        return data.decode(errors='replace').strip()

    def command(self, command):
        self.p.stdin.write((command + '\n').encode('ascii'))
        self.p.stdin.flush()
        return self.recv()

    def save(self, name):
        frame = int(self.command('frame'))
        response = self.command('save '+name)
        if response != 'ok':
            raise RuntimeError('fork snapshot save failed: '+response)
        self.snapshot_frames[name] = frame

    def restore(self, name='root173'):
        response = self.command('load '+name)
        if not response.startswith('ok '):
            raise RuntimeError('fork snapshot restore failed: '+response)
        if int(response.split()[-1]) != self.snapshot_frames[name]:
            raise RuntimeError('checkpoint frame shifted during restore')

    def screenshot(self, path):
        # Do not accept a stale image when the runtime reports a failed write.
        path.unlink(missing_ok=True)
        response = self.command('shot '+str(path))
        if response != 'ok' or not path.is_file() or path.stat().st_size == 0:
            raise RuntimeError('screenshot was not written: '+response)

    def state(self):
        base = min(self.x_offset, self.y_offset, self.mode_offset)
        size = max(self.x_offset + 2, self.y_offset + 2, self.mode_offset + 1) - base
        if size > 512:
            raise ValueError('WRAM offsets too far apart')
        raw = bytes.fromhex(self.command(f'ram {base:x} {size:x}'))
        word = lambda addr: raw[addr-base] + 256*raw[addr-base+1]
        return {'frame': int(self.command('frame')), 'x': word(self.x_offset),
                'y': word(self.y_offset), 'mode': raw[self.mode_offset-base]}

    def run(self, actions, sample_interval):
        trajectory = [self.state()]
        for n, mask in actions:
            while n > 0:
                step = min(n, sample_interval)
                result = self.command(f'run {step} {mask:04x}')
                if not result.startswith('ok '):
                    raise RuntimeError('input rejected: '+result)
                trajectory.append(self.state())
                n -= step
        return trajectory

    def close(self):
        try: self.command('quit')
        except Exception: pass
        if self.p.poll() is None: self.p.kill()
        try: self.p.wait(timeout=1)
        except subprocess.TimeoutExpired: pass
        for stream in (self.p.stdin, self.p.stdout, self.p.stderr):
            stream.close()


def replay_lines(start_frame, actions, rom_hash):
    lines = [f'# FORJA65_INPUT_TRACE 1 rom={rom_hash}']
    frame = start_frame
    for count, mask in actions:
        for _ in range(count):
            lines.append(f'frame={frame} joy1={mask:04x} joy2=0000')
            frame += 1
    return '\n'.join(lines) + '\n'


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--game', type=Path, required=True)
    p.add_argument('--game-dir', type=Path)
    p.add_argument('--checkpoint', type=Path, required=True)
    p.add_argument('--config', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--x-offset', type=lambda s: int(s, 16), default=0x09DD)
    p.add_argument('--y-offset', type=lambda s: int(s, 16), default=0x09E0)
    p.add_argument('--mode-offset', type=lambda s: int(s, 16), default=0x09DA)
    p.add_argument('--near-x', type=int, default=5100)
    p.add_argument('--objective', choices=('horizontal','climb'), default='horizontal')
    p.add_argument('--sample-every', type=int, default=5)
    p.add_argument('--timeout', type=float, default=20.)
    p.add_argument('--rom-hash', default='unknown')
    args = p.parse_args(argv)
    if not 1 <= args.sample_every <= 120 or args.timeout < 1:
        p.error('invalid sampling or timeout')
    game = args.game.resolve(); directory = (args.game_dir or game.parent).resolve()
    # CLI file arguments are relative to the invocation directory, as in the example.
    ckpt = args.checkpoint.resolve()
    if not game.is_file() or not ckpt.is_file(): p.error('missing executable or checkpoint')
    prefix, candidates = load_config(args.config)
    out = args.output.resolve()
    if any(ch.isspace() for ch in str(out)):
        p.error('output path cannot contain whitespace: screenshot protocol uses one path token')
    out.mkdir(parents=True, exist_ok=True)
    ctl = Controller(game, ckpt, directory, args.x_offset, args.y_offset, args.mode_offset, args.timeout)
    records = []
    try:
        root_frame = ctl.start_frame
        if prefix:
            ctl.run(prefix, args.sample_every)
            ctl.save('prefix173')
        for name, actions in candidates:
            ctl.restore('prefix173' if prefix else 'root173')
            trajectory = ctl.run(actions, args.sample_every)
            result = summarize(trajectory, args.near_x)
            result.update(name=name, checkpoint=str(ckpt), start_frame=trajectory[0]['frame'],
                          frames_run=sum(n for n,_ in actions))
            records.append(result)
            print(f"{name}: maxX={result['max_x_observed']} minY={result['min_y_near_target']} last={result['last']}",flush=True)
        best = max(records, key=lambda r:rank(r,args.objective))
        best_name = best['name']
        winning_actions = next(a for name, a in candidates if name == best_name)
        ctl.restore('prefix173' if prefix else 'root173')
        verified = summarize(ctl.run(winning_actions, args.sample_every), args.near_x)
        for f in ('max_x_observed', 'min_y_near_target', 'last'):
            if best[f] != verified[f]:
                raise RuntimeError(f'non-deterministic route: {f} does not match')
        ctl.screenshot(out/'best-route.ppm')
        (out/'best-route-input.txt').write_text(replay_lines(root_frame,prefix+winning_actions,args.rom_hash),encoding='utf-8')
        report = {'best_candidate': best_name, 'reverified': True,
                  'checkpoint_frame': root_frame, 'objective':args.objective, 'best': best,
                  'candidates': records, 'phase_cleared': 'NOT_VERIFIED',
                  'notes': 'Search explores real joypad input only. Never infer boss defeat from position.'}
        (out/'route-search-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        print(f'BEST {best_name}: maxX={best["max_x_observed"]}; phase NOT VERIFIED',flush=True)
    finally:
        ctl.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
