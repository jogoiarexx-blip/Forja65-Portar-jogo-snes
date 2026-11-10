import sys,pickle
sys.path.insert(0,'/home/claude/refemu')
from recport import *
from follow import follow
R=pickle.load(open('/home/claude/refemu/ref_l1rest.pkl','rb'))
def onmap(e): return e.ram(0x4e1,1)[0]==1 and e.ram(0x6d8,1)[0]==1 and e.ram(0x1488,1)[0]==0
e=resume('/home/claude/refemu/port_b2_done.ckpt')
print('b2 feito',e.frame(),e.w16(0x47b),e.w16(0x47f),e.ram(0x5d3,1).hex(),flush=True)
e.run(120,0); e.shot('/tmp/b2_coin0.ppm')
for n,m in [(10,DOWN),(30,RIGHT),(10,RIGHT|B),(20,RIGHT)]: e.run(n,m)
for k in range(900):
    e.run(1,0)
    if e.w16(0x47b)==4688: break
print('volta ao nivel',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
e.shot('/tmp/b2_back.ppm')
checkpoint(e,'/home/claude/refemu/port_b2_back.ckpt')
p=follow(e,R,K=8,D=3,start=3143,end=4300,log=lambda s:print(s,flush=True))
print('fim referencia',e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
for k in range(60):
    if onmap(e): break
    e.run(20,B|RIGHT); e.run(20,RIGHT)
for k in range(400):
    if onmap(e): break
    e.run(5,0)
print('mapa' if onmap(e) else 'SEM MAPA',e.frame(),flush=True)
e.run(240,0); e.shot('/tmp/port_l1_100_map.ppm')
checkpoint(e,'/home/claude/refemu/port_l1_100.ckpt')
e.write_trace('/home/claude/refemu/lakeside-100-port.trace',['Lakeside Limbo 100% gerado no proprio port (REV134 control mode)'])
