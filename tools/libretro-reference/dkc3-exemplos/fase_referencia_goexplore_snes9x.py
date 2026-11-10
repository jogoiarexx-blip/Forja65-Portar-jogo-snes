import pickle,sys
from emu import *
import goexplore_macros as GM
start,pkl,flag,out=sys.argv[1],sys.argv[2],int(sys.argv[3],16),sys.argv[4]
e=Emu(); e.loadfile(start); R=[]
def run(n,m):
    for k in range(n): e.run(1,m); R.append((m,e.w16(0x47b),e.w16(0x47f),e.ram(0x5d5,1)[0]))
h=pickle.load(open(pkl,'rb'))['done'][0]
L0=e.ram(0x5d5,1)[0]
for a in h:
    for n,m in GM.M[a]: run(n,m)
    if e.ram(flag,1)[0]&2: break
run(400,0)
print('fim',e.frame(),'flag',hex(e.ram(flag,1)[0]),'vidas',L0,'->',e.ram(0x5d5,1)[0],'mapa',e.w16(0x8f8),e.w16(0x8fc),'no',e.ram(0x5e7,1)[0],len(R))
pickle.dump(R,open(out+'.pkl','wb')); e.savefile(out+'_done.state'); e.shot('/tmp/'+out+'.ppm')
