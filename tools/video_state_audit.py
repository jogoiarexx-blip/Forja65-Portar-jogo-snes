#!/usr/bin/env python3
"""Read-only per-frame SNES video-state diagnostics from FORJA65_VIDEO_STATE_CSV.

This measures correlated changes, not causality or SNES-equivalence.
"""
import argparse
import csv
import json
from pathlib import Path

HASH_COLS = ('framebuffer','wram','vram','cgram','oam')
COUNT_COLS = ('ppu_writes','dma_bytes','hdma_bytes','blocked_vram_writes')
STATE_COLS = ('inidisp','bgmode','tm','ts')
COLUMNS = ('frame','pc') + HASH_COLS + COUNT_COLS + STATE_COLS + ('joy1','autojoy1')


def inspect(path, start=0, end=None):
    if start < 0 or (end is not None and end < start):
        raise ValueError('Invalid frame window')
    with Path(path).open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames or not set(COLUMNS).issubset(reader.fieldnames):
            raise ValueError('Video-state CSV has missing columns')
        rows, previous_frame, prior = [], -1, None
        for r in reader:
            try:
                frame = int(r['frame'])
                counters = {k:int(r[k]) for k in COUNT_COLS}
            except (ValueError, TypeError) as exc:
                raise ValueError('Invalid frame or hardware counter') from exc
            if frame <= previous_frame:
                raise ValueError('Non-monotonic or duplicate frame')
            previous_frame = frame
            if prior is not None and any(counters[k] < prior[k] for k in COUNT_COLS):
                raise ValueError('Non-monotonic cumulative counters')
            prior = counters
            if frame >= start and (end is None or frame <= end):
                rows.append((r, counters))
    if len(rows) < 2:
        return {'status':'insufficient_samples','samples':len(rows)}
    first, last = rows[0][0], rows[-1][0]
    uniques = {k:len({r[k] for r,_ in rows}) for k in HASH_COLS + STATE_COLS}
    diffs = {k:rows[-1][1][k]-rows[0][1][k] for k in COUNT_COLS}
    fb_static = uniques['framebuffer'] == 1
    video_static = all(uniques[k] == 1 for k in ('vram','cgram','oam'))
    if not fb_static:
        status='framebuffer_changed'
    elif not video_static:
        status='static_image_video_memory_changed'
    elif uniques['wram'] > 1:
        status='static_image_wram_changed_video_memory_static'
    else:
        status='static_image_memory_unchanged'
    return {
        'status':status,'samples':len(rows),'first_frame':int(first['frame']),
        'last_frame':int(last['frame']),'hash_uniques':uniques,
        'counter_deltas':diffs,
        'read_only':True,
        'interpretation':('Changes in PPU memory do not prove visible output should change. '
          'Constant VRAM/CGRAM/OAM does not prove a timing bug: check PPU registers, '
          'NMI, gameplay state, transfer destinations, and a reference SNES trace.')
    }


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('input',type=Path)
    p.add_argument('--start',type=int,default=0)
    p.add_argument('--end',type=int)
    p.add_argument('--out',type=Path)
    a=p.parse_args()
    result=inspect(a.input,a.start,a.end)
    output=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if a.out:
        a.out.parent.mkdir(parents=True,exist_ok=True)
        a.out.write_text(output,encoding='utf-8')
    print(output,end='')


if __name__=='__main__':
    main()
