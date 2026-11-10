#!/usr/bin/env python3
"""Forja65 REV138 - comparacao em passo (lockstep) port x referencia (Snes9x via refemu), quadro a quadro.

Os dois recebem as mesmas entradas (FORJA65_INPUT_TRACE) e, ao fim de cada quadro, gravam um 'dump'
(CPU, WRAM, VRAM, OAM, CGRAM, imagem). Para cada categoria registra o PRIMEIRO quadro divergente e o
detalhe (enderecos, sprites, pixels). Uso:
  python lockstep.py --rom jogo.sfc --game build/game --assets assets --trace rota.trace --frames 5000 --out pasta
       [--ignore-wram 0x1f00-0x1fff,...] [--step 1] [--core snes9x_libretro.so] [--refemu refemu]
"""
import argparse,os,sys,json,struct,time
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from emu import Emu
from portemu import PortEmu
ap=argparse.ArgumentParser()
for k in ['rom','game','assets','trace','out']: ap.add_argument('--'+k,required=True)
ap.add_argument('--frames',type=int,default=5000); ap.add_argument('--step',type=int,default=1)
ap.add_argument('--ignore-wram',default=''); ap.add_argument('--core',default=os.environ.get('FORJA65_LIBRETRO_CORE','snes9x_libretro.so'))
ap.add_argument('--refemu',default=os.environ.get('FORJA65_REFEMU',os.path.join(os.path.dirname(os.path.abspath(__file__)),'refemu')))
ap.add_argument('--poweron',default='snes9x',help='estado de ligar do port (FORJA65_POWERON): snes9x iguala WRAM/CGRAM iniciais da referencia')
ap.add_argument('--arbiter',default='',help='3o core libretro (ex.: bsnes_libretro.so): diz, para cada divergencia de WRAM, quem concorda com quem')
ap.add_argument('--keep',type=int,default=8,help='quantos quadros detalhar por categoria apos a 1a divergencia')
a=ap.parse_args(); os.makedirs(a.out,exist_ok=True)
a.core=os.path.abspath(a.core); a.refemu=os.path.abspath(a.refemu)
import emu as _emu; _emu.REFEMU=a.refemu; _emu.CORE=a.core
ign=[]
for r in filter(None,a.ignore_wram.split(',')):
    lo,hi=r.split('-'); ign.append((int(lo,0),int(hi,0)))
ev=[]
env={}
for l in open(a.trace):
    if l.startswith('# FORJA65_ENV '):
        k,v=l[14:].strip().split('=',1); env[k]=v
    if l.startswith('frame='): ev.append((int(l.split()[0][6:]),int(l.split('joy1=')[1].split()[0],16)))
def mask_at(f):
    m=0
    for fr,mm in ev:
        if fr>f: break
        m=mm
    return m
def parse(p):
    b=open(p,'rb').read(); assert b[:6]==b'FJDMP1'
    fr,=struct.unpack_from('<Q',b,8); regs=struct.unpack_from('<10I',b,16); o=56
    wram=b[o:o+0x20000]; o+=0x20000; vram=b[o:o+0x10000]; o+=0x10000; oam=b[o:o+544]; o+=544; cg=b[o:o+512]; o+=512
    w,h=struct.unpack_from('<II',b,o); o+=8; fb=b[o:o+w*h*4]
    return dict(frame=fr,pc=regs[0],a=regs[1],x=regs[2],y=regs[3],s=regs[4],d=regs[5],db=regs[6],p=regs[7],e=regs[8],v=regs[9],wram=wram,vram=vram,oam=oam,cgram=cg,w=w,h=h,fb=fb)
def fbdiff(A,B):
    if (A['w'],A['h'])!=(B['w'],B['h']): return {'tamanho':[A['w'],A['h'],B['w'],B['h']]}
    import numpy as np
    x=np.frombuffer(A['fb'],dtype=np.uint8).reshape(-1,4)[:,:3].astype(int); y=np.frombuffer(B['fb'],dtype=np.uint8).reshape(-1,4)[:,:3].astype(int)
    x=(x*31+127)//255; y=(y*31+127)//255
    m=(x!=y).any(1).reshape(A['h'],A['w'])
    n=int(m.sum())
    if not n: return None
    rows=np.where(m.any(1))[0]
    return {'pixels':n,'linhas':[int(rows[0]),int(rows[-1])],'n_linhas':int(len(rows))}
def bdiff(x,y,ignore=()):
    import numpy as np
    m=np.frombuffer(x,dtype=np.uint8)!=np.frombuffer(y,dtype=np.uint8)
    for lo,hi in ignore: m[lo:hi+1]=False
    return np.nonzero(m)[0].tolist()
