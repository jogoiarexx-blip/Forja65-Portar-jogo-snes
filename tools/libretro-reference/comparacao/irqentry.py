#!/usr/bin/env python3
"""REV143: custo de entrada de NMI/IRQ medido no traco (port x Snes9x).
entrada = (T(primeira instrucao do handler) - T(instrucao interrompida)) - custo tipico da instrucao interrompida.
uso: irqentry.py traco [traco...] --handlers 80xx,80yy   (PCs de inicio dos handlers, hex)"""
import sys, collections, argparse
ap=argparse.ArgumentParser(); ap.add_argument('traces',nargs='+'); ap.add_argument('--handlers',required=True); ap.add_argument('--lines',type=int,default=262)
a=ap.parse_args(); H={int(x,16) for x in a.handlers.split(',')}; LINE=1364; FR=a.lines*LINE
def load(p):
    out=[]
    for l in open(p):
        f=l.split()
        if not f or f[0]=='S': continue
        try:
            if any(x.startswith('V=') for x in f):
                pc=int(f[0],16); v=int([x for x in f if x.startswith('V=')][0][2:]); h=int([x for x in f if x.startswith('C=')][0][2:])
            else: pc=int(f[0],16); v=(int(f[2])+1)%a.lines; h=int(f[3])
        except Exception: continue
        out.append((pc,v*LINE+h))
    return out
REFRESH_H=538
for p in a.traces:
    T=load(p); cost=collections.defaultdict(collections.Counter)
    def d(i):
        x=(T[i+1][1]-T[i][1])%FR
        return x
    for i in range(len(T)-1):
        if T[i+1][0] not in H: cost[T[i][0]][d(i)]+=1
    typ={pc:c.most_common(1)[0][0] for pc,c in cost.items()}
    res=collections.Counter()
    for i in range(len(T)-1):
        if T[i+1][0] in H and T[i][0] not in H and T[i][0] in typ:
            e=d(i)-typ[T[i][0]]
            if e>=REFRESH_H//10 and e<400: res[(T[i+1][0],e)]+=1
    print(p)
    for (h,e),c in sorted(res.items()): print('  handler %06X entrada=%d ciclos mestres  (%d vezes)'%(h,e,c))
