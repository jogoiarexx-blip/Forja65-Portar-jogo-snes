#!/usr/bin/env python3
"""Forja65 REV205 - prova INDEPENDENTE de jogabilidade de um port.

Ideia: a rota que o port joga (gravada quadro a quadro, por exemplo com FORJA65_INPUT_LOGIC_WALL_OUT ou
FORJA65_INPUT_RECORD) e reproduzida desde o power-on em dois emuladores de codigo aberto que nao tem
nada do Forja (bsnes = arbitro exato, Snes9x = segunda opiniao). Se o jogo de verdade, com as mesmas
entradas, passa pelos mesmos marcos e chega ao mesmo estado, a jogabilidade do port fica comprovada por
quem nao foi escrito pelo Forja.

Em cada amostra (--step quadros) os tres gravam o estado completo e se compara:
  - estado logico: enderecos de WRAM escolhidos (--logic 0100,13BF,...) - o que importa para o jogo;
  - WRAM inteira (sem a pilha), OAM, CGRAM, VRAM e a imagem (5 bits por canal);
  - marcos (--milestones marcos.json): condicoes de WRAM, com o 1o quadro em que cada lado chega.

Veredito:
  IDENTICO_AO_BSNES     estado (WRAM inteira sem a pilha, VRAM, OAM, CGRAM), estado logico e imagem iguais ao bsnes
                        em todas as amostras
  ESTADO_IDENTICO_AO_BSNES  o jogo (WRAM, VRAM, OAM, CGRAM) e igual ao bsnes em todas as amostras; alguma imagem difere
                        (diferenca so de desenho, listada em primeira_divergencia/imagem_*)
  MARCOS_COMPROVADOS    todos os marcos atingidos pelo port e pelo bsnes, com estado logico igual neles
  DIVERGE               algum marco nao foi atingido pelo bsnes ou o estado logico diverge em um marco

Uso:
  python3 gameplay-proof.py --rom jogo.sfc --game PORT/build/game --assets PORT/assets --input rota.trace \
     --refemu refemu --core bsnes=bsnes_libretro.so --core snes9x=snes9x_libretro.so --out prova \
     [--frames N] [--step 60] [--logic 0100,0013,0094,0095,0096,0097] [--milestones marcos.json]

Formato de marcos.json:
  [{"nome": "fase 1 concluida", "wram": {"0100": "0b"}}, {"nome": "creditos", "wram": {"0100": "15", "13c6": "08"}}]
"""
import argparse, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import importlib.util  # noqa: E402
_spec = importlib.util.spec_from_file_location('conformance', os.path.join(HERE, 'conformance.py'))
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)
PortEmu = C.PortEmu


def read_trace(path):
    ev, env = [], {}
    for line in open(path):
        if line.startswith('# FORJA65_ENV '):
            k, v = line[14:].strip().split('=', 1)
            env[k] = v
        if line.startswith('frame='):
            f = int(line.split()[0][6:])
            m = int(line.split('joy1=')[1].split()[0], 16)
            ev.append((f, m))
    return ev, env


def mask_at(ev, f):
    m = 0
    for fr, mm in ev:
        if fr > f:
            break
        m = mm
    return m


def milestone_hit(d, ms):
    w = d['wram']
    for a, v in ms['wram'].items():
        if w[int(a, 16) & 0x1FFFF] != int(v, 16):
            return False
    return True


