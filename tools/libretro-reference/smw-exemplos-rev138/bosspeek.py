import sys,os,json
os.environ.setdefault('FORJA65_OUT','/home/claude/smwrun')
from portnav import *
route,arch=sys.argv[1],sys.argv[2]
a=json.load(open(arch)); k,v=max(a.items(),key=lambda kv:kv[1]['prog'])
e=Rec(game=GAME,assets=ASSETS); e.restore(route)
f=e.frame(); cur=0
for fr,m in v['ev']:
    if fr>f: PortEmu.run(e,fr-f,cur); f=fr
    cur=m
if v['fr']>f: PortEmu.run(e,v['fr']-f,cur)
import itertools
prev=e.ram(0,0x2000)
for t in range(6):
    num=e.ram(0x9e,12); st=e.ram(0x14c8,12); xl=e.ram(0xe4,12); xh=e.ram(0x14e0,12); yl=e.ram(0xd8,12); c2=e.ram(0xc2,12); s1=e.ram(0x1528,12); s2=e.ram(0x1534,12); s3=e.ram(0x1594,12)
    print([ (i,hex(num[i]),st[i],xl[i]|xh[i]<<8,yl[i],c2[i],s1[i],s2[i],s3[i]) for i in range(12) if st[i]])
    e.run(10,0); cur2=e.ram(0,0x2000); ch=[hex(i) for i in range(0x2000) if cur2[i]!=prev[i] and not 0x1c0<=i<0x200]; prev=cur2; print('changed',len(ch),ch[:80]); e.snap(f'boss{t}')
