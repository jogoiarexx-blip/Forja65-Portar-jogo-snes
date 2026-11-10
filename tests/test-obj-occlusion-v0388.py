#!/usr/bin/env python3
import sys,struct,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'tools'))
from obj_occlusion_audit_v0388 import compare
with tempfile.TemporaryDirectory() as td:
 pp=Path(td)/'image.ppm';ob=Path(td)/'obj.nspr';png=Path(td)/'vis.png'
 pp.write_bytes(b'P6\n2 1\n255\n'+bytes([255,0,0,0,0,255]))
 ob.write_bytes(b'NSPR'+struct.pack('<6H',1,0,2,1,0,0)+struct.pack('<I',2)+struct.pack('<II',0xffff0000,0xff00ff00))
 r=compare(pp,ob,png)
 assert r['rgb_exact_match']==1 and r['rgb_changed']==1 and not r['occlusion_proven']
 assert png.read_bytes().startswith(b'\x89PNG')
 try:compare(pp,pp);raise AssertionError('accepted wrong format')
 except ValueError:pass
print('PASS OBJ versus composited preview and debug overlay, no false occlusion claim')
