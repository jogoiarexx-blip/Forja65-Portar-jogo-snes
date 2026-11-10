import sys,pickle
sys.path.insert(0,'/home/claude/refemu')
from recport import *
from follow import follow
R=pickle.load(open('/home/claude/refemu/ref_l2.pkl','rb'))
e=resume('/home/claude/refemu/port_l2_start.ckpt')
print('inicio',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
p=follow(e,R,K=8,D=3,log=lambda s:print(s,flush=True))
e.run(300,0)
print('fim',e.frame(),e.w16(0x47b),e.w16(0x47f),'vidas',e.ram(0x5d5,1)[0],flush=True)
e.shot('/tmp/port_l2_end.ppm')
checkpoint(e,'/home/claude/refemu/port_l2_done.ckpt')
