import pickle
from emu import *
e=Emu(); e.loadfile('l6_start.state'); R=[]
def run(n,m):
    for k in range(n): e.run(1,m); R.append((m,e.w16(0x47b),e.w16(0x47f),e.ram(0x5d5,1)[0]))
def goto(tx):
    for k in range(400):
        x=e.w16(0x47b)
        if abs(x-tx)<=1: return
        run(1,RIGHT if x<tx else LEFT)
run(40,0); goto(430); run(30,0); run(20,B); run(400,0)
print('arena',e.frame(),e.w16(0x47b),e.w16(0x47f),'belcha',e.w16(0x966),len(R))
pickle.dump(R,open('ref_l6.pkl','wb')); e.savefile('ref_l6_arena.state')
