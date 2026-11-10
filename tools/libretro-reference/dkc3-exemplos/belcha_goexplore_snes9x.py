import random,pickle,sys,time
from emu import *
random.seed(int(sys.argv[1]))
e=Emu();e.loadfile('l6_arena2.state'); L0=e.ram(0x5d5,1)[0]
M={'w':[(12,0)],'r':[(12,RIGHT)],'l':[(12,LEFT)],'b':[(16,B)],'br':[(16,B|RIGHT)],'bl':[(16,B|LEFT)],
   'y':[(4,Y),(8,0)],'yr':[(4,Y|RIGHT),(8,RIGHT)],'yl':[(4,Y|LEFT),(8,LEFT)],'yh':[(16,Y)],'yhr':[(16,Y|RIGHT)],'yhl':[(16,Y|LEFT)],'yhb':[(16,Y|B)],'yhbr':[(16,Y|B|RIGHT)],'d':[(12,DOWN)],'u':[(12,UP)],'w4':[(4,0)],'sel':[(2,SEL),(20,0)],'yh32r':[(32,Y|RIGHT)],'yh32':[(32,Y)],'b4':[(4,B),(12,0)],'brY':[(16,B|RIGHT|Y)],'blY':[(16,B|LEFT|Y)],'rel':[(2,0)]}
K=list(M)
from bslots import slots
def cell():
    kx,ky=e.w16(0x47b),e.w16(0x47f); kn=[(x,y) for k,t,x,y in slots(e) if t=='27d2' and y<760]
    rel=0 if not kn else 1+min(3,abs(kn[0][1]-ky)//16)+ (4 if abs(kn[0][0]-kx)<40 else 0)
    return (e.w16(0x966)//6, kx//32, rel, e.ram(0x5b0,1)[0]&0x40)
arch={}; e.save('c0'); arch[cell()]=('c0',[],0); n=0; t=time.time(); done=None
for it in range(int(sys.argv[2])):
    items=list(arch.items())
    w=[(1+k[0]-min(a[0] for a in arch))**2/((1+v[2])**0.5) for k,v in items]
    k,(slot,h,ch)=random.choices(items,weights=w)[0]; arch[k]=(slot,h,ch+1)
    e.load(slot); h=list(h)
    for s in range(random.randint(2,8)):
        a=random.choice(K); h.append(a)
        for nn,m in M[a]: e.run(nn,m)
        if e.ram(0x64f,1)[0]&2: done=h; break
        if e.ram(0x5d5,1)[0]<L0 or e.w16(0x47f)>760: break
        c=cell()
        if c not in arch or len(arch[c][1])>len(h):
            n+=1; sl='s%d'%n; e.save(sl); arch[c]=(sl,list(h),0)
    if done: print('VENCEU',it,len(done),flush=True); break
    if it%200==0: print(it,len(arch),'belcha_max',max(a[0] for a in arch)*6,round(time.time()-t),flush=True)
pickle.dump({'arch':{k:v[1] for k,v in arch.items()},'done':done},open('belcha_ge_%s.pkl'%sys.argv[1],'wb'))
if done: e.savefile('l6_won.state')
