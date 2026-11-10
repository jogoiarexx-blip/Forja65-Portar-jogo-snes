"""SMK: piloto por perseguicao pura (pure pursuit) seguindo a trajetoria do kart 7 da CPU na 2a volta.
Direcao do kart: +$2A (16 bits, 0 = norte, cresce no sentido horario). Uso: python smk_03_perseguicao.py 20 6
(antecipacao 20 pontos, zona morta 6 graus): 1o lugar, 1:33.35 no port REV137."""
from portnav import *
import math,pickle,sys,time
paths=pickle.load(open('ai_paths.pkl','rb'))
P=[(x,y) for f,x,y,lap,cp in paths[7] if lap==129]; N=len(P)
def run(e,LOOK=int(sys.argv[1]) if len(sys.argv)>1 else 10,TH=int(sys.argv[2]) if len(sys.argv)>2 else 6,frames=12000,log=None):
    idx=None; t=time.time()
    while e.frame()<frames:
        r=e.ram(0x1000,0x100)
        x=r[0x18]|r[0x19]<<8; y=r[0x1c]|r[0x1d]<<8; h=r[0x2a]|r[0x2b]<<8; lap=r[0xc1]-128
        if lap>=5: return True
        cand=range(N) if idx is None else [(idx+k)%N for k in range(-5,40)]
        idx=min(cand,key=lambda i:(P[i][0]-x)**2+(P[i][1]-y)**2)
        tx,ty=P[(idx+LOOK)%N]
        want=math.degrees(math.atan2(ty-y,tx-x)); cur=-90+h*360/65536
        d=(want-cur+180)%360-180
        m=B|(RIGHT if d>TH else LEFT if d<-TH else 0)
        e.run(2,m)
        if log and e.frame()%600<2: log(e.frame(),'lap',lap,'cp',r[0xc0],'idx',idx,round(time.time()-t))
    return False
if __name__=='__main__':
    e=Rec(game=GAME,assets=ASSETS); e.restore('smk_race.pkl')
    ok=run(e,log=print); print('ok',ok,e.frame()); e.dump('smk_pp_end.pkl'); e.snap('smk_pp_end')
    for i in range(6): e.run(150,0)
    e.snap('smk_resultado'); e.write_trace('smk_mario_circuit1.trace',['Super Mario Kart: power-on -> Mario Circuit 1 (5 voltas) -> resultados'])
