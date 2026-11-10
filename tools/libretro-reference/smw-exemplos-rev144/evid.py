import os,sys
os.environ.setdefault('FORJA65_PORT_ASSETS','/home/claude/ports/smw-l/assets'); os.environ['FORJA65_OUT']='/home/claude/smwrun/evid14'
from portnav import *
import pickle
d=pickle.load(open('dp1_map.pkl','rb'))
shots=[(2100,'00-yi1-inicio'),(5383,'01-yi1-fita'),(11015,'02-yi2-fita'),(16242,'03-yi3-fita'),(20264,'04-yi4-fita'),(21727,'05-castelo1-entrada'),(23600,'06-castelo1-pilares'),(25400,'07-iggy-luta'),(25985,'08-iggy-caindo-na-lava'),(26100,'09-iggy-derrotado'),(26750,'10-castelo-destruido'),(29500,'11-mensagem-iggy'),(31123,'12-dp1-inicio'),(35252,'13-dp1-fita'),(36354,'14-mapa-apos-dp1')]
e=PortEmu(game=GAME,assets=ASSETS); f=e.frame(); cur=0; ev=sorted(d['ev']); i=0
for F,name in shots:
    while i<len(ev) and ev[i][0]<=F:
        fr,m=ev[i]
        if fr>f: e.run(fr-f,cur); f=fr
        cur=m; i+=1
    if F>f: e.run(F-f,cur); f=F
    e.shot(f'/home/claude/smwrun/evid14/{name}-q{F}.ppm'); Image.open(f'/home/claude/smwrun/evid14/{name}-q{F}.ppm').save(f'/home/claude/smwrun/evid14/{name}-q{F}.png'); os.remove(f'/home/claude/smwrun/evid14/{name}-q{F}.ppm')
    print(F,name,hex(e.ram(0x100,1)[0]),flush=True)
