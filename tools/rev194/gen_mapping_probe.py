#!/usr/bin/env python3
"""Forja65 REV194 - gerador de ROMs-sonda de mapeamento (MIT).

Cada ROM preenche o arquivo com um padrao que codifica o proprio deslocamento a cada 4 bytes
([o>>16, o>>8, o, 0xA5] em o%4==0). Um programa no banco de reset le uma tabela de enderecos
SNES (LDA [dp]) e grava cada byte lido em $7E:2000+4*i. Assim o dump de WRAM diz, para cada
endereco SNES, qual deslocamento do arquivo (ou barramento aberto/SRAM) o emulador mapeou ali.
Entradas de escrita (op=1) gravam o indice em SRAM para testar espelhos de RAM de cartucho.

uso: gen_mapping_probe.py SAIDA_DIR      -> gera *.sfc e *.probes.json (lista de enderecos)
"""
import json, os, sys

def checksum_fix(rom, hdr):
    # campo de checksum/complemento consistente: soma com 0x0000/0xFFFF ja escritos
    rom[hdr + 0x1C:hdr + 0x20] = bytes([0xFF, 0xFF, 0x00, 0x00])
    size = len(rom)
    # soma no estilo do SNES: potencia de 2 inferior + espelho do resto
    p = 1
    while p * 2 <= size: p *= 2
    s = sum(rom[:p])
    if size > p:
        rest = rom[p:]
        reps = p // len(rest) if len(rest) else 0
        s += sum(rest) * max(1, reps)
    s &= 0xFFFF
    rom[hdr + 0x1E] = s & 0xFF; rom[hdr + 0x1F] = s >> 8
    c = s ^ 0xFFFF
    rom[hdr + 0x1C] = c & 0xFF; rom[hdr + 0x1D] = c >> 8

def build(name, size, hdr, code_off, map_mode, rom_type, rom_size_code, sram_code, probes, title, init=(), sub=None, serial=None, reset=0x8000, prefix=None):
    rom = bytearray(size)
    for o in range(0, size, 4):
        rom[o] = (o >> 16) & 255; rom[o + 1] = (o >> 8) & 255; rom[o + 2] = o & 255; rom[o + 3] = 0xA5
    table = []
    for addr, op in probes:
        table += [addr & 255, (addr >> 8) & 255, (addr >> 16) & 255, op]
    n = len(probes)
    code = bytearray()
    def emit(*b): code.extend(b)
    emit(0x78, 0x18, 0xFB)            # SEI CLC XCE
    emit(0xC2, 0x10)                  # REP #$10
    emit(0xE2, 0x20)                  # SEP #$20
    emit(0xA9, 0x80, 0x8D, 0x00, 0x21)  # LDA #$80 STA $2100
    emit(0x9C, 0x00, 0x42)            # STZ $4200
    for a, v in init:                 # REV195: escritas de preparo (registradores de chip)
        emit(0xA9, v & 255, 0x8F, a & 255, (a >> 8) & 255, (a >> 16) & 255)  # LDA #v ; STA long a
    emit(0xA2, 0x00, 0x00)            # LDX #0
    loop = len(code)
    # LDA tab,X / STA $00 ... (tab endereco absoluto no banco de reset)
    tab_addr_pos = []
    for k, dp in enumerate((0x00, 0x01, 0x02)):
        emit(0xBD, 0, 0); tab_addr_pos.append((len(code) - 2, k)); emit(0x85, dp)
    emit(0xBD, 0, 0); tab_addr_pos.append((len(code) - 2, 3))   # op
    emit(0xD0, 0x08)                  # BNE escrita (+8)
    emit(0xA7, 0x00)                  # LDA [$00]
    emit(0x9F, 0x00, 0x20, 0x7E)      # STA $7E2000,X
    emit(0x80, 0x08)                  # BRA prox (+8)
    # escrita: TXA (indice baixo) ; STA [$00] ; STA $7E2000,X
    emit(0x8A, 0x87, 0x00)            # TXA ; STA [$00]
    emit(0x9F, 0x00, 0x20, 0x7E)      # STA $7E2000,X
    emit(0xEA)                        # NOP (alinha o salto de BRA)
    emit(0xE8, 0xE8, 0xE8, 0xE8)      # INX x4
    emit(0xE0, (n * 4) & 255, (n * 4) >> 8)  # CPX #n*4
    rel = loop - (len(code) + 2)
    emit(0xD0, rel & 255)             # BNE loop
    emit(0xA9, 0x77, 0x8F, 0xFC, 0xFF, 0x7E)  # LDA #$77 ; STA $7EFFFC (marca de fim)
    emit(0x80, 0xFE)                  # BRA $
    tab_off = len(code)
    tab_cpu = reset + tab_off
    for pos, k in tab_addr_pos:
        a = tab_cpu + k
        code[pos] = a & 255; code[pos + 1] = a >> 8
    code += bytes(table)
    assert len(code) < 0x3000, len(code)
    rom[code_off:code_off + len(code)] = code
    # cabecalho
    h = hdr
    t = title.encode('ascii')[:21].ljust(21, b' ')
    # zera tambem o cabecalho estendido ($xxB0-$xxBF): sem isso o padrao de sonda vira
    # 'expansion RAM size' quando o licenciado e 0x33 (bsnes aloca RAM fantasma).
    rom[h - 0x10:h + 0x40] = bytes(0x50)
    rom[h:h + 21] = t
    rom[h + 0x15] = map_mode; rom[h + 0x16] = rom_type; rom[h + 0x17] = rom_size_code
    rom[h + 0x18] = sram_code; rom[h + 0x19] = 0x01; rom[h + 0x1A] = 0x33; rom[h + 0x1B] = 0
    vec = h + 0x20  # $FFE0
    for i in range(16): rom[vec + i * 2] = 0x00; rom[vec + i * 2 + 1] = 0x80
    rom[h + 0x3C] = reset & 255; rom[h + 0x3D] = reset >> 8     # reset
    if sub is not None: rom[h - 1] = sub                    # subtipo do chip ($xxBF)
    if serial: rom[h - 0x0E:h - 0x0A] = serial.encode('ascii'); rom[h + 0x1A] = 0x33  # cabecalho estendido
    if prefix: rom[0:len(prefix)] = prefix
    checksum_fix(rom, h)
    return rom

