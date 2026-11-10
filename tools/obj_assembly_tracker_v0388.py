#!/usr/bin/env python3
"""Forja65: read-only groups of OAM objects and per-frame assembly trajectories.

This is a diagnostic grouping, NOT a character classifier. VRAM graphics can
change without changing tile indices, and camera movement can shift screen x/y.
"""
from __future__ import annotations
import argparse
import collections
import csv
import json
from pathlib import Path

REQUIRED = ('frame','slot','x','y','width','height','tile','attributes','visible_pixels',
            'min_x','min_y','max_x','max_y')

def load_rows(path):
    with open(path, newline='', encoding='utf-8') as stream:
        rd=csv.DictReader(stream)
        if rd.fieldnames is None or any(k not in rd.fieldnames for k in REQUIRED):
            raise ValueError('OBJ CSV missing required fields')
        rows=[]
        used=set()
        for r in rd:
            v={k:int(r[k]) for k in REQUIRED}
            f,s=v['frame'],v['slot']
            if (f,s) in used: raise ValueError('duplicated frame/slot')
            used.add((f,s))
            if not (0<=s<128 and 0<=v['y']<=255 and -256<=v['x']<=511 and
                    0<v['width']<=64 and 0<v['height']<=64 and v['visible_pixels']>0 and
                    0<=v['tile']<=511 and 0<=v['attributes']<=255 and
                    0<=v['min_x']<=v['max_x']<256 and 0<=v['min_y']<=v['max_y']<512):
                raise ValueError('invalid OBJ sample')
            rows.append(v)
    rows.sort(key=lambda a:(a['frame'],a['slot']))
    return rows

def group_key(row):
    # Tile bank in 32-tile units + palette bits; never includes dynamic H/V flip.
    # This is a heuristic family, not proof of the entity that owns those tiles.
    return (row['tile']//32*32, row['attributes']&0x0E)

def assemblies(rows, min_members=2):
    buckets=collections.defaultdict(list)
    for r in rows: buckets[(r['frame'],group_key(r))].append(r)
    tracks=collections.defaultdict(list)
    for (frame,key),rs in sorted(buckets.items()):
        if len(rs)<min_members:continue
        box=(min(r['min_x'] for r in rs),min(r['min_y'] for r in rs),
             max(r['max_x'] for r in rs),max(r['max_y'] for r in rs))
        anchor_x=min(r['x'] for r in rs); anchor_y=min(r['y'] for r in rs)
        # Relative OAM layout ignores screen translation, retains sprite arrangement.
        layout=tuple(sorted((r['tile'],r['attributes'],r['width'],r['height'],
                             r['x']-anchor_x,r['y']-anchor_y) for r in rs))
        tracks[key].append({'frame':frame,'slot_count':len(rs),'slots':sorted(r['slot'] for r in rs),
                            'box':list(box),'center2':[box[0]+box[2],box[1]+box[3]],
                            'anchor':[anchor_x,anchor_y],
                            'tile_ids':sorted({r['tile'] for r in rs}),
                            'palette_attributes':sorted({r['attributes']&0x0E for r in rs}),
                            'hflip_count':sum(bool(r['attributes']&0x40) for r in rs),
                            'vflip_count':sum(bool(r['attributes']&0x80) for r in rs),
                            'visible_pixels':sum(r['visible_pixels'] for r in rs),
                            'layout':layout})
    out=[]
    for (tile_base,pal),frames in sorted(tracks.items()):
        frames.sort(key=lambda r:r['frame'])
        seen={r['layout'] for r in frames}
        out.append({'family_id':f'tile-{tile_base:03d}-pal-{pal:02d}',
                    'tile_base':tile_base,'palette_bits':pal,
                    'frames_sampled':len(frames),'first_frame':frames[0]['frame'],
                    'last_frame':frames[-1]['frame'],
                    'first_center2':frames[0]['center2'],'last_center2':frames[-1]['center2'],
                    'center_displacement_pixels':[(frames[-1]['center2'][j]-frames[0]['center2'][j])/2 for j in range(2)],
                    'relative_layouts_observed':len(seen),
                    'hflip_frames':sum(bool(r['hflip_count']) for r in frames),
                    'vflip_frames':sum(bool(r['vflip_count']) for r in frames),
                    'min_sprites':min(r['slot_count'] for r in frames),
                    'max_sprites':max(r['slot_count'] for r in frames),
                    'frames':[{k:v for k,v in r.items() if k!='layout'} for r in frames]})
    return {'schema':'forja65.obj-assembly-tracks.v1','grouping':'tile32+palette_bits',
            'samples':len(rows),'families':out,'identity_inferred':False,
            'warnings':['Grouping by tile block and palette is a hypothesis, not Kong identity.',
                        'Different characters may share tile banks or a character may switch banks.',
                        'OAM positions are SCREEN coordinates and may change due to camera.',
                        'Tile layout changes do not prove a unique animation frame: VRAM may update tiles in place.']}

def analyze_file(file,min_members=2):return assemblies(load_rows(file),min_members)

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('obj_slots',type=Path)
    p.add_argument('--out',type=Path);p.add_argument('--min-members',type=int,default=2)
    a=p.parse_args();result=analyze_file(a.obj_slots,a.min_members)
    if a.out:a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(result,indent=2)+'\n')
    print('OBJ_ASSEMBLIES_OK samples=%d families=%d'%(result['samples'],len(result['families'])))
if __name__=='__main__':main()
