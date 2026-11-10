#!/usr/bin/env python3
"""Forja65 REV205 - monta o corpus de conformidade a partir de repositorios de codigo aberto.

Os repositorios nao vem no pacote: este script os clona em commits fixos (ou usa uma pasta ja clonada),
compila o que precisa de compilacao e grava corpus.json com as ROMs e as areas que cada uma exercita.

  python3 make-corpus.py --out PASTA [--peterlemon CLONE] [--undisbeliever CLONE] [--forja-tests PASTA]

Fontes (commits fixos):
  PeterLemon/SNES (krom)               350b394e86ec5d62f600b5cbf64cdce3721bb6ef  binarios ja incluidos
  undisbeliever/snes-test-roms (zlib)  ac6ef8006809c0ff5dabc8ff137a4623967697fe  compila com bass-untech (make)
  Forja65 REV205 OAM/sprites (proprio) tests/rev205-roms/*.asm                  compila com bass-untech
"""
import argparse, json, os, shutil, subprocess

PL_COMMIT = '350b394e86ec5d62f600b5cbf64cdce3721bb6ef'
UB_COMMIT = 'ac6ef8006809c0ff5dabc8ff137a4623967697fe'

# (caminho relativo, areas, quadros)
PETERLEMON = [
    ('HelloWorld/HelloWorld.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/2BPP/8x8BG1Map2BPP32x328PAL/8x8BG1Map2BPP32x328PAL.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/2BPP/8x8BG2Map2BPP32x328PAL/8x8BG2Map2BPP32x328PAL.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/2BPP/8x8BG3Map2BPP32x328PAL/8x8BG3Map2BPP32x328PAL.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/2BPP/8x8BG4Map2BPP32x328PAL/8x8BG4Map2BPP32x328PAL.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/4BPP/8x8BGMap4BPP32x328PAL/8x8BGMap4BPP32x328PAL.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/8BPP/32x32/8x8BGMap8BPP32x32.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/8BPP/64x32/8x8BGMap8BPP64x32.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/8BPP/32x64/8x8BGMap8BPP32x64.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/8BPP/64x64/8x8BGMap8BPP64x64.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/BGMAP/8x8/8BPP/TileFlip/8x8BGMapTileFlip.sfc', ['dma', 'vram', 'cgram'], None),
    ('PPU/HDMA/RedSpaceHDMA/RedSpaceHDMA.sfc', ['hdma', 'cgram'], [60, 61, 120]),
    ('PPU/HDMA/RedSpaceIndirectHDMA/RedSpaceIndirectHDMA.sfc', ['hdma', 'cgram'], [60, 61, 120]),
    ('PPU/HDMA/RedSpace9BitHDMA/RedSpace9BitHDMA.sfc', ['hdma', 'cgram'], [60, 61, 120]),
    ('PPU/HDMA/WaveHDMA/WaveHDMA.sfc', ['hdma', 'dma', 'vram'], [60, 61, 120]),
    ('PPU/HDMA/Mode7HDMA/Mode7HDMA.sfc', ['hdma', 'mode7', 'dma', 'vram'], [60, 61, 120]),
    ('PPU/HDMA/HiColor64PerTileRow/HiColor64PerTileRow.sfc', ['hdma', 'cgram', 'dma', 'vram'], [60, 120]),
    ('PPU/HDMA/HiColor128PerTileRow/HiColor128PerTileRow.sfc', ['hdma', 'cgram', 'dma', 'vram', 'oam'], [60, 120]),
    ('PPU/HDMA/HiColor64PerTileRowPseudoHiRes/HiColor64PerTileRowPseudoHiRes.sfc', ['hdma', 'cgram', 'hires'], [60, 120]),
    ('PPU/Window/WindowHDMA/WindowHDMA.sfc', ['hdma', 'window'], [60, 61, 120]),
    ('PPU/Window/WindowMultiHDMA/WindowMultiHDMA.sfc', ['hdma', 'window'], [60, 61, 120]),
    ('PPU/Mode7/RotZoom/RotZoom.sfc', ['mode7', 'dma', 'vram'], [60, 61, 120]),
    ('PPU/Mode7/Perspective/Perspective.sfc', ['mode7', 'hdma', 'dma', 'vram'], [60, 61, 120]),
    ('PPU/Mode7/StarWars/StarWars.sfc', ['mode7', 'hdma', 'oam', 'dma'], [60, 120, 240]),
    ('PPU/Mosaic/Mode3/MosaicMode3.sfc', ['mosaic', 'dma', 'vram'], [60, 61, 120]),
    ('PPU/Mosaic/Mode5/MosaicMode5.sfc', ['mosaic', 'hires', 'dma', 'vram'], [60, 61, 120]),
    ('PPU/Blend/HiColor/HiColor3840/HiColor3840.sfc', ['colormath', 'cgram', 'hdma'], [60, 120]),
    ('PPU/Blend/HiColor/HiColor575Myst/HiColor575Myst.sfc', ['colormath', 'cgram', 'hdma'], [60, 120]),
    ('PPU/Rings/Rings.sfc', ['hdma', 'window'], [60, 61, 120]),
    ('PPU/GreenSpace/GreenSpace.sfc', ['hdma', 'cgram'], [60, 61, 120]),
    ('PPU/Interlace/InterlaceRPG/InterlaceRPG.sfc', ['interlace', 'oam', 'dma'], [60, 120]),
    ('PlotPixel/Mode7/PlotPixelMode7.sfc', ['mode7', 'vram'], [60, 120]),
    ('PlotLine/Mode7/PlotLineMode7.sfc', ['mode7', 'vram'], [60, 120]),
    ('Games/MonsterFarmJump/MonsterFarmJump.sfc', ['jogo', 'oam', 'dma', 'vram', 'cgram'], [60, 120, 240, 400]),
]
for n in ['ADC', 'AND', 'ASL', 'BIT', 'BRA', 'CMP', 'DEC', 'EOR', 'INC', 'JMP', 'LDR', 'LSR', 'MOV', 'MSC', 'ORA',
          'PHL', 'PSR', 'RET', 'ROL', 'ROR', 'SBC', 'STR', 'TRN']:
    PETERLEMON.append(('CPUTest/CPU/%s/CPU%s.sfc' % (n, n), ['cpu'], [60, 180]))

