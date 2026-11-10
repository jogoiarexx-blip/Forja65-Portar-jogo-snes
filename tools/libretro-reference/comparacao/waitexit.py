#!/usr/bin/env python3
"""REV143: tempo absoluto (ciclos mestres desde o power-on) de saida de cada laco de espera de porta APU.
port: t = ((linha_do_port+1) mod linhas)*1364 + H, isto e V*1364+H (somando quadros); ref (bsnes/Snes9x): t = V*1364 + H (somando quadros).
uso: waitexit.py rom.sfc traco [--port] [--n 200]"""
import sys,argparse
ap=argparse.ArgumentParser();ap.add_argument('rom');ap.add_argument('trace');ap.add_argument('--port',action='store_true');ap.add_argument('--n',type=int,default=200);ap.add_argument('--lines',type=int,default=262)
a=ap.parse_args();rom=open(a.rom,'rb').read();LINE=1364;FR=a.lines*LINE
def portread(pc):
    o=(pc&0x7FFF) if (pc&0xFFFF)>=0x8000 else None
    if o is None:return False
    op=rom[o]
    return op in (0xAD,0xCD,0x2C) and rom[o+2]==0x21 and 0x40<=rom[o+1]<=0x43
T=[];prev=None;base=0
for l in open(a.trace):
    f=l.split()
    if not f or f[0]=='S' or (a.port and len(f)<4) or (not a.port and len(f)<10):continue
    pc=int(f[0],16)
    if a.port: t=((int(f[2])+1)%a.lines)*LINE+int(f[3])
    else: t=int([x for x in f if x.startswith('V=')][0][2:])*LINE+int([x for x in f if x.startswith('C=')][0][2:])
    if prev is not None and t+base<prev-FR//2: base+=FR
    prev=t+base;T.append((pc,t+base))
    if len(T)>2000000:break
ex=[];cur=None
for i,(pc,t) in enumerate(T):
    if not portread(pc):continue
    if cur and cur[0]==pc and i-cur[2]<=8: cur[1]=t;cur[2]=i;cur[3]+=1;continue
    if cur and cur[3]>=2: ex.append(cur[1])
    cur=[pc,t,i,1]
    if len(ex)>=a.n:break
print(' '.join(map(str,ex)))
