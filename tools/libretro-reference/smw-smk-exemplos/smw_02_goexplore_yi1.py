"""SMW: Go-Explore no proprio port ate tocar a fita de chegada ($1493 != 0). Celulas: X/24, Y/32, poder, Yoshi.
Descarta caminho com morte ($71 == 9), vida perdida ($0DBE) ou saida da fase. Na REV137 achou a meta em 2252 iteracoes."""
from portnav import *
from ge import go_explore
import sys
e=Rec(game=GAME,assets=ASSETS); e.restore('yi1_start.pkl')
R_,L_=RIGHT,LEFT
M={'r':[(16,R_|Y)],'w':[(16,R_)],'j':[(18,R_|Y|B),(4,R_|Y)],'hj':[(30,R_|Y|B),(4,R_|Y)],'sj':[(6,R_|A),(14,R_)],
   'nj':[(18,B),(4,0)],'st':[(16,0)],'l':[(16,L_)],'lj':[(18,L_|B),(4,L_)],'d':[(16,DOWN)],'rr':[(40,R_|Y)],'jj':[(10,R_|Y|B),(4,R_|Y),(10,R_|Y|B),(4,R_|Y)]}
lives0=e.ram(0xdbe,1)[0]
X=lambda:e.w16(0x94); Yp=lambda:e.w16(0x96)
dead=lambda: e.ram(0x71,1)[0]==9 or e.ram(0xdbe,1)[0]!=lives0 or e.mode()!=0x14
done=lambda: e.ram(0x1493,1)[0]!=0
cell=lambda: (X()//24,min(Yp(),600)//32,e.ram(0x19,1)[0],e.ram(0x187a,1)[0])
ok=go_explore(e,M,cell,X,dead,done,maxit=int(sys.argv[1]) if len(sys.argv)>1 else 3000)
print('ok',ok,e.frame()); e.dump('yi1_goal.pkl')
# termina a fase e volta ao mapa (caminho novo revelado)
for i in range(1500):
    e.run(1,0)
    if e.mode()==0x0E and i>200: break
e.run(420,0); e.snap('yi1_mapa'); e.dump('yi1_done.pkl')
e.write_trace('smw_yi1.trace',['Super Mario World: power-on -> Yoshi Island 1 concluida -> mapa'])
