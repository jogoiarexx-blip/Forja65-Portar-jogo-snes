"""Segue uma trajetoria de referencia no port com savestates, compensando quadros de atraso:
a cada bloco de K quadros testa as entradas da referencia deslocadas (-D..+D) e fica com a que deixa
o Kong mais perto da trajetoria (e com mais itens coletados)."""
import math
def follow(e,R,K=8,D=3,start=0,end=None,collected=None,log=None):
    # R: lista de (mask,x,y,c) por quadro da referencia, a partir do estado sincronizado
    p=start; end=end or len(R); steps=0
    pos=lambda: (e.w16(0x47b),e.w16(0x47f))
    while p<end-1:
        sid='fw%d'%steps; e.save(sid); best=None; first=True  # id unico por passo (sem reutilizar o FIFO)
        for d in [0]+[x for k in range(1,D+1) for x in (k,-k)]:
            a=max(0,p+d); b=min(len(R),a+K)
            if a>=b: continue
            if not first: e.load(sid)
            first=False
            for j in range(a,b): e.run(1,R[j][0])
            x,y=pos()
            dist=min(math.hypot(R[q][1]-x,R[q][2]-y) for q in range(max(0,b-4),min(len(R),b+3)))
            sc=(collected() if collected else 0)*1000-dist-abs(d)*0.5
            if best is None or sc>best[0]: best=(sc,d,a,b,dist)
            if dist==0 and d==0: break
        if not (best[1]==0 and best[4]==0):
            e.load(sid)
            for j in range(best[2],best[3]): e.run(1,R[j][0])
        if hasattr(e,'delete'): e.delete(sid)
        p=best[3]; steps+=1
        if log and steps%25==0: log(f'follow p={p}/{end} d={best[1]} dist={best[4]:.1f} pos={pos()}')
    return p
