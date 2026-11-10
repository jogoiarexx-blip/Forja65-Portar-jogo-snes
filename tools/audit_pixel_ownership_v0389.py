#!/usr/bin/env python3
"""Summarize read-only per-pixel compositor provenance from Forja65.

Note: a static PPU snapshot is only representative when pixel RGB from the
snapshot agrees with the recorded framebuffer; raster state can change.
"""
import argparse,csv,json,collections
from pathlib import Path

def analyze(input_path:Path):
    reasons=collections.Counter();slots=collections.defaultdict(lambda:collections.Counter())
    matched=unmatched=math_modified=0;total=0
    with input_path.open(newline='',encoding='utf-8') as f:
        rows=csv.DictReader(f)
        required={'x','y','slot','obj_depth','winner','winner_depth','winner_slot','reason','final_color_changed','snapshot_matches_frame'}
        if not rows.fieldnames or not required.issubset(rows.fieldnames):raise ValueError('pixel ownership CSV schema mismatch')
        for rec in rows:
            total+=1
            reason=rec['reason'];slot=int(rec['slot'])
            if reason not in ('obj_wins','bg_wins','obj_disabled','obj_windowed','backdrop_wins','blank'):
                raise ValueError('unknown reason '+reason)
            reasons[reason]+=1;slots[slot][reason]+=1
            m=int(rec['snapshot_matches_frame']);matched+=m;unmatched+=1-m
            math_modified+=int(rec['final_color_changed'])
    confidence= matched/total if total else 0
    return {'schema':'forja65.pixel-ownership-audit.v1','opaque_obj_pixels':total,
      'snapshot_match_pixels':matched,'snapshot_mismatch_pixels':unmatched,
      'snapshot_match_fraction':round(confidence,4),'reason_counts':dict(sorted(reasons.items())),
      'modified_final_color_pixels':math_modified,
      'slots':{str(k):dict(sorted(v.items())) for k,v in sorted(slots.items())},
      'warning':'Reasons describe captured PPU register state, NOT necessarily rasterized frame. Interpret as frame proof only when snapshot match is high; source game reference is still required.'}

def main():
    a=argparse.ArgumentParser(description=__doc__);a.add_argument('input',type=Path);a.add_argument('--out',type=Path,required=True)
    ns=a.parse_args();obj=analyze(ns.input);ns.out.parent.mkdir(parents=True,exist_ok=True);ns.out.write_text(json.dumps(obj,indent=2)+'\n')
    print('DKC3_PIXEL_PROVENANCE_AUDIT opaque=%d snapshot_match=%.4f '%(obj['opaque_obj_pixels'],obj['snapshot_match_fraction']))
if __name__=='__main__':main()
