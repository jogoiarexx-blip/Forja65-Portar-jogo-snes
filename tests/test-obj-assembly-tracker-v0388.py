#!/usr/bin/env python3
import sys,tempfile,csv
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'tools'))
from obj_assembly_tracker_v0388 import analyze_file,load_rows
fields='frame slot x y width height tile attributes visible_pixels min_x min_y max_x max_y'.split()
with tempfile.TemporaryDirectory() as td:
 p=Path(td)/'slots.csv'
 def put(data):
  with p.open('w',newline='') as f:
   w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows([dict(zip(fields,rec)) for rec in data])
 put([[10,0,12,100,16,16,384,37,5,12,100,27,115],
      [10,1,28,100,16,16,386,37,7,28,100,43,115],
      [12,0,17,100,16,16,384,101,5,17,100,32,115],
      [12,1,33,100,16,16,386,101,7,33,100,48,115],
      [12,2,130,10,8,8,288,33,4,130,10,137,17]])
 r=analyze_file(p)
 assert len(r['families'])==1,r
 fam=r['families'][0]
 assert fam['center_displacement_pixels']==[5,0],fam
 assert fam['hflip_frames']==1 and fam['relative_layouts_observed']==2,fam
 assert r['identity_inferred'] is False
 with p.open('a') as f:f.write('12,0,17,100,16,16,384,101,5,17,100,32,115\n')
 try:load_rows(p);raise AssertionError('duplicate accepted')
 except ValueError:pass
print('PASS obj assembly tracked translation/flip, excludes singletons, rejects duplicates')
