#!/usr/bin/env python3
"""Forja65 REV205 - bateria de conformidade de hardware contra DOIS emuladores independentes.

Para cada ROM do corpus (ROMs de teste de codigo aberto: PeterLemon/SNES, undisbeliever/snes-test-roms, ...):
  1. gera o port com o Forja (analyze), sem nenhum conhecimento previo;
  2. compila so o alvo 'game';
  3. roda o port em modo de controle (FORJA65_CONTROL=1, parada no VBlank) e as referencias libretro
     (bsnes = arbitro exato, Snes9x = segunda opiniao) com as mesmas entradas;
  4. em cada ponto de controle grava o estado completo (FJDMP1) dos tres e compara
     VRAM, OAM, CGRAM, WRAM e a imagem (quantizada para 5 bits por canal, como o hardware).

Cada ROM declara as areas que exercita (vram, oam, cgram, dma, hdma, ...). A nota de cada area e
a fracao de ROMs/pontos em que o port fica IDENTICO ao bsnes. Quando bsnes e Snes9x discordam entre si
o ponto e marcado como 'referencias_divergem' e nao conta contra o port.

Uso:
  python3 conformance.py --corpus corpus.json --forja RAIZ_DO_FORJA --refemu refemu \
      --core bsnes=bsnes_libretro.so --core snes9x=snes9x_libretro.so --out pasta [--work pasta_ports] [--only nome,...]
"""
import argparse, hashlib, json, os, shutil, struct, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'libretro-reference'))
sys.path.insert(0, os.path.join(HERE, '..', 'libretro-reference', 'comparacao'))
import emu as _emu  # noqa: E402
from portemu import PortEmu  # noqa: E402

AREAS = ('vram', 'oam', 'cgram', 'wram', 'framebuffer')