def probes_for(kind):
    ps = []
    def rd(a):
        for k in range(3): ps.append((a + k, 0))
    banks = [0x00, 0x01, 0x10, 0x1F, 0x20, 0x2F, 0x30, 0x3F, 0x40, 0x4F, 0x50, 0x5F, 0x60, 0x6F, 0x70, 0x71,
             0x7D, 0x80, 0x90, 0x9F, 0xA0, 0xBF, 0xC0, 0xCF, 0xD0, 0xDF, 0xE0, 0xEF, 0xF0, 0xF1, 0xFE, 0xFF]
    for b in banks:
        io = b <= 0x3F or 0x80 <= b <= 0xBF
        lows = [0x6004, 0x7FF4, 0x8004, 0xC004, 0xF004] if io else [0x0004, 0x4004, 0x7FF4, 0x8004, 0xC004, 0xF004]
        for lo in lows: rd((b << 16) | lo)
    # SRAM: escreve o indice e le espelhos
    sram_sets = {
        'lorom': [0x700000, 0x700010], 'hirom': [0x206000, 0x306010], 'exhirom': [0x206000, 0xA06010],
        'exlorom': [0x700000, 0x7D0010], 'sa1': [0x400000, 0x006010], 'sdd1': [0x006000, 0x700010], 'gsu': [0x700000, 0x006010],
        # REV195
        'spc7110': [0x006000, 0x076010], 'obc1': [0x006000, 0x707010], 'st010': [0x680000, 0x680010],
        'st018': [0x700000, 0x7D0010], 'bslo': [0x700000, 0x700010], 'bshi': [0x206000, 0x306010],
        'sufami': [0x600000, 0x700000], 'sgb': [0x700000]}
    for a in sram_sets.get(kind, []):
        ps.append((a, 1))
    mirrors = {
        'lorom': [0x700000, 0x708000, 0x7D0000, 0xF00000, 0xFF8000, 0x710000, 0x700010, 0x7C0010],
        'hirom': [0x206000, 0x306000, 0xA06000, 0x3F6000, 0x306010, 0x206010, 0x216010],
        'exhirom': [0x206000, 0xA06000, 0x806000, 0x406000, 0xA06010, 0x206010],
        'exlorom': [0x700000, 0x708000, 0xF00000, 0x7D0010, 0x700010, 0xF08010],
        'sa1': [0x400000, 0x410000, 0x006000, 0x806000, 0x006010, 0x400010],
        'sdd1': [0x006000, 0x806000, 0x700000, 0x700010, 0x708010, 0x730010],
        'gsu': [0x700000, 0xF00000, 0x006000, 0x006010, 0x700010, 0x710010],
        'spc7110': [0x006000, 0x806000, 0x016000, 0x076010, 0x006010, 0x0F6010],
        'obc1': [0x006000, 0x806000, 0x707010, 0xF0F010, 0x007010, 0x007C14, 0x007FF0, 0x007FF5, 0x007FF6],
        'st010': [0x680000, 0xE80000, 0x688000, 0x680010, 0x6F0010, 0x600000, 0x600001],
        'st018': [0x700000, 0x700010, 0x7D0010, 0xF00000, 0x003800, 0x0038FF],
        'bslo': [0x700000, 0x708000, 0xF00000, 0x700010, 0xC00000],
        'bshi': [0x206000, 0x306000, 0xA06000, 0x306010, 0x206010, 0x608000],
        'sufami': [0x600000, 0x700000, 0x208000, 0x408000],
        'sgb': [0x700000, 0x006000, 0x007000, 0x007800]}
    for a in mirrors.get(kind, []):
        ps.append((a, 0))
    return ps

