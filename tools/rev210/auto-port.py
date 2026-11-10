#!/usr/bin/env python3
"""Forja65 REV210: porte autonomo em ciclo fechado.

Faz sozinho o que era feito a mao no Kirby:
  1. gera o port (analyze) se ainda nao existe, compila;
  2. roda a rota em AOT ESTRITO (sem interpretador). Se completar, vai para a prova;
  3. se parar numa fronteira nao resolvida, roda a MESMA rota em modo pesquisa (interpretador ligado, SA-1 interpretado),
     grava o log do interpretador (e a trilha de PCs do SA-1), aprende so o que faltou (learn-from-interpreter --port,
     compile-sa1-observed-rev203.js), recompila e volta ao passo 2;
  4. prova: roda a rota completa em estrito e confere (a) zero instrucoes interpretadas, (b) hash da imagem a cada
     --hash-every quadros igual ao modo pesquisa, (c) opcionalmente imagens iguais as de uma referencia externa.
Grava auto-port-relatorio.json e auto-port-relatorio.md na pasta do port. Nao inventa entradas: o que o interpretador nao viu
continua falhando fechado.

Uso:
  python3 tools/rev210/auto-port.py --rom jogo.sfc --port PASTA [--route rota.txt] [--frames 3000] [--sa1]
       [--max-iter 8] [--jobs 2] [--hash-every 300] [--opt -O1]
A rota e um arquivo de entradas ("frame=N joy1=XXXX" ou FORJA65_INPUT_REPLAY do port). Sem rota roda sem apertar nada.
"""
import re, argparse, csv, hashlib, json, os, shutil, struct, subprocess, sys, time, uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TAGSUF = 'x' + uuid.uuid4().hex[:12]   # avoid collisions between parallel launches


