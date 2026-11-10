#!/bin/bash
# uso: runport.sh PORTDIR RUNDIR "comandos separados por ;" [VAR=valor ...]
port=$1; run=$2; cmds=$3; shift 3
rm -rf "$run"; mkdir -p "$run"; ln -s "$port/assets" "$run/assets"
cd "$run"
printf '%s\n' "$(echo "$cmds" | tr ';' '\n')" | env FORJA65_CONTROL=1 FORJA65_HEADLESS=1 FORJA65_HEADLESS_FRAMES=0 \
  FORJA65_WATCHDOG_INSTRUCTIONS=0 FORJA65_EXECUTION=reference FORJA65_SPC_PROFILE=reference \
  FORJA65_CONTROL_DIR="$run/ctl" "$@" "$port/game"
