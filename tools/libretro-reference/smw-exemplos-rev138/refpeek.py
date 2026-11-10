import sys,os,json
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
from PIL import Image
D=sys.argv[1]; a=json.load(open(D+'/arch.json'))
items=sorted(a.values(),key=lambda v:-v['prog'])[:int(sys.argv[2]) if len(sys.argv)>2 else 3]
e=Emu(rom='/home/claude/roms/smw.sfc',core='/home/claude/ref/snes9x_libretro.so')
ims=[]
for i,v in enumerate(items):
    e.loadfile(v['st']); e.run(1,0); e.shot('/tmp/rp.ppm'); ims.append(Image.open('/tmp/rp.ppm').copy())
    print(i,'x',v['prog'],'y',e.w16(0x96),'r',v['r'])
w=Image.new('RGB',(256*len(ims),224)); [w.paste(im,(i*256,0)) for i,im in enumerate(ims)]; w.save(D+'/melhores.png')
