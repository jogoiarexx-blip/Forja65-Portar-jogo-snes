import sys,os
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
from portemu import PortEmu
import lockstep_lib as L
from PIL import Image
ev,env=L.read_trace(os.environ['TRACE']); FR=[int(x) for x in sys.argv[1].split(',')]
r=Emu(rom='/home/claude/roms/smw.sfc',core='/home/claude/ref/snes9x_libretro.so')
p=PortEmu(game='/home/claude/ports/smw-l/build-spc/game',assets='/home/claude/ports/smw-l/assets',extra_env={**env,'FORJA65_POWERON':'snes9x','FORJA65_CONTROL_AT':'vblank'})
f=p.frame(); r.run(f+1,0)
for F in FR:
    L.advance(r,p,ev,f,F); f=F
    a,b=L.dump_both(r,p,'/dev/shm/fbat')
    W,H=a['w'],a['h']
    ia=Image.frombytes('RGBX',(W,H),a['fb']).convert('RGB'); ib=Image.frombytes('RGBX',(b['w'],b['h']),b['fb']).convert('RGB')
    d=[(x,y) for y in range(H) for x in range(W) if ia.getpixel((x,y))!=ib.getpixel((x,y))]
    print(F,len(d),'x',min(x for x,y in d) if d else None,max(x for x,y in d) if d else None,'y',min(y for x,y in d) if d else None,max(y for x,y in d) if d else None, d[:3], [ (ia.getpixel(q),ib.getpixel(q)) for q in d[:3]],flush=True)
    w=Image.new('RGB',(W*2,H)); w.paste(ia,(0,0)); w.paste(ib,(W,0)); w.save(f'/home/claude/cmp/fb_{F}.png')
