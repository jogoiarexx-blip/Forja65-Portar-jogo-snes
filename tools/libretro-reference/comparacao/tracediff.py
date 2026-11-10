#!/usr/bin/env python3
"""Forja65 REV138 - compara trace por instrucao do port ('cputrace') com o da referencia (Snes9x 'cputrace').
Anda nos dois em paralelo: 1) primeira instrucao divergente (fluxo da CPU); 2) deriva de tempo acumulada e
instrucoes cujo custo difere (por PC e por opcode). Uso: tracediff.py ref.txt port.txt rom.sfc [lo|hi]"""
import sys,collections
ref,port,romp=sys.argv[1],sys.argv[2],sys.argv[3]; hirom=len(sys.argv)>4 and sys.argv[4]=='hi'
rom=open(romp,'rb').read()
def off(a):
    b=(a>>16)&0x7f; lo=a&0xffff
    return ((b&0x3f)<<16|lo) if hirom else (b<<15|(lo&0x7fff))
def op(pc):
    try: return rom[off(pc)] if (pc&0xffff)>=0x8000 or hirom else None
    except IndexError: return None
R=[];P=[]
for l in open(ref):
    p=l.split()
    if len(p)<11: continue
    R.append((int(p[0],16),int(p[9][2:])*1364+int(p[10][2:])))
for l in open(port):
    p=l.split()
    if len(p)<4: continue
    P.append((int(p[0],16),int(p[2])*1364+int(p[3]),int(p[1])))
n=min(len(R),len(P))-1
cost_d=collections.Counter(); cnt=collections.Counter(); per_pc=collections.defaultdict(lambda:[0,0,0])
first_flow=None; t0r=R[0][1]; t0p=P[0][1]
# alinha o inicio (o port pode ja ter contado a instrucao em curso quando parou)
i=j=0
for a in range(0,8):
    for b in range(0,8):
        if all(R[a+k][0]==P[b+k][0] for k in range(16)): i,j=a,b; break
    else: continue
    break
t0r=R[i][1]; t0p=P[j][1]; drift_samples=[]
while i<len(R)-1 and j<len(P)-1:
    if R[i][0]!=P[j][0]:
        first_flow=(i,j,hex(R[i][0]),hex(P[j][0])); break
    rc=R[i+1][1]-R[i][1]; pc_=P[j+1][1]-P[j][1]
    if rc<0: rc+=262*1364
    if pc_<0: pc_+=262*1364
    d=pc_-rc
    if d:
        o=op(R[i][0]); cost_d[o]+=d; cnt[o]+=1; e=per_pc[R[i][0]]; e[0]+=1; e[1]+=d; e[2]=(rc,pc_)
    if i%2000==0: drift_samples.append((i,hex(R[i][0]),(P[j][1]-t0p)-(R[i][1]-t0r)))
    i+=1;j+=1
print('instrucoes comparadas',i,'ref total',len(R),'port total',len(P))
print('1a divergencia de fluxo:',first_flow)
print('deriva (port-ref, ciclos master) ao longo do trace:',drift_samples[-6:])
print('opcodes com custo diferente (opcode: soma da diferenca, ocorrencias):')
for o,v in sorted(cost_d.items(),key=lambda x:-abs(x[1]))[:15]: print('  $%02X'%o if o is not None else '  ?', v, cnt[o])
print('PCs com custo diferente (pc: vezes, soma, ultimo (ref,port)):')
for pc,(k,s,last) in sorted(per_pc.items(),key=lambda x:-abs(x[1][1]))[:20]: print('  %06X'%pc,k,s,last)
