"""SMK: grava a trajetoria dos karts da CPU (structs em $1000+i*$100: X +$18, Y +$1C, checkpoint +$C0, volta +$C1)."""
from portnav import *
import pickle
e=Rec(game=GAME,assets=ASSETS); e.restore('smk_race.pkl')
paths={}
for i in range(2400):
    e.run(2,B); r=e.ram(0x1000,0x800)
    for k in range(1,8):
        b=k*0x100; paths.setdefault(k,[]).append((e.frame(),r[b+0x18]|r[b+0x19]<<8,r[b+0x1c]|r[b+0x1d]<<8,r[b+0xc1],r[b+0xc0]))
pickle.dump(paths,open('ai_paths.pkl','wb'))
