"""SMW: liga o console, File A, 1 jogador, intro, mapa, entra na Yoshi's Island 1 (caminho da esquerda).
Grava yi1_start.pkl. RAM: $0100 modo de jogo (07 titulo, 0E mapa, 14 fase), $1F17 X no mapa."""
from portnav import *
e=Rec(game=GAME,assets=ASSETS)
e.until_mode(7); e.run(30,0); e.run(4,START); e.run(60,0); e.run(4,B); e.run(40,0); e.run(4,B); e.run(40,0)
e.until_mode(0x14); e.run(800,0); e.run(4,B)          # mensagem de abertura (so fecha depois de ~740 quadros)
e.until_mode(0x0E); e.run(90,0); e.run(4,LEFT); e.run(150,0)
e.run(4,B); e.until_mode(0x14); e.run(20,0)
print('fase',hex(e.ram(0x13bf,1)[0]),'quadro',e.frame()); e.dump('yi1_start.pkl')
