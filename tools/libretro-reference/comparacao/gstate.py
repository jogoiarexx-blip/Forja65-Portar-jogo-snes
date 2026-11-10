# compara variaveis de jogo do SMW quadro a quadro (alinhado em vblank) entre F0 e F1
import sys,os
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
from portemu import PortEmu
import lockstep_lib as L
F0,F1=int(sys.argv[1]),int(sys.argv[2])
ev,env=L.read_trace(os.environ['TRACE'])
r=Emu(rom='/home/claude/roms/smw.sfc',core='/home/claude/ref/snes9x_libretro.so')
p=PortEmu(game=os.environ.get('PGAME','/home/claude/ports/smw-l/build-spc/game'),assets='/home/claude/ports/smw-l/assets',extra_env={**env,'FORJA65_POWERON':'snes9x','FORJA65_CONTROL_AT':os.environ.get('CTLAT','vblank')})
f=p.frame(); r.run(f+1,0)
L.advance(r,p,ev,f,F0); f=F0
V={'mode':0x100,'fc':0x13,'fc2':0x14,'xl':0x94,'xh':0x95,'yl':0x96,'yh':0x97,'vx':0x7b,'vy':0x7d,'rng1':0x148d,'rng2':0x148e,'st71':0x71,'lag':0x10,'sub':0x141a}
nd=0
while f<F1:
    a,b=L.dump_both(r,p,'/dev/shm/gs')
    d={k:(a['wram'][v],b['wram'][v]) for k,v in V.items() if a['wram'][v]!=b['wram'][v]}
    if d:
        print(f,d,flush=True); nd+=1
        if nd>25:break
    L.advance(r,p,ev,f,f+1); f+=1
print('fim',f)
