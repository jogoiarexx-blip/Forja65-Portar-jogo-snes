#!/bin/bash
# pipeline.sh mapa.pkl nome "acoes de navegacao"   -> nome_start.pkl, busca na referencia, nome_goal.pkl, nome_map.pkl
set -e
cd /home/claude/smwrun
MAP=$1; N=$2; shift 2
if [ ! -f ${N}_start.pkl ]; then python3 nav.py $MAP ${N}_start.pkl $@ B lvl shot:${N}s; fi
F=$(python3 -c "import pickle;print(pickle.load(open('${N}_start.pkl','rb'))['end'])")
python3 mktrace.py ${N}_start.pkl ${N}_start.trace "ate o inicio de $N" > /dev/null
if [ ! -f ${N}ref/done.json ]; then python3 geref.py ${N}_start.trace $F /home/claude/smwrun/${N}ref 40000; fi
[ -f ${N}ref/done.json ] || { echo "SEM_FIM $N"; exit 3; }
python3 joinref.py ${N}_start.pkl ${N}ref/done.json ${N}_goal.pkl
python3 tomap.py ${N}_goal.pkl ${N}_map.pkl
echo "PRONTO $N"
