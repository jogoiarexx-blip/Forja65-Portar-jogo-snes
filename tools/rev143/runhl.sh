#!/bin/bash
# uso: runhl.sh PORTDIR RUNDIR FRAMES [VAR=valor ...]   (headless, relatorios QA no fim)
port=$1; run=$2; frames=$3; shift 3
rm -rf "$run"; mkdir -p "$run"; ln -s "$port/assets" "$run/assets"
cd "$run"
env FORJA65_HEADLESS=1 FORJA65_HEADLESS_FRAMES=$frames FORJA65_WATCHDOG_INSTRUCTIONS=0 FORJA65_EXECUTION=reference FORJA65_SPC_PROFILE=reference "$@" "$port/game" > run.log 2>&1
echo "rc=$?"
