"""Go-Explore generico no proprio port (fork savestates)."""
import random,time,math,pickle
def go_explore(e,M,cell,progress,dead,done,maxit=4000,seed=1,log=print,maxslots=600,steps=(2,6)):
    random.seed(seed); keys=list(M)
    arch={}; nslot=0
    e.save('c0'); arch[cell()]=dict(slot='c0',fr=e.frame(),chosen=0,prog=progress())
    t=time.time()
    for it in range(maxit):
        cells=list(arch.items()); pmax=max(v['prog'] for _,v in cells)
        w=[(1/math.sqrt(1+v['chosen']))*(1+4*math.exp(-(pmax-v['prog'])/64)) for k,v in cells]
        k,v=random.choices(cells,weights=w)[0]; v['chosen']+=1
        e.load(v['slot'])
        for st in range(random.randint(*steps)):
            a=random.choice(keys)
            for n,m in M[a]: e.run(n,m)
            if done(): 
                log('DONE',it,e.frame()); return True
            if dead(): break
            c=cell(); fr=e.frame()
            if c not in arch or arch[c]['fr']>fr:
                nslot+=1; s=f's{nslot}'; e.save(s); old=arch.get(c)
                if old and old['slot']!='c0': e.delete(old['slot'])
                arch[c]=dict(slot=s,fr=fr,chosen=old['chosen'] if old else 0,prog=progress())
        if len(arch)>maxslots:  # poda celulas fracas
            items=sorted(arch.items(),key=lambda kv:kv[1]['prog'])
            for kk,vv in items[:len(arch)-maxslots]:
                if vv['slot']!='c0': e.delete(vv['slot']); del arch[kk]
        if it%100==0: log(it,'cells',len(arch),'best',pmax,round(time.time()-t))
    return False
