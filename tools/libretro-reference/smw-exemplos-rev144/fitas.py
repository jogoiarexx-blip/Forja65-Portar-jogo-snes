import os,pickle
os.environ.setdefault('FORJA65_PORT_ASSETS','/home/claude/ports/smw-l/assets')
from portnav import *
d=pickle.load(open('dp1_map.pkl','rb')); ev=sorted(d['ev'])
e=PortEmu(game=GAME,assets=ASSETS); f=e.frame(); cur=0; i=0; prev=0; prevm=None
while f<d['end']:
    while i<len(ev) and ev[i][0]<=f: cur=ev[i][1]; i+=1
    nxt=ev[i][0] if i<len(ev) else d['end']
    n=1 if True else 1
    e.run(1,cur); f+=1
    g=e.ram(0x1493,1)[0]; m=e.ram(0x100,1)[0]
    if g and not prev: print('fita',f,'nivel',hex(e.ram(0x13bf,1)[0]),flush=True)
    if m in (0x18,0x1a) and prevm not in (0x18,0x1a): print('modo',hex(m),f,flush=True)
    prev=g; prevm=m