def sha256_file(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def sh(cmd, cwd=None, env=None, log=None, timeout=None, clean_forja_env=False):
    e = {k: v for k, v in os.environ.items() if not (clean_forja_env and k.startswith('FORJA65_'))}
    if env:
        e.update(env)
    try:
        if log:
            with open(log, 'w', encoding='utf-8') as out:
                return subprocess.run(cmd, cwd=cwd, env=e, stdout=out, stderr=subprocess.STDOUT,
                                      timeout=timeout).returncode
        return subprocess.run(cmd, cwd=cwd, env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                              timeout=timeout).returncode
    except subprocess.TimeoutExpired:
        if log:
            with open(log, 'a', encoding='utf-8') as out:
                out.write('\nTIMEOUT: process exceeded %d seconds\n' % timeout)
        return 124


def build(port, jobs, opt):
    b = port / 'build-auto'
    cfg = ['cmake', '-S', str(port), '-B', str(b), '-G', 'Ninja', '-DCMAKE_BUILD_TYPE=Release']
    if opt:
        cfg.append('-DCMAKE_CXX_FLAGS_RELEASE=' + opt + ' -DNDEBUG')
    if sh(cfg, log=str(port / 'auto-cmake.log')) != 0:
        raise SystemExit('cmake falhou, veja auto-cmake.log')
    if sh(['cmake', '--build', str(b), '--target', 'game', '--parallel', str(jobs)],
          log=str(port / 'auto-build.log')) != 0:
        raise SystemExit('compilacao falhou, veja auto-build.log')
    for candidate in (b / 'game.exe', b / 'game', b / 'Release' / 'game.exe'):
        if candidate.is_file():
            return candidate
    raise SystemExit('compilacao retornou sucesso, mas nao foi encontrado game/game.exe')


def route_input_mode(route):
    """Use the correct runtime loader for wall-frame, poll and logical replays.

    In particular, `.logic` is NOT `FORJA65_INPUT_REPLAY`: SMW REV204
    recordings advance on game logic frames (not wall-clock VBlank count).
    """
    if not route:
        return None
    with Path(route).open('r', encoding='utf-8-sig', errors='replace') as source:
        header=source.readline().strip()
    if header.startswith('# FORJA65_LOGIC_TRACE 1'):
        return 'FORJA65_INPUT_LOGIC'
    if header.startswith('# FORJA65_INPUT_POLL 1 rom='):
        return 'FORJA65_INPUT_POLL'
    return 'FORJA65_INPUT_REPLAY'


def read_logic_digests(path):
    """Read Forja REV200 digest records indexed by *logical* input, not VBlank.

    Each record: wall_frame u32, logical_index u32, fb FNV64, WRAM FNV64.
    A truncated, duplicate, out-of-order or missing record is not evidence.
    """
    p=Path(path)
    if not p.is_file():
        return {}
    data=p.read_bytes()
    if len(data) % 24:
        raise ValueError('LOGIC_DIGEST_OUT: arquivo truncado')
    values={}
    last_index=0
    for wall,index,fb,ram in struct.iter_unpack('<IIQQ',data):
        if index <= last_index or index > 10000000:
            raise ValueError('LOGIC_DIGEST_OUT: indices repetidos ou fora de ordem')
        values[index]=(fb,ram)
        last_index=index
    return values


def run_game(exe, port, tag, frames, route, strict, sa1, hash_every, sa1_trace=None, observe=None,
             scpu_trace=None, run_timeout=600, wram_capture=None):
    d = port / 'auto-runs' / tag
    shutil.rmtree(d, ignore_errors=True)          # saves/ antigo muda a imagem: sempre pasta limpa
    d.mkdir(parents=True)
    shutil.copytree(port / 'assets', d / 'assets')
    env = {'FORJA65_HEADLESS': '1', 'FORJA65_HEADLESS_FRAMES': str(frames),
           'FORJA65_WATCHDOG_INSTRUCTIONS': '4000000000',
           'FORJA65_FRAME_PROGRESS_CSV': 'progress.csv', 'FORJA65_FRAME_PROGRESS_EVERY': str(hash_every)}
    input_mode=route_input_mode(route)
    if route:
        env[input_mode] = str(Path(route).resolve())
        if input_mode=='FORJA65_INPUT_LOGIC':
            env['FORJA65_LOGIC_DIGEST_OUT']='logic-digests.bin'
    if wram_capture is not None:
        # Passive end-of-VBlank raw WRAM snapshots. No new emulation logic.
        step = int(wram_capture)
        if step < 1 or (frames - 1) // step + 1 > 128:
            raise ValueError('WRAM capture needs 1..128 evenly spaced samples')
        env.update({'FORJA65_WRAM_RAW_DIR':'wram-raw', 'FORJA65_WRAM_RAW_START':'0',
                    'FORJA65_WRAM_RAW_END':str(frames - 1),
                    'FORJA65_WRAM_RAW_STEP':str(step),
                    'FORJA65_WRAM_RAW_MAX':str((frames-1)//step+1)})
    if strict:
        env.update({'FORJA65_CPU_INTERPRETER': '0', 'FORJA65_AOT_ONLY': '1'})
        if sa1:
            env['FORJA65_SA1_MODE'] = 'strict'
    else:
        env['FORJA65_CPU_INTERPRETER'] = '1'
        if sa1:
            env['FORJA65_SA1_MODE'] = 'research'
        if sa1_trace:
            env['FORJA65_SA1_TRACE'] = str(sa1_trace)
        if scpu_trace:
            env['FORJA65_SCPU_TRACE'] = str(scpu_trace)   # instrucoes executadas a partir da WRAM (codigo copiado para a RAM)
        if observe:
            env['FORJA65_STACK_RETURN_OBSERVE'] = str(observe)   # todos os retornos por pilha que so passaram por causa do interpretador
    t0 = time.time()
    rc = sh([str(exe)], cwd=d, env=env, log=str(d / 'run.log'), timeout=run_timeout, clean_forja_env=True)
    dt = time.time() - t0
    audit = {}
    rep = d / 'forja65-native-dependency-report.txt'
    if rep.exists():
        audit = dict(l.split('=', 1) for l in rep.read_text().splitlines() if '=' in l)
    err = ''
    for n in ('forja65-last-error.txt', 'forja65-unresolved-targets.txt'):
        p = d / n
        if p.exists():
            err += p.read_text(errors='replace')[:400]
    logic_done=None
    done_file=d/'forja65-logic-replay-done.txt'
    if done_file.is_file():
        try:
            details=dict(line.split('=',1) for line in done_file.read_text().splitlines() if '=' in line)
            logic_done={'wall_frame':int(details['frame']), 'logic_inputs':int(details['logic_inputs'])}
        except (KeyError,ValueError):
            logic_done=None
    prog = {}
    pp = d / 'progress.csv'
    if pp.exists():
        for r in csv.reader(open(pp)):
            if r and r[0].isdigit():
                prog[int(r[0])] = (r[8].strip().lower().lstrip('0') or '0')
    logic_digests=read_logic_digests(d/'logic-digests.bin') if input_mode=='FORJA65_INPUT_LOGIC' else {}
    return {'dir': str(d), 'rc': rc, 'seconds': round(dt, 1), 'frames': int(audit.get('frames', '0') or 0),
            'cpu_interp': int(audit.get('cpu_interpreter_instructions', '-1') or -1),
            'sa1_interp': int(audit.get('sa1_interpreter_instructions', '0') or 0),
            'cpu_aot': int(audit.get('cpu_aot_instructions', '0') or 0), 'sa1_aot': int(audit.get('sa1_aot_instructions', '0') or 0),
            'error': err.strip(), 'hashes': prog, 'input_mode':route_input_mode(route),
            'logic_done':logic_done, 'logic_digests':logic_digests}


def load_hashes(path):
    # DKC1-style external reference contract: never assume equivalence from a partial CSV.
    values = {}
    with Path(path).open(newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None or 'frame' not in reader.fieldnames or 'fb_fnv1a64' not in reader.fieldnames:
            raise ValueError('oracle-progress: CSV precisa de frame,fb_fnv1a64')
        for row in reader:
            frame = int(row['frame'])
            digest = row['fb_fnv1a64'].strip().lower()
            if frame < 0 or frame in values or not re.fullmatch(r'[0-9a-f]{1,16}', digest):
                raise ValueError('oracle-progress: quadro/hash invalido ou duplicado')
            values[frame] = digest.lstrip('0') or '0'
    if not values:
        raise ValueError('oracle-progress: CSV vazio')
    return values


def synthetic_rows(strict_dir):
    """Linhas no formato do log do interpretador a partir da falha do modo estrito (retorno por pilha sem frame).
    O modo pesquisa so ve o que ainda NAO e nativo; a falha estrita diz exatamente qual retorno faltou."""
    d = Path(strict_dir)
    f = d / 'forja65-unresolved-returns.txt'
    if not f.exists():
        return []
    st = 'M0X0'
    ct = d / 'forja65-crash-trace.txt'
    if ct.exists():
        import re
        last = [l for l in ct.read_text(errors='replace').splitlines() if re.search(r' E=\d M=\d X8=\d', l)]
        if last:
            m = re.search(r' E=(\d) M=(\d) X8=(\d)', last[-1])
            st = 'E1' if m.group(1) == '1' else 'M%sX%s' % (m.group(2), m.group(3))
    rows = []
    for l in f.read_text().splitlines():
        p = l.split()
        if len(p) >= 3 and p[1] == '->':
            rows.append('%06X %s from=%06X count=1' % (int(p[2], 16), st, int(p[0], 16)))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rom', required=True)
    ap.add_argument('--port', required=True)
    ap.add_argument('--route')
    ap.add_argument('--frames', type=int, default=3000)
    ap.add_argument('--sa1', action='store_true')
    ap.add_argument('--max-iter', type=int, default=8)
    ap.add_argument('--jobs', type=int, default=2)
    ap.add_argument('--hash-every', type=int, default=300)
    ap.add_argument('--opt', default='-O1')
    ap.add_argument('--budget', default='20000')
    ap.add_argument('--run-timeout', type=int, default=600)
    ap.add_argument('--rom-sha256', help='sha256 exato fixado pelo contrato (opcional)')
    ap.add_argument('--oracle-progress', type=Path, help='CSV externo com hashes por quadro, opcional')
    a = ap.parse_args()
    if not (1 <= a.frames <= 1000000 and 1 <= a.hash_every <= a.frames and
            1 <= a.max_iter <= 100 and 1 <= a.jobs <= 128 and 1 <= a.run_timeout <= 86400):
        ap.error('frames/hash-every/max-iter/jobs/run-timeout fora dos limites')
    port = Path(a.port).resolve()
    rom = Path(a.rom).resolve()
    if not rom.is_file():
        ap.error('ROM nao encontrada: ' + str(rom))
    if a.route and not Path(a.route).is_file():
        ap.error('rota nao encontrada: ' + str(a.route))
    rom_sha = sha256_file(rom)
    if a.rom_sha256 and (not re.fullmatch(r'[a-fA-F0-9]{64}', a.rom_sha256) or rom_sha != a.rom_sha256.lower()):
        ap.error('ROM recusada: SHA-256 diferente do contrato')
    # A previous port is tied to its exact compiled ROM. No implicit cross-ROM reuse.
    cart = port / 'assets' / 'cart-data.bin'
    if (port / 'src' / 'runtime.hpp').exists():
        if not cart.is_file() or sha256_file(cart) != rom_sha:
            ap.error('projeto existente pertence a outra ROM (ou assets ausentes); escolha outra pasta')
    oracle = None
    if a.oracle_progress:
        oracle = load_hashes(a.oracle_progress)
    expected_frames = set(range(a.hash_every, a.frames + 1, a.hash_every))
    if oracle is not None and set(oracle) != expected_frames:
        ap.error('CSV oracle deve conter exatamente os quadros amostrados do contrato')
    log = []
    rep = {'schema': 'forja65.autoport.v2', 'rom': rom.name, 'rom_sha256': rom_sha,
           'route_sha256': sha256_file(a.route) if a.route else None,
           'oracle_sha256': sha256_file(a.oracle_progress) if a.oracle_progress else None,
           'frames': a.frames, 'hash_every': a.hash_every, 'iteracoes': [], 'veredito': 'EM_ANDAMENTO'}

    def save():
        (port / 'auto-port-relatorio.json').write_text(json.dumps(rep, indent=1))
        md = ['# Porte autonomo REV210', '', 'ROM: %s  |  quadros: %d  |  veredito: **%s**' % (rom.name, a.frames, rep['veredito']), '']
        for i, it in enumerate(rep['iteracoes'], 1):
            md.append('%d. %s' % (i, it.get('resumo', '')))
        (port / 'auto-port-relatorio.md').write_text('\n'.join(md) + '\n')

    if not (port / 'src' / 'runtime.hpp').exists():
        r = sh(['node', str(ROOT / 'tools' / 'forja65.js'), 'analyze', str(rom), '--out', str(port)], log=str(port.parent / (port.name + '-analyze.log')))
        if r != 0:
            raise SystemExit('analyze falhou')
        rep['iteracoes'].append({'resumo': 'port gerado com a REV210'})
    exe = build(port, a.jobs, a.opt)
    last_sig = None
    for it in range(1, a.max_iter + 1):
        s = run_game(exe, port, 'estrito-%d' % it, a.frames, a.route, True, a.sa1, a.hash_every, run_timeout=a.run_timeout)
        ok = (s['frames'] >= a.frames and s['rc'] == 0 and s['cpu_interp'] == 0
              and s['sa1_interp'] == 0 and s['cpu_aot'] > 0
              and (route_input_mode(a.route) != 'FORJA65_INPUT_LOGIC' or s['logic_done'] is not None))
        rep['iteracoes'].append({'resumo': 'estrito %d: quadros %d/%d, interp cpu=%d sa1=%d, aot cpu=%d sa1=%d, rc=%d %s' % (
            it, s['frames'], a.frames, s['cpu_interp'], s['sa1_interp'], s['cpu_aot'], s['sa1_aot'], s['rc'], s['error'][:120].replace('\n', ' '))})
        save()
        sig = (s['frames'], s['cpu_aot'], s['error'][:200])
        if not ok and sig == last_sig:      # mesma parada, mesmo ponto: o aprendizado nao mudou nada
            rep['veredito'] = 'SEM_PROGRESSO_MESMA_PARADA'
            rep['bloqueio'] = s['error'][:400]
            rep['iteracoes'].append({'resumo': 'sem progresso: a mesma falha apos aprender; a causa nao e lacuna de catalogo (investigar)'})
            save()
            print(rep['veredito'])
            return 4
        last_sig = sig
        if ok:
            ref = run_game(exe, port, 'pesquisa', a.frames, a.route, False, a.sa1, a.hash_every, run_timeout=a.run_timeout)
            strict_frames, research_frames = set(s['hashes']), set(ref['hashes'])
            missing_strict = sorted(expected_frames - strict_frames)
            missing_research = sorted(expected_frames - research_frames)
            extra_strict = sorted(strict_frames - expected_frames)
            extra_research = sorted(research_frames - expected_frames)
            common = sorted(expected_frames & strict_frames & research_frames)
            diff = [f for f in common if s['hashes'][f] != ref['hashes'][f]]
            oracle_diff = [f for f in sorted(expected_frames & set(oracle or {}))
                           if oracle is not None and s['hashes'].get(f) != oracle[f]]
            research_ok = (ref['rc'] == 0 and ref['frames'] >= a.frames
                           and (route_input_mode(a.route) != 'FORJA65_INPUT_LOGIC' or ref['logic_done'] is not None))
            logic_mode = route_input_mode(a.route) == 'FORJA65_INPUT_LOGIC'
            logic_ok=True
            logic_diff=[]
            if logic_mode:
                count=(s.get('logic_done') or {}).get('logic_inputs',0)
                indices=set(range(1,count+1)) if 0 < count <= 1000000 else set()
                sa=s.get('logic_digests',{})
                rb=ref.get('logic_digests',{})
                logic_diff=sorted(i for i in indices & set(sa) & set(rb) if sa[i] != rb[i])
                logic_ok=(bool(indices) and
                          (ref.get('logic_done') or {}).get('logic_inputs') == count and
                          set(sa) == indices and set(rb) == indices and not logic_diff)
            hashes_complete = not (missing_strict or missing_research or extra_strict or extra_research)
            rep['prova'] = {
                'amostras_esperadas': len(expected_frames), 'amostras_de_imagem': len(common),
                'amostras_diferentes': diff[:20], 'oracle_diferentes': oracle_diff[:20],
                'faltando_estrito': missing_strict[:20], 'faltando_pesquisa': missing_research[:20],
                'extras_estrito': extra_strict[:20], 'extras_pesquisa': extra_research[:20],
                'pesquisa_completa': research_ok, 'oracle_fornecido': oracle is not None,
                'logico_completo':logic_ok,'primeira_diferenca_logica':logic_diff[:1],
                'estrito': {k: v for k, v in s.items() if k not in ('hashes','logic_digests')},
                'pesquisa': {k: v for k, v in ref.items() if k not in ('hashes','logic_digests')}
            }
            if research_ok and hashes_complete and logic_ok and (not diff or logic_mode) and not oracle_diff:
                rep['veredito'] = ('APROVADO_ESTRITO_PESQUISA_E_ORACLE_FORNECIDO' if oracle is not None
                                   else 'APROVADO_ESTRITO_IGUAL_A_PESQUISA')
            else:
                rep['veredito'] = 'PROVA_INCOMPLETA_OU_DIVERGENTE'
            rep['iteracoes'].append({'resumo': 'prova: %d/%d amostras, %d divergentes (oracle %s), pesquisa %s' %
                                     (len(common), len(expected_frames), len(diff), len(oracle_diff), research_ok)})
            save()
            print(rep['veredito'])
            return 0 if rep['veredito'].startswith('APROVADO') else 1
        # parou: aprender com a mesma rota em modo pesquisa
        sa1_trace = port / 'auto-runs' / ('sa1-%d.trace' % it)
        obs_file = port / 'auto-runs' / ('stack-returns-%d.txt' % it)
        ref = run_game(exe, port, 'pesquisa-%d' % it, a.frames, a.route, False, a.sa1, a.hash_every, sa1_trace if a.sa1 else None, observe=obs_file, scpu_trace=port / 'auto-runs' / ('scpu-%d.trace' % it), run_timeout=a.run_timeout)
        interp = Path(ref['dir']) / 'forja65-cpu-interpreter.txt'
        learned = 0
        extra = synthetic_rows(s['dir'])
        base_txt = interp.read_text() if interp.exists() else ''
        if not re.search(r'^rom=[0-9a-fA-F]{16}$', base_txt, re.M):   # log sem identidade da ROM: usa o formato legado (so as linhas)
            base_txt = ''
        if extra or ('blocks=' in base_txt and any(l and l[0] in '0123456789abcdefABCDEF' for l in base_txt.splitlines())):
            outd = port / 'auto-runs' / ('aprendido-%d' % it)
            comb = port / 'auto-runs' / ('entrada-aprendizado-%d.txt' % it)
            comb.write_text(base_txt + '\n'.join(extra) + '\n')
            interp = comb
            r = sh(['node', str(ROOT / 'tools' / 'learn-from-interpreter.js'), '--rom', str(port / 'assets' / 'cart-data.bin'), '--log', str(interp),
                    '--out', str(outd), '--port', str(port), '--tag', 'auto%d%s' % (it, TAGSUF), '--budget', a.budget] + (['--stack-returns', str(obs_file)] if obs_file.exists() else []), log=str(port / 'auto-runs' / ('learn-%d.log' % it)))
            learned = 1 if r == 0 else 0
            # o aprendizado so registra o arquivo novo no ramo "observado": garante o ramo padrao
            cm = port / 'CMakeLists.txt'
            t = cm.read_text()
            for f in sorted((port / 'src').glob('forja_learned_auto%d_*.cpp' % it)):
                name = 'src/' + f.name
                if name not in t.split('add_library(forja65_generated OBJECT')[-1].split('\n')[0]:
                    t = t.replace('add_library(forja65_generated OBJECT src/native_hooks.cpp src/dispatch.cpp', 'add_library(forja65_generated OBJECT src/native_hooks.cpp src/dispatch.cpp ' + name, 1)
            cm.write_text(t)
        sa1_n = 0
        if a.sa1 and sa1_trace.exists():
            r = sh(['node', str(ROOT / 'tools' / 'compile-sa1-observed-rev203.js'), str(sa1_trace), str(port / 'src' / 'forja_cpu_interpreter.cpp'),
                    str(port / 'assets' / 'cart-data.bin'), str(port / 'src' / 'forja_sa1_aot.cpp')], log=str(port / 'auto-runs' / ('sa1-%d.log' % it)))
            sa1_n = sum(1 for _ in open(sa1_trace)) if r == 0 else 0
        scpu_n = 0
        cum = port / 'scpu-wram.trace'
        st_new = port / 'auto-runs' / ('scpu-%d.trace' % it)
        if st_new.exists() and st_new.stat().st_size > 0:
            rows = set(cum.read_text().splitlines()) if cum.exists() else set()
            before = len(rows)
            rows |= set(l for l in st_new.read_text().splitlines() if l.strip())
            if len(rows) > before:
                # Keep the last successfully compiled catalog until the new one compiles.
                staged = port / 'auto-runs' / ('scpu-%d.candidate.trace' % it)
                staged.write_text('\n'.join(sorted(rows)) + '\n')
                r = sh(['node', str(ROOT / 'tools' / 'compile-sa1-observed-rev203.js'), str(staged), str(port / 'src' / 'forja_cpu_interpreter.cpp'),
                        str(rom), str(port / 'src' / 'forja_scpu_aot.cpp'), 'scpu', '--any-rom'], log=str(port / 'auto-runs' / ('scpu-%d.log' % it)))
                if r == 0:
                    staged.replace(cum)
                    scpu_n = len(rows)
                else:
                    rep['iteracoes'].append({'resumo': 'falha de compilacao do catalogo WRAM: consulte scpu-%d.log' % it})
        rep['iteracoes'].append({'resumo': 'aprendizado %d: log do interpretador %s, integrado=%d, estados SA-1=%d, instrucoes WRAM catalogadas=%d' % (it, 'ok' if interp.exists() else 'ausente', learned, sa1_n, scpu_n)})
        save()
        if not learned and not sa1_n and not scpu_n:
            rep['veredito'] = 'BLOQUEADO_SEM_NADA_PARA_APRENDER'
            rep['bloqueio'] = s['error'][:400]
            save()
            print(rep['veredito'], s['error'][:200])
            return 2
        exe = build(port, a.jobs, a.opt)
    rep['veredito'] = 'LIMITE_DE_ITERACOES'
    save()
    print(rep['veredito'])
    return 3


if __name__ == '__main__':
    sys.exit(main())
