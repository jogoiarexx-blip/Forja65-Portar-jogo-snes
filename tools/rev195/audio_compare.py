#!/usr/bin/env python3
"""Forja65 REV195 - compara o audio do port com uma referencia (Snes9x/bsnes via refemu).
Mede: amostras por quadro (taxa efetiva), inicio do som (1a amostra audivel), velocidade relativa
(lag da correlacao cruzada ao longo do tempo: inclinacao != 0 => audio acelerado/lento) e semelhanca.
uso: audio_compare.py REF.raw|wav REF_HZ PORT.wav|raw PORT_HZ QUADROS [--fps 60.0988]
Arquivos .raw = PCM s16le estereo sem cabecalho; .wav = cabecalho de 44 bytes."""
import sys, numpy as np

def load(p):
    b = open(p, 'rb').read()
    if p.endswith('.wav'): b = b[44:]
    a = np.frombuffer(b[:len(b) // 4 * 4], dtype='<i2').reshape(-1, 2).astype(np.float32)
    return a.mean(axis=1) / 32768.0

def resample(x, src, dst):
    if src == dst: return x
    n = int(round(len(x) * dst / src)); t = np.arange(n) * (src / dst)
    return np.interp(t, np.arange(len(x)), x).astype(np.float32)

def first_sound(x, hz, thr=1e-3):
    i = np.flatnonzero(np.abs(x) > thr)
    return None if len(i) == 0 else i[0] / hz

def lag_track(a, b, hz, win=1.0, maxlag=0.6):
    w = int(win * hz); m = int(maxlag * hz); out = []
    for s in range(m, min(len(a), len(b)) - w - m, w):
        seg = a[s:s + w]
        if np.sqrt((seg ** 2).mean()) < 1e-3: continue
        ref = b[s - m:s + w + m]
        c = np.correlate(ref, seg, mode='valid')
        k = int(np.argmax(c)); lag = (k - m) / hz
        den = np.sqrt((seg ** 2).sum() * (ref[k:k + w] ** 2).sum()) + 1e-12
        out.append((s / hz, lag, float(c[k] / den)))
    return out

def main():
    a = sys.argv[1:]; fps = 60.0988
    if '--fps' in a: i = a.index('--fps'); fps = float(a[i + 1]); del a[i:i + 2]
    rp, rhz, pp, phz, frames = a[0], float(a[1]), a[2], float(a[3]), int(a[4])
    r, p = load(rp), load(pp)
    print('referencia: %d amostras = %.2f por quadro (%.1f Hz efetivos)' % (len(r), len(r) / frames, len(r) / frames * fps))
    print('port:       %d amostras = %.2f por quadro (%.1f Hz efetivos)' % (len(p), len(p) / frames, len(p) / frames * fps))
    hz = 32040.0
    r2, p2 = resample(r, rhz, hz), resample(p, phz, hz)
    fr, fp = first_sound(r2, hz), first_sound(p2, hz)
    print('inicio do som: referencia %s s, port %s s' % (None if fr is None else round(fr, 3), None if fp is None else round(fp, 3)))
    tr = lag_track(p2, r2, hz)
    if not tr: print('sem trechos audiveis para correlacionar'); return
    t = np.array([x[0] for x in tr]); lag = np.array([x[1] for x in tr]); cor = np.array([x[2] for x in tr])
    good = cor > 0.5
    if good.sum() >= 2:
        k = np.polyfit(t[good], lag[good], 1)[0]
        print('deriva: %+.4f s por s (velocidade do port = %.4fx da referencia)' % (k, 1 - k))
    print('correlacao media %.3f; trechos com correlacao > 0.5: %d de %d; lag mediano %.4f s' % (cor.mean(), good.sum(), len(cor), float(np.median(lag))))
    for x in tr[:6] + tr[-3:]: print('  t=%.1fs lag=%+.4fs corr=%.3f' % x)

if __name__ == '__main__': main()

def envelope(x, hz, step=0.01):
    n = int(step * hz); m = len(x) // n
    e = np.sqrt((x[:m * n].reshape(m, n) ** 2).mean(axis=1))
    d = np.maximum(np.diff(e, prepend=e[0]), 0)  # realce de ataques (notas)
    return d / (np.linalg.norm(d) + 1e-12)

def tempo_ratio(port, ref, hz, lo=0.85, hi=1.15, steps=301):
    """Fator de escala de tempo que melhor alinha os ataques do port aos da referencia (1.0 = mesmo andamento)."""
    ep, er = envelope(port, hz), envelope(ref, hz)
    best = (0, 1.0, 0)
    for k in np.linspace(lo, hi, steps):
        t = np.arange(len(ep)) * k
        valid = t < len(er) - 1
        if valid.sum() < 100: continue
        rs = np.interp(t[valid], np.arange(len(er)), er)
        ps = ep[valid]
        for off in range(-60, 61, 2):
            if off >= 0: a, b = ps[off:], rs[:len(rs) - off]
            else: a, b = ps[:off], rs[-off:]
            c = float((a * b).sum() / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12))
            if c > best[0]: best = (c, float(k), off)
    return best

def identical_fraction(port, ref, tol=0):
    """Fracao de amostras (estereo, s16) iguais com lag 0 desde a 1a amostra audivel da referencia."""
    n = min(len(port), len(ref))
    a, b = np.round(port[:n] * 32768), np.round(ref[:n] * 32768)
    nz = np.flatnonzero(np.abs(b) > 0)
    if len(nz) == 0: return None
    a, b = a[nz[0]:], b[nz[0]:]
    return float((np.abs(a - b) <= tol).mean())
