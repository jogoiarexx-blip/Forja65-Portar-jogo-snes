#!/usr/bin/env python3
"""Fail-closed comparison of two deterministic SNES replay runs.

An input-dependent image/PPU difference is evidence of an input-dependent state,
not necessarily movement, a projectile, damage, or stage completion.
"""
import argparse
import csv
import json
from pathlib import Path

VIDEO_COLUMNS=('frame','framebuffer','wram','vram','cgram','oam','joy1','autojoy1')
PROGRESS_COLUMNS=('frame','pc','joy1','autojoy1','instructions','nmi','fb_fnv1a64')

def rows(path, required):
    with Path(path).open(encoding='utf-8-sig',newline='') as handle:
        reader=csv.DictReader(handle)
        if not reader.fieldnames or not set(required).issubset(reader.fieldnames):
            raise ValueError(f'Missing columns in {path}: {set(required)-set(reader.fieldnames or [])}')
        result={}
        for row in reader:
            frame=int(row['frame'])
            if frame in result:raise ValueError(f'Duplicate frame {frame} in {path}')
            if frame < 0:raise ValueError('Negative frame')
            result[frame]=row
        if not result:raise ValueError(f'Empty replay file: {path}')
    return result

def compare(a_progress,b_progress,*,a_video=None,b_video=None,start=0,end=None):
    a=rows(a_progress,PROGRESS_COLUMNS);b=rows(b_progress,PROGRESS_COLUMNS)
    overlap=sorted(f for f in a.keys()&b.keys() if f>=start and (end is None or f<=end))
    if not overlap:return {'status':'no_shared_frames','matched_frames':0,'gameplay_verified':False}
    # Replays must share the same prefix. A divergent baseline invalidates causality.
    mismatch=[];inputs=[];fb=[]
    for f in overlap:
        if any(a[f][c]!=b[f][c] for c in ('joy1','autojoy1')): inputs.append(f)
        if a[f]['fb_fnv1a64'].lower()!=b[f]['fb_fnv1a64'].lower():fb.append(f)
        if f < (inputs[0] if inputs else 10**18) and any(a[f][c]!=b[f][c] for c in ('pc','instructions','nmi','fb_fnv1a64')):
            mismatch.append(f)
    if mismatch:return {'status':'baseline_diverged_before_input','matched_frames':len(overlap),'first_divergence':mismatch[0],'gameplay_verified':False}
    if not inputs:return {'status':'no_input_difference','matched_frames':len(overlap),'gameplay_verified':False}
    first_input=inputs[0]
    # Input-dependent outcomes must occur AFTER the first differing input, not before.
    after_fb=[f for f in fb if f>=first_input]
    result={'status':'input_applied_no_visual_difference' if not after_fb else 'input_correlated_image_change',
            'matched_frames':len(overlap),'first_input_difference':first_input,
            'first_image_difference':after_fb[0] if after_fb else None,
            'image_differences':len(after_fb),'gameplay_verified':False,
            'note':'Matching frames and differing image hashes do not identify a moving player or projectile.'}
    if (a_video is None) != (b_video is None):raise ValueError('Both video logs required for comparison')
    if a_video is not None:
        va=rows(a_video,VIDEO_COLUMNS);vb=rows(b_video,VIDEO_COLUMNS)
        vframes=sorted((va.keys()&vb.keys())&set(overlap))
        if not vframes:
            result['video_status']='no_matched_video_frames'
        else:
            result['video_status']='compared'
            result['matched_video_frames']=len(vframes)
            result['first_video_difference']={}
            for key in ('wram','vram','cgram','oam','framebuffer'):
                differences=[f for f in vframes if f>=first_input and va[f][key].lower()!=vb[f][key].lower()]
                result['first_video_difference'][key]=differences[0] if differences else None
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('neutral_progress',type=Path)
    parser.add_argument('controlled_progress',type=Path)
    parser.add_argument('--neutral-video',type=Path)
    parser.add_argument('--controlled-video',type=Path)
    parser.add_argument('--start',type=int,default=0)
    parser.add_argument('--end',type=int)
    parser.add_argument('--out',type=Path)
    args=parser.parse_args()
    if args.start<0 or args.end is not None and args.end<args.start:parser.error('Invalid frame window')
    try:
        result=compare(args.neutral_progress,args.controlled_progress,
          a_video=args.neutral_video,b_video=args.controlled_video,start=args.start,end=args.end)
    except (ValueError,OSError) as exc:parser.error(str(exc))
    output=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.out:args.out.parent.mkdir(parents=True,exist_ok=True);args.out.write_text(output,encoding='utf8')
    print(output,end='')

if __name__=='__main__':main()
