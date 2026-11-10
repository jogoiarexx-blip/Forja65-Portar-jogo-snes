import pickle
from emu import *
import goexplore_macros as GM
e=Emu(); e.loadfile('l5_start.state'); R=[]
def run(n,m):
    for k in range(n): e.run(1,m); R.append((m,e.w16(0x47b),e.w16(0x47f),e.ram(0x5d5,1)[0]))
def mac(a):
    for n,m in GM.M[a]: run(n,m)
def goto(tx):
    for k in range(400):
        x=e.w16(0x47b)
        if abs(x-tx)<=1: return
        run(1,RIGHT if x<tx else LEFT)
mac('gr90'); mac('wr'); run(2,SEL); run(60,0)
for a in ['jul','dn','w','jul']: mac(a)
run(300,0)
for n,m in [(4,A),(30,0),(6,Y|UP|LEFT),(30,UP|LEFT)]: run(n,m)
run(140,0); print('warp',e.w16(0x47b),e.w16(0x47f))
e.save('fin'); R0=list(R); ok=False
for tx in range(2600,2800,10):
    for d in [LEFT,0,RIGHT]:
        e.load('fin'); R[:]=R0; goto(tx); run(2,0); run(18,B|UP|d); run(30,UP); run(450,0)
        if e.ram(0x65c,1)[0]&2: ok=True; print('bandeira em',tx,d); break
    if ok: break
run(400,0)
print('fim',e.frame(),hex(e.ram(0x65c,1)[0]),'vidas',e.ram(0x5d5,1)[0],len(R))
pickle.dump(R,open('ref_l5.pkl','wb')); e.savefile('ref_l5_done.state')
