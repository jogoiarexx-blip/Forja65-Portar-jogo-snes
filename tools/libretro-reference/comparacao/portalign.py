import sys,os
sys.path.insert(0,'/home/claude/cmp')
from portemu import PortEmu
import lockstep_lib as L
ev,env=L.read_trace(os.environ['TRACE']); F0,F1=int(sys.argv[1]),int(sys.argv[2])
G='/home/claude/ports/smw-l/build-spc/game';A='/home/claude/ports/smw-l/assets'
def rec(extra):
    p=PortEmu(game=G,assets=A,extra_env={**env,**extra}); f=p.frame()
    class D:
        def run(s,n,m):pass
    L.advance(D(),p,ev,f,F0); f=F0; out=[]
    while f<F1:
        b=p.ram(0,0x200); out.append((b[0x100],b[0x13],b[0x94]|b[0x95]<<8,b[0x96]|b[0x97]<<8)); L.advance(D(),p,ev,f,f+1); f+=1
    return out,p.frame()
a,fa=rec({}); ev0=ev
if os.environ.get('TRACE2'): ev,_=L.read_trace(os.environ['TRACE2'])
b,fb=rec({'FORJA65_CONTROL_AT':'vblank'})
ev=ev0
print('frames',fa,fb)
for k in range(-3,4):
    m=sum(1 for i in range(len(a)) if 0<=i+k<len(b) and a[i]==b[i+k]); print('k',k,'iguais',m,'de',len(a))
print('rec',a[100:106]); print('vbl',b[100:106])
for i in range(len(a)):
    if a[i]!=b[i]:
        print('1a diferenca no quadro',21500+i if False else int(sys.argv[1])+i, a[i-2:i+4], b[i-2:i+4]); print('joy', [hex(L.mask_at(ev,int(sys.argv[1])+j)) for j in range(i-3,i+4)]); break
