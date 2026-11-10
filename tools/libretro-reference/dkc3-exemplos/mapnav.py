from emu import *
def mpos(e): return e.w16(0x8f8),e.w16(0x8fc)
def swim(e,tx,ty,maxf=1200,tol=2):
    for k in range(maxf//4):
        x,y=mpos(e); m=0
        if x<tx-tol: m|=RIGHT
        elif x>tx+tol: m|=LEFT
        if y<ty-tol: m|=DOWN
        elif y>ty+tol: m|=UP
        if not m: return True
        e.run(4,m)
    return False
