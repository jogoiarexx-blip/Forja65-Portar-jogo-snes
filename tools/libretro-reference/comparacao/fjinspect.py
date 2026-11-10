#!/usr/bin/env python3
"""Forja65 REV138 - inspeciona quadros especificos (port x referencia): lista enderecos WRAM/VRAM/OAM/CGRAM com valores."""
import sys,os,json,argparse
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from emu import Emu
from portemu import PortEmu
import lockstep_lib as L
ap=argparse.ArgumentParser()
for k in ['rom','game','assets','trace']: ap.add_argument('--'+k,required=True)
ap.add_argument('--frames',required=True); ap.add_argument('--poweron',default='snes9x'); ap.add_argument('--max',type=int,default=40)
ap.add_argument('--cputrace',default='',help='quadro:arquivo_prefixo -> trace por instrucao da referencia nesse quadro')
ap.add_argument('--core',default=os.environ.get('FORJA65_LIBRETRO_CORE','snes9x_libretro.so'))
ap.add_argument('--refemu',default=os.environ.get('FORJA65_REFEMU',os.path.join(os.path.dirname(os.path.abspath(__file__)),'refemu')))
a=ap.parse_args()
a.core=os.path.abspath(a.core); a.refemu=os.path.abspath(a.refemu)
import emu as _emu; _emu.REFEMU=a.refemu; _emu.CORE=a.core
ev,env=L.read_trace(a.trace)
r=Emu(rom=a.rom); p=PortEmu(game=a.game,assets=a.assets,extra_env={**env,'FORJA65_POWERON':a.poweron,'FORJA65_CONTROL_AT':'vblank'})
f=p.frame(); r.run(f+1,0)
for F in [int(x) for x in a.frames.split(',')]:
    L.advance(r,p,ev,f,F); f=F
    R,P=L.dump_both(r,p,'/dev/shm/insp')
    print('== quadro',F,'pc ref',hex(R['pc']),'port',hex(P['pc']))
    for name,sz in [('wram',None),('vram',None),('oam',None),('cgram',None)]:
        d=[i for i in range(len(R[name])) if R[name][i]!=P[name][i]]
        if d: print(' ',name,len(d),' '.join('%05X:%02X/%02X'%(i,R[name][i],P[name][i]) for i in d[:a.max]))
