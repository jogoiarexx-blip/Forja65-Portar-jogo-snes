import sys,os
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
import lockstep_lib as L
core,F0,F1=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
ev,env=L.read_trace(os.environ['TRACE'])
r=Emu(rom='/home/claude/roms/smw.sfc',core=core)
class D:
    def run(s,n,m):pass
# port frame f (vblank mode) <-> ref pre-run f+1 (same as stage3)
r.run(1,0); f=0
L.advance(r,D(),ev,f,F0); f=F0; last=None
while f<F1:
    m=r.ram(0x100,1)[0]
    if m!=last: print(f,hex(m),flush=True); last=m
    L.advance(r,D(),ev,f,f+1); f+=1
