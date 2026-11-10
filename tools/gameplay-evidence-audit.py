#!/usr/bin/env python3
"""Evidence-based replay assessment; does NOT infer gameplay from rendered frames.

Consumes headless progress and optional per-frame video-state CSV. Distinguishes
rendering and input reception from actual movement/combat/victory evidence.
"""
import argparse
import csv
import json
from pathlib import Path


def read_progress(path):
    with Path(path).open(newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        expected = {'frame', 'instructions', 'nmi', 'joy1', 'fb_fnv1a64'}
        if not reader.fieldnames or not expected.issubset(reader.fieldnames):
            raise ValueError('Missing required headless progress columns')
        rows=[]
        for r in reader:
            try:
                row={'frame':int(r['frame']), 'instructions':int(r['instructions']),
                     'nmi':int(r['nmi']), 'joy1':int(r['joy1'],16),
                     'framebuffer':r['fb_fnv1a64'].lower()}
            except (ValueError,TypeError) as e:
                raise ValueError('Malformed progress record') from e
            if not row['framebuffer'] or any(c not in '0123456789abcdef' for c in row['framebuffer']):
                raise ValueError('Invalid framebuffer hash')
            if rows and any(row[k] <= rows[-1][k] for k in ['frame','instructions']):
                raise ValueError('Frame/instruction timeline must be strictly increasing')
            if rows and row['nmi'] < rows[-1]['nmi']:
                raise ValueError('NMI counter decreased')
            rows.append(row)
    if not rows:
        raise ValueError('Empty progress log')
    return rows


def audit(progress, *, start=0, video=None):
    if start < 0:
        raise ValueError('Negative start frame')
    rows=[r for r in read_progress(progress) if r['frame']>=start]
    if not rows:
        return {'status':'no_samples_after_start','gameplay_verified':False,
                'reason':'Replay did not reach the requested window'}
    first,last=rows[0],rows[-1]
    observations={
        'first_frame':first['frame'],'last_frame':last['frame'],
        'samples':len(rows), 'instruction_delta':last['instructions']-first['instructions'],
        'nmi_delta':last['nmi']-first['nmi'],
        'input_samples':sum(r['joy1']!=0 for r in rows),
        'unique_framebuffer_hashes':len({r['framebuffer'] for r in rows})
    }
    if video is not None:
        from video_state_audit import inspect
        observations['video_state']=inspect(video, max(start, first['frame']), last['frame'])
    status=('render_updates_with_input' if observations['input_samples'] and observations['unique_framebuffer_hashes']>1
            else 'render_updates_no_input' if observations['unique_framebuffer_hashes']>1
            else 'static_render_with_input' if observations['input_samples'] else 'static_render_no_input')
    return {'status':status, 'observations':observations, 'gameplay_verified':False,
            'missing_evidence':['matched-frame control vs neutral OAM/world-position comparison',
                                'observable projectile and hit/collision behavior',
                                'level completion reproduced against original SNES'],
            'note':'CPU/NMI progress, control latches, framebuffer or WRAM changes alone do not prove gameplay.'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('progress',type=Path)
    p.add_argument('--start',type=int,default=0)
    p.add_argument('--video',type=Path)
    p.add_argument('--out',type=Path)
    a=p.parse_args()
    result=audit(a.progress,start=a.start,video=a.video)
    out=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if a.out:
        a.out.parent.mkdir(parents=True,exist_ok=True)
        a.out.write_text(out,encoding='utf-8')
    print(out,end='')

if __name__=='__main__':
    main()
