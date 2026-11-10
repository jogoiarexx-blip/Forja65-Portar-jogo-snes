import sys
sys.path.insert(0,'/home/claude/refemu')
from recport import *
def steer(e,tx,ty,maxf=300,tol=3):
    for k in range(maxf//4):
        x,y=e.w16(0x47b),e.w16(0x47f); m=0
        if x<tx-tol: m|=RIGHT
        elif x>tx+tol: m|=LEFT
        if y<ty-tol: m|=DOWN
        elif y>ty+tol: m|=UP
        if not m: return
        e.run(4,m)
e=resume('/home/claude/refemu/port_after_cave.ckpt')
print('passaros(0x5cd)',e.ram(0x5cd,1)[0],'vidas',e.ram(0x5d5,1)[0],e.frame(),flush=True)
e.run(20,DOWN); e.run(60,0)
for tx,ty in [(615,640),(605,660),(605,700),(620,730),(630,737)]: steer(e,tx,ty,maxf=400)
for n,m in [(40,RIGHT),(40,0),(40,RIGHT),(40,0),(40,RIGHT),(40,0)]: e.run(n,m)
steer(e,626,737,maxf=200,tol=1)
for n,m in [(30,RIGHT),(30,RIGHT),(60,0),(10,B),(150,0)]: e.run(n,m)
for n,m in [(10,B),(120,0),(60,0),(30,RIGHT),(60,0)]: e.run(n,m)
print('no Doorstop Dash',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
e.shot('/tmp/p_dd_map.ppm')
e.run(10,B); e.run(300,0)
print('l2 inicio',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
e.shot('/tmp/p_l2s.ppm')
checkpoint(e,'/home/claude/refemu/port_l2_start.ckpt')