def main():
    ap = argparse.ArgumentParser()
    for k in ('rom', 'game', 'assets', 'input', 'refemu', 'out'):
        ap.add_argument('--' + k, required=True)
    ap.add_argument('--core', action='append', default=[])
    ap.add_argument('--arbiter', default='bsnes')
    ap.add_argument('--frames', type=int, default=0, help='0 = ate o ultimo evento da rota + 600')
    ap.add_argument('--step', type=int, default=60)
    ap.add_argument('--align', type=int, default=4)
    ap.add_argument('--align-at', type=int, default=0, help='quadro do alinhamento (padrao: antes da 1a entrada)')
    ap.add_argument('--logic', default='', help='enderecos WRAM do estado logico, hex separados por virgula')
    ap.add_argument('--milestones', default='')
    ap.add_argument('--poweron', default='snes9x')
    ap.add_argument('--keep', type=int, default=6)
    ap.add_argument('--shots', type=int, default=0, help='salva ate N imagens lado a lado (port | arbitro) das amostras com imagem diferente')
    a = ap.parse_args()
    for k in ('rom', 'game', 'assets', 'input', 'refemu', 'out'):
        setattr(a, k, os.path.abspath(getattr(a, k)))
    os.makedirs(a.out, exist_ok=True)
    cores = dict((c.split('=', 1)[0], os.path.abspath(c.split('=', 1)[1])) for c in a.core)
    if a.arbiter not in cores:
        sys.exit('o arbitro %s precisa estar em --core' % a.arbiter)
    ev, env = read_trace(a.input)
    if not ev:
        sys.exit('rota sem eventos frame=/joy1=')
    frames_end = a.frames or (ev[-1][0] + 600)
    logic = [int(x, 16) for x in a.logic.split(',') if x.strip()]
    milestones = json.load(open(a.milestones)) if a.milestones else []

    pe = dict(env)
    pe.update({'FORJA65_POWERON': a.poweron, 'FORJA65_CONTROL_AT': 'vblank', 'FORJA65_WATCHDOG_INSTRUCTIONS': '0'})
    port = PortEmu(game=a.game, assets=a.assets, extra_env=pe)
    start = port.frame()
    refs = {}
    for k, c in cores.items():
        refs[k] = C.Ref(a.refemu, c, a.rom, k)
        refs[k].run(start + 1, 0)
    tmp = os.path.join(a.out, '.dumps')
    os.makedirs(tmp, exist_ok=True)

    # 1) alinhamento antes da primeira entrada (o boot de cada emulador termina em quadros diferentes)
    first_input = next((f for f, m in ev if m), ev[0][0])
    align_at = a.align_at or max(start + a.align + 2, min(first_input - 2, start + 600))
    f = start
    port.run(align_at - f, 0)
    for r in refs.values():
        r.run(align_at - a.align - f, 0)
    f = align_at
    P = C.parse_dump(_dump(port, tmp, 'p'))
    offsets = {}
    for k, r in refs.items():
        best = None
        for j in range(-a.align, a.align + 1):
            r.e.save('al%d' % (j + a.align))
            sc = C.similarity(r.dump(os.path.join(tmp, k)), P)
            if best is None or (sc, -abs(j)) > (best[0], -abs(best[1])):
                best = (sc, j)
            if j < a.align:
                r.run(1, 0)
        r.e.load('al%d' % (best[1] + a.align))
        offsets[k] = best[1]
    print('alinhamento no quadro', align_at, offsets, flush=True)

    # 2) rota inteira, amostrando
    arb_name = a.arbiter
    log = open(os.path.join(a.out, 'amostras.jsonl'), 'w')
    first_div = {}
    detail = {}
    reached = {ms['nome']: {} for ms in milestones}
    ms_state = {ms['nome']: {} for ms in milestones}
    samples = 0
    equal_logic = {k: 0 for k in refs}
    equal_fb = {k: 0 for k in refs}
    equal_state = {k: 0 for k in refs}
    t0 = time.time()
    next_sample = align_at + a.step
    while f < frames_end:
        target = min(next_sample, frames_end)
        nxt = [fr for fr, _ in ev if f < fr < target]
        n = (nxt[0] if nxt else target) - f
        m = mask_at(ev, f)
        port.run(n, m)
        for r in refs.values():
            r.run(n, m)
        f += n
        if f < target:
            continue
        next_sample += a.step
        P = C.parse_dump(_dump(port, tmp, 'p'))
        D = {k: r.dump(os.path.join(tmp, k)) for k, r in refs.items()}
        samples += 1
        rec = {'quadro': f}
        for k, R in D.items():
            lg = [x for x in logic if R['wram'][x] != P['wram'][x]]
            fb = C.fb_compare(R, P)
            cmpr = C.compare(R, P, {'wram', 'oam', 'cgram', 'vram'}, [(0x1F00, 0x1FFF)])
            rec[k] = {'logico_diferente': ['%05X' % x for x in lg], 'imagem_igual_pct': fb.get('igual_pct'),
                      **{kk: vv['igual_pct'] for kk, vv in cmpr.items()}}
            if not lg:
                equal_logic[k] += 1
            elif 'logico_' + k not in first_div:
                first_div['logico_' + k] = f
                detail['logico_' + k] = {'quadro': f, 'enderecos': {('%05X' % x): [R['wram'][x], P['wram'][x]] for x in lg}}
            if all(cmpr[kk]['bytes_diferentes'] == 0 for kk in ('wram', 'oam', 'cgram', 'vram')):
                equal_state[k] += 1
            elif 'estado_' + k not in first_div:
                first_div['estado_' + k] = f
                detail['estado_' + k] = {'quadro': f, **{kk: cmpr[kk]['primeiros'][:8] for kk in ('wram', 'oam', 'cgram', 'vram') if cmpr[kk]['bytes_diferentes']}}
            if fb.get('igual_pct') == 100.0:
                equal_fb[k] += 1
            elif 'imagem_' + k not in first_div:
                first_div['imagem_' + k] = f
        if a.shots and rec[arb_name]['imagem_igual_pct'] not in (None, 100.0):
            a.shots -= 1
            try:
                save_pair(P, D[arb_name], os.path.join(a.out, 'imagem-%d.png' % f))
            except Exception:  # noqa: BLE001
                pass
        for ms in milestones:
            nm = ms['nome']
            for side, d in [('port', P)] + list(D.items()):
                if side not in reached[nm] and milestone_hit(d, ms):
                    reached[nm][side] = f
                    if logic:
                        ms_state[nm][side] = ['%02X' % d['wram'][x] for x in logic]
        log.write(json.dumps(rec) + '\n')
        if samples % 50 == 0:
            print('quadro', f, 'divergencias', first_div, '%.0fs' % (time.time() - t0), flush=True)
    port.close()
    for r in refs.values():
        r.close()

    arb = a.arbiter
    all_logic = equal_logic[arb] == samples
    all_fb = equal_fb[arb] == samples
    ms_ok = all(('port' in reached[nm] and arb in reached[nm]) for nm in reached)
    ms_same_state = all(ms_state[nm].get('port') == ms_state[nm].get(arb) for nm in ms_state) if logic else True
    all_state = equal_state[arb] == samples
    if all_logic and all_fb and all_state:
        verdict = 'IDENTICO_AO_BSNES'
    elif all_logic and all_state:
        verdict = 'ESTADO_IDENTICO_AO_BSNES'
    elif milestones and ms_ok and ms_same_state:
        verdict = 'MARCOS_COMPROVADOS'
    else:
        verdict = 'DIVERGE'
    rep = {'formato': 'forja65-rev205-prova-jogabilidade-1', 'veredito': verdict,
           'rom_sha256': C.sha256(a.rom), 'port_sha256': C.sha256(a.game), 'rota_sha256': C.sha256(a.input),
           'cores': {k: {'arquivo': os.path.basename(v), 'sha256': C.sha256(v)} for k, v in cores.items()},
           'quadros': [start, f], 'passo': a.step, 'amostras': samples, 'alinhamento': {'quadro': align_at, 'deslocamentos': offsets},
           'amostras_logico_igual': equal_logic, 'amostras_estado_igual': equal_state, 'amostras_imagem_igual': equal_fb,
           'primeira_divergencia': first_div, 'detalhe': detail,
           'marcos': {nm: {'atingido_em': reached[nm], 'estado_logico': ms_state[nm]} for nm in reached},
           'enderecos_logicos': ['%05X' % x for x in logic], 'perfil_rota': env}
    json.dump(rep, open(os.path.join(a.out, 'prova.json'), 'w'), indent=1)
    print(json.dumps({k: rep[k] for k in ('veredito', 'amostras', 'amostras_logico_igual', 'amostras_estado_igual', 'amostras_imagem_igual', 'primeira_divergencia', 'marcos')}, indent=1))


def save_pair(P, R, path):
    import numpy as np
    from PIL import Image
    x, y = C.fb_rgb5(P), C.fb_rgb5(R)
    h = min(x.shape[0], y.shape[0])
    x, y = x[:h], y[:h]
    diff = (np.abs(x - y) > 1).any(2)
    to8 = lambda a: (a * 255 // 31).astype(np.uint8)[:, :, ::-1]
    mark = np.zeros_like(to8(x)); mark[diff] = (255, 0, 255)
    Image.fromarray(np.concatenate([to8(x), to8(y), mark], 1)).resize((x.shape[1] * 6, h * 2)).save(path)


def _dump(port, tmp, name):
    p = os.path.join(tmp, name)
    if port.cmd('dump ' + p) != 'ok':
        raise RuntimeError('port: dump falhou')
    return p


if __name__ == '__main__':
    main()
