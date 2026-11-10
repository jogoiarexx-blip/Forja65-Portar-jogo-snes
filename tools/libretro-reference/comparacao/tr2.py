import sys,os
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
from portemu import PortEmu
import lockstep_lib as L
F0,N=int(sys.argv[1]),int(sys.argv[2])
ev,env=L.read_trace(os.environ.get('TRACE','/home/claude/work/smw_yi1.trace'))
r=Emu(rom='/home/claude/roms/smw.sfc',core='/home/claude/ref/snes9x_libretro.so')
p=PortEmu(game='/home/claude/ports/smw-l/build/game',assets='/home/claude/ports/smw-l/assets',extra_env={**env,'FORJA65_POWERON':'snes9x','FORJA65_CONTROL_AT':'vblank'})
f=p.frame(); r.run(f+1,0)
L.advance(r,p,ev,f,F0)
r.cmd('cputrace /dev/shm/tr_ref.txt 0'); p.cmd('cputrace /dev/shm/tr_port.txt 0')
L.advance(r,p,ev,F0,F0+N)
r.cmd('cputrace off 0'); p.cmd('cputrace off 0')
print('ok')
