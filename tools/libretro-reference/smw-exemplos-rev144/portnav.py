"""Forja65 REV137 - Rec: PortEmu (modo de controle) com gravacao de entradas, checkpoint (dump/restore) e
trace com perfil (# FORJA65_ENV). Variaveis: FORJA65_PORT_GAME, FORJA65_PORT_ASSETS, FORJA65_OUT."""
import sys,os,pickle; sys.path.insert(0,'/home/claude/forja/Forja65-v0.4.36.117-REV137-DSP1-VCOUNTER-SMW-SMK/tools/libretro-reference')
from portemu import *
from PIL import Image
GAME=os.environ.get('FORJA65_PORT_GAME','build/game'); ASSETS=os.environ.get('FORJA65_PORT_ASSETS','assets')
OUT=os.environ.get('FORJA65_OUT','.')
class Rec(PortEmu):
    def __init__(s,*a,**k): super().__init__(*a,**k); s.ev=[]; s.slots={}
    def run(s,n,mask=0):
        if n<=0: return
        r=super().run(n,mask); end=int(r.split()[1]); s.ev.append((end-n,mask)); return r
    def save(s,k): s.slots[k]=list(s.ev); return super().save(k)
    def load(s,k): r=super().load(k); s.ev=list(s.slots[k]); return r
    def delete(s,k): s.slots.pop(k,None); return super().delete(k)
    def mode(s): return s.ram(0x100,1)[0]
    def snap(s,name): s.shot(os.path.join(os.path.abspath(OUT),name+'.ppm')); Image.open(os.path.join(os.path.abspath(OUT),name+'.ppm')).save(os.path.join(os.path.abspath(OUT),name+'.png'))
    def until_mode(s,m,maxf=3000,mask=0):
        for i in range(maxf):
            if s.mode()==m: return True
            s.run(1,mask)
        return False
    def dump(s,path): pickle.dump({'ev':list(s.ev),'end':s.frame()},open(path,'wb'))
    def restore(s,path):
        d=pickle.load(open(path,'rb')); f=s.frame(); cur=0
        for fr,m in d['ev']:
            if fr>f: PortEmu.run(s,fr-f,cur); f=fr
            cur=m
        if d['end']>f: PortEmu.run(s,d['end']-f,cur)
        s.ev=list(d['ev']); return s
    def write_trace(s,path,header=()):
        h=s.cart_hash() if hasattr(s,'cart_hash') else None
        out=['# FORJA65_INPUT_TRACE 1','# FORJA65_ENV FORJA65_SPC_PROFILE=reference','# FORJA65_ENV FORJA65_EXECUTION=reference']+['# '+x for x in header]; last=None
        for f,m in sorted(s.ev):
            if m!=last: out.append(f'frame={f} joy1={m:04x} joy2=0000'); last=m
        open(path,'w').write('\n'.join(out)+'\n')
