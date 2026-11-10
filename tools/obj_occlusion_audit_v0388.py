#!/usr/bin/env python3
"""Read-only NSPR vs frame-P6 capture comparison; optionally writes OBJ foreground diagnostic.

Pixels that differ are NOT necessarily occluded: blending, windows, brightness
and color math can also change their final RGB values.
"""
from __future__ import annotations
import argparse,json
from pathlib import Path
from nspr_to_png_v0388 import read_nspr,write_rgba_png

def load_ppm(path):
    data=Path(path).read_bytes();head,sep,rest=data.partition(b'\n255\n')
    if not sep:raise ValueError('expected binary P6 PPM (255)')
    parts=head.split()
    if len(parts)!=3 or parts[0]!=b'P6':raise ValueError('expected P6 PPM')
    w,h=map(int,parts[1:]);
    if w<1 or h<1 or w>1024 or h>1024 or len(rest)!=w*h*3:raise ValueError('invalid PPM data size')
    return w,h,rest

def compare(preview,nspr,overlay=None,tolerance=1):
    w,h,rgb=load_ppm(preview);sw,sh,rgba,_=read_nspr(nspr)
    if (w,h)!=(sw,sh):raise ValueError('scene dimensions differ')
    visible=close=changed=0;xs=[];ys=[];highlight=bytearray(w*h*4)
    for i in range(w*h):
        a=rgba[4*i+3];col=rgba[4*i:4*i+3];base=rgb[3*i:3*i+3]
        if a:
            xs.append(i%w);ys.append(i//w)
            d=max(abs(col[c]-base[c]) for c in range(3))
            visible+=d==0;close+=0<d<=tolerance;changed+=d>tolerance
            # diagnostic overlay, NOT a proposed change to the game renderer
            highlight[4*i:4*i+4]=bytes((col[0],col[1],col[2],255))
        else:
            highlight[4*i:4*i+4]=bytes((base[0]//2,base[1]//2,base[2]//2,255))
    if overlay:write_rgba_png(overlay,w,h,highlight)
    return {'schema':'forja65.obj-final-comparison.v1','width':w,'height':h,
            'opaque_obj_pixels':len(xs),'rgb_exact_match':visible,
            'rgb_near_match':close,'rgb_changed':changed,'rgb_tolerance_per_channel':tolerance,
            'obj_bounds':[min(xs),min(ys),max(xs),max(ys)] if xs else None,
            'occlusion_proven':False,'warning':'Changed RGB may be foreground, windows, color math, or brightness. Requires BG-priority reference to prove occlusion.'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('preview',type=Path)
    p.add_argument('nspr',type=Path);p.add_argument('--overlay',type=Path)
    p.add_argument('--out',required=True,type=Path);a=p.parse_args()
    result=compare(a.preview,a.nspr,a.overlay)
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(result,indent=2)+'\n')
    print('OBJ_COMPOSE_AUDIT_OK opaque=%d near=%d changed=%d occlusion_proven=NO'%(
      result['opaque_obj_pixels'],result['rgb_exact_match']+result['rgb_near_match'],result['rgb_changed']))
if __name__=='__main__':main()
