import sys,pickle
sys.path.insert(0,'/home/claude/refemu')
from recport import *
# uso: port_entry.py entrada.ckpt saida.ckpt passos...  (mesma linguagem do build_entry.py)
e=resume(sys.argv[1])
mpos=lambda:(e.w16(0x8f8),e.w16(0x8fc)); node=lambda:e.ram(0x5e7,1)[0]
D={'U':UP,'D':DOWN,'L':LEFT,'R':RIGHT,'B':B,'0':0}
for st in sys.argv[3:]:
    p=st.split(':')
    if p[0]=='swim':
        tx,ty=map(int,p[1].split(','))
        for k in range(400):
            x,y=mpos(); m=0
            if node()!=0: break
            if x<tx-2: m|=RIGHT
            elif x>tx+2: m|=LEFT
            if y<ty-2: m|=DOWN
            elif y>ty+2: m|=UP
            if not m: break
            e.run(4,m)
    elif p[0]=='P': e.run(int(p[2]),D[p[1]])
    elif p[0]=='W': e.run(int(p[1]),0)
    print(st,'->',node(),mpos(),e.frame(),flush=True)
print('fase',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
checkpoint(e,sys.argv[2])
