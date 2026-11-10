"""Go-Explore de fase do SMW na REFERENCIA (Snes9x via refemu), com estados em ARQUIVO: retomavel apos reinicio.
Como o port REV138 anda em passo com Snes9x/bsnes, a rota achada aqui e conferida depois no port.
Uso: geref.py rota_ate_inicio.trace quadro_inicio pasta [iteracoes]
Convencao de quadros: o retro_run numero r (contando de 0 desde o reset) usa a entrada do quadro r-1 do port."""
import sys,os,json,random,math,time
sys.path.insert(0,'/home/claude/cmp')
import emu as E; E.REFEMU='/home/claude/ref/refemu'
from emu import Emu
import lockstep_lib as L
B=0x8000;Y=0x4000;SEL=0x2000;START=0x1000;UP=0x0800;DOWN=0x0400;LEFT=0x0200;RIGHT=0x0100;A=0x0080;X=0x0040
trace,F0,D=sys.argv[1],int(sys.argv[2]),sys.argv[3]; its=int(sys.argv[4]) if len(sys.argv)>4 else 20000
os.makedirs(D+'/st',exist_ok=True); LOG=open(D+'/ge.log','a')
def log(*a): print(*a,file=LOG,flush=True)
ev,env=L.read_trace(trace)
e=Emu(rom='/home/claude/roms/smw.sfc',core='/home/claude/ref/snes9x_libretro.so')
w16=lambda a: e.w16(a); mode=lambda: e.ram(0x100,1)[0]
base=D+'/st/base.st'
if not os.path.exists(base):
    e.run(1,0); r=1   # retro_run 0 (reset ate o 1o VBlank)
    while r<F0+1:
        m=L.mask_at(ev,r-1); nxt=[fr+1 for fr,_ in ev if r<fr+1<F0+1]; n=(nxt[0] if nxt else F0+1)-r
        e.run(n,m); r+=n
    e.savefile(base); json.dump({'r':r},open(D+'/base.json','w'))
e.loadfile(base); R0=json.load(open(D+'/base.json'))['r']
R_,L_=RIGHT,LEFT
M={'r':[(16,R_|Y)],'w':[(16,R_)],'j':[(18,R_|Y|B),(4,R_|Y)],'hj':[(30,R_|Y|B),(4,R_|Y)],'sj':[(6,R_|A),(14,R_)],
   'nj':[(18,B),(4,0)],'st':[(16,0)],'l':[(16,L_)],'lr':[(16,L_|Y)],'lj':[(18,L_|B),(4,L_)],'d':[(16,DOWN)],'u':[(16,UP)],'rr':[(40,R_|Y)],
   'jj':[(10,R_|Y|B),(4,R_|Y),(10,R_|Y|B),(4,R_|Y)],'uj':[(18,UP|B),(4,UP)],'ru':[(16,R_|UP)],'w40':[(40,0)],'w80':[(80,0)],
   'rhj':[(40,R_|Y|B),(4,R_|Y)],'whj':[(30,R_|B),(4,R_)],'sjr':[(6,R_|Y|A),(20,R_|Y)],'lhj':[(30,L_|Y|B),(4,L_|Y)]}
keys=list(M)
lives0=e.ram(0xdbe,1)[0]
PROG=lambda: w16(0x94)+10000*e.ram(0x141a,1)[0]  # $141A conta trocas de subnivel (canos, portas)
def done():
    m=mode(); return e.ram(0x1493,1)[0]!=0 or (m in (0x0B,0x0C,0x0D,0x0E) and e.ram(0xdbe,1)[0]==lives0 and e.ram(0x71,1)[0]!=9)
def dead(): return e.ram(0x71,1)[0]==9 or e.ram(0xdbe,1)[0]!=lives0 or (mode() in (0x0B,0x0C,0x0D,0x0E) and not done())
def cell():
    r=e.ram(0,0x2000); x=r[0x94]|r[0x95]<<8; y=r[0x96]|r[0x97]<<8
    return (x//24,min(y,800)//32,r[0x19],r[0x187a],r[0x13bf],r[0x1b95],r[0x141a])
AR=D+'/arch.json'
arch=json.load(open(AR)) if os.path.exists(AR) else {}
if not arch:
    arch[json.dumps(cell())]=dict(st=base,r=R0,ev=[],prog=PROG(),chosen=0)
def persist(): json.dump(arch,open(AR+'.tmp','w')); os.replace(AR+'.tmp',AR)
random.seed(int(time.time())); t=time.time(); nst=len(os.listdir(D+'/st')); okd=None
for it in range(its):
    cells=list(arch.items()); pmax=max(v['prog'] for _,v in cells)
    wt=[(1/math.sqrt(1+v['chosen']))*(1+4*math.exp(-(pmax-v['prog'])/128)) for k,v in cells]
    k,v=random.choices(cells,weights=wt)[0]; v['chosen']+=1
    e.loadfile(v['st']); r=v['r']; evs=list(v['ev'])
    for s in range(random.randint(2,6)):
        a=random.choice(keys)
        for n,m in M[a]: evs.append((r,m)); e.run(n,m); r+=n
        if done(): okd=(r,evs); break
        if dead(): break
        c=json.dumps(cell())
        if c not in arch or arch[c]['r']>r:
            nst+=1; f=f'{D}/st/{nst}.st'; e.savefile(f); old=arch.get(c)
            if old and old['st']!=base:
                try: os.remove(old['st'])
                except OSError: pass
            arch[c]=dict(st=f,r=r,ev=list(evs),prog=PROG(),chosen=old['chosen'] if old else 0)
    if okd: break
    if len(arch)>800:
        for kk,vv in sorted(arch.items(),key=lambda kv:kv[1]['prog'])[:len(arch)-800]:
            if vv['st']!=base:
                try: os.remove(vv['st'])
                except OSError: pass
                del arch[kk]
    if it%100==0: log(it,'cells',len(arch),'best',pmax,round(time.time()-t)); persist()
persist()
if okd:
    r,evs=okd
    # entradas do port: retro_run r usa o quadro r-1 do port
    json.dump({'fim_r':r,'ev_port':[(rr-1,m) for rr,m in evs]},open(D+'/done.json','w'))
    log('DONE',r)
