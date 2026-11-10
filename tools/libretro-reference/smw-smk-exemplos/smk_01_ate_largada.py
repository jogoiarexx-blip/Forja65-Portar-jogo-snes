"""SMK: titulo -> 1P GAME -> MARIOKART GP -> 50cc -> OK -> Mario -> OK -> Mushroom Cup -> Mario Circuit 1.
No port o cursor do primeiro menu comeca em 2P (WRAM/SRAM zeradas); no Snes9x comeca em 1P: por isso o UP."""
from portnav import *
e=Rec(game=GAME,assets=ASSETS)
e.run(300,0); e.run(4,B); e.run(90,0); e.run(4,UP); e.run(60,0)
for i in range(3): e.run(4,B); e.run(90,0)
e.run(4,B); e.run(150,0); e.run(4,B); e.run(150,0); e.run(4,B); e.run(150,0)
e.run(4,B); e.run(150,0); e.run(4,B); e.run(200,0); e.run(300,0)
print('quadro',e.frame()); e.dump('smk_race.pkl')
