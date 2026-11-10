import pickle,sys
from mapnav import *
# uso: build_entry.py inicio.state saida.state passos...   passos: swim:x,y | node:N (espera) | P:DIR:n | W:n | B
e=Emu(); e.loadfile(sys.argv[1]); R=[]
D={'U':UP,'D':DOWN,'L':LEFT,'R':RIGHT,'B':B,'0':0}
def run(n,m):
    for k in range(n): e.run(1,m); R.append(m)
for st in sys.argv[3:]:
    p=st.split(':')
    if p[0]=='swim':
        tx,ty=map(int,p[1].split(','))
        for k in range(400):
            x,y=mpos(e); m=0
            if e.ram(0x5e7,1)[0]!=0: break
            if x<tx-2: m|=RIGHT
            elif x>tx+2: m|=LEFT
            if y<ty-2: m|=DOWN
            elif y>ty+2: m|=UP
            if not m: break
            run(4,m)
    elif p[0]=='P': run(int(p[2]),D[p[1]])
    elif p[0]=='W': run(int(p[1]),0)
    print(st,'->',e.ram(0x5e7,1)[0],mpos(e),flush=True)
print('fase',e.frame(),e.w16(0x47b),e.w16(0x47f))
e.savefile(sys.argv[2]); pickle.dump(R,open(sys.argv[2]+'.masks.pkl','wb')); e.shot('/tmp/entry.ppm')
