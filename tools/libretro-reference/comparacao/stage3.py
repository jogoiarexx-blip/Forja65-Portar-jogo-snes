"""Comparacao alinhada (inicio do VBlank) port x Snes9x num trecho: variaveis de jogo, camera, sprites (tabelas e OAM),
CGRAM, imagem e estado do SPC. Registra a 1a divergencia de cada categoria e contagens. Uso:
  TRACE=rota.trace python3 stage3.py F0 F1 saida.json [passo_spc]"""
import sys,os,json
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
from portemu import PortEmu
import lockstep_lib as L
F0,F1,OUT=int(sys.argv[1]),int(sys.argv[2]),sys.argv[3]; SP=int(sys.argv[4]) if len(sys.argv)>4 else 60
ev,env=L.read_trace(os.environ['TRACE'])
evr,_=L.read_trace(os.environ.get('TRACE_REF',os.environ['TRACE']))
def adv(a,b):
    L.advance(r,Dummy(),evr,a,b); L.advance(Dummy(),p,ev,a,b)
class Dummy:
    def run(s,n,m): pass
r=Emu(rom='/home/claude/roms/smw.sfc',core='/home/claude/ref/snes9x_libretro.so')
p=PortEmu(game=os.environ.get('PGAME','/home/claude/ports/smw-l/build-spc/game'),assets='/home/claude/ports/smw-l/assets',extra_env={**env,'FORJA65_POWERON':os.environ.get('PWR','snes9x'),'FORJA65_CONTROL_AT':os.environ.get('CTLAT','vblank')})
f=p.frame(); r.run(f+1,0); adv(f,F0); f=F0
G={'modo':[0x100],'mario':[0x94,0x95,0x96,0x97,0x7b,0x7d,0x71,0x19],'camera':[0x1a,0x1b,0x1c,0x1d,0x1e,0x1f,0x20,0x21,0x1462,0x1463,0x1464,0x1465],
   'sala':[0x65,0x66,0x67,0x141a],'rng':[0x148d,0x148e],'tempo':[0xf31,0xf32,0xf33],'chefe_e_sprites':list(range(0x9e,0xaa))+list(range(0x14c8,0x14d4))+list(range(0xe4,0xf0))+list(range(0xd8,0xe4))+list(range(0xc2,0xce)),
   'som_fila':[0x1df9,0x1dfa,0x1dfb,0x1dfc,0x2140-0x2140+0x1dfd] }
first={};count={};modes=[];last=None;spc=[];rmodes=[];rlast=None
def note(k,fr,det):
    count[k]=count.get(k,0)+1
    if k not in first: first[k]=dict(quadro=fr,detalhe=det); print('1a divergencia',k,fr,det,flush=True)
while f<F1:
    a,b=L.dump_both(r,p,'/dev/shm/s3_'+os.path.basename(OUT))
    wa,wb=a['wram'],b['wram']
    for k,addrs in G.items():
        d=[(hex(x),wa[x],wb[x]) for x in addrs if wa[x]!=wb[x]]
        if d: note(k,f,d[:6])
    if a['oam']!=b['oam']: note('oam',f,[i for i in range(544) if a['oam'][i]!=b['oam'][i]][:8])
    if a['cgram']!=b['cgram']: note('cgram',f,[i for i in range(512) if a['cgram'][i]!=b['cgram'][i]][:8])
    if a['vram']!=b['vram']: note('vram',f,sum(1 for i in range(0,65536,2) if a['vram'][i:i+2]!=b['vram'][i:i+2]))
    # Snes9x entrega RGB565 (verde com 6 bits): a expansao para 8 bits difere em 1-2 unidades. Compara no dominio de 5 bits.
    fa=bytes(x>>3 for x in a['fb']); fb5=bytes(x>>3 for x in b['fb'])
    if fa!=fb5:
        W=a['w']; diff=[i//4 for i in range(0,len(fa),4) if fa[i:i+3]!=fb5[i:i+3]]
        note('imagem',f,dict(pixels=len(diff),linhas=sorted(set(i//W for i in diff))[:6]))
    if wa[0x100]!=rlast: rmodes.append((f,hex(wa[0x100]))); rlast=wa[0x100]
    m=wb[0x100]
    if m!=last: modes.append((f,hex(m))); last=m
    if (f-F0)%SP==0:
        r.cmd('aram /dev/shm/s3ar_'+os.path.basename(OUT)); p.cmd('aram /dev/shm/s3ap_'+os.path.basename(OUT)); x=open('/dev/shm/s3ar_'+os.path.basename(OUT),'rb').read(); y=open('/dev/shm/s3ap_'+os.path.basename(OUT),'rb').read()
        dp=[i for i in range(0x100) if x[i]!=y[i] and not 0xF0<=i<=0xFF]
        spc.append(dict(quadro=f,dp_diff=len(dp),timer0_ref=x[65536+10],timer0_port=y[65536+10],musica_ref=x[0x45] if False else None))
    adv(f,f+1); f+=1
    if (f-F0)%500==0:
        json.dump(dict(trecho=[F0,f],primeira=first,contagem=count,modos=modes,modos_ref=rmodes,spc=spc),open(OUT,'w'),indent=1)
json.dump(dict(trecho=[F0,F1],primeira=first,contagem=count,modos=modes,modos_ref=rmodes,spc=spc),open(OUT,'w'),indent=1)
print('fim',f,count)