def oamdiff(x,y):
    s=[]
    for i in range(128):
        if x[i*4:i*4+4]!=y[i*4:i*4+4]: s.append(i)
    hi=[i for i in range(32) if x[512+i]!=y[512+i]]
    return s,hi
r=Emu(rom=a.rom,core=a.core)
bz=Emu(rom=a.rom,core=os.path.abspath(a.arbiter)) if a.arbiter else None
pe=dict(env);pe['FORJA65_POWERON']=a.poweron;pe['FORJA65_CONTROL_AT']='vblank'; p=PortEmu(game=a.game,assets=a.assets,extra_env=pe)
start=p.frame()
# FORJA65_CONTROL_AT=vblank: o port para no inicio do VBlank do quadro 'start' (antes do NMI e da leitura
# do controle), como cada retro_run da referencia. O 1o retro_run vai do reset ao 1o VBlank.
r.run(start+1,0)
if bz: bz.run(start+1,0)
first={}; detail={k:[] for k in ['cpu','wram','oam','cgram','vram','framebuffer']}
log=open(os.path.join(a.out,'lockstep.log'),'w'); t=time.time()
dr,dp=os.path.join(a.out,'r.dmp'),os.path.join(a.out,'p.dmp')
f=start
while f<start+a.frames:
    n=a.step; m=mask_at(f)
    # nao atravessa mudanca de entrada dentro do passo
    nxt=[fr for fr,_ in ev if f<fr<f+n]
    if nxt: n=nxt[0]-f
    r.run(n,m); p.run(n,m); f+=n
    if bz: bz.run(n,m)
    r.cmd('dump '+dr); p.cmd('dump '+dp)
    R=parse(dr); P=parse(dp)
    res={}
    w=bdiff(R['wram'],P['wram'],ign)
    if w:
        res['wram']={'bytes':len(w),'enderecos':['%05X'%i for i in w[:24]]}
        if bz:
            bz.cmd('dump '+dr+'.b'); B=parse(dr+'.b')['wram']
            ag_ref=sum(1 for i in w if B[i]==R['wram'][i]); ag_port=sum(1 for i in w if B[i]==P['wram'][i])
            res['wram']['arbitro']={'concorda_com_referencia':ag_ref,'concorda_com_port':ag_port}
    s,hi=oamdiff(R['oam'],P['oam'])
    if s or hi: res['oam']={'sprites':s[:24],'n_sprites':len(s),'tabela_alta':hi[:8]}
    c=bdiff(R['cgram'],P['cgram'])
    if c: res['cgram']={'cores':sorted(set(i//2 for i in c))[:24],'n':len(set(i//2 for i in c))}
    v=bdiff(R['vram'],P['vram'])
    if v: res['vram']={'bytes':len(v),'primeiro':'%04X'%v[0],'ultimo':'%04X'%v[-1]}
    fd=fbdiff(R,P)
    if fd: res['framebuffer']=fd
    # CPU no fim do quadro (informativo: o ponto exato em que cada lado para nao e o mesmo)
    if R['pc']!=P['pc'] or R['s']!=P['s'] or R['db']!=P['db'] or R['d']!=P['d']:
        res['cpu']={'ref':{k:hex(R[k]) for k in ['pc','a','x','y','s','d','db','p']},'port':{k:hex(P[k]) for k in ['pc','a','x','y','s','d','db','p']}}
    for k,vv in res.items():
        if k not in first: first[k]=f
        if len(detail[k])<a.keep: detail[k].append({'quadro':f,**vv})
    rec={'quadro':f,**{k:(vv.get('bytes') or vv.get('n_sprites') or vv.get('n') or vv.get('pixels') or 1) for k,vv in res.items()}}
    if w: rec['wram_end']=w[:400]
    if w and bz: rec['arb']=[res['wram']['arbitro']['concorda_com_referencia'],res['wram']['arbitro']['concorda_com_port']]
    if s: rec['oam_spr']=s
    if c: rec['cg']=sorted(set(i//2 for i in c))
    if fd: rec['fb_linhas']=fd.get('linhas')
    rec['pc']=[R['pc'],P['pc']]
    log.write(json.dumps(rec)+'\n')
    if (f-start)%500<n: print(f,'primeiras divergencias',first,round(time.time()-t),flush=True)
rep={'quadros':a.frames,'inicio':start,'primeira_divergencia':first,'detalhe':detail,'ignorado_wram':a.ignore_wram,'perfil':env}
json.dump(rep,open(os.path.join(a.out,'lockstep.json'),'w'),indent=1)
print(json.dumps(first))
r.cmd('quit') if False else None
