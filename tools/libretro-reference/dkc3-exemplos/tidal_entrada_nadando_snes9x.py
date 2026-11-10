import pickle,sys
from mapnav import *
e=Emu(); e.loadfile('/home/claude/refemu/l2_done.state')
R=[]
def run(n,m):
    for k in range(n): e.run(1,m); R.append(m)
run(60,0); run(20,DOWN); run(200,0); run(20,UP); run(200,0)
for k in range(300):
    x,y=mpos(e); m=0
    if e.ram(0x5e7,1)[0]==4: break
    if x<70: m|=RIGHT
    elif x>74: m|=LEFT
    if y>60: m|=UP
    run(4,m or UP)
run(60,0); print('no',e.ram(0x5e7,1)[0],mpos(e))
run(10,B); run(300,0)
print('fase 3',e.frame(),e.w16(0x47b),e.w16(0x47f))
e.savefile('/home/claude/refemu/l3_start.state'); pickle.dump(R,open('l3entry_masks.pkl','wb'))
e.shot('/tmp/l3s.ppm')
