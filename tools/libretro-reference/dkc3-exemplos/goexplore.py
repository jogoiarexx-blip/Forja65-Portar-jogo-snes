"""Go-Explore com savestates (refemu): arquiva celulas (x,y grosseiros) e explora a partir delas."""
import sys,random,time,math,pickle
from emu import *
random.seed(int(sys.argv[2]) if len(sys.argv)>2 else 1)
START=sys.argv[1]; MAXIT=int(sys.argv[3]) if len(sys.argv)>3 else 3000; OUT=sys.argv[4] if len(sys.argv)>4 else 'ge'
e=Emu(); e.loadfile(START)
X=lambda: e.w16(0x47b); Yp=lambda: e.w16(0x47f)
def mode():
    return 1 if (e.ram(0x4e1,1)[0]==1 and e.ram(0x6d8,1)[0]==1 and e.ram(0x1488,1)[0]==0) else 0
R_,L_=RIGHT,LEFT
M={'r':[(20,R_|Y)],'l':[(20,L_|Y)],'wr':[(20,R_)],'wl':[(20,L_)],'jr':[(16,R_|B),(4,R_)],'jl':[(16,L_|B),(4,L_)],
   'ju':[(18,B),(2,0)],'jur':[(18,B|UP|R_),(2,UP)],'jul':[(18,B|UP|L_),(2,UP)],'up':[(20,UP)],'dn':[(20,DOWN)],'w':[(20,0)],
   'hr':[(24,R_|Y|B)],'hl':[(24,L_|Y|B)],'a':[(4,A),(16,0)],'y':[(6,Y),(14,0)],'yu':[(6,Y|UP),(14,UP)],
   'hang':[(16,B),(60,0)],'hangr':[(16,B|R_),(60,0)],'hangl':[(16,B|L_),(60,0)],'upl':[(60,UP)],'dnl':[(40,DOWN)],
   'rr':[(60,R_|Y)],'ll':[(60,L_|Y)],
   'gr30':[(18,B|R_),(8,R_),(30,0),(4,B),(120,R_|Y)],'gr60':[(18,B|R_),(8,R_),(60,0),(4,B),(120,R_|Y)],'gr90':[(18,B|R_),(8,R_),(90,0),(4,B),(140,R_|Y)],
   'gl30':[(18,B|L_),(8,L_),(30,0),(4,B),(120,L_|Y)],'gl60':[(18,B|L_),(8,L_),(60,0),(4,B),(120,L_|Y)],
   'gu60r':[(18,B),(60,0),(4,B),(120,R_|Y)],'gu60l':[(18,B),(60,0),(4,B),(120,L_|Y)],
   'team_up':[(4,A),(30,0),(6,Y|UP),(30,UP)],'tne':[(4,A),(30,0),(6,Y|UP|R_),(30,UP|R_)],'tnw':[(4,A),(30,0),(6,Y|UP|L_),(30,UP|L_)],'gj':[(30,B|UP),(30,0),(4,B),(120,R_|Y)],'gjl':[(30,B|UP),(30,0),(4,B),(120,L_|Y)],'jjr':[(16,R_|Y|B),(16,R_|Y|B)],'team_r':[(4,A),(30,0),(6,Y|R_),(20,R_)],'team_l':[(4,A),(30,0),(6,Y|L_),(20,L_)]}
keys=list(M)
def cell(): return (X()//48,Yp()//40,1 if e.ram(0x5b0,1)[0]&0x40 else 0)
arch={}  # cell -> dict(slot,hist,frames,chosen,seen)
LIVES0=e.ram(0x5d5,1)[0]
import os
FLAG=int(os.environ.get('GE_FLAG','0'),16)
SX,SY=X(),Yp()
NODE0=e.ram(0x5e7,1)[0]
c0=cell(); e.save('c0'); arch[c0]=dict(slot='c0',hist=[],frames=0,chosen=0,seen=0)
best_y=Yp(); t=time.time(); nslot=0; done=None
for it in range(MAXIT):
    cells=list(arch.items())
    ys=[k[1] for k,_ in cells]; ymin=min(ys)
    if os.environ.get('GE_NEUTRAL'): w=[1/math.sqrt(1+v['chosen'])*(3 if k[2]==1 else 1) for k,v in cells]
    else: w=[1/math.sqrt(1+v['chosen'])*(1+2*math.exp(-(k[1]-ymin)/6))*(3 if k[2]==1 else 1)*(1+k[0]/40) for k,v in cells]
    k,v=random.choices(cells,weights=w)[0]; v['chosen']+=1
    e.load(v['slot']); hist=list(v['hist']); fr=v['frames']
    x0,y0=X(),Yp(); prevL=e.ram(0x5d5,1)[0]
    for step in range(random.randint(2,6)):
        a=random.choice(keys); hist.append(a)
        for n,m in M[a]: e.run(n,m); fr+=n
        if FLAG and (e.ram(FLAG,1)[0]&2):
            done=(hist,fr); break
        lv=e.ram(0x5d5,1)[0]
        # perdeu vida, saiu da fase ou voltou ao mapa -> descarta o caminho
        if lv<LIVES0 or lv<prevL or e.ram(0x5e7,1)[0]!=NODE0 or (FLAG and e.ram(0x4e1,1)[0]==1 and e.ram(0x6d8,1)[0]==1): break
        prevL=lv
        if not FLAG and mode()!=0:
            done=(hist,fr); break
        x,y=X(),Yp()
        if (abs(x-SX)<40 and abs(y-SY)<20 and fr>200) or x<SX-1500: break  # voltou ao inicio (morte) -> descarta
        x0,y0=x,y
        c=cell()
        if c not in arch or arch[c]['frames']>fr:
            nslot+=1; s=f's{nslot}'; e.save(s)
            old=arch.get(c); arch[c]=dict(slot=s,hist=list(hist),frames=fr,chosen=old['chosen'] if old else 0,seen=0)
    if done: print('FIM DE FASE (modo mudou)',it,done[1],flush=True); break
    if it%200==0: pickle.dump({'arch':{k:(v['hist'],v['frames']) for k,v in arch.items()},'done':None},open(OUT+'.pkl','wb'))
    if it%200==0: print(it,'celulas',len(arch),'ymin',ymin*40,'xmax',max(k[0] for k in arch)*48,'2kongs',sum(1 for k in arch if k[2]==1),round(time.time()-t),flush=True)
pickle.dump({'arch':{k:(v['hist'],v['frames']) for k,v in arch.items()},'done':done},open(OUT+'.pkl','wb'))
if done: e.savefile(OUT+'_done.state')
