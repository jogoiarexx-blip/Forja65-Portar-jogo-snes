"""Termina a fase (depois do 'done') e espera o mapa estabilizar. Uso: tomap.py entrada.pkl saida.pkl"""
import sys,os
os.environ.setdefault('FORJA65_PORT_GAME','/home/claude/ports/smw-l/build/game'); os.environ.setdefault('FORJA65_PORT_ASSETS','/home/claude/ports/smw-l/assets'); os.environ.setdefault('FORJA65_OUT','/home/claude/smwrun')
from portnav import *
e=Rec(game=GAME,assets=ASSETS); e.restore(sys.argv[1])
for i in range(3000):
    e.run(1,0)
    if e.mode()==0x0E and i>100: break
e.run(400,0); print('mapa',e.frame(),'vidas',e.ram(0xdbe,1)[0],'pos',e.ram(0x1f17,4).hex()); e.snap(os.path.basename(sys.argv[2])); e.dump(sys.argv[2])
