#!/usr/bin/env python3
"""Convert a Forja65 NSPR-v1 isolated OBJ capture into an RGBA PNG.

Preserves transparent pixels and original CGRAM colors. Standard library only.
"""
from __future__ import annotations
import argparse,struct,zlib
from pathlib import Path

def read_nspr(source):
    data=Path(source).read_bytes()
    if len(data)<20 or data[:4]!=b'NSPR':raise ValueError('not NSPR')
    version,flags,width,height,reserved1,reserved2=struct.unpack_from('<6H',data,4)
    count=struct.unpack_from('<I',data,16)[0]
    if (version!=1 or flags!=0 or reserved1!=0 or reserved2!=0 or
        width<1 or height<1 or width>1024 or height>1024 or count!=width*height or
        len(data)!=20+4*count):raise ValueError('invalid NSPR-v1 dimensions/payload')
    rgba=bytearray(4*count)
    opaque=0
    for i in range(count):
        v=struct.unpack_from('<I',data,20+i*4)[0]
        rgba[4*i:4*i+4]=bytes(((v>>16)&255,(v>>8)&255,v&255,(v>>24)&255))
        opaque+=bool(v>>24)
    return width,height,bytes(rgba),opaque

def chunk(tag,payload):return struct.pack('>I',len(payload))+tag+payload+struct.pack('>I',zlib.crc32(tag+payload)&0xffffffff)

def write_rgba_png(dst,width,height,rgba):
    if len(rgba)!=width*height*4:raise ValueError('invalid RGBA size')
    raw=b''.join(b'\x00'+rgba[y*width*4:(y+1)*width*4] for y in range(height))
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
    Path(dst).parent.mkdir(parents=True,exist_ok=True)
    Path(dst).write_bytes(png)
    return len(png)

def convert(src,dst):
    width,height,rgba,opaque=read_nspr(src)
    size=write_rgba_png(dst,width,height,rgba)
    return {'width':width,'height':height,'opaque_pixels':opaque,'bytes':size}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('nspr',type=Path);p.add_argument('--out',required=True,type=Path)
    a=p.parse_args();info=convert(a.nspr,a.out)
    print('NSPR_PNG_OK size=%dx%d opaque=%d bytes=%d'% (info['width'],info['height'],info['opaque_pixels'],info['bytes']))
if __name__=='__main__':main()
