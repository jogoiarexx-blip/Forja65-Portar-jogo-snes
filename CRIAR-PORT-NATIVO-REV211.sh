#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ "$#" -ne 2 ]; then
  echo 'Use: ./CRIAR-PORT-NATIVO-REV211.sh jogo.sfc /pasta/do/port' >&2
  exit 2
fi
python3 tools/rev211_native_workflow.py --rom "$1" --port "$2" --frames 600 --hash-every 60 --package
