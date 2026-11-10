#!/usr/bin/env python3
"""REV143 - comparacao de temporizacao CPU por instrucao: port Forja65 x Snes9x (core com sondas REV138).

Entrada:
  - traco do port (comando `cputrace` do modo de controle): "PC mc linha H"  (linha do port = V-1)
  - traco do Snes9x (comando `cputrace` do refemu): "PC A=.. ... V=n C=h"
Alinha pelo PC (primeira janela de 64 PCs iguais), segue em passo enquanto os PCs coincidem e compara
o custo de cada instrucao (diferenca de posicao V*H entre instrucoes consecutivas), em ciclos mestres.
Saida: deriva acumulada, primeiras divergencias e histograma por opcode (opcode lido da ROM quando o PC
esta na ROM LoROM/HiROM; senao 'ram').

uso: timingdiff.py port.trace snes9x.trace [rom.sfc] [--lines 262] [--max-report 40] [--offset-tolerance 0]
"""
import sys, collections, argparse

ap = argparse.ArgumentParser()
ap.add_argument('port'); ap.add_argument('ref'); ap.add_argument('rom', nargs='?')
ap.add_argument('--lines', type=int, default=262)
ap.add_argument('--max-report', type=int, default=40)
ap.add_argument('--hirom', action='store_true')
ap.add_argument('--json')
args = ap.parse_args()
LINE = 1364

def load_port(p):
    out = []
    for l in open(p):
        f = l.split()
        if len(f) < 4: continue
        try: out.append((int(f[0], 16), (int(f[2]) + 1) % args.lines, int(f[3])))
        except ValueError: pass
    return out

def load_ref(p):
    out = []
    for l in open(p):
        f = l.split()
        if not f: continue
        try:
            pc = int(f[0], 16)
            v = int([x for x in f if x.startswith('V=')][0][2:])
            c = int([x for x in f if x.startswith('C=')][0][2:])
        except (ValueError, IndexError): continue
        out.append((pc, v, c))
    return out

rom = open(args.rom, 'rb').read() if args.rom else b''
if len(rom) % 1024 == 512: rom = rom[512:]
def opcode(pc):
    bank, addr = pc >> 16, pc & 0xFFFF
    if not rom: return None
    if args.hirom:
        if addr < 0x8000 and not (0x40 <= (bank & 0x7F) <= 0x7D): return None
        off = ((bank & 0x3F) << 16) | addr
    else:
        if addr < 0x8000 or (bank & 0x7F) >= 0x7E: return None
        off = ((bank & 0x7F) << 15) | (addr & 0x7FFF)
    return rom[off % len(rom)] if rom else None

P = load_port(args.port); R = load_ref(args.ref)
W = 64
pseq = [x[0] for x in P[:W]]
rpcs = [x[0] for x in R]
j0 = None
for j in range(len(R) - W):
    if rpcs[j] == pseq[0] and rpcs[j:j+W] == pseq:
        j0 = j; break
if j0 is None:
    print('sem alinhamento nos primeiros %d PCs' % W); sys.exit(2)

def t(v, h): return v * LINE + h
frame = args.lines * LINE
def delta(a, b):
    d = (t(*b) - t(*a)) % frame
    if d > frame // 2: d -= frame
    return d

hist = collections.Counter(); hist_n = collections.Counter(); ex = {}
n = 0; drift0 = None; first = []; resyncs = 0
REFRESH_H = 538; REFRESH = 40
def cost(a, b):
    """custo da instrucao em ciclos mestres, descontado o refresh de DRAM (H=538) atravessado."""
    d = delta(a, b)
    if d <= 0 or d > 4 * LINE: return d, False
    va, ha = a; vb, hb = b
    crossed = (va == vb and ha <= REFRESH_H < hb) or (va != vb and (ha <= REFRESH_H or hb > REFRESH_H))
    return (d - REFRESH if crossed and d >= REFRESH + 6 else d), crossed
# indice de janelas do ref para ressincronizar depois de lacos de espera dependentes de fase
RW = 24
ridx = collections.defaultdict(list)
for j in range(0, len(R) - RW):
    if j % 1 == 0: ridx[tuple(rpcs[j:j+RW])].append(j)
ppcs = [x[0] for x in P]
k = 0; j = j0
while k + 1 < len(P) and j + 1 < len(R):
    pa, pb = P[k], P[k+1]; ra, rb = R[j], R[j+1]
    if pa[0] != ra[0] or pb[0] != rb[0]:
        # procura a proxima janela comum (port avanca ate 20000 instrucoes; ref a frente de j)
        found = None
        for kk in range(k + 1, min(len(P) - RW, k + 20000)):
            cand = ridx.get(tuple(ppcs[kk:kk+RW]))
            if not cand: continue
            jj = next((c for c in cand if c > j), None)
            if jj is not None: found = (kk, jj); break
        if not found: break
        k, j = found; resyncs += 1
        continue
    dp, cp_ = cost(pa[1:], pb[1:]); dr, cr = cost(ra[1:], rb[1:])
    if drift0 is None: drift0 = delta(ra[1:], pa[1:])
    op = opcode(pa[0])
    key = ('%02X' % op) if op is not None else 'ram'
    hist_n[key] += 1
    if dp != dr and abs(dp - dr) < 4 * LINE:
        hist[(key, dp - dr)] += 1
        ex.setdefault((key, dp - dr), (k, pa[0], dp, dr))
        if len(first) < args.max_report: first.append((k, pa[0], key, dp, dr))
    n += 1
    k += 1; j += 1
print('ressincronizacoes: %d' % resyncs)
end_drift = delta(R[j][1:], P[k][1:]) if k < len(P) and j < len(R) else None
print('alinhado: port[0] = ref[%d]; instrucoes comparadas em passo: %d' % (j0, n))
print('defasagem inicial (port - ref, ciclos mestres): %s; final: %s' % (drift0, end_drift))
print('fim da comparacao: port idx %d de %d, ref idx %d de %d' % (k, len(P), j, len(R)))
tot = sum(hist.values())
print('instrucoes com custo diferente: %d (%.3f%%)' % (tot, 100.0 * tot / max(1, n)))
print('\nopcode  dif(port-ref)  ocorrencias  /total_opcode   exemplo(idx pc port ref)')
for (key, d), c in sorted(hist.items(), key=lambda x: -x[1])[:60]:
    e = ex[(key, d)]
    print('%-6s %+6d %12d %10d     %d %06X %d %d' % (key, d, c, hist_n[key], e[0], e[1], e[2], e[3]))
if args.json:
    import json
    json.dump({'aligned_ref_index': j0, 'compared': n, 'drift_start': drift0, 'drift_end': end_drift,
               'mismatched': tot, 'by_opcode': [{'opcode': k_[0], 'diff': k_[1], 'count': c} for k_, c in hist.items()]},
              open(args.json, 'w'), indent=1)
