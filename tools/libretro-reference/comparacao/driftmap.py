#!/usr/bin/env python3
"""REV143: mapa de deriva absoluta port x referencia (bsnes/Snes9x), instrucao a instrucao.
Mostra cada ponto em que a diferenca de tempo (port - ref, ciclos mestres desde o power-on) muda.
uso: driftmap.py port.trace ref.trace rom.sfc [--n 2500000] [--show 80] [--ignore-refresh]"""
import argparse
ap=argparse.ArgumentParser();ap.add_argument('port');ap.add_argument('ref');ap.add_argument('rom');ap.add_argument('--n',type=int,default=2500000);ap.add_argument('--show',type=int,default=80);ap.add_argument('--ignore-refresh',action='store_true');ap.add_argument('--lines',type=int,default=262)
a=ap.parse_args();LINE=1364;L=a.lines;FR=L*LINE;rom=open(a.rom,'rb').read()
def load(p,port):
    T=[];base=0;prev=None
    for l in open(p):
        f=l.split()
        if not f or f[0]=='S' or (port and len(f)<4) or (not port and len(f)<10):continue
        try:
            if port: t=((int(f[2])+1)%L)*LINE+int(f[3])
            else: t=int([x for x in f if x.startswith('V=')][0][2:])*LINE+int([x for x in f if x.startswith('C=')][0][2:])
        except Exception: continue
        if prev is not None and t+base<prev-FR//2: base+=FR
        prev=t+base;T.append((int(f[0],16),t+base))
        if len(T)>=a.n:break
    return T
P=load(a.port,True);R=load(a.ref,False)
def op(pc):
    o=(pc&0x7FFF) if (pc&0xFFFF)>=0x8000 and ((pc>>16)&0x7F)<0x7E else None
    return rom[o:o+4].hex() if o is not None and o+4<=len(rom) else 'ram'
i=j=0;last=None;ev=[]
while i<len(P) and j<len(R):
    if P[i][0]==R[j][0]:
        d=P[i][1]-R[j][1]
        if a.ignore_refresh and last is not None and abs(d-last)==40: pass
        elif d!=last: ev.append((i,j,P[i][0],d,op(P[i-1][0]) if i else '')); last=d
        i+=1;j+=1;continue
    ok=False
    for k in range(1,4000):
        if i+k<len(P) and [x[0] for x in P[i+k:i+k+8]]==[x[0] for x in R[j:j+8]]: i+=k;ok=True;break
        if j+k<len(R) and [x[0] for x in R[j+k:j+k+8]]==[x[0] for x in P[i:i+8]]: j+=k;ok=True;break
    if not ok: print('alinhamento perdido em port %d ref %d'%(i,j));break
print('pontos de mudanca: %d (port idx final %d, ref idx final %d)'%(len(ev),i,j))
for e in ev[:a.show]: print('port#%d ref#%d pc=%06X deriva=%+d  (instr anterior %s)'%e)
