import sys,os
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
from portemu import PortEmu
import lockstep_lib as L
F0,F1=int(sys.argv[1]),int(sys.argv[2]); A=[int(x,16) for x in sys.argv[3].split(',')]
ev,env=L.read_trace(os.environ['TRACE'])
r=Emu(rom='/home/claude/roms/smw.sfc',core='/home/claude/ref/snes9x_libretro.so')
p=PortEmu(game=os.environ.get('PGAME','/home/claude/ports/smw-l/build-spc/game'),assets='/home/claude/ports/smw-l/assets',extra_env={**env,'FORJA65_POWERON':'snes9x','FORJA65_CONTROL_AT':'vblank'})
f=p.frame(); r.run(f+1,0); L.advance(r,p,ev,f,F0); f=F0
while f<F1:
    a=[int(r.cmd(f'ram {x:x} 1'),16) for x in A]; b=[int(p.cmd(f'ram {x:x} 1'),16) for x in A]
    print(f,'joy',hex(L.mask_at(ev,f)),'ref',' '.join(f'{v:02x}' for v in a),'port',' '.join(f'{v:02x}' for v in b),'*' if a!=b else '',flush=True)
    L.advance(r,p,ev,f,f+1); f+=1
