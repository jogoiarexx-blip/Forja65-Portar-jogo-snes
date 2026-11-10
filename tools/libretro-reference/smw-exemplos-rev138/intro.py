import sys,os
os.environ.setdefault('FORJA65_PORT_GAME','/home/claude/ports/smw-l/build/game'); os.environ.setdefault('FORJA65_PORT_ASSETS','/home/claude/ports/smw-l/assets'); os.environ.setdefault('FORJA65_OUT','/home/claude/smwrun')
from portnav import *
e=Rec(game=GAME,assets=ASSETS)
e.until_mode(7); e.run(30,0); e.run(4,START); e.run(60,0); e.run(4,B); e.run(40,0); e.run(4,B); e.run(40,0)
e.until_mode(0x14); e.run(800,0); e.run(4,B)
e.until_mode(0x0E); e.run(90,0); e.run(4,LEFT); e.run(150,0)
e.run(4,B); e.until_mode(0x14); e.run(20,0)
print('fase',hex(e.ram(0x13bf,1)[0]),'quadro',e.frame()); e.dump('yi1_start.pkl')
