"""Busca Monte Carlo com savestates: a cada passo escolhe a acao cujo melhor rollout aleatorio mais aumenta o objetivo."""
import random,time
try:
    from emu import *
except ImportError:
    from portemu import *
def mc_search(e,score,acts,steps,rollouts=4,depth=5,stop=None,log=True,tiebreak=None):
    hist=[];t=time.time();keys=list(acts)
    for st in range(steps):
        e.save('mc'); base=score(); best=None
        for k in keys:
            e.load('mc')
            for n,m in acts[k]: e.run(n,m)
            imm=score(); e.save('mc1'); la=imm
            for r in range(rollouts):
                e.load('mc1')
                for d in range(depth):
                    for n,m in acts[random.choice(keys)]: e.run(n,m)
                    la=max(la,score())
            v=imm*2+la+(tiebreak(k) if tiebreak else 0)+random.random()*0.01
            if best is None or v>best[0]: best=(v,k)
        e.load('mc')
        for n,m in acts[best[1]]: e.run(n,m)
        hist.append(best[1])
        if log and st%5==0: print(st,e.frame(),'obj',score(),best[1],round(time.time()-t),flush=True)
        if stop and stop(score()): break
    return hist
