import sys,random,math,time
sys.path.insert(0,'/home/claude/refemu')
from recport import *
def bcd(v): return (v>>4)*10+(v&15)
e=resume('/home/claude/refemu/port_b2_start.ckpt')
got=lambda: 15-bcd(e.ram(0x5d3,1)[0])
def dist():
    m=e.ram(0x47b,6); k=(m[0]|m[1]<<8, m[4]|m[5]<<8)
    b=e.ram(0xab0,6); t=(b[0]|b[1]<<8, b[4]|b[5]<<8)
    return math.hypot(k[0]-t[0],(k[1]-20)-t[1])
ACTS={'r':[(8,RIGHT)],'l':[(8,LEFT)],'jr':[(8,RIGHT|B)],'jl':[(8,LEFT|B)],'u':[(8,UP)],'ur':[(8,UP|RIGHT)],'ul':[(8,UP|LEFT)],
 'd':[(8,DOWN)],'b':[(8,B)],'db':[(4,DOWN|B),(4,0)],'w':[(8,0)],'rr':[(8,RIGHT|Y)],'ll':[(8,LEFT|Y)]}
keys=list(ACTS)
def val(): return got()*5000-dist()
e.save('start')
for attempt in range(6):
    random.seed(attempt); e.load('start'); t=time.time()
    for st in range(400):
        if got()>=15 or e.w16(0x47b)>3000: break
        e.save('mc'); best=None
        for k in keys:
            e.load('mc')
            for n,m in ACTS[k]: e.run(n,m)
            v0=val(); e.save('m1'); la=v0
            for r in range(3):
                e.load('m1')
                for d in range(3):
                    for n,m in ACTS[random.choice(keys)]: e.run(n,m)
                    la=max(la,val()-d*3)
            v=v0*0.5+la+random.random()*0.01
            if best is None or v>best[0]: best=(v,k)
        e.load('mc')
        for n,m in ACTS[best[1]]: e.run(n,m)
        if st%10==0: print(attempt,st,e.frame(),'got',got(),'dist',round(dist()),best[1],round(time.time()-t),flush=True)
    print('tentativa',attempt,'bananas',got(),e.frame(),flush=True)
    if got()>=15: break
e.del_('start') if hasattr(e,'del_') else None
print('bananas',got(),e.frame(),flush=True)
checkpoint(e,'/home/claude/refemu/port_b2_done.ckpt')
