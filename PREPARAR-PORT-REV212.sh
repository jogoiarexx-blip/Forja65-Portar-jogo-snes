#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ "$#" -lt 2 ]; then
 echo 'Uso: ./PREPARAR-PORT-REV212.sh jogo.sfc pasta-plano [auto|smw|dkc2|dkc3|zelda3|generic]' >&2
 exit 2
fi
exec python3 "$ROOT/tools/rev212_port_kit.py" --rom "$1" --out "$2" --game "${3:-auto}"
