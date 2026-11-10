"""Go-Explore de fase do SMW no port, RETOMAVEL (sobrevive a reinicio do container).
Uso: level2.py rota_ate_inicio.pkl - saida [iteracoes]
 - o port refaz a rota ate o inicio da fase (uma vez por execucao) e guarda esse estado por fork;
 - o arquivo saida.arch (json) guarda TODAS as celulas (entradas desde o inicio da fase) a cada 100 iteracoes;
 - se saida.arch existir, as melhores celulas sao reconstruidas e a busca continua."""
import sys,os,json,pickle,random,math,time
os.environ.setdefault('FORJA65_OUT','/home/claude/smwrun')
sys.path.insert(0,'/home/claude/smwrun')
from portnav import *
G=os.environ.get('FORJA65_PORT_GAME','/home/claude/ports/smw-l/build/game'); AS=os.environ.get('FORJA65_PORT_ASSETS','/home/claude/ports/smw-l/assets')
route,ckpt,out=sys.argv[1],sys.argv[2],sys.argv[3]; its=int(sys.argv[4]) if len(sys.argv)>4 else 6000
LOG=open(out+'.log','a')
def log(*a): print(*a,file=LOG,flush=True)
base=pickle.load(open(route,'rb'))
e=Rec(game=G,assets=AS); e.restore(route)
F0=e.frame(); assert F0==base['end'], (F0,base['end'])
BASE_N=len(e.ev)
R_,L_=RIGHT,LEFT
M={'r':[(16,R_|Y)],'w':[(16,R_)],'j':[(18,R_|Y|B),(4,R_|Y)],'hj':[(30,R_|Y|B),(4,R_|Y)],'sj':[(6,R_|A),(14,R_)],
   'nj':[(18,B),(4,0)],'st':[(16,0)],'l':[(16,L_)],'lr':[(16,L_|Y)],'lj':[(18,L_|B),(4,L_)],'d':[(16,DOWN)],'u':[(16,UP)],'rr':[(40,R_|Y)],
   'jj':[(10,R_|Y|B),(4,R_|Y),(10,R_|Y|B),(4,R_|Y)],'uj':[(18,UP|B),(4,UP)],'ru':[(16,R_|UP)],'w40':[(40,0)],'w80':[(80,0)],
   'rhj':[(40,R_|Y|B),(4,R_|Y)],'whj':[(30,R_|B),(4,R_)],'sjr':[(6,R_|Y|A),(20,R_|Y)],'lhj':[(30,L_|Y|B),(4,L_|Y)],'ul':[(16,UP|L_)],'uu':[(32,UP|Y)],'ujr':[(18,UP|R_|B),(4,UP|R_)],'ujl':[(18,UP|L_|B),(4,UP|L_)],'lw':[(16,L_)]}
keys=list(M)
lives0=e.ram(0xdbe,1)[0]
X=lambda:e.w16(0x94); Yp=lambda:e.w16(0x96)
def done():
    m=e.mode()
    return e.ram(0x1493,1)[0]!=0 or (m in (0x0B,0x0C,0x0D,0x0E) and e.ram(0xdbe,1)[0]==lives0 and e.ram(0x71,1)[0]!=9)
def dead(): return e.ram(0x71,1)[0]==9 or e.ram(0xdbe,1)[0]!=lives0 or (e.mode() in (0x0B,0x0C,0x0D,0x0E) and not done())
def PTR(): b=e.ram(0x65,3); return b[0]|b[1]<<8|b[2]<<16
BOSS=int(os.environ.get('BOSS','0'),0)
def boss():
    if not BOSS: return None
    n=e.ram(0x9e,12); st=e.ram(0x14c8,12)
    for i in range(12):
        if n[i]==BOSS and st[i]: x=e.ram(0xe4+i,1)[0]|e.ram(0x14e0+i,1)[0]<<8; return (x,st[i],e.ram(0xc2+i,1)[0])
    return None
