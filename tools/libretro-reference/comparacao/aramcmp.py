# compara RAM do SPC (port x Snes9x) a cada STEP frames ate achar divergencia
import sys,os
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
from portemu import PortEmu
import lockstep_lib as L
F0,F1,STEP=int(sys.argv[1]),int(sys.argv[2]),int(sys.argv[3])
ev,env=L.read_trace(os.environ.get('TRACE'))
r=Emu(rom='/home/claude/roms/smw.sfc',core='/home/claude/ref/snes9x_libretro.so')
p=PortEmu(game=os.environ.get('PGAME','/home/claude/ports/smw-l/build-spc/game'),assets='/home/claude/ports/smw-l/assets',extra_env={**env,'FORJA65_POWERON':'snes9x','FORJA65_CONTROL_AT':'vblank','FORJA65_SHORTLINE':os.environ.get('SL','')})
f=p.frame(); r.run(f+1,0)
def get():
    r.cmd('aram /dev/shm/ar.bin'); p.cmd('aram /dev/shm/ap.bin')
    return open('/dev/shm/ar.bin','rb').read(),open('/dev/shm/ap.bin','rb').read()
cur=f
for F in range(max(F0,f),F1,STEP):
    L.advance(r,p,ev,cur,F); cur=F
    a,b=get()
    # ignora pilha, echo e portas de E/S; considera so a pagina zero/um do driver (variaveis)
    d=[i for i in range(0x0000,0x0100) if a[i]!=b[i] and not (0xF0<=i<=0xFF)]
    d2=[i for i in range(0x0100,0x0500) if a[i]!=b[i] and not (0x01A0<=i<=0x01FF)]
    print(F,'dp',len(d),[hex(i) for i in d[:12]],'p1-4',len(d2),'regs ref',a[65536:].hex(),'port',b[65536:].hex(),flush=True)
