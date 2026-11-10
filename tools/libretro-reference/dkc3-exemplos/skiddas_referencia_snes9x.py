import pickle
from emu import *
import goexplore_macros as GM
e=Emu(); e.loadfile('l4_start.state'); R=[]
def run(n,m):
    for k in range(n): e.run(1,m); R.append((m,e.w16(0x47b),e.w16(0x47f),e.ram(0x5d5,1)[0]))
def mac(a):
    for n,m in GM.M[a]: run(n,m)
def goto(tx):
    for k in range(400):
        x=e.w16(0x47b)
        if abs(x-tx)<=1: return
        run(1,RIGHT if x<tx else LEFT)
for a in pickle.load(open('l4_far.hist','rb')): mac(a)
print('far',e.frame(),e.w16(0x47b),e.w16(0x47f))
b=pickle.load(open('ge_l4b.pkl','rb'))['arch']; k=max(b,key=lambda k:(k[0],-b[k][1]))
for a in b[k][0]: mac(a)
print('far2',e.frame(),e.w16(0x47b),e.w16(0x47f))
run(300,RIGHT|Y); e.save('fin'); R0=list(R); ok=False
for tx in range(9180,9340,10):
    for d in [LEFT,0,RIGHT]:
        e.load('fin'); R[:]=R0; goto(tx); run(2,0); run(18,B|UP|d); run(30,UP); run(450,0)
        if e.ram(0x65d,1)[0]&2: ok=True; print('bandeira em',tx,d); break
    if ok: break
run(400,0)
print('fim',e.frame(),hex(e.ram(0x65d,1)[0]),'vidas',e.ram(0x5d5,1)[0],len(R))
pickle.dump(R,open('ref_l4.pkl','wb')); e.savefile('ref_l4_done.state'); e.shot('/tmp/ref_l4.ppm')
