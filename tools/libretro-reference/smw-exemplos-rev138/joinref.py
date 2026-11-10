"""Junta rota do port (pkl) + resultado da busca na referencia (done.json) -> pkl continuo para o port."""
import sys,json,pickle
a=pickle.load(open(sys.argv[1],'rb')); d=json.load(open(sys.argv[2]))
ev=list(a['ev'])+[tuple(x) for x in d['ev_port']]
pickle.dump({'ev':ev,'end':d['fim_r']-1},open(sys.argv[3],'wb')); print('fim (quadro do port)',d['fim_r']-1,len(ev))
