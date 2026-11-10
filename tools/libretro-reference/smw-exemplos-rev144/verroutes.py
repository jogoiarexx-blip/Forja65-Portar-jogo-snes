import os
os.environ.setdefault('FORJA65_PORT_ASSETS','/home/claude/ports/smw-l/assets');os.environ.setdefault('FORJA65_OUT','/home/claude/smwrun')
from portnav import *
for p in ['yi1_goal.pkl','yi2_goal.pkl','yi3_goal.pkl','yi4f','c1q','dp1p','dp2p','ghp']:
    e=Rec(game=GAME,assets=ASSETS); e.restore(p)
    print(p,'frame',e.frame(),'mode',hex(e.mode()),'1493',e.ram(0x1493,1)[0],'71',e.ram(0x71,1)[0],'lives',e.ram(0xdbe,1)[0],flush=True)
    e.p.kill()
