#!/bin/bash
# Forja65 REV143 - avaliacao de temporizacao CPU e sincronizacao CPU/APU contra o bsnes (core libretro com sonda
# forja_probe_trace). Para cada ROM: gera o port com o Forja, grava o traco por instrucao dos dois lados desde o
# power-on e mede (a) deriva absoluta instrucao a instrucao, (b) custo por instrucao, (c) esperas de porta APU.
# Roda duas vezes: perfil REV142 (FORJA65_TIMING_PROFILE=rev142) e padrao REV143.
# uso: avaliar-rev143.sh FORJA_DIR REFEMU BSNES_SO PASTA_ROMS SAIDA [instrucoes]
set -u
FORJA=$1; REFEMU=$2; CORE=$3; ROMS=$4; OUT=$5; N=${6:-3000000}
C="$FORJA/tools/libretro-reference/comparacao"
mkdir -p "$OUT"
declare -A INPUT=( [twosong]="run 28 0000;run 3 0080;run 269 0000" )
declare -A REFIN=( [twosong]="run 30 0000\nrun 3 0080\nrun 267 0000" )
for rom in "$ROMS"/*.sfc; do
  name=$(basename "$rom" .sfc)
  ref="$OUT/bsnes-$name.trace"
  if [ ! -s "$ref" ]; then
    printf "cputrace $ref $N\n${REFIN[$name]:-run 300 0000}\nquit\n" | "$REFEMU" "$CORE" "$rom" >/dev/null 2>&1
  fi
  port="$OUT/port-$name"
  if [ ! -x "$port/game" ]; then node "$(dirname "$0")/../../../tools/rev143/buildport.js" "$FORJA/forja65-core.js" "$rom" "$port" >/dev/null 2>&1 || { echo "$name: falha ao gerar port"; continue; }; fi
  for prof in rev142 rev143; do
    tr="$OUT/$prof-$name.trace"; run="$OUT/run-$prof-$name"
    extra=(); [ $prof = rev142 ] && extra=(FORJA65_TIMING_PROFILE=rev142)
    rm -rf "$run"; mkdir -p "$run"; ln -s "$port/assets" "$run/assets"
    ( cd "$run" && printf '%s\nquit\n' "$(echo "${INPUT[$name]:-run 299 0000}" | tr ';' '\n')" | env FORJA65_CONTROL=1 FORJA65_HEADLESS=1 FORJA65_HEADLESS_FRAMES=0 \
      FORJA65_WATCHDOG_INSTRUCTIONS=0 FORJA65_EXECUTION=reference FORJA65_SPC_PROFILE=reference FORJA65_CONTROL_DIR="$run/ctl" \
      FORJA65_CPUTRACE_FILE="$tr" FORJA65_CPUTRACE_COUNT=$N "${extra[@]}" "$port/game" >/dev/null 2>&1 )
    d=$(python3 "$C/driftmap.py" "$tr" "$ref" "$rom" --ignore-refresh --show 0 --n $N 2>&1 | grep -E "pontos|perdido" | tr '\n' ' ')
    w=$(python3 "$C/apuwait.py" "$rom" "$tr" "$ref" 2>&1 | sed -n 2,3p | tr '\n' ' ')
    t=$(python3 "$C/timingdiff.py" "$tr" "$ref" "$rom" 2>&1 | grep -E "comparadas|custo diferente" | tr '\n' ' ')
    echo "$name [$prof] | deriva: $d | custo: $t | APU: $w"
  done
done
