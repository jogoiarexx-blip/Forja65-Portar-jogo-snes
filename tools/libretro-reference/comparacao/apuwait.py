#!/usr/bin/env python3
"""REV143: sincronizacao CPU/APU medida por lacos de espera nas portas $2140-$2143.
Para cada traco, acha os PCs (na ROM) que leem $2140-$2143 e agrupa as execucoes consecutivas do mesmo PC
em "esperas" (episodios). Compara a sequencia de esperas entre traco do port e da referencia: numero de
leituras por espera e duracao em ciclos mestres. Mede a fidelidade do handshake CPU/SPC700.
uso: apuwait.py rom.sfc port.trace ref.trace [--hirom] [--lines 262]"""
import sys, argparse, statistics
ap=argparse.ArgumentParser(); ap.add_argument('rom'); ap.add_argument('traces',nargs=2); ap.add_argument('--hirom',action='store_true'); ap.add_argument('--lines',type=int,default=262)
a=ap.parse_args(); LINE=1364; FR=a.lines*LINE
rom=open(a.rom,'rb').read()
if len(rom)%1024==512: rom=rom[512:]
def off(pc):
    b,ad=pc>>16,pc&0xFFFF
    if a.hirom: return ((b&0x3F)<<16)|ad
    if ad<0x8000: return None
    return ((b&0x7F)<<15)|(ad&0x7FFF)
READ_ABS={0xAD,0xCD,0x2C,0x4D,0x0D,0x2D,0xAE,0xAC,0xEC,0xCC}; READ_LONG={0xAF,0xCF}
def reads_port(pc):
    o=off(pc)
    if o is None or o+3>len(rom): return False
    op=rom[o]
    if op in READ_ABS: ad=rom[o+1]|rom[o+2]<<8; return 0x2140<=ad<=0x2143
    if op in READ_LONG: ad=rom[o+1]|rom[o+2]<<8; bk=rom[o+3]; return 0x2140<=ad<=0x2143 and (bk&0x40)==0
    return False
def load(p):
    T=[]
    for l in open(p):
        f=l.split()
        if not f or f[0]=='S': continue
        try:
            pc=int(f[0],16)
            if any(x.startswith('V=') for x in f):
                v=int([x for x in f if x.startswith('V=')][0][2:]); h=int([x for x in f if x.startswith('C=')][0][2:])
            else: v=(int(f[2])+1)%a.lines; h=int(f[3])
        except Exception: continue
        T.append((pc,v*LINE+h))
    return T
cache={}
def episodes(T):
    ep=[]; cur=None
    for i,(pc,t) in enumerate(T):
        rp=cache.get(pc)
        if rp is None: rp=cache[pc]=reads_port(pc)
        if not rp: continue
        if cur and cur[0]==pc and i-cur[3]<=8: cur[1]+=1; cur[3]=i; cur[4]=t
        else:
            if cur: ep.append(cur)
            cur=[pc,1,t,i,t]
    if cur: ep.append(cur)
    out=[]
    for pc,n,t0,i,t1 in ep:
        out.append((pc,n,(t1-t0)%FR))
    return out
P=episodes(load(a.traces[0])); R=episodes(load(a.traces[1]))
# alinha por sequencia de PCs (LCS simples guloso)
i=j=0; pairs=[]
while i<len(P) and j<len(R):
    if P[i][0]==R[j][0]: pairs.append((P[i],R[j])); i+=1; j+=1
    else:
        # procura o proximo casamento proximo
        best=None
        for di in range(0,6):
            for dj in range(0,6):
                if i+di<len(P) and j+dj<len(R) and P[i+di][0]==R[j+dj][0]:
                    if best is None or di+dj<best[0]: best=(di+dj,di,dj)
        if not best: i+=1; j+=1; continue
        i+=best[1]; j+=best[2]
dn=[p[1]-r[1] for p,r in pairs]; dt=[p[2]-r[2] for p,r in pairs]
long=[(p,r) for p,r in pairs if r[1]>=3]
print('esperas: port=%d ref=%d pareadas=%d (com >=3 leituras na ref: %d)'%(len(P),len(R),len(pairs),len(long)))
if pairs:
    print('leituras por espera: port-ref media=%+.3f  |media|=%.3f  iguais=%.1f%%'%(statistics.mean(dn),statistics.mean(abs(x) for x in dn),100*sum(1 for x in dn if x==0)/len(dn)))
    print('duracao (ciclos mestres): port-ref media=%+.1f  |media|=%.1f'%(statistics.mean(dt),statistics.mean(abs(x) for x in dt)))
    if long:
        ln=[p[1]-r[1] for p,r in long]; lt=[p[2]-r[2] for p,r in long]
        print('  esperas longas: leituras |media|=%.3f, duracao media=%+.1f |media|=%.1f, soma ref=%d ciclos'%(statistics.mean(abs(x) for x in ln),statistics.mean(lt),statistics.mean(abs(x) for x in lt),sum(r[2] for p,r in long)))
