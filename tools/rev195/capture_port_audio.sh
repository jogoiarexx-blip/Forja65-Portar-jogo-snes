#!/bin/bash
# Forja65 REV195 - grava o audio de um port em modo de controle (sem janela).
# uso: capture_port_audio.sh PORT_DIR QUADROS SAIDA.wav [VAR=valor ...]
# Referencia: printf 'audio ref.raw\nrun QUADROS 0000\nquit\n' | refemu snes9x_libretro.so ROM.sfc   (PCM 32040 Hz)
# Comparacao: python3 tools/rev195/audio_compare.py ref.raw 32040 SAIDA.wav 32040 QUADROS
port=$(cd "$1" && pwd); frames=$2; out=$(cd "$(dirname "$3")" && pwd)/$(basename "$3"); shift 3
run=$(mktemp -d); ln -s "$port/assets" "$run/assets"
(cd "$run" && printf "run $frames 0000\nquit\n" | env FORJA65_AUDIO_DUMP=1 FORJA65_CONTROL=1 FORJA65_HEADLESS=1 FORJA65_HEADLESS_FRAMES=0 FORJA65_WATCHDOG_INSTRUCTIONS=0 FORJA65_CONTROL_DIR="$run/ctl" "$@" "$port/game" > out.txt 2>&1; cp forja65-native-audio.wav "$out"; tail -1 out.txt)
rm -rf "$run"
