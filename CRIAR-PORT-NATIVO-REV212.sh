#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "$#" -lt 2 ]; then
 echo 'Uso: ./CRIAR-PORT-NATIVO-REV212.sh jogo.sfc pasta-port [plano/rotas.json]' >&2
 exit 2
fi
if [ "$#" -ge 3 ]; then
 exec python3 "$ROOT/tools/rev211_native_workflow.py" --rom "$1" --port "$2" --contract "$3" --max-iter 8
fi
exec python3 "$ROOT/tools/rev211_native_workflow.py" --rom "$1" --port "$2" --frames 600 --hash-every 60 --max-iter 8