VARIANTS = [
    # nome, tipo, tamanho, offset do cabecalho, offset do codigo, mapMode, romType, romSizeCode, sramCode
    ('lorom-1m',       'lorom',  0x100000, 0x007FC0, 0x000000, 0x20, 0x00, 0x0A, 0x00),
    ('lorom-3m-ram8k', 'lorom',  0x300000, 0x007FC0, 0x000000, 0x20, 0x02, 0x0C, 0x03),
    ('lorom-2m-ram32k','lorom',  0x200000, 0x007FC0, 0x000000, 0x30, 0x02, 0x0B, 0x05),
    ('hirom-3m-ram8k', 'hirom',  0x300000, 0x00FFC0, 0x008000, 0x21, 0x02, 0x0C, 0x03),
    ('hirom-4m-fast',  'hirom',  0x400000, 0x00FFC0, 0x008000, 0x31, 0x00, 0x0C, 0x00),
    ('exhirom-6m-ram8k','exhirom',0x600000, 0x40FFC0, 0x408000, 0x25, 0x02, 0x0D, 0x03),
    ('exhirom-8m-ram32k','exhirom',0x800000, 0x40FFC0, 0x408000, 0x25, 0x02, 0x0D, 0x05),  # REV196: ExHiROM de 8 MiB (hacks/traducoes)
    ('exlorom-6m-ram32k','exlorom',0x600000,0x407FC0, 0x400000, 0x20, 0x02, 0x0D, 0x05),
    ('sa1-2m-ram32k',  'sa1',    0x200000, 0x007FC0, 0x000000, 0x23, 0x35, 0x0B, 0x05),
    ('sdd1-4m-ram8k',  'sdd1',   0x400000, 0x007FC0, 0x000000, 0x32, 0x45, 0x0C, 0x03),  # S-DD1 real tem >=4 MiB (bsnes nao espelha a MMC abaixo disso)
    ('gsu-1m-ram64k',  'gsu',    0x100000, 0x007FC0, 0x000000, 0x20, 0x15, 0x0A, 0x06),
    # REV195 (bsnes boards.bml): SPC7110 com SRAM habilitada em $4830, OBC1 com registradores preparados,
    # ST010/ST011 (uPD96050), ST018 (ARM), BS-X LoROM/HiROM (sem cartao), Sufami Turbo (sem cartuchos) e SGB.
    ('spc7110-3m-ram8k','spc7110',0x300000,0x00FFC0, 0x008000, 0x3A, 0xF5, 0x0C, 0x03, dict(sub=0x00, init=[(0x004830, 0x80)])),
    ('spc7110-5m-mmc', 'spc7110',0x500000,0x00FFC0, 0x008000, 0x3A, 0xF9, 0x0D, 0x03, dict(sub=0x00, init=[(0x004830, 0x80), (0x004834, 0x02), (0x004831, 0x03), (0x004832, 0x00), (0x004833, 0x01)])),
    ('obc1-1m-ram8k',  'obc1',   0x100000, 0x007FC0, 0x000000, 0x30, 0x25, 0x0A, 0x03,
        dict(init=[(0x007FF5, 0x00), (0x007FF6, 0x05), (0x007FF0, 0x11), (0x007FF1, 0x22), (0x007FF2, 0x33), (0x007FF3, 0x44), (0x007FF4, 0x03), (0x007FF5, 0x01)])),
    ('st010-1m',       'st010',  0x100000, 0x007FC0, 0x000000, 0x30, 0xF6, 0x0A, 0x00, dict(sub=0x01)),
    ('st018-2m-ram32k','st018',  0x200000, 0x007FC0, 0x000000, 0x30, 0xF5, 0x0B, 0x05, dict(sub=0x02)),
    ('bslo-1m-ram8k',  'bslo',   0x100000, 0x007FC0, 0x000000, 0x20, 0x02, 0x0A, 0x03, dict(serial='ZBAJ')),
    ('bshi-1m-ram8k',  'bshi',   0x100000, 0x00FFC0, 0x008000, 0x21, 0x02, 0x0A, 0x03, dict(serial='ZBBJ')),
    ('sufami-bios',    'sufami', 0x040000, 0x007FC0, 0x000100, 0x20, 0x00, 0x08, 0x00, dict(reset=0x8100, prefix=b'BANDAI SFC-ADX')),
    ('sgb-256k',       'sgb',    0x040000, 0x007FC0, 0x000000, 0x20, 0xE3, 0x08, 0x00),
]

def main():
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    only = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
    for v in VARIANTS:
        name, kind, size, hdr, code, mm, rt, rs, sc = v[:9]; extra = v[9] if len(v) > 9 else {}
        if only and name not in only: continue
        ps = probes_for(kind)
        rom = build(name, size, hdr, code, mm, rt, rs, sc, ps, 'FORJA MAP ' + name.upper(), **extra)
        open(os.path.join(out, name + '.sfc'), 'wb').write(rom)
        json.dump({'name': name, 'kind': kind, 'size': size, 'probes': [[a, op] for a, op in ps]},
                  open(os.path.join(out, name + '.probes.json'), 'w'))
        print(name, len(ps), 'sondas')

if __name__ == '__main__':
    main()
