import pickle
from bslots import *
e=Emu(); e.loadfile('ref_l6_arena.state'); R=[]
def run(n,m):
    for k in range(n): e.run(1,m); R.append((m,e.w16(0x47b),e.w16(0x47f),e.ram(0x5d5,1)[0]))
def kn():
    for k,t,x,y in slots(e):
        if t=='27d2' and y<760: return (x,y)
B0=e.w16(0x966); L0=e.ram(0x5d5,1)[0]; nslot=0
def snap():
    global nslot; nslot+=1; s='q%d'%nslot; e.save(s); return (s,len(R))
def back(sv): e.load(sv[0]); del R[sv[1]:]
for hit in range(12):
    if e.ram(0x64f,1)[0]&2 or e.w16(0x966)>=960: break
    bx=e.w16(0x966); done=False
    for tries in range(40):
        # A) pular nos barris ate sair um Knik-Knak
        for k in range(30):
            if kn(): break
            run(16,B); run(16,0)
        if not kn(): continue
        base=snap()
        for steer,wait in [(16,24),(12,20),(16,20),(20,24),(12,28),(8,24),(24,28)]:
            for dist in [240,220,260,200,280,180,300,160,140,320]:
                back(base)
                run(16,0); run(steer,LEFT); run(wait,0); run(6,Y)
                for k in range(80):
                    if e.w16(0x966)-e.w16(0x47b)<=dist: break
                    run(2,Y|RIGHT)
                run(8,Y|B|RIGHT); run(6,RIGHT)
                ok=False
                for k in range(80):
                    run(4,0)
                    if e.w16(0x966)>bx+40 or e.w16(0x966)>=960 or e.ram(0x64f,1)[0]&2: ok=True; break
                if ok and e.ram(0x5d5,1)[0]>=L0: done=True; break
            if done: break
        if done: break
        back(base); run(40,0)
    print('acerto',hit,'belcha',bx,'->',e.w16(0x966),'quadro',e.frame(),'flag',hex(e.ram(0x64f,1)[0]),flush=True)
    if not done: print('sem acerto'); break
# pega a moeda de bonus deixada pelo Belcha (fim da fase) e espera o mapa
for tx in range(0,1):
    for k in range(300):
        if e.w16(0x47b)>=880: break
        run(1,RIGHT)
run(20,RIGHT|B); run(30,RIGHT); run(60,0)
for k in range(200):
    if e.ram(0x64f,1)[0]&2: break
    run(4,0)
run(700,0)
print('fim',e.frame(),'flag',hex(e.ram(0x64f,1)[0]),'vidas',e.ram(0x5d5,1)[0],len(R))
pickle.dump(R,open('ref_belcha.pkl','wb')); e.savefile('belcha_done.state'); e.shot('/tmp/belcha_done.ppm')
