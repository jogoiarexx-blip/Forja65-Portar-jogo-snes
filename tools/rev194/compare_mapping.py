#!/usr/bin/env python3
"""Forja65 REV194 - compara tabelas de sondas de mapeamento (bsnes, snes9x, port).
Para cada endereco de 3 leituras alinhadas decodifica o deslocamento de arquivo (padrao o>>16,o>>8,o);
leituras que nao formam o padrao aparecem como bytes crus (barramento aberto, SRAM, codigo).
uso: compare_mapping.py ref.json outro.json [outro2.json ...] [--show N]"""
import json, sys

def decode(reads):
    keys = [k for k in reads if not k.endswith('w')]
    out = {}
    for k in keys:
        a = int(k, 16)
        if (a & 3) != 0 or a & 0xFFFF < 4 and False: pass
        if a & 3 == 0 and ('%06X' % (a + 1)) in reads and ('%06X' % (a + 2)) in reads:
            b0, b1, b2 = reads[k], reads['%06X' % (a + 1)], reads['%06X' % (a + 2)]
            o = (b0 << 16) | (b1 << 8) | b2
            out[k] = ('rom:%06X' % o) if (o & 3) == 0 and (o & 0xFFFF) == (a & 0xFFFF) or (o & 0x7FFF) == (a & 0x7FFF) else 'raw:%02X%02X%02X' % (b0, b1, b2)
        elif a & 3 != 0:
            continue
        else:
            out[k] = 'raw:%02X' % reads[k]
    # sondas de SRAM (enderecos nao alinhados ou depois das escritas) entram como byte cru
    for k in keys:
        if k not in out and int(k, 16) & 3 == 0:
            out[k] = 'raw:%02X' % reads[k]
    return out

def main():
    argv = sys.argv[1:]; show = 40
    if '--show' in argv: i = argv.index('--show'); show = int(argv[i + 1]); del argv[i:i + 2]
    args = argv
    tabs = [json.load(open(p)) for p in args]
    dec = [decode(t['reads']) for t in tabs]
    ref = dec[0]
    for j in range(1, len(dec)):
        same = sum(1 for k in ref if dec[j].get(k) == ref[k])
        print('%s vs %s: %d/%d iguais' % (args[j], args[0], same, len(ref)))
    diffs = [k for k in sorted(ref) if any(d.get(k) != ref[k] for d in dec[1:])]
    for k in diffs[:show]:
        print('  %s  ' % k + '  '.join('%-14s' % d.get(k) for d in dec))
    if len(diffs) > show: print('  ... %d diferencas' % len(diffs))

if __name__ == '__main__':
    main()