def bkey():
    b=boss(); return (b[0]//16,b[1],b[2]) if b else (0,0,0)
def cell(): return bkey()+(X()//24,min(Yp(),800)//32,e.ram(0x19,1)[0],e.ram(0x187a,1)[0],e.ram(0x13bf,1)[0],e.ram(0x1b95,1)[0],e.ram(0x141a,1)[0],PTR())
PY=float(os.environ.get('PROG_Y','0'))
# progresso: X (+Y opcional) + 10000 por sala nova (troca do ponteiro de dados da camada 1, $65-$67)
PROG=lambda rooms: (lambda b:(4*abs(b[0]-128)+(500 if b[1]!=8 else 0)) if b else 0)(boss())+X()+int(PY*max(0,800-min(Yp(),800)))+10000*rooms
e.save('base'); nslot=0; arch={}
def key2s(k): return ','.join(map(str,k))
if os.path.exists(out+'.arch'):
    old=json.load(open(out+'.arch'))
    items=sorted(old.items(),key=lambda kv:-kv[1]['prog'])
    # reconstroi as melhores celulas e uma amostra das demais (diversidade)
    pick=items[:40]+random.Random(1).sample(items[40:],min(40,max(0,len(items)-40)))
    for ks,v in pick:
        e.load('base'); f=e.frame(); cur=0
        for fr,m in v['ev']:
            if fr>f: PortEmu.run(e,fr-f,cur); f=fr
            cur=m
        if v['fr']>f: PortEmu.run(e,v['fr']-f,cur)
        e.ev=list(base['ev'])+[tuple(x) for x in v['ev']]
        nslot+=1; s=f's{nslot}'; e.save(s); arch[tuple(int(x) for x in ks.split(','))]=dict(slot=s,fr=v['fr'],chosen=v.get('chosen',0),prog=v['prog'],rooms=v.get('rooms',0))
    log('retomado',len(arch),'celulas; melhor',max(v['prog'] for v in arch.values()))
else:
    arch[cell()]=dict(slot='base',fr=F0,chosen=0,prog=PROG(0),rooms=0)
def persist():
    d={key2s(k):dict(ev=e.slots[v['slot']][BASE_N:],fr=v['fr'],prog=v['prog'],chosen=v['chosen'],rooms=v.get('rooms',0)) for k,v in arch.items() if v['slot'] in e.slots}
    json.dump(d,open(out+'.arch.tmp','w')); os.replace(out+'.arch.tmp',out+'.arch')
random.seed(int(time.time())); t=time.time(); okd=False
for it in range(its):
    cells=list(arch.items()); pmax=max(v['prog'] for _,v in cells)
    w=[(1/math.sqrt(1+v['chosen']))*(1+4*math.exp(-(pmax-v['prog'])/128)) for k,v in cells]
    k,v=random.choices(cells,weights=w)[0]; v['chosen']+=1
    e.load(v['slot']); rooms=v.get('rooms',0); lp=PTR()
    for st in range(random.randint(2,6)):
        a=random.choice(keys)
        for n,m in M[a]: e.run(n,m)
        if done(): okd=True; break
        if dead(): break
        pp=PTR()
        if pp!=lp: rooms+=1; lp=pp
        c=cell(); fr=e.frame()
        if c not in arch or arch[c]['fr']>fr:
            nslot+=1; s=f's{nslot}'; e.save(s); old=arch.get(c)
            if old and old['slot']!='base': e.delete(old['slot'])
            arch[c]=dict(slot=s,fr=fr,chosen=old['chosen'] if old else 0,prog=PROG(rooms),rooms=rooms)
    if okd: break
    if len(arch)>600:
        for kk,vv in sorted(arch.items(),key=lambda kv:kv[1]['prog'])[:len(arch)-600]:
            if vv['slot']!='base': e.delete(vv['slot']); del arch[kk]
    if it%100==0:
        log(it,'cells',len(arch),'best',pmax,round(time.time()-t)); persist()
if okd:
    log('DONE',e.frame()); e.dump(out); e.snap(os.path.basename(out))
else:
    persist(); log('sem fim nesta rodada')