UNDIS = {
    'vmain-address-remapping/*': ['vram', 'dma'],
    'effects/vmain-*': ['vram', 'dma'],
    'examples/vram-writes-without-dma': ['vram'],
    'examples/hdma-to-cgram': ['hdma', 'cgram'],
    'examples/hdma-*': ['hdma'],
    'effects/hdma-textbox-wipe': ['hdma', 'window'],
    'effects/repeating_hdma_pattern': ['hdma'],
    'effects/window-*': ['window'],
    'effects/inidisp_fadein_fadeout': ['inidisp', 'cgram'],
    'effects/inidisp_extend_vblank': ['inidisp', 'dma'],
    'hardware-tests/hdma-timing-demonstration': ['hdma'],
    'hardware-tests/hdmaen_latch_test': ['hdma'],
    'hardware-tests/hdmaen_latch_test_2': ['hdma'],
    'hardware-tests/object-dropout-test': ['oam'],
    'hardware-tests/vram-mid-scanline-test': ['vram'],
    'hardware-tests/inidisp_*': ['inidisp'],
    'hardware-tests/wrmpyb-in-flight': ['cpu'],
    'hardware-glitch-tests/dma-ends-at-hdma-start/*': ['dma', 'hdma'],
    'hardware-glitch-tests/setini-early-read-obj': ['oam'],
    'examples/textbuffer-hello-world': ['vram', 'dma'],
}


def classify(rel):
    import fnmatch
    best = None
    for pat, areas in UNDIS.items():
        if fnmatch.fnmatch(rel, pat):
            if best is None or len(pat) > len(best[0]):
                best = (pat, areas)
    return best[1] if best else None


