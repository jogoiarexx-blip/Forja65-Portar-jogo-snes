import sys,pickle
sys.path.insert(0,'/home/claude/refemu')
from recport import *
from PIL import Image
import numpy as np
def steer(e,tx,ty,maxf=300,tol=3):
    for k in range(maxf//4):
        x,y=e.w16(0x47b),e.w16(0x47f); m=0
        if x<tx-tol: m|=RIGHT
        elif x>tx+tol: m|=LEFT
        if y<ty-tol: m|=DOWN
        elif y>ty+tol: m|=UP
        if not m: return
        e.run(4,m)
def bright(e):
    e.shot('/tmp/pc.ppm'); return np.asarray(Image.open('/tmp/pc.ppm').convert('L')).mean()
e=resume('/home/claude/refemu/port_l1_100.ckpt')
print('mapa',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
for n,m in [(60,0),(30,LEFT),(60,0),(30,DOWN),(60,0),(30,0)]: e.run(n,m)
print('mundo',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
for n,m in [(30,LEFT),(30,LEFT),(30,LEFT),(60,0),(20,B),(60,0),(40,UP),(40,UP),(40,LEFT)]: e.run(n,m)
print('barco',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
for tx,ty in [(605,650),(615,640),(625,632),(635,625),(640,618)]: steer(e,tx,ty)
e.run(40,UP); e.run(30,0)
print('praia',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
e.run(6,B); e.run(120,0); e.run(6,B); e.run(120,0)
print('caverna?',e.frame(),round(bright(e),1),flush=True)
checkpoint(e,'/home/claude/refemu/port_cave_in.ckpt')
# memoria de cristais: tenta botoes com esperas crescentes
plan=[]
e.save('cur')
for step in range(40):
    done=False
    for delay in range(0,900,15):
        ok=[]
        for name,b in [('A',A),('B',B),('X',X),('Y',Y)]:
            e.load('cur')
            if delay: e.run(delay,0)
            e.run(4,b); e.save('t_'+name)
            vals=[]
            for k in range(5): e.run(24,0); vals.append(bright(e))
            if min(vals)>20: ok.append(name)
        if len(ok)==1:
            e.load('t_'+ok[0]); e.save('cur'); plan.append((delay,ok[0])); print('nota',step,'espera',delay,ok[0],flush=True); done=True; break
        if len(ok)==0: break
    if not done: break
e.load('cur')
print('sequencia',plan,flush=True)
e.run(800,0)
print('apos caverna',e.frame(),e.w16(0x47b),e.w16(0x47f),round(bright(e),1),flush=True)
checkpoint(e,'/home/claude/refemu/port_after_cave.ckpt')
e.shot('/tmp/port_after_cave.ppm')
