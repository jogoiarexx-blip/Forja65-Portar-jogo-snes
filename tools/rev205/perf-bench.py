#!/usr/bin/env python3
"""Forja65 REV205 - desempenho global medido: roda cada port sem janela e sem limite de velocidade e junta
quadros por segundo, tempo de quadro (p50/p95/p99/max), parte do PPU e quanto da CPU 65C816 ainda caiu no
interpretador.

  python3 perf-bench.py --ports PASTA_COM_PORTS --out pasta [--frames 1800] [--only a,b] [--env CHAVE=VALOR ...]

Cada subpasta de --ports com build/game e assets/ e um port. O executavel e rodado numa pasta temporaria
(FORJA65_HEADLESS=1, FORJA65_PERF=1). Ports gerados antes da REV205 nao tem FORJA65_PERF: o tempo vem do
relogio de parede (inclui a carga, entao fica um pouco pior).
"""
import argparse, json, os, shutil, statistics, subprocess, tempfile, time


def parse_kv(path):
    d = {}
    if os.path.exists(path):
        for line in open(path, errors='replace'):
            if '=' in line and not line.startswith('#'):
                k, v = line.strip().split('=', 1)
                d[k] = v
    return d


def bench(port, frames, extra_env, timeout):
    exe = os.path.join(port, 'build', 'game')
    if not os.path.exists(exe):
        return {'erro': 'sem build/game'}
    d = tempfile.mkdtemp(prefix='forja-bench-')
    os.symlink(os.path.abspath(os.path.join(port, 'assets')), os.path.join(d, 'assets'))
    env = dict(os.environ, FORJA65_HEADLESS='1', FORJA65_HEADLESS_FRAMES=str(frames), FORJA65_PERF='1',
               FORJA65_WATCHDOG_INSTRUCTIONS='0', FORJA65_UNCAPPED='1')
    env.update(extra_env)
    t = time.time()
    try:
        p = subprocess.run([os.path.abspath(exe)], cwd=d, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                           text=True, timeout=timeout)
        out = p.stdout
        rc = p.returncode
    except subprocess.TimeoutExpired:
        shutil.rmtree(d, ignore_errors=True)
        return {'erro': 'tempo esgotado'}
    wall = time.time() - t
    r = {'retorno': rc, 'parede_s': round(wall, 3)}
    perf = os.path.join(d, 'forja65-perf.json')
    if os.path.exists(perf):
        r['perf'] = json.load(open(perf))
    else:
        r['perf'] = {'quadros_por_segundo': frames / wall if wall else 0, 'fonte': 'relogio de parede'}
    qa = parse_kv(os.path.join(d, 'forja65-qa-status.txt'))
    interp = parse_kv(os.path.join(d, 'forja65-cpu-interpreter.txt'))
    r['quadros'] = int(qa.get('frames', 0) or 0)
    r['cpu_instrucoes'] = int(qa.get('instructions', 0) or 0)
    r['cpu_interpretadas'] = int(interp.get('instructions', 0) or 0)
    r['interpretador_blocos'] = int(interp.get('blocks', 0) or 0)
    r['framebuffer_hash'] = qa.get('framebuffer_hash')
    r['wram_hash'] = qa.get('wram_hash')
    r['apu_aot_misses'] = int(qa.get('apu_aot_misses', 0) or 0)
    if rc != 0:
        r['saida'] = out[-600:]
    shutil.rmtree(d, ignore_errors=True)
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ports', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--frames', type=int, default=1800)
    ap.add_argument('--only', default='')
    ap.add_argument('--env', action='append', default=[])
    ap.add_argument('--timeout', type=int, default=900)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    extra = dict(e.split('=', 1) for e in a.env)
    only = set(filter(None, a.only.split(',')))
    rows = []
    for name in sorted(os.listdir(a.ports)):
        port = os.path.join(a.ports, name)
        if not os.path.isdir(port) or (only and name not in only):
            continue
        r = bench(port, a.frames, extra, a.timeout)
        r['nome'] = name
        rows.append(r)
        pf = r.get('perf', {})
        print('%-48s fps=%8.1f  p99=%6s ms  ppu=%5s%%  interp=%d' % (
            name, pf.get('quadros_por_segundo', 0), pf.get('quadro_ms', {}).get('p99', '-'), pf.get('ppu_pct', '-'),
            r.get('cpu_interpretadas', -1)), flush=True)
    ok = [r for r in rows if 'perf' in r and r.get('retorno') == 0]
    fps = [r['perf']['quadros_por_segundo'] for r in ok]
    p99 = [r['perf'].get('quadro_ms', {}).get('p99') for r in ok if r['perf'].get('quadro_ms')]
    ntsc = 21477272.7 / (1364.0 * 262.0 - 2.0)
    summary = {
        'formato': 'forja65-rev205-desempenho-global-1', 'quadros_por_port': a.frames, 'ports': len(rows), 'ports_ok': len(ok),
        'fps_min': round(min(fps), 1) if fps else None, 'fps_mediana': round(statistics.median(fps), 1) if fps else None,
        'fps_media_geometrica': round(statistics.geometric_mean(fps), 1) if fps else None,
        'tempo_real_min_x': round(min(fps) / ntsc, 2) if fps else None,
        'ports_abaixo_do_tempo_real': [r['nome'] for r in ok if r['perf']['quadros_por_segundo'] < ntsc],
        'p99_ms_pior': round(max(p99), 2) if p99 else None,
        'ports_com_p99_acima_de_16_64ms': [r['nome'] for r in ok if (r['perf'].get('quadro_ms') or {}).get('p99', 0) > 16.64],
        'cpu_instrucoes_total': sum(r.get('cpu_instrucoes', 0) for r in ok),
        'cpu_interpretadas_total': sum(r.get('cpu_interpretadas', 0) for r in ok),
        'ports_com_interpretador': [r['nome'] for r in ok if r.get('cpu_interpretadas', 0) > 0],
        'ambiente': {'nproc': os.cpu_count(), 'env': extra},
    }
    tot = summary['cpu_instrucoes_total']
    summary['cpu_interpretada_pct'] = round(100.0 * summary['cpu_interpretadas_total'] / tot, 4) if tot else None
    json.dump({'resumo': summary, 'ports': rows}, open(os.path.join(a.out, 'desempenho.json'), 'w'), indent=1)
    print(json.dumps(summary, indent=1))


if __name__ == '__main__':
    main()