def git_at(url, commit, dest):
    if not os.path.isdir(dest):
        subprocess.check_call(['git', 'clone', url, dest])
    subprocess.check_call(['git', '-C', dest, 'checkout', '-q', commit])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--peterlemon', default='')
    ap.add_argument('--undisbeliever', default='')
    ap.add_argument('--forja-roms', default='', help='pasta com ROMs proprias ja compiladas (tests/rev205-roms/bin)')
    a = ap.parse_args()
    out = os.path.abspath(a.out)
    os.makedirs(os.path.join(out, 'roms'), exist_ok=True)
    pl = a.peterlemon or os.path.join(out, 'src', 'PeterLemon-SNES')
    ub = a.undisbeliever or os.path.join(out, 'src', 'snes-test-roms')
    if not a.peterlemon:
        git_at('https://github.com/PeterLemon/SNES.git', PL_COMMIT, pl)
    if not a.undisbeliever:
        git_at('https://github.com/undisbeliever/snes-test-roms.git', UB_COMMIT, ub)
        if not os.path.isdir(os.path.join(ub, 'bass-untech', 'bass')):
            subprocess.check_call(['git', '-C', ub, 'submodule', 'update', '--init'])
        subprocess.check_call(['make', '-C', ub, '-j2'])
    roms = []

    def add(src, name, areas, frames, fonte):
        dst = os.path.join(out, 'roms', name + '.sfc')
        shutil.copyfile(src, dst)
        roms.append({'nome': name, 'rom': os.path.join('roms', name + '.sfc'), 'areas': areas,
                     'quadros': frames or [60, 120], 'fonte': fonte})

    for rel, areas, frames in PETERLEMON:
        src = os.path.join(pl, rel)
        if os.path.exists(src):
            add(src, 'pl-' + os.path.splitext(os.path.basename(rel))[0], areas, frames, 'PeterLemon/SNES ' + rel)
    for root, _, files in os.walk(os.path.join(ub, 'bin')):
        for f in sorted(files):
            if not f.endswith('.sfc'):
                continue
            rel = os.path.relpath(os.path.join(root, f), os.path.join(ub, 'bin'))[:-4]
            areas = classify(rel)
            if areas:
                add(os.path.join(root, f), 'ub-' + rel.replace('/', '-'), areas, [60, 61, 120],
                    'undisbeliever/snes-test-roms ' + rel)
    # ROMs proprias da REV205 (OAM/sprites, portas de leitura e DMA, HDMA em todos os modos): compiladas com o bass-untech
    # e o framework do undisbeliever (zlib), que ja estao no clone acima.
    own = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'tests', 'rev205-roms')
    if not a.forja_roms and os.path.isdir(own):
        dst_src = os.path.join(ub, 'src', 'forja-rev205')
        os.makedirs(dst_src, exist_ok=True)
        os.makedirs(os.path.join(ub, 'bin', 'forja-rev205'), exist_ok=True)
        bass = os.path.join(ub, 'bass-untech', 'bass', 'out', 'bass-untech')
        for f in sorted(os.listdir(own)):
            if f.endswith('.asm'):
                shutil.copyfile(os.path.join(own, f), os.path.join(dst_src, f))
                outsfc = os.path.join(ub, 'bin', 'forja-rev205', f[:-4] + '.sfc')
                subprocess.check_call([bass, '-strict', '-o', outsfc, os.path.join(dst_src, f)], cwd=ub)
                subprocess.check_call(['python3', os.path.join(ub, 'tools', 'write-sfc-checksum.py'), '--lorom', outsfc], cwd=ub)
        shutil.copyfile(os.path.join(own, 'areas.json'), os.path.join(ub, 'bin', 'forja-rev205', 'areas.json'))
        a.forja_roms = os.path.join(ub, 'bin', 'forja-rev205')
    if a.forja_roms:
        meta = os.path.join(a.forja_roms, 'areas.json')
        tags = json.load(open(meta)) if os.path.exists(meta) else {}
        for f in sorted(os.listdir(a.forja_roms)):
            if f.endswith('.sfc'):
                n = f[:-4]
                frames = {'oam-sprite-render': [20, 37, 54, 71, 88, 105, 122, 139, 156], 'ppu-port-readback': [30, 60],
                          'hdma-all-modes': [30, 31, 60, 90]}.get(n, [30, 31, 60])
                add(os.path.join(a.forja_roms, f), 'fj-' + n, tags.get(n, ['oam']), frames, 'Forja65 REV205 ' + f)
    json.dump({'formato': 'forja65-rev205-corpus-1', 'roms': roms}, open(os.path.join(out, 'corpus.json'), 'w'), indent=1)
    print(len(roms), 'ROMs em', os.path.join(out, 'corpus.json'))


if __name__ == '__main__':
    main()
