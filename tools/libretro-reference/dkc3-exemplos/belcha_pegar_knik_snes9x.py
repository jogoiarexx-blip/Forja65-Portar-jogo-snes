"""Belcha's Barn (Snes9x): receita achada para virar, pegar e arremessar o Knik-Knak.
Estado de partida: Kong caindo sobre o Knik-Knak recem-saido do barril (l6_knik.state).
Tipos de objeto (bslots.py): '27d2' Knik-Knak, 'b5cc' corpo do Belcha, '24d4' dentes (abertura da boca)."""
from bslots import *
e=Emu(); e.loadfile('l6_knik.state')
e.run(16,0)        # cai sobre o Knik-Knak: ele vira
e.run(16,LEFT)     # afasta durante o quique (senao o Kong cai de novo em cima)
e.run(24,0)        # aterrissa ao lado
e.run(6,Y)         # pega (segurar Y para carregar)
e.run(40,Y|RIGHT)  # carrega em direcao ao Belcha
e.run(3,Y|RIGHT); e.run(6,RIGHT)  # solta Y = arremessa
for i in range(30):
    e.run(5,0); print([(t,x,y) for k,t,x,y in slots(e) if t in ('27d2','b5cc')], 'belcha x', e.w16(0x966))
# Falta: chegar dentro da boca ABERTA (dentes afastados) - ainda nao encontrado.
