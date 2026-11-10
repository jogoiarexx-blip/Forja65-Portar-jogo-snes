#!/usr/bin/env python3
"""Forja65 REV211: one-command native port, multi-route gate and ROM-free package.

Clean-room implementation of general release practices observed in DKC1Recomp.
It invokes the existing Forja65 native compiler and does not import its engine.

Examples:
  python tools/rev211_native_workflow.py --rom jogo.sfc --port ./meu-port --frames 600
  python tools/rev211_native_workflow.py --rom jogo.sfc --port ./meu-port --contract rotas.json --package
  python tools/rev211_native_workflow.py --rom jogo.sfc --port ./meu-port --verify-only --contract rotas.json
  python tools/rev211_native_workflow.py --rom jogo.sfc --init-contract rotas.json
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
AUTOPORT = ROOT / 'tools' / 'rev210' / 'auto-port.py'
SCHEMA = 'forja65.native-port.contract.v1'
REPORT_SCHEMA = 'forja65.native-port.gate.v2'
ROM_PROBE = ROOT/'tools'/'rev212_rom_probe.py'
WRAM_DIFF = ROOT/'tools'/'rev210'/'wram-first-divergence.py'


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def write_json(path: Path, obj: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def validate_sha(value: str) -> str:
    if not isinstance(value, str) or re.fullmatch(r'[0-9a-fA-F]{64}', value) is None:
        raise ValueError('rom_sha256 precisa de 64 digitos hexadecimais')
    return value.lower()


def contract_routes(contract_path: Path | None, rom_sha: str, frames: int, hash_every: int) -> list[dict]:
    if contract_path:
        contract = json.loads(contract_path.read_text(encoding='utf-8'))
        if contract.get('schema') != SCHEMA:
            raise ValueError('schema de contrato nao reconhecido')
        if validate_sha(contract.get('rom_sha256')) != rom_sha:
            raise ValueError('SHA-256 da ROM diverge do contrato; nao recompilar ROM diferente')
        routes = contract.get('routes')
        if not isinstance(routes, list) or not 1 <= len(routes) <= 64:
            raise ValueError('contrato precisa de 1..64 rotas')
    else:
        routes = [{'name': 'inicializacao', 'frames': frames, 'hash_every': min(frames, hash_every)}]
    results = []
    names = set()
    for r in routes:
        if not isinstance(r, dict) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,48}', str(r.get('name', ''))):
            raise ValueError('cada rota precisa de nome simples, unico e seguro')
        name = r['name']
        if name in names:
            raise ValueError('nome duplicado de rota: ' + name)
        names.add(name)
        f = r.get('frames')
        h = r.get('hash_every', min(f, hash_every) if isinstance(f, int) else hash_every)
        if type(f) is not int or type(h) is not int or not 1 <= f <= 1000000 or not 1 <= h <= f:
            raise ValueError(f'{name}: frames/hash_every precisam ser positivos e hash_every <= frames')
        src = r.get('input')
        route_file = None
        if src is not None:
            if not isinstance(src, str) or not src:
                raise ValueError(f'{name}: input invalido')
            route_file = ((contract_path.parent / src) if contract_path and not Path(src).is_absolute() else Path(src)).resolve()
            if not route_file.is_file():
                raise ValueError(f'{name}: arquivo de entrada nao encontrado: {route_file}')
        oracle_path = None
        if r.get('oracle_progress') is not None:
            op = r['oracle_progress']
            if not isinstance(op, str) or not op:
                raise ValueError(f'{name}: oracle_progress invalido')
            oracle_path = ((contract_path.parent / op) if contract_path and not Path(op).is_absolute() else Path(op)).resolve()
            if not oracle_path.is_file():
                raise ValueError(f'{name}: oracle CSV inexistente: {oracle_path}')
        wram_step = r.get('wram_every')
        if wram_step is not None:
            if type(wram_step) is not int or wram_step < 1 or ((f-1)//wram_step + 1) > 128:
                raise ValueError(f'{name}: wram_every deve gerar de 1 a 128 amostras')
        wram_ref = None
        if r.get('wram_reference_manifest') is not None:
            if wram_step is None:
                raise ValueError(f'{name}: wram_reference_manifest exige wram_every')
            val = r['wram_reference_manifest']
            if not isinstance(val, str) or not val:
                raise ValueError(f'{name}: wram_reference_manifest invalido')
            wram_ref = ((contract_path.parent / val) if contract_path and not Path(val).is_absolute() else Path(val)).resolve()
            if not wram_ref.is_file():
                raise ValueError(f'{name}: referencia WRAM nao encontrada: {wram_ref}')
        logic_ref = None
        if r.get('logical_reference_bin') is not None:
            if not route_file or not route_file.open(encoding='utf-8-sig',errors='replace').readline().startswith('# FORJA65_LOGIC_TRACE 1'):
                raise ValueError(f'{name}: logical_reference_bin exige replay logico (.logic)')
            src=r['logical_reference_bin']
            if not isinstance(src,str) or not src:
                raise ValueError(f'{name}: logical_reference_bin invalido')
            logic_ref=((contract_path.parent/src) if contract_path and not Path(src).is_absolute() else Path(src)).resolve()
            if not logic_ref.is_file():
                raise ValueError(f'{name}: referencia logica inexistente')
        results.append({'name': name, 'frames': f, 'hash_every': h, 'input': route_file,
                        'logical_reference_bin':logic_ref,
                        'logical_reference_sha256':sha256_file(logic_ref) if logic_ref else None,
                        'wram_every':wram_step, 'wram_reference_manifest':wram_ref,
                        'wram_reference_manifest_sha256':sha256_file(wram_ref) if wram_ref else None,
                        'oracle_progress': oracle_path,
                        'route_sha256': sha256_file(route_file) if route_file else None,
                        'oracle_sha256': sha256_file(oracle_path) if oracle_path else None})
    return results


def load_autoport():
    spec = importlib.util.spec_from_file_location('forja_rev210_autoport', AUTOPORT)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def load_wram_diff():
    spec = importlib.util.spec_from_file_location('forja_rev210_wram_diff', WRAM_DIFF)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def verify_wram_snapshots(strict: dict, research: dict, route: dict) -> dict:
    """Compare strict vs research and optionally user-provided reference snapshots.

    A provided external reference is *not* proof of bsnes provenance; the
    caller must run the same ROM, input stream and reset point externally.
    """
    if route.get('wram_every') is None:
        return {'status':'NAO_SOLICITADO'}
    mod = load_wram_diff()
    f, step = route['frames'],route['wram_every']
    expected = set(range(0,f,step))
    paths = {
        'strict': Path(strict['dir']) / 'wram-raw' / 'frames.csv',
        'research': Path(research['dir']) / 'wram-raw' / 'frames.csv',
    }
    if route.get('wram_reference_manifest') is not None:
        paths['external'] = route['wram_reference_manifest']
    result = {'status':'FALHOU','amostras_esperadas':len(expected),'comparacoes':{}}
    try:
        frames = {key:mod.frames_from_manifest(p) for key,p in paths.items()}
        for key, v in frames.items():
            if set(v) != expected:
                result['erro'] = f'{key}: quadros faltantes ou excedentes no manifesto de WRAM'
                return result
        for side in ('research','external'):
            if side not in frames:
                continue
            diff=mod.analyze(frames['strict'],frames[side],limit=16,trace_context=4)
            result['comparacoes'][side]={
                'status':'IGUAL' if diff['first_divergence'] is None else 'DIVERGENTE',
                'first_divergence':diff['first_divergence'],
            }
        if all(x['status']=='IGUAL' for x in result['comparacoes'].values()):
            result['status']='APROVADO_WRAM_AMOSTRADA'
    except (OSError,ValueError,KeyError) as exc:
        result['erro']=str(exc)
    return result


def verify_route(auto, exe: Path, port: Path, route: dict, index: int, timeout: int, sa1=False) -> dict:
    f, h, name = route['frames'], route['hash_every'], route['name']
    inpath = route['input']
    wram_every = route.get('wram_every')
    strict = auto.run_game(exe, port, f'rev211-final-{index}-strict', f, inpath, True, sa1,
                           h, run_timeout=timeout, wram_capture=wram_every)
    research = auto.run_game(exe, port, f'rev211-final-{index}-research', f, inpath, False, sa1,
                             h, run_timeout=timeout, wram_capture=wram_every)
    expected = set(range(h, f + 1, h))
    actual_s, actual_r = set(strict['hashes']), set(research['hashes'])
    missing_s = sorted(expected - actual_s)
    missing_r = sorted(expected - actual_r)
    extra_s = sorted(actual_s - expected)
    extra_r = sorted(actual_r - expected)
    diff = sorted(i for i in expected & actual_s & actual_r
                  if strict['hashes'][i] != research['hashes'][i])
    oracle_diff = []
    if route['oracle_progress']:
        oracle = auto.load_hashes(route['oracle_progress'])
        if set(oracle) != expected:
            raise ValueError(f'{name}: oracle nao cobre o conjunto exato de quadros')
        oracle_diff = sorted(i for i in expected if strict['hashes'].get(i) != oracle[i])
    wram = verify_wram_snapshots(strict,research,route)
    mode = auto.route_input_mode(inpath) if inpath else None
    logical_complete = mode != 'FORJA65_INPUT_LOGIC' or (
        strict.get('logic_done') is not None and research.get('logic_done') is not None)
    logical_proof={'status':'NAO_SOLICITADO'}
    if mode == 'FORJA65_INPUT_LOGIC':
        sdone, rdone=strict.get('logic_done'),research.get('logic_done')
        count=sdone.get('logic_inputs',0) if isinstance(sdone,dict) else 0
        sb=strict.get('logic_digests',{})
        rb=research.get('logic_digests',{})
        expected_logic=set(range(1,count+1)) if 0 < count <= 1000000 else set()
        mismatches=sorted(i for i in expected_logic & set(sb) & set(rb) if sb[i] != rb[i])
        missing_s=sorted(expected_logic-set(sb))
        missing_r=sorted(expected_logic-set(rb))
        logic_external = None
        external_mismatch=[]
        if route.get('logical_reference_bin') is not None:
            logic_external=auto.read_logic_digests(route['logical_reference_bin'])
            external_mismatch=sorted(i for i in expected_logic & set(sb) & set(logic_external)
                                     if sb[i] != logic_external[i])
        logical_complete=(logical_complete and rdone.get('logic_inputs') == count and
                         bool(expected_logic) and set(sb)==expected_logic and
                         set(rb)==expected_logic and not mismatches and
                         (logic_external is None or (set(logic_external)==expected_logic and not external_mismatch)))
        logical_proof={'status':'APROVADO' if logical_complete else 'FALHOU',
                       'logical_inputs_expected':count,
                       'logical_digests_strict':len(sb),
                       'logical_digests_research':len(rb),
                       'first_divergent_index':mismatches[0] if mismatches else None,
                       'missing_strict_first':missing_s[:10],
                       'missing_research_first':missing_r[:10],
                       'external_reference_provided':logic_external is not None,
                       'external_first_divergent_index':external_mismatch[0] if external_mismatch else None}
    approved = (wram['status'] in ('NAO_SOLICITADO', 'APROVADO_WRAM_AMOSTRADA')
                and logical_complete and strict['rc'] == 0 and strict['frames'] >= f and strict['cpu_interp'] == 0
                and strict['sa1_interp'] == 0 and strict.get('cpu_aot', 0) > 0 and research['rc'] == 0 and research['frames'] >= f
                and not missing_s and not missing_r and not extra_s and not extra_r
                and (not diff or mode == 'FORJA65_INPUT_LOGIC') and not oracle_diff)
    return {'name': name, 'frames': f, 'amostras_esperadas': len(expected),
            'sha256_entrada': route['route_sha256'], 'sha256_oracle': route['oracle_sha256'],
            'wram': wram, 'wram_reference_manifest_sha256':route.get('wram_reference_manifest_sha256'),
            'input_mode':mode,'logical_replay_complete':logical_complete,'logical_proof':logical_proof, 'logical_reference_sha256':route.get('logical_reference_sha256'),
            'status': 'APROVADO_ROTA_AOT' if approved else 'FALHOU',
            'strict': {k: v for k, v in strict.items() if k not in ('hashes','logic_digests')},
            'research': {k: v for k, v in research.items() if k not in ('hashes','logic_digests')},
            'faltando_estrito': missing_s[:30], 'faltando_pesquisa': missing_r[:30],
            'extras_estrito': extra_s[:30], 'extras_pesquisa': extra_r[:30],
            'hash_divergente': diff[:30], 'oracle_divergente': oracle_diff[:30],
            'limite': 'Apenas os quadros/entradas deste roteiro; nao certifica campanha, controles ou audio reais.'}


def powershell_installer(rom_sha: str) -> str:
    return '''param([Parameter(Mandatory=$true)][string]$Rom)
$ErrorActionPreference = 'Stop'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = (Resolve-Path -LiteralPath $Rom).Path
$hash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hash -ne 'SHA_PLACEHOLDER') { throw 'ROM incorreta: SHA-256 nao corresponde ao port compilado.' }
New-Item -Path (Join-Path $base 'assets') -ItemType Directory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination (Join-Path $base 'assets/cart-data.bin') -Force
Write-Host 'ROM verificada e instalada. Execute INICIAR-PORT.cmd.'
'''.replace('SHA_PLACEHOLDER', rom_sha)


def windows_launcher(rom_sha: str) -> str:
    return '''@echo off
setlocal
cd /d "%~dp0"
if not exist "assets\\cart-data.bin" (
  echo Falta assets\\cart-data.bin. Use Instalar-ROM.ps1 -Rom "C:\\jogos\\sua-rom.sfc"
  pause
  exit /b 2
)
powershell -NoProfile -Command "if ((Get-FileHash -LiteralPath 'assets/cart-data.bin' -Algorithm SHA256).Hash.ToLowerInvariant() -ne 'SHA_PLACEHOLDER') { exit 2 }"
if errorlevel 1 (
  echo ROM incorreta. O executavel foi gerado para outra versao do jogo.
  pause
  exit /b 3
)
"%~dp0game.exe" %*
'''.replace('SHA_PLACEHOLDER', rom_sha)


def python_rom_installer(rom_sha: str) -> str:
    return '''#!/usr/bin/env python3
"""Copies only the exact private ROM expected by the recompilation."""
import hashlib
import pathlib
import shutil
import sys
src = pathlib.Path(sys.argv[1]) if len(sys.argv) == 2 else None
if src is None or not src.is_file():
    sys.exit('Uso: python3 instalar_rom.py /caminho/do/jogo.sfc')
h = hashlib.sha256(src.read_bytes()).hexdigest()
if h != 'SHA_PLACEHOLDER':
    sys.exit('ROM errada: SHA-256 nao corresponde ao port.')
out = pathlib.Path(__file__).resolve().parent / 'assets'
out.mkdir(exist_ok=True)
shutil.copyfile(src, out / 'cart-data.bin')
print('ROM verificada e instalada.')
'''.replace('SHA_PLACEHOLDER', rom_sha)


def make_package(exe: Path, port: Path, rom_sha: str, report: dict) -> Path:
    if report.get('status') != 'APROVADO_ROTAS_AOT':
        raise ValueError('port nao aprovado: release bloqueada')
    if not exe.is_file():
        raise ValueError('executavel compilado nao encontrado')
    is_win = exe.suffix.lower() == '.exe'
    out_path = port / ('Forja65-Port-AOT-Windows.zip' if is_win else 'Forja65-Port-AOT-Linux.zip')
    files = {
        'game.exe' if is_win else 'game': exe.read_bytes(),
        'instalar_rom.py': python_rom_installer(rom_sha).encode('utf-8'),
        'RELATORIO-ROTAS.json': (json.dumps(report, indent=2, ensure_ascii=False) + '\n').encode('utf-8'),
        'README-PORT.txt': (
            'Forja65 REV212 - port nativo AOT (certificacao limitada as rotas fornecidas).\n'
            'Nao inclui ROM nem assets extraidos. Para executar, forneca sua ROM original\n'
            f'SHA-256 da ROM: {rom_sha}\n'
            'Linux: python3 instalar_rom.py jogo.sfc ; ./game\n'
            'Windows: powershell -File Instalar-ROM.ps1 -Rom caminho\\jogo.sfc ; INICIAR-PORT.cmd\n'
            'Um port AOT usa CPU recompilada, mas mantem hardware SNES virtualizado.\n'
            'Controles fisicos, audio e campanha completa nao foram validados por este gate.\n'
        ).encode('utf-8')
    }
    if is_win:
        files['Instalar-ROM.ps1'] = powershell_installer(rom_sha).encode('utf-8')
        files['INICIAR-PORT.cmd'] = windows_launcher(rom_sha).encode('utf-8')
    else:
        files['iniciar.sh'] = ('#!/bin/sh\nset -eu\ncd "$(dirname "$0")"\nexec ./game "$@"\n').encode('utf-8')
    # Explicit allowlist: exclude cart-data.bin, native-rom-data.bin, captured
    # images, replay states and generated C++ (potentially copyrighted bytes).
    with zipfile.ZipFile(out_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for name, data in sorted(files.items()):
            entry = zipfile.ZipInfo(name, (2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = (0o755 if name in ('game', 'iniciar.sh', 'instalar_rom.py') else 0o644) << 16
            z.writestr(entry, data)
    return out_path


def summary_markdown(report: dict) -> str:
    rows = [
        '# Forja65 REV212 - certificacao de rotas', '',
        f"ROM SHA-256: `{report['rom_sha256']}`", '',
        f"**Resultado:** {report['status']}", '',
        '| Rota | Quadros | Amostras | CPU interpretada | Resultado |',
        '|---|---:|---:|---:|---|'
    ]
    for r in report['routes']:
        rows.append(f"| {r['name']} | {r.get('frames', '—')} | {r.get('amostras_esperadas', 0)} | "
                    f"{r.get('strict', {}).get('cpu_interp', '—')} | {r['status']} |")
    rows += ['', 'Opcional: WRAM estrito/pesquisa e referencia externa, apenas quando fornecida no contrato.',
             'Este gate prova apenas a rota e as condicoes observadas. Nao representa jogo zerado,',
             'prova de equivalencia ao bsnes sem oracle externo, ou EXE Windows validado.',
             'O runtime PPU/APU/DMA continua modelando hardware do SNES.\n']
    return '\n'.join(rows)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--rom', type=Path, required=True, help='ROM do usuario, mantida local')
    ap.add_argument('--port', type=Path, help='diretorio de saida do port')
    ap.add_argument('--contract', type=Path, help='roteiros e SHA-256 validado')
    ap.add_argument('--init-contract', type=Path, help='criar template preso a ROM (sem compilar)')
    ap.add_argument('--frames', type=int, default=600)
    ap.add_argument('--hash-every', type=int, default=60)
    ap.add_argument('--max-iter', type=int, default=8)
    ap.add_argument('--jobs', type=int, default=2)
    ap.add_argument('--build-opt', choices=['O0','O1','O2'], default='O1',
                    help='O0 compila mais rapidamente para diagnostico; O1/O2 otimizam o port')
    ap.add_argument('--run-timeout', type=int, default=600)
    ap.add_argument('--sa1', action='store_true')
    ap.add_argument('--probe-only',action='store_true',help='inspecionar ROM sem criar port')
    ap.add_argument('--verify-only', action='store_true', help='nao aprende nem modifica codigo nativo')
    ap.add_argument('--package', action='store_true', help='ZIP sem ROM apos gate integral aprovado')
    a = ap.parse_args(argv)
    try:
        rom = a.rom.resolve(strict=True)
        rom_sha = sha256_file(rom)
        probe_spec=importlib.util.spec_from_file_location('forja_rev212_rom_probe', ROM_PROBE)
        probe_module=importlib.util.module_from_spec(probe_spec)
        assert probe_spec and probe_spec.loader
        probe_spec.loader.exec_module(probe_module)
        rom_info=probe_module.probe(rom)
        if a.probe_only:
            print(probe_module.concise(rom_info))
            return 0
        if a.init_contract:
            dest = a.init_contract.resolve()
            if dest.exists():
                raise ValueError('contrato ja existe: nao sobrescrever')
            write_json(dest, {'schema': SCHEMA, 'rom_sha256': rom_sha,
                              'routes': [{'name': 'inicializacao', 'frames': a.frames,
                                          'hash_every': min(a.hash_every, a.frames)}]})
            print('Contrato gerado:', dest)
            return 0
        if not a.port:
            raise ValueError('--port obrigatorio sem --init-contract')
        port = a.port.resolve()
        contract = a.contract.resolve(strict=True) if a.contract else None
        if not (1 <= a.frames <= 1000000 and 1 <= a.hash_every <= a.frames and
                1 <= a.jobs <= 128 and 1 <= a.max_iter <= 100 and 1 <= a.run_timeout <= 86400):
            raise ValueError('parametros numericos fora dos limites')
        routes = contract_routes(contract, rom_sha, a.frames, a.hash_every)
        existing_rom = port / 'assets' / 'cart-data.bin'
        if existing_rom.is_file() and sha256_file(existing_rom) != rom_sha:
            raise ValueError('projeto existente de outra ROM: recusado ANTES de compilar')
        if a.verify_only and not existing_rom.is_file():
            raise ValueError('--verify-only exige port ja gerado com assets/cart-data.bin')
        report = {'schema': REPORT_SCHEMA, 'rom_sha256': rom_sha,
                  'contract_sha256': sha256_file(contract) if contract else None,
                  'build_opt':'-'+a.build_opt,
                  'forja_tool': str(AUTOPORT.relative_to(ROOT)), 'rom_probe':rom_info,
                  'status': 'EM_ANDAMENTO', 'routes': []}
        if not a.verify_only:
            # IMPORTANT: `analyze` refuses nonempty output paths. Write initial
            # diagnostics alongside the project until the generator creates it.
            logs = port.parent / (port.name + '-rev211-logs')
            logs.mkdir(parents=True, exist_ok=True)
            for route in routes:
                cmd = [sys.executable, str(AUTOPORT), '--rom', str(rom), '--port', str(port),
                       '--rom-sha256', rom_sha, '--frames', str(route['frames']),
                       '--hash-every', str(route['hash_every']), '--max-iter', str(a.max_iter),
                       '--run-timeout', str(a.run_timeout), '--jobs', str(a.jobs),
                       '--opt', '-'+a.build_opt]
                if route['input']:
                    cmd.extend(['--route', str(route['input'])])
                if route['oracle_progress']:
                    cmd.extend(['--oracle-progress', str(route['oracle_progress'])])
                if a.sa1:
                    cmd.append('--sa1')
                print(f"[Forja65] geracao/aprendizado: {route['name']}", flush=True)
                with (logs / (route['name'] + '.log')).open('w', encoding='utf-8') as f:
                    result = subprocess.run(cmd, stdout=f, stderr=subprocess.STDOUT)
                auto_file = port / 'auto-port-relatorio.json'
                if auto_file.exists():
                    shutil.copyfile(auto_file, logs / (route['name'] + '-auto-port.json'))
                if (port / 'src' / 'runtime.hpp').exists():
                    destination = port / 'reports' / 'rev211'
                    destination.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(logs / (route['name'] + '.log'), destination / (route['name'] + '.log'))
                    if auto_file.exists():
                        shutil.copyfile(auto_file, destination / (route['name'] + '-auto-port.json'))
                if result.returncode != 0:
                    report['status'] = 'BLOQUEADO_APRENDIZADO'
                    report['routes'].append({'name': route['name'], 'status': 'FALHOU',
                                             'log': str(logs / (route['name'] + '.log'))})
                    write_json(logs / 'gate.json', report)
                    (logs / 'gate.md').write_text(summary_markdown(report), encoding='utf-8')
                    print('BLOQUEADO: ver', logs / (route['name'] + '.log'))
                    return 2
        auto = load_autoport()
        exe = auto.build(port, a.jobs, '-'+a.build_opt) if not a.verify_only else next(
            (p for p in (port/'build-auto'/'game.exe', port/'build-auto'/'game') if p.is_file()), None)
        if exe is None:
            raise ValueError('executable nao localizado em build-auto')
        exe = exe.resolve()
        report['executable_sha256'] = sha256_file(exe)
        report['platform'] = platform.system()
        for index, route in enumerate(routes):
            print(f"[Forja65] prova final independente: {route['name']}", flush=True)
            proof = verify_route(auto, exe, port, route, index, a.run_timeout, a.sa1)
            report['routes'].append(proof)
        report['status'] = ('APROVADO_ROTAS_AOT' if all(r['status'] == 'APROVADO_ROTA_AOT'
                                                          for r in report['routes']) else 'FALHOU_GATE')
        logs = port / 'reports' / 'rev211'
        write_json(logs / 'gate.json', report)
        (logs / 'gate.md').write_text(summary_markdown(report), encoding='utf-8')
        if report['status'] != 'APROVADO_ROTAS_AOT':
            print(report['status'], ': ver', logs / 'gate.md')
            return 1
        if a.package:
            package = make_package(exe, port, rom_sha, report)
            print('ZIP sem ROM:', package)
        print('APROVADO_ROTAS_AOT: rotas verificadas; NAO significa jogo inteiro nativo.')
        return 0
    except (OSError, ValueError, json.JSONDecodeError, subprocess.SubprocessError) as e:
        print('ERRO:', e, file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
