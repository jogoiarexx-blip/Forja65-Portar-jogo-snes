import pickle,sys
sys.path.insert(0,'/home/claude/refemu')
from emu import *
import goexplore_macros as GM
e=Emu(); e.loadfile('/home/claude/refemu/l2_start.state')
R=[]
def run(n,m):
    for k in range(n):
        e.run(1,m); R.append((m,e.w16(0x47b),e.w16(0x47f),e.ram(0x5d5,1)[0]))
def mac(a):
    for n,m in GM.M[a]: run(n,m)
def goto(tx):
    for k in range(300):
        x=e.w16(0x47b)
        if abs(x-tx)<=1: return
        run(1,RIGHT if x<tx else LEFT)
a=pickle.load(open('ge_l2c.pkl','rb'))['arch']
for m in a[(20,51,1)][0]: mac(m)
run(70,0); goto(978); run(4,0)
run(60,B|UP); run(30,0); run(4,B)
D2={'r':[(8,RIGHT|Y)],'j':[(8,RIGHT|Y|B)],'jj':[(16,RIGHT|Y|B)],'w':[(8,RIGHT)]}
for k in ['jj', 'jj', 'jj', 'jj', 'w', 'r', 'jj', 'jj', 'jj', 'jj', 'jj', 'jj', 'jj', 'jj', 'jj']:
    for n,m in D2[k]: run(n,m)
print('apos porta 2',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
h=pickle.load(open('ge_l2f.pkl','rb'))['done'][0]
for m in h[:33]: mac(m)
run(400,0)
print('fim',e.frame(),e.w16(0x47b),e.w16(0x47f),e.ram(0x4e1,1)[0],e.ram(0x6d8,1)[0],e.w16(0x1488),'vidas',e.ram(0x5d5,1)[0])
e.shot('/tmp/l2ref_end.ppm')
pickle.dump(R,open('ref_l2.pkl','wb')); print(len(R))
