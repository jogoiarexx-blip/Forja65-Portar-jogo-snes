import sys
sys.path.insert(0,'/home/claude/refemu')
from recport import *
e=resume('/home/claude/refemu/port_cave_in.ckpt')
e.run(375,0); e.run(4,Y); e.run(30,0); e.run(4,B); e.run(30,0); e.run(4,Y); e.run(30,0); e.run(4,X); e.run(800,0)
print('passaro',e.ram(0x5cd,1)[0],e.frame(),e.w16(0x47b),e.w16(0x47f),flush=True)
checkpoint(e,'/home/claude/refemu/port_after_cave.ckpt')
e2=resume('/home/claude/refemu/port_after_cave.ckpt')
print('verificado no replay:',e2.ram(0x5cd,1)[0],e2.frame())
