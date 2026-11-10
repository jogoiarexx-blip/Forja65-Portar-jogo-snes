#!/usr/bin/env python3
import sys,struct,tempfile,zlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'tools'))
from nspr_to_png_v0388 import convert,read_nspr
with tempfile.TemporaryDirectory() as td:
 src=Path(td)/'obj.nspr';out=Path(td)/'obj.png'
 src.write_bytes(b'NSPR'+struct.pack('<6H',1,0,2,1,0,0)+struct.pack('<I',2)+struct.pack('<II',0x00000000,0xFFFF8034))
 info=convert(src,out)
 assert info['opaque_pixels']==1 and info['width']==2
 data=out.read_bytes();assert data.startswith(b'\x89PNG\r\n\x1a\n')
 n=struct.unpack_from('>I',data,33)[0];assert data[37:41]==b'IDAT'
 row=zlib.decompress(data[41:41+n]);assert row==b'\x00\x00\x00\x00\x00\xff\x80\x34\xff',row
 try:read_nspr(src.with_suffix('.png'));raise AssertionError('non-nspr accepted')
 except ValueError:pass
print('PASS NSPR->PNG transparency, RGB, dimensions and malformed input')
