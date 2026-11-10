#!/usr/bin/env python3
"""Forja65 REV172: audit gameplay progress from read-only per-frame WRAM CSV.

This is a diagnostic, not a level-clear oracle: never infer victory solely from
frames, horizontal position, framebuffer activity, or CPU/Cx4 instruction count.
"""
import argparse
import csv
import json
from pathlib import Path


def analyze(rows, xfield, yfield, window=90, max_teleport=192):
    if window < 2 or max_teleport <= 0:
        raise ValueError('invalid window or teleport threshold')
    if not rows:
        raise ValueError('empty WRAM trace')
    states=[]
    prev_frame = -1
    for r in rows:
        frame = int(r['frame'])
        if frame <= prev_frame:
            raise ValueError('frames must be strictly increasing')
        prev_frame=frame
        x=int(r[xfield]); y=int(r[yfield]); state=int(r['wram_009da_1']) if 'wram_009da_1' in r else None
        joy=int(r.get('joy1', '0'), 16)
        if not (0 <= x <= 65535 and 0 <= y <= 65535):
            raise ValueError('WRAM coordinate out of range')
        states.append({'frame': frame,'x':x,'y':y,'state':state,'joy':joy,'fbhash':r.get('fbhash')})
    resets=[]; stalls=[]; peak_stalls=[]
    # Detect resets/teleports rather than counting wraps or death as movement.
    epoch=0
    for i in range(1,len(states)):
        a,b=states[i-1],states[i]
        if (a['x'] and not b['x']) or (a['y'] and not b['y']) or abs(b['x']-a['x'])>max_teleport or abs(b['y']-a['y'])>max_teleport:
            resets.append({'from':a['frame'],'to':b['frame']}); epoch=i
        if i>=window-1:
            segment=states[i-window+1:i+1]
            # Continuous frames and no reset; the player is trying to move right.
            if segment[-1]['frame']-segment[0]['frame']!=window-1: continue
            if any(any(reset['to']==z['frame'] for reset in resets) for z in segment): continue
            forward=sum(bool(z['joy'] & 0x0100) for z in segment)
            if forward < window*0.7: continue
            lo=min(z['x'] for z in segment);hi=max(z['x'] for z in segment)
            earlier_max=max((z['x'] for z in states[:i-window+1] if z['x']), default=0)
            if hi <= earlier_max:
                peak={'start':segment[0]['frame'],'end':segment[-1]['frame'],
                      'historical_max_x':earlier_max,'window_max_x':hi,'right_input_frames':forward}
                if not peak_stalls or peak_stalls[-1]['end'] < peak['start']-1: peak_stalls.append(peak)
                else:peak_stalls[-1]['end']=peak['end']
            if hi-lo<=5:
                entry={'start':segment[0]['frame'],'end':segment[-1]['frame'],
                       'x_min':lo,'x_max':hi,'right_input_frames':forward}
                if not stalls or stalls[-1]['end'] < entry['start']-1:stalls.append(entry)
                else:stalls[-1]['end']=entry['end']
    valid=[s for s in states if s['x'] and s['y']]
    if not valid: raise ValueError('no nonzero coordinates observed')
    bestx=max(valid, key=lambda z:z['x'])
    miny=min(valid,key=lambda z:z['y'])
    return {'frames_observed':len(states),'first_frame':states[0]['frame'],
            'last_frame':states[-1]['frame'],'max_x':bestx['x'],
            'max_x_frame':bestx['frame'],'min_y':miny['y'],
            'min_y_frame':miny['frame'],'last_position':{'x':states[-1]['x'],'y':states[-1]['y']},
            'suspected_resets':resets,'stalls_right':stalls,
            'no_new_horizontal_peak':peak_stalls,
            'phase_clear':'NOT_VERIFIED',
            'interpretation':'Coordinates demonstrate traversal, not a completed level.'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('csvfile',type=Path)
    p.add_argument('--x',default='wram_009dd_2')
    p.add_argument('--y',default='wram_009e0_2')
    p.add_argument('--window',type=int,default=90)
    p.add_argument('--output',type=Path)
    args=p.parse_args()
    with args.csvfile.open(newline='') as f:
        data=list(csv.DictReader(f))
    result=analyze(data,args.x,args.y,args.window)
    report=json.dumps(result,indent=2,ensure_ascii=False)
    if args.output:args.output.write_text(report+'\n',encoding='utf-8')
    print(report)

if __name__=='__main__':main()
