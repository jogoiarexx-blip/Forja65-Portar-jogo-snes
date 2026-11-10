"""Emu que grava todas as entradas (quadro, mascara) para gerar um FORJA65_INPUT_TRACE."""
from emu import *
class RecEmu(Emu):
    def __init__(s,*a,**k):
        super().__init__(*a,**k); s.events=[]; s.fr=0
    def run(s,n,mask=0):
        if n<=0: return
        s.events.append((s.fr,mask)); s.fr+=n; return super().run(n,mask)
    def trace(s,path,until):
        ev=[]
        for l in open(path):
            if l.startswith('frame='):
                f=int(l.split()[0][6:]); j=int(l.split('joy1=')[1].split()[0],16); ev.append((f,j))
        cur=0
        for f,j in ev:
            if f>=until: break
            if f>s.fr: super().run(f-s.fr,cur); s.events.append((s.fr,cur)); s.fr=f
            cur=j
        if until>s.fr: s.events.append((s.fr,cur)); super().run(until-s.fr,cur); s.fr=until
    def goto(s,tx,xa=0x47b,tol=1,maxf=200):
        for k in range(maxf):
            x=s.w16(xa)
            if abs(x-tx)<=tol: break
            s.run(1,RIGHT if x<tx else LEFT)
    def replay_log(s,path,until=None):
        for l in open(path):
            n,m=l.split(); n=int(n); m=int(m,16)
            if until and until(): return
            s.run(n,m)
    def write_trace(s,path,header):
        out=['# FORJA65_INPUT_TRACE 1 rom=3a574807afbad761']+['# '+h for h in header]; last=None
        for f,m in s.events:
            if m!=last: out.append(f'frame={f} joy1={m:04x} joy2=0000'); last=m
        open(path,'w').write('\n'.join(out)+'\n')
