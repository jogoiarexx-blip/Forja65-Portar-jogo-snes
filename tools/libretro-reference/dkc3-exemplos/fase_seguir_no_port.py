import sys,pickle
sys.path.insert(0,'/home/claude/refemu')
from recport import *
from follow import follow
# uso: port_level.py inicio.ckpt ref.pkl flag_addr saida.ckpt
R=pickle.load(open(sys.argv[2],'rb')); flag=int(sys.argv[3],16)
e=resume(sys.argv[1]); print('inicio',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
follow(e,R,K=8,D=3,log=lambda s:print(s,flush=True))
print('fim',e.frame(),e.w16(0x47b),e.w16(0x47f),'flag',hex(e.ram(flag,1)[0]),'vidas',e.ram(0x5d5,1)[0],flush=True)
checkpoint(e,sys.argv[4]); e.shot('/tmp/'+sys.argv[4].split('/')[-1]+'.ppm')