def sha256(p):
    h = hashlib.sha256()
    with open(p, 'rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            h.update(b)
    return h.hexdigest()


def parse_dump(path):
    b = open(path, 'rb').read()
    if b[:6] != b'FJDMP1':
        raise ValueError('dump invalido: ' + path)
    fr, = struct.unpack_from('<Q', b, 8)
    regs = struct.unpack_from('<10I', b, 16)
    o = 56
    d = dict(frame=fr, pc=regs[0], v=regs[9])
    d['wram'] = b[o:o + 0x20000]; o += 0x20000
    d['vram'] = b[o:o + 0x10000]; o += 0x10000
    d['oam'] = b[o:o + 544]; o += 544
    d['cgram'] = b[o:o + 512]; o += 512
    d['w'], d['h'] = struct.unpack_from('<II', b, o); o += 8
    d['fb'] = b[o:o + d['w'] * d['h'] * 4]
    return d


def norm_cgram(c):
    # bit 7 do byte alto nao existe no hardware (cor de 15 bits)
    c = bytearray(c)
    for i in range(1, 512, 2):
        c[i] &= 0x7F
    return bytes(c)


def fb_rgb5(d):
    """Imagem como lista de linhas 256 de largura, RGB 5 bits. 512 de largura (hi-res) vira media de pares;
    448/478 de altura (entrelacado) vira linhas pares."""
    import numpy as np
    w, h = d['w'], d['h']
    if not w or not h or len(d['fb']) < w * h * 4:
        return None
    a = np.frombuffer(d['fb'], dtype=np.uint8).reshape(h, w, 4)[:, :, :3].astype(np.int32)
    # FJDMP1 grava BGRA (port, little-endian 0xAARRGGBB) e a referencia grava 0xFFRRGGBB: mesmo layout
    a = (a * 31 + 127) // 255
    if h >= 400:
        a = a[0::2]
    if w >= 500:
        a = (a[:, 0::2] + a[:, 1::2]) // 2
    return a


def fb_compare(A, B):
    import numpy as np
    x, y = fb_rgb5(A), fb_rgb5(B)
    if x is None or y is None:
        return {'comparavel': False}
    hh = min(x.shape[0], y.shape[0], 224)
    x, y = x[:hh], y[:hh]
    # tolera 1 nivel de 5 bits (diferencas de arredondamento de brilho/half-blend entre emuladores)
    diff = (np.abs(x - y) > 1).any(2)
    n = int(diff.sum())
    tot = int(diff.size)
    rows = np.where(diff.any(1))[0]
    return {'comparavel': True, 'pixels_diferentes': n, 'pixels': tot,
            'igual_pct': round(100.0 * (tot - n) / tot, 4),
            'linhas': [int(rows[0]), int(rows[-1])] if len(rows) else None}


def bytes_compare(x, y, ignore=()):
    n = len(x)
    diffs = [i for i in range(n) if x[i] != y[i] and not any(lo <= i <= hi for lo, hi in ignore)]
    return {'bytes_diferentes': len(diffs), 'bytes': n, 'igual_pct': round(100.0 * (n - len(diffs)) / n, 4),
            'primeiros': ['%05X' % i for i in diffs[:16]]}


def oam_compare(x, y):
    spr = [i for i in range(128) if x[i * 4:i * 4 + 4] != y[i * 4:i * 4 + 4]]
    hi = [i for i in range(32) if x[512 + i] != y[512 + i]]
    r = bytes_compare(x, y)
    r.update({'sprites': spr[:32], 'tabela_alta': hi})
    return r


def compare(R, P, areas, wram_ignore):
    out = {}
    if 'vram' in areas:
        out['vram'] = bytes_compare(R['vram'], P['vram'])
    if 'oam' in areas:
        out['oam'] = oam_compare(R['oam'], P['oam'])
    if 'cgram' in areas:
        out['cgram'] = bytes_compare(norm_cgram(R['cgram']), norm_cgram(P['cgram']))
    if 'wram' in areas:
        out['wram'] = bytes_compare(R['wram'], P['wram'], wram_ignore)
    if 'framebuffer' in areas:
        out['framebuffer'] = fb_compare(R, P)
    return out


def similarity(A, B):
    import numpy as np
    sc = 0.0
    for k in ('vram', 'oam', 'cgram'):
        sc += float((np.frombuffer(A[k], np.uint8) == np.frombuffer(B[k], np.uint8)).mean())
    wa = np.frombuffer(A['wram'], np.uint8).copy(); wb = np.frombuffer(B['wram'], np.uint8).copy()
    wa[0x1F00:0x2000] = 0; wb[0x1F00:0x2000] = 0
    sc += float((wa == wb).mean()) * 2
    fb = fb_compare(A, B)
    if fb.get('comparavel'):
        sc += fb['igual_pct'] / 100.0
    return sc


def area_equal(res, area, fb_min=100.0):
    r = res.get(area)
    if not r:
        return None
    if area == 'framebuffer':
        if not r.get('comparavel'):
            return None
        return r['igual_pct'] >= fb_min
    return r['bytes_diferentes'] == 0


def run(cmd, cwd=None, env=None, timeout=None, log=None):
    p = subprocess.run(cmd, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=timeout)
    if log:
        with open(log, 'a') as f:
            f.write('$ ' + ' '.join(cmd) + '\n' + p.stdout[-20000:] + '\n')
    return p


def build_env():
    e = dict(os.environ)
    if shutil.which('ccache'):
        e.setdefault('CCACHE_SLOPPINESS', 'pch_defines,time_macros,include_file_mtime,include_file_ctime,locale')
        e.setdefault('CCACHE_NOHASHDIR', '1')
    return e


def build_port(forja, rom, pdir, log, opt=''):
    """Gera (ou reaproveita) o port e compila so o alvo game. Retorna caminho do executavel."""
    exe = os.path.join(pdir, 'build', 'game')
    stamp = os.path.join(pdir, '.rev205-stamp')
    want = sha256(rom) + ':' + sha256(os.path.join(forja, 'forja65-core.js')) + ((':' + opt) if opt else '')
    if os.path.exists(exe) and os.path.exists(stamp) and open(stamp).read() == want:
        return exe, 0.0
    t = time.time()
    if os.path.exists(pdir):
        shutil.rmtree(pdir)
    p = run(['node', os.path.join(forja, 'tools', 'forja65.js'), 'analyze', rom, '--out', pdir], log=log, timeout=900)
    if p.returncode != 0:
        raise RuntimeError('analyze falhou')
    flags = ['-DCMAKE_CXX_FLAGS_RELEASE=%s -DNDEBUG' % opt] if opt else []
    p = run(['cmake', '-S', pdir, '-B', os.path.join(pdir, 'build'), '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release'] + flags + (['-DCMAKE_CXX_COMPILER_LAUNCHER=ccache'] if shutil.which('ccache') else []), log=log, timeout=600)
    if p.returncode != 0:
        raise RuntimeError('cmake falhou')
    p = run(['ninja', '-C', os.path.join(pdir, 'build'), 'game'], log=log, timeout=3600, env=build_env())
    if p.returncode != 0 or not os.path.exists(exe):
        raise RuntimeError('compilacao falhou')
    open(stamp, 'w').write(want)
    return exe, time.time() - t


class Ref:
    def __init__(self, refemu, core, rom, name):
        _emu.REFEMU = refemu
        self.name = name
        self.e = _emu.Emu(rom=rom, core=core)

    def run(self, n, m=0):
        return self.e.run(n, m)

    def dump(self, path):
        r = self.e.cmd('dump ' + path)
        if r != 'ok':
            raise RuntimeError(self.name + ': dump falhou: ' + r)
        return parse_dump(path)

    def close(self):
        try:
            self.e.cmd('quit')
        except Exception:
            pass


def input_mask_at(events, f):
    m = 0
    for fr, mm in events:
        if fr > f:
            break
        m = mm
    return m


def test_rom(entry, args, cores, outdir):
    name = entry['nome']
    rom = os.path.abspath(os.path.join(os.path.dirname(args.corpus), entry['rom']))
    pdir = os.path.join(args.work, name)
    log = os.path.join(outdir, name + '.log')
    open(log, 'w').close()
    res = {'nome': name, 'rom': entry['rom'], 'rom_sha256': sha256(rom), 'areas': entry['areas'],
           'fonte': entry.get('fonte', ''), 'pontos': []}
    try:
        exe, bt = build_port(args.forja, rom, pdir, log, args.opt)
        res['compilacao_s'] = round(bt, 1)
    except Exception as e:  # noqa: BLE001
        res['erro'] = 'port: ' + str(e)
        return res
    events = [(int(f), int(m, 16)) for f, m in entry.get('entradas', [])]
    checkpoints = sorted(entry.get('quadros', [60, 120]))
    cmp_areas = set(a for a in entry['areas'] if a in AREAS) | {'framebuffer'}
    if any(a in entry['areas'] for a in ('dma', 'hdma', 'vram')):
        cmp_areas |= {'vram'}
    if 'dma' in entry['areas']:
        cmp_areas |= {'oam', 'cgram'}
    wram_ignore = [(0x1F00, 0x1FFF)]  # pilha: depende do ponto exato de parada da CPU
    refs, port = {}, None
    try:
        port = PortEmu(game=exe, assets=os.path.join(pdir, 'assets'),
                       extra_env={'FORJA65_POWERON': args.poweron, 'FORJA65_CONTROL_AT': 'vblank',
                                  'FORJA65_WATCHDOG_INSTRUCTIONS': '0'})
        start = port.frame()
        for cname, core in cores.items():
            refs[cname] = Ref(args.refemu, core, rom, cname)
            refs[cname].run(start + 1, 0)  # 1o retro_run vai do reset ao 1o VBlank
        f = start
        tmp = os.path.join(outdir, '.dumps')
        os.makedirs(tmp, exist_ok=True)
        W = args.align
        offsets = None
        for F in checkpoints:
            first = offsets is None
            # no 1o ponto as referencias param 1 quadro antes da janela: o estado salvo de cada deslocamento e o do
            # quadro anterior, e o quadro escolhido e rodado de novo depois do load (o load nao refaz a imagem)
            target_ref = F - W - 1 if first else F
            while f < F:
                n = F - f
                nxt = [fr for fr, _ in events if f < fr < F]
                if nxt:
                    n = nxt[0] - f
                m = input_mask_at(events, f)
                port.run(n, m)
                nr = min(n, max(0, target_ref - f))
                if nr:
                    for r in refs.values():
                        r.run(nr, m)
                f += n
            pp = os.path.join(tmp, name + '.p')
            if port.cmd('dump ' + pp) != 'ok':
                raise RuntimeError('port: dump falhou')
            P = parse_dump(pp)
            if first:
                # Alinhamento: emuladores diferentes nao terminam o boot no mesmo quadro (bsnes e Snes9x chegam
                # a diferir 2 quadros). No 1o ponto cada referencia e testada de F-W a F+W e fica no quadro que
                # mais se parece com o port; o deslocamento vale para o resto da ROM e vai para o relatorio.
                offsets = {}
                m = input_mask_at(events, F)
                for k, r in refs.items():
                    best = None
                    for j in range(-W, W + 1):
                        r.e.save('al%d' % (j + W))
                        r.run(1, m)
                        R = r.dump(os.path.join(tmp, name + '.' + k))
                        sc = similarity(R, P)
                        if best is None or (sc, -abs(j)) > (best[0], -abs(best[1])):
                            best = (sc, j)
                    r.e.load('al%d' % (best[1] + W))
                    r.run(1, m)
                    offsets[k] = best[1]
            D = {k: r.dump(os.path.join(tmp, name + '.' + k)) for k, r in refs.items()}
            ponto = {'quadro': F, 'port_pc': '%06X' % P['pc'], 'deslocamento_referencias': dict(offsets)}
            arb = args.arbiter if args.arbiter in D else next(iter(D))
            ponto['contra_' + arb] = compare(D[arb], P, cmp_areas, wram_ignore)
            for k in D:
                if k == arb:
                    continue
                ponto['contra_' + k] = compare(D[k], P, cmp_areas, wram_ignore)
                ponto['referencias_' + arb + '_x_' + k] = compare(D[arb], D[k], cmp_areas, wram_ignore)
            # veredito por area
            ver = {}
            for a in cmp_areas:
                eq = area_equal(ponto['contra_' + arb], a, args.fb_min)
                if eq is None:
                    continue
                refs_agree = True
                for k in D:
                    if k != arb:
                        refs_agree = refs_agree and bool(area_equal(ponto['referencias_' + arb + '_x_' + k], a, args.fb_min))
                if eq:
                    ver[a] = 'IGUAL'
                elif not refs_agree:
                    ver[a] = 'REFERENCIAS_DIVERGEM'
                else:
                    ver[a] = 'DIVERGE'
            ponto['veredito'] = ver
            res['pontos'].append(ponto)
            if args.shots:
                port.cmd('shot ' + os.path.join(outdir, '%s-%d-port.ppm' % (name, F)))
                for k, r in refs.items():
                    r.e.cmd('shot ' + os.path.join(outdir, '%s-%d-%s.ppm' % (name, F, k)))
    except Exception as e:  # noqa: BLE001
        res['erro'] = 'execucao: ' + str(e)
    finally:
        if port:
            port.close()
        for r in refs.values():
            r.close()
    return res


def score(results, arbiter):
    """Nota medida por area: IGUAL / (IGUAL + DIVERGE). Pontos onde as referencias divergem nao contam."""
    by = {}
    for r in results:
        tags = list(r['areas'])
        if r.get('erro'):
            for t in tags:
                b = by.setdefault(t, {'igual': 0, 'diverge': 0, 'refs_divergem': 0, 'erro': 0, 'roms': set()})
                b['erro'] += 1
                b['roms'].add(r['nome'])
            continue
        for p in r['pontos']:
            ver = p['veredito']
            # cada etiqueta da ROM e julgada pelas areas de memoria que ela afeta + imagem
            for t in tags:
                b = by.setdefault(t, {'igual': 0, 'diverge': 0, 'refs_divergem': 0, 'erro': 0, 'roms': set()})
                b['roms'].add(r['nome'])
                keys = {'dma': ('vram', 'oam', 'cgram', 'framebuffer'), 'hdma': ('framebuffer',),
                        'vram': ('vram', 'framebuffer'), 'oam': ('oam', 'framebuffer'),
                        'cgram': ('cgram', 'framebuffer')}.get(t, ('framebuffer',))
                if 'wram' in tags:  # ROMs que gravam o resultado das leituras de porta na WRAM
                    keys = tuple(keys) + ('wram',)
                vs = [ver[k] for k in keys if k in ver]
                if not vs:
                    continue
                if 'DIVERGE' in vs:
                    b['diverge'] += 1
                elif all(v == 'IGUAL' for v in vs):
                    b['igual'] += 1
                else:
                    b['refs_divergem'] += 1
    out = {}
    for t, b in sorted(by.items()):
        tot = b['igual'] + b['diverge'] + b['erro']
        strict = tot + b['refs_divergem']
        out[t] = {'pontos_iguais': b['igual'], 'pontos_divergentes': b['diverge'], 'roms_com_erro': b['erro'],
                  'referencias_divergem': b['refs_divergem'], 'roms': len(b['roms']),
                  # estrita: o bsnes e o arbitro em todos os pontos (inclusive quando o Snes9x discorda dele)
                  'nota_medida_0a10': round(10.0 * b['igual'] / strict, 2) if strict else None,
                  # sem os pontos em que as duas referencias discordam entre si
                  'nota_sem_pontos_ambiguos_0a10': round(10.0 * b['igual'] / tot, 2) if tot else None}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', required=True)
    ap.add_argument('--forja', required=True)
    ap.add_argument('--refemu', required=True)
    ap.add_argument('--core', action='append', default=[], help='nome=caminho do core libretro (repetir)')
    ap.add_argument('--arbiter', default='bsnes')
    ap.add_argument('--out', required=True)
    ap.add_argument('--work', default='')
    ap.add_argument('--only', default='')
    ap.add_argument('--poweron', default='snes9x')
    ap.add_argument('--fb-min', type=float, default=100.0, help='%% minimo de pixels iguais para a imagem contar como igual')
    ap.add_argument('--shots', action='store_true')
    ap.add_argument('--opt', default='', help='otimizacao do compilador para os ports (ex.: -O1 compila mais rapido; padrao: a do CMake Release)')
    ap.add_argument('--resume', action='store_true', help='mantem o conformidade.jsonl e pula ROMs ja testadas')
    ap.add_argument('--align', type=int, default=3, help='janela de alinhamento de quadros das referencias (+-W)')
    args = ap.parse_args()
    args.corpus = os.path.abspath(args.corpus)
    args.forja = os.path.abspath(args.forja)
    args.refemu = os.path.abspath(args.refemu)
    args.out = os.path.abspath(args.out)
    args.work = os.path.abspath(args.work or os.path.join(args.out, 'ports'))
    os.makedirs(args.out, exist_ok=True)
    os.makedirs(args.work, exist_ok=True)
    cores = {}
    for c in args.core:
        k, v = c.split('=', 1)
        cores[k] = os.path.abspath(v)
    if not cores:
        sys.exit('informe pelo menos um --core')
    corpus = json.load(open(args.corpus))
    only = set(filter(None, args.only.split(',')))
    results = []
    jl = os.path.join(args.out, 'conformidade.jsonl')
    done = set()
    if args.resume and os.path.exists(jl):
        for line in open(jl):
            try:
                r = json.loads(line)
            except ValueError:
                continue
            results.append(r)
            done.add(r['nome'])
    with open(jl, 'a' if args.resume else 'w') as jf:
        for entry in corpus['roms']:
            if only and entry['nome'] not in only:
                continue
            if entry['nome'] in done:
                continue
            t = time.time()
            r = test_rom(entry, args, cores, args.out)
            r['segundos'] = round(time.time() - t, 1)
            results.append(r)
            jf.write(json.dumps(r) + '\n'); jf.flush()
            summ = r.get('erro') or ' '.join('%d:%s' % (p['quadro'], ','.join('%s=%s' % kv for kv in sorted(p['veredito'].items()))) for p in r['pontos'])
            print('[%s] %s' % (r['nome'], summ), flush=True)
    rep = {'formato': 'forja65-rev205-conformidade-1', 'arbitro': args.arbiter,
           'cores': {k: {'arquivo': os.path.basename(v), 'sha256': sha256(v)} for k, v in cores.items()},
           'forja_core_sha256': sha256(os.path.join(args.forja, 'forja65-core.js')),
           'notas': score(results, args.arbiter), 'roms': results}
    json.dump(rep, open(os.path.join(args.out, 'conformidade.json'), 'w'), indent=1)
    print(json.dumps(rep['notas'], indent=1))


if __name__ == '__main__':
    main()
