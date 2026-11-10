import sys,os,json,pickle
os.environ.setdefault('FORJA65_OUT','/home/claude/smwrun')
from portnav import *
route,arch,n=sys.argv[1],sys.argv[2],int(sys.argv[3]) if len(sys.argv)>3 else 1
base=pickle.load(open(route,'rb')); a=json.load(open(arch))
items=sorted(a.items(),key=lambda kv:-kv[1]['prog'])[:n]
e=Rec(game=GAME,assets=ASSETS); e.restore(route); e.save('b')
for i,(k,v) in enumerate(items):
    e.load('b'); f=e.frame(); cur=0
    for fr,m in v['ev']:
        if fr>f: PortEmu.run(e,fr-f,cur); f=fr
        cur=m
    if v['fr']>f: PortEmu.run(e,v['fr']-f,cur)
    print(i,k,v['prog'],'x',e.w16(0x94),'y',e.w16(0x96),'sub',e.ram(0x141a,1)[0],flush=True); e.snap(f'peek{i}')
