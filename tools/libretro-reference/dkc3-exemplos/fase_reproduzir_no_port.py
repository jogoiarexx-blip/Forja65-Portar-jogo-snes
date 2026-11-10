import sys,pickle,os
sys.path.insert(0,'/home/claude/refemu')
from recport import *
# reproduz a referencia sem savestates (quando o follow ja mostrou desvio 0) e confere no fim
R=pickle.load(open(sys.argv[2],'rb')); flag=int(sys.argv[3],16)
e=resume(sys.argv[1],game=os.environ.get('GAME','/home/claude/dk/build/game')); print('inicio',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
i=0; maxd=0
while i<len(R):
    j=i
    while j<len(R) and R[j][0]==R[i][0] and j-i<256: j+=1
    e.run(j-i,R[i][0]); x,y=e.w16(0x47b),e.w16(0x47f); d=abs(x-R[j-1][1])+abs(y-R[j-1][2]); maxd=max(maxd,d)
    if (i//2000)!=(j//2000): print('p',j,'pos',(x,y),'ref',R[j-1][1:3],'desvio',d,flush=True)
    i=j
print('fim',e.frame(),e.w16(0x47b),e.w16(0x47f),'flag',hex(e.ram(flag,1)[0]),'vidas',e.ram(0x5d5,1)[0],'desvio max',maxd,flush=True)
checkpoint(e,sys.argv[4]); e.shot('/tmp/'+sys.argv[4].split('/')[-1]+'.ppm')
