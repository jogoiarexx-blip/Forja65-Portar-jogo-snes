"""PortEmu com gravacao de entradas (gera FORJA65_INPUT_TRACE valido para o port)."""
import pickle
from portemu import *
class RecPort(PortEmu):
    def __init__(s,*a,**k):
        super().__init__(*a,**k); s.events=[]; s.fr0=s.fr
    def run(s,n,mask=0):
        if n<=0: return
        f=s.frame_cached if hasattr(s,'frame_cached') else None
        r=super().run(n,mask)
        # resposta "ok <quadro>" -> quadro final; inicio = final-n
        end=int(r.split()[1]); s.events.append((end-n,mask)); return r
    def save(s,k):
        r=super().save(k)
        if not hasattr(s,'_slots'): s._slots={}
        s._slots[k]=list(s.events)  # eventos pertencem ao ramo salvo
        return r
    def load(s,k):
        r=super().load(k)
        f=int(r.split()[1])
        if hasattr(s,'_slots') and k in s._slots: s.events=list(s._slots[k])
        else: s.events=[ev for ev in s.events if ev[0]<f]
        return r
    def delete(s,k):
        if hasattr(s,'_slots'): s._slots.pop(k,None)
        return super().delete(k)
    def replay_events(s,events):
        f=s.frame()
        for i,(fr,m) in enumerate(events):
            nxt=events[i+1][0] if i+1<len(events) else None
            if fr>f: super().run(fr-f,s.events[-1][1] if s.events else 0); f=fr
            s.events.append((fr,m))
        return
    def goto(s,tx,xa=0x47b,tol=1,maxf=200,step=1):
        for k in range(maxf):
            x=s.w16(xa)
            if abs(x-tx)<=tol: break
            s.run(step,RIGHT if x<tx else LEFT)
    def write_trace(s,path,header,rom=None,env=None):
        # REV137: o cabecalho leva o perfil do modo de controle (FORJA65_ENV); o port aplica no replay.
        env=env if env is not None else {'FORJA65_SPC_PROFILE':'reference','FORJA65_EXECUTION':'reference'}
        out=['# FORJA65_INPUT_TRACE 1'+(' rom='+rom if rom else '')]+[f'# FORJA65_ENV {k}={v}' for k,v in env.items()]+['# '+h for h in header]; last=None
        for f,m in sorted(s.events):
            if m!=last: out.append(f'frame={f} joy1={m:04x} joy2=0000'); last=m
        open(path,'w').write('\n'.join(out)+'\n')

def checkpoint(e,path):
    import pickle
    pickle.dump({'events':list(e.events),'end':e.frame()},open(path,'wb'))
def resume(path,game='/home/claude/dk/build/game',assets='/home/claude/dk/dkc3/assets'):
    """Cria um RecPort e reaplica as entradas gravadas ate o quadro final salvo."""
    import pickle
    d=pickle.load(open(path,'rb')); ev=d['events']; end=d['end']
    e=RecPort(game=game,assets=assets)
    f=e.frame(); cur=0
    for fr,m in ev:
        if fr>f: PortEmu.run(e,fr-f,cur); f=fr
        cur=m
    if end>f: PortEmu.run(e,end-f,cur)
    e.events=list(ev)
    return e
