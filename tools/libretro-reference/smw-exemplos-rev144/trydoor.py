import sys,os,json,pickle
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
print('antes 10B',hex(e.w16(0x10b)));e.save('s')
for name,seq in [('up',[(30,UP)]),('rightup',[(20,RIGHT),(30,UP)]),('leftup',[(10,LEFT),(30,UP)]),('stand',[(20,0),(30,UP)]),('r40',[(40,RIGHT|Y),(20,0)])]:
    e.load('s')
    for n,m in seq: e.run(n,m)
    for i in range(60): e.run(1,0)
    print(name,'10B',hex(e.w16(0x10b)),'x',e.w16(0x94),'y',e.w16(0x96),'sub',e.ram(0x141a,1)[0],'mode',hex(e.mode()),'71',e.ram(0x71,1)[0],flush=True); e.snap('door_'+name)
