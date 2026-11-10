#!/usr/bin/env python3
"""Deterministic joypad replay compiler for Forja65 (REV175).

Supports explicit button pulses with width/period and delayed start. A shot
requires a release interval; hold=shoot is valid but not substituted for pulses.
Only produces input trace, never modifies ROM, save states, CPU or WRAM.
"""
import argparse
import json
from pathlib import Path

BUTTONS = {
    'right': 0x0100, 'left': 0x0200, 'up': 0x0800,
    'down': 0x0400, 'jump': 0x8000, 'shoot': 0x4000,
    'dash': 0x0080, 'start': 0x1000, 'select': 0x2000,
}
MAX_FRAMES = 30000


def _button(name):
    if name not in BUTTONS:
        raise ValueError('unknown joypad button: ' + str(name))
    return BUTTONS[name]


def build_masks(plan):
    if not isinstance(plan, dict) or not isinstance(plan.get('phases'), list):
        raise ValueError('expected phases list')
    masks = []
    for phase in plan['phases']:
        if not isinstance(phase, dict):
            raise ValueError('invalid phase')
        count = phase.get('frames')
        if type(count) is not int or count < 1 or count > MAX_FRAMES:
            raise ValueError('invalid frame count')
        held = phase.get('hold', [])
        pulses = phase.get('pulses', [])
        if not isinstance(held, list) or not isinstance(pulses, list):
            raise ValueError('hold and pulses must be lists')
        base = 0
        for b in held:
            base |= _button(b)
        parsed = []
        for p in pulses:
            if not isinstance(p, dict):
                raise ValueError('invalid pulse')
            btn = _button(p.get('button'))
            period, width, start = p.get('every'), p.get('width', 1), p.get('start', 0)
            if (type(period) is not int or type(width) is not int or type(start) is not int
                    or period < 1 or width < 1 or width > period or start < 0):
                raise ValueError('invalid pulse timing')
            parsed.append((btn, period, width, start))
        for i in range(count):
            mask = base
            for btn, period, width, start in parsed:
                if i >= start and (i-start) % period < width:
                    mask |= btn
            if mask & BUTTONS['left']:
                mask &= ~BUTTONS['right']
            if mask & BUTTONS['up']:
                mask &= ~BUTTONS['down']
            masks.append(mask)
        if len(masks) > MAX_FRAMES:
            raise ValueError('campaign longer than max frames')
    if not masks:
        raise ValueError('empty campaign')
    return masks


def trace(plan, masks):
    frame = plan.get('start_frame')
    rom = plan.get('rom_fingerprint')
    if type(frame) is not int or frame < 0 or not isinstance(rom, str) or not (8 <= len(rom) <= 64) or not all(c in '0123456789abcdef' for c in rom.lower()):
        raise ValueError('invalid trace identity')
    head = '# FORJA65_INPUT_TRACE 1 rom=' + rom
    return '\n'.join([head] + [f'frame={frame+i} joy1={mask:04x} joy2=0000'
                                  for i, mask in enumerate(masks)]) + '\n'


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--plan', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    args = p.parse_args()
    plan = json.loads(args.plan.read_text(encoding='utf-8'))
    masks = build_masks(plan)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(trace(plan, masks), encoding='utf-8')
    print(f'Forja65 pulsed campaign: {len(masks)} frames; trace={args.output}')


if __name__ == '__main__':
    main()
