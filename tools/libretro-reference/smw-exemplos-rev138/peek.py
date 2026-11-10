import sys,os
os.environ.setdefault('FORJA65_PORT_GAME','/home/claude/ports/smw-l/build/game'); os.environ.setdefault('FORJA65_PORT_ASSETS','/home/claude/ports/smw-l/assets'); os.environ.setdefault('FORJA65_OUT','/home/claude/smwrun')
from portnav import *
e=Rec(game=GAME,assets=ASSETS); e.restore(sys.argv[1])
print('telas $5E',e.ram(0x5e,1)[0],'x',e.w16(0x94),'y',e.w16(0x96),'vertical $5B',e.ram(0x5b,1)[0])
