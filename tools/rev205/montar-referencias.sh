#!/usr/bin/env bash
# Forja65 REV205 - monta as referencias independentes (codigo aberto, commits fixos, nada de binario no pacote):
#   bsnes-libretro 05439f96121d2b9d7ad7a5fc1f29d7eebdcc8c43 + bsnes-sonda-rev205.patch  (arbitro exato, GPLv3)
#   snes9x         fae2fea08f74180759ef540ee94259213f503480 + snes9x-sondas-forja.patch (segunda opiniao)
#   refemu (host libretro minimo do Forja) e libretro.h (MIT)
# Uso: tools/rev205/montar-referencias.sh PASTA   -> PASTA/refemu, PASTA/bsnes_libretro.so, PASTA/snes9x_libretro.so
# Linux ou MSYS2/MinGW no Windows (no Windows os cores saem como .dll).
set -euo pipefail
out="$(mkdir -p "${1:-referencias}" && cd "${1:-referencias}" && pwd)"
here="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cmp="$here/../libretro-reference/comparacao"
jobs="${JOBS:-$(nproc 2>/dev/null || echo 2)}"
ext=so; [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* ]] && ext=dll
src="$out/src"; mkdir -p "$src"
if [[ ! -d "$src/bsnes-libretro" ]]; then git clone https://github.com/libretro/bsnes-libretro.git "$src/bsnes-libretro"; fi
git -C "$src/bsnes-libretro" checkout -q -f 05439f96121d2b9d7ad7a5fc1f29d7eebdcc8c43
git -C "$src/bsnes-libretro" apply "$cmp/bsnes-sonda-rev205.patch"
make -C "$src/bsnes-libretro/bsnes" -j"$jobs" target=libretro binary=library
cp "$src/bsnes-libretro/bsnes/out/bsnes_libretro.$ext" "$out/"
if [[ ! -d "$src/snes9x" ]]; then git clone https://github.com/libretro/snes9x.git "$src/snes9x"; fi
git -C "$src/snes9x" checkout -q -f fae2fea08f74180759ef540ee94259213f503480
git -C "$src/snes9x" apply "$cmp/snes9x-sondas-forja.patch"
make -C "$src/snes9x/libretro" -j"$jobs"
cp "$src/snes9x/libretro/snes9x_libretro.$ext" "$out/"
exe=refemu; [[ $ext == dll ]] && exe=refemu.exe
ldl=-ldl; [[ $ext == dll ]] && ldl=
g++ -O2 -std=c++17 -I"$src/snes9x/libretro" "$here/../libretro-reference/refemu.cpp" -o "$out/$exe" $ldl
cat > "$out/referencias.env" <<EOF
# opcoes do bsnes para comparar pixel a pixel (gama 1.0, sem aleatoriedade, PPU exato)
FORJA_REFEMU_VARS=bsnes_video_gamma=100,bsnes_video_luminance=100,bsnes_video_saturation=100,bsnes_entropy=None,bsnes_ppu_fast=OFF,bsnes_blur_emulation=OFF,bsnes_dsp_fast=OFF
EOF
echo "REFERENCIAS_PRONTAS $out"
