#!/usr/bin/env python3
"""Forja65 REV133 - busca automatica de entradas para atravessar uma fase de plataforma (rolagem para a direita).

Usa savestates do emulador de referencia (refemu + core libretro). A cada passo testa um conjunto de acoes
curtas (correr, pular, nadar...), avalia cada uma com uma continuacao de ~120 quadros e escolhe a que mais
avanca no eixo X sem morrer e sem afundar (penalidade por Y abaixo do chao). Se empacar, volta 20 passos e
proibe a acao escolhida la. Grava o log de entradas (quadros mascara) para virar um FORJA65_INPUT_TRACE.

Exemplo (DKC3 Lakeside Limbo, Kong lider: X=$047B, Y=$047F na WRAM):
  python stage-search.py --state inicio_fase.state --x 0x47b --y 0x47f --ground 570 --steps 500 --log fase.log
"""
import argparse, random, time
from emu import *
ap=argparse.ArgumentParser()
ap.add_argument('--state',required=True); ap.add_argument('--x',type=lambda v:int(v,0),required=True)
ap.add_argument('--y',type=lambda v:int(v,0),required=True); ap.add_argument('--ground',type=int,default=570)
ap.add_argument('--steps',type=int,default=500); ap.add_argument('--seed',type=int,default=1)
ap.add_argument('--log',default='stage-search.log'); ap.add_argument('--end-state',default='stage-search-end.state')
a=ap.parse_args(); random.seed(a.seed)
e=Emu(); e.loadfile(a.state)
X_=lambda:e.w16(a.x); Y_=lambda:e.w16(a.y)
R_=RIGHT
ACTS={'run':[(16,R_|Y)],'walk':[(16,R_)],'jump':[(14,R_|Y|B),(2,R_|Y)],'hop':[(5,R_|Y|B),(11,R_|Y)],
 'longjump':[(24,R_|Y|B),(4,R_|Y)],'jumpw':[(14,R_|B),(2,R_)],'wait':[(16,0)],'wjump':[(14,B),(2,0)],
 'back':[(16,LEFT)],'backjump':[(14,LEFT|B),(2,LEFT)],'swim':[(3,R_|B),(5,R_),(3,R_|B),(5,R_)],
 'swimup':[(3,B),(5,0),(3,B),(5,0)],'up':[(16,UP|R_)]}
score=lambda:X_()-3*max(0,Y_()-a.ground)
def evaluate(name):
    e.load('cur'); x0=X_()
    for n,m in ACTS[name]: e.run(n,m)
    vals=[];xs=[]
    for k in range(10): e.run(12,R_|Y); xs.append(X_()); vals.append(score())
    dead=any(xs[i+1]<xs[i]-150 for i in range(len(xs)-1)) or xs[-1]<x0-150
    return (-100000 if dead else 0)+max(vals)*0.3+vals[-1]*0.7
hist=[];log=[];best=-1;bestStep=0;banned={};t=time.time()
for step in range(a.steps):
    slot=f"h{len(hist)}"; e.save(slot); e.save('cur'); hist.append((slot,len(log)))
    sc={k:evaluate(k)+random.uniform(0,25) for k in ACTS if k not in banned.get(len(hist)-1,set())}
    act=max(sc,key=sc.get); e.load('cur')
    for n,m in ACTS[act]: e.run(n,m); log.append((n,m))
    hist[-1]=hist[-1]+(act,)
    s=score()
    if s>best+8: best=s; bestStep=step
    if step-bestStep>18 and len(hist)>25:
        k=len(hist)-21; slot,ll,old=hist[k]; banned.setdefault(k,set()).add(old)
        hist=hist[:k]; log=log[:ll]; e.load(slot); bestStep=step; best=-1
    if step%20==0: print(step,e.frame(),'x',X_(),'y',Y_(),act,round(time.time()-t),flush=True)
with open(a.log,'w') as f:
    for n,m in log: f.write(f"{n} {m:04x}\n")
e.savefile(a.end_state); print('fim',e.frame(),X_(),Y_())
