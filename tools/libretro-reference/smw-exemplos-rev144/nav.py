"""nav.py entrada.pkl saida.pkl acoes...  acoes: w<n> (espera n), L/R/U/D (aperta 4 quadros), B (entra), shot:nome"""
import sys,os
os.environ.setdefault('FORJA65_PORT_GAME','/home/claude/ports/smw-l/build/game'); os.environ.setdefault('FORJA65_PORT_ASSETS','/home/claude/ports/smw-l/assets'); os.environ.setdefault('FORJA65_OUT','/home/claude/smwrun')
from portnav import *
e=Rec(game=GAME,assets=ASSETS); e.restore(sys.argv[1])
K={'L':LEFT,'R':RIGHT,'U':UP,'D':DOWN,'B':B,'A':A,'S':START,'X':X,'Y':Y}
for a in sys.argv[3:]:
    if a.startswith('w'): e.run(int(a[1:]),0)
    elif a.startswith('shot:'): e.snap(a[5:])
    elif a=='lvl': 
        e.until_mode(0x14,3000); e.run(20,0)
    else: e.run(4,K[a]); 
print('quadro',e.frame(),'modo',hex(e.mode()),'pos',e.ram(0x1f17,4).hex(),'nivel',hex(e.ram(0x13bf,1)[0]),'vidas',e.ram(0xdbe,1)[0])
e.dump(sys.argv[2])
