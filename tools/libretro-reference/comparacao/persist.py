#!/usr/bin/env python3
"""Forja65 REV138 - pos-processa lockstep.log: separa divergencias TRANSITORIAS (progresso/temporizacao, somem sozinhas)
de PERSISTENTES (o mesmo endereco diverge por >= N quadros seguidos). Uso: persist.py lockstep.log [N]"""
import sys,json,collections
path=sys.argv[1]; N=int(sys.argv[2]) if len(sys.argv)>2 else 60
run=collections.defaultdict(int); start={}; persist={}
frames=0; cat_first={}; cat_persist={}
streak=collections.defaultdict(int); sstart={}
for l in open(path):
    d=json.loads(l); f=d['quadro']; frames+=1
    cur=set(a for a in d.get("wram_end",[]) if not (0x100<=a<=0x1FF))  # pilha: lixo abaixo do SP depende do instante da interrupcao
    for a in list(run):
        if a not in cur: run.pop(a); start.pop(a,None)
    for a in cur:
        if a not in run: start[a]=f
        run[a]+=1
        if run[a]==N and a not in persist: persist[a]=start[a]
    for k in ['oam','cgram','vram','framebuffer']:
        if k in d:
            if streak[k]==0: sstart[k]=f
            streak[k]+=1
            if streak[k]==N and k not in cat_persist: cat_persist[k]=sstart[k]
        else: streak[k]=0
print('quadros',frames)
print('WRAM persistente (>= %d quadros seguidos):'%N, len(persist))
for a,f in sorted(persist.items(),key=lambda x:x[1])[:40]: print('  $%05X desde o quadro %d'%(a,f))
print('categorias persistentes:',cat_persist)
