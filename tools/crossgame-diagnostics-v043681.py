#!/usr/bin/env python3
"""Forja65 v0.4.36.81: read-only, ROM-scoped, cross-game diagnostic triage.

Correlations are symptom-level hypotheses, never proof of a shared root cause.
No ROM, port, hint file, or Forja core is patched by this program.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re
import sys

SCHEMA = 'forja65.crossgame.sessions.v1'
OUTPUT_SCHEMA = 'forja65.crossgame.report.v1'
MAX_SESSIONS = 128
MAX_FILE_BYTES = 16 * 1024 * 1024
NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$')
HEX64 = re.compile(r'^[a-fA-F0-9]{64}$')
HEX16 = re.compile(r'^[a-fA-F0-9]{16}$')
PC = re.compile(r'^\s*([0-9a-fA-F]{6})\s+A=', re.M)
ROM_HINT = re.compile(r'^rom=([0-9a-fA-F]{16})(?:\s|$)', re.M)
REASON = re.compile(r'^reason=([a-zA-Z0-9_-]{1,80})\s*$', re.M)
FRAME = re.compile(r'^frame=(\d+)(?:\s|$)', re.M)
FILE_NAMES = {
    'trace': 'forja65-crash-trace.txt',
    'hints': 'forja65-runtime-hints.txt',
    'unresolved': 'forja65-unresolved-targets.txt',
    'qa': 'forja65-qa-status.txt',
    'error': 'forja65-last-error.txt',
}

# High-level cause candidates, intentionally NOT CPU address or game-specific targets.
RULES = (
    ('cfg.unresolved_flow', 'CPU/CFG', ('unresolved-flow', 'fluxo cfg nao resolvido', 'unresolved target', 'unresolved flow')),
    ('cpu.stack_or_return', 'CPU/stack', ('stack underflow', 'stack overflow', 'return stack', 'native_return_depth')),
    ('dma.hdma', 'DMA/HDMA', ('hdma', 'dma transfer', 'dma channel')),
    ('ppu.obj', 'PPU/OBJ', ('ppu', 'sprite', 'oam', 'cgram', 'vram', 'stat77')),
    ('audio.spc_dsp', 'SPC700/DSP', ('spc700', 'spc ', 'dsp', 'apu ', 'audio', 'sound', 'sem som')),
    ('runtime.timeout', 'runtime', ('timeout', 'hang', 'watchdog', 'frozen')),
    ('runtime.transition', 'runtime', ('phase transition', 'fase seguinte', 'level transition')),
)
SUGGESTIONS = {
    'cfg.unresolved_flow': 'Revisar caminho de retorno/CFG com evidencias da MESMA ROM e estado CPU; executar regressao de saltos indiretos.',
    'cpu.stack_or_return': 'Comparar pilha, modo E/M/X, chamadas e retornos; testar fronteiras do banco.',
    'dma.hdma': 'Comparar ordem de barramento e cronologia de DMA/HDMA por scanline.',
    'ppu.obj': 'Comparar estado PPU/OBJ e captura de frames sincronizados.',
    'audio.spc_dsp': 'Inspecionar portas APU e sequencia de instrucoes SPC/DSP.',
    'runtime.timeout': 'Adicionar checkpoint de progresso/limite de frame e perfilar o loop.',
    'runtime.transition': 'Auditar transicao de estado do jogo e persistencia de WRAM.',
    'runtime.other': 'Reproduzir e coletar trace e estado; nao aplicar correcoes sem causa verificada.',
}

class DiagnosticError(ValueError):
    pass


def check(condition: bool, message: str):
    if condition:
        raise DiagnosticError(message)


def sha256(path: Path) -> str:
    hash_obj = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            hash_obj.update(chunk)
    return hash_obj.hexdigest()


def read_log(path: Path):
    if not path.exists():
        return None, None
    check(path.is_symlink() or not path.is_file(), f'log invalido ou link simbolico: {path}')
    check(path.stat().st_size > MAX_FILE_BYTES, f'log excede 16 MiB: {path}')
    data = path.read_bytes()
    return data.decode('utf-8', errors='replace'), hashlib.sha256(data).hexdigest()


def get_path(root: Path, raw, field: str):
    check(not isinstance(raw, str) or not raw.strip(), f'{field}: caminho obrigatorio')
    return (root / raw).resolve()


def classify(reason: str, error: str):
    normalized = (reason + ' ' + error).lower()
    for key, subsystem, keywords in RULES:
        if any(keyword in normalized for keyword in keywords):
            return key, subsystem
    return 'runtime.other', 'runtime'


def parse_error(qa: str, last_error: str):
    # The QA format is line-oriented and may include contextual lines; only
    # `error=` is considered a failure, not unrelated metrics or commentary.
    qa_error = re.search(r'^error=(.+)$', qa, re.M)
    msg = (last_error.strip().splitlines()[:1] or [''])[0].strip()
    if not msg and qa_error:
        msg = qa_error.group(1).strip()
    started = re.search(r'^runtime_started=([^\s]+)', qa, re.M)
    failed = bool(started and started.group(1).upper() in ('FAIL', 'ERROR', 'FALSE', '0'))
    return msg[:240], failed


def validate_manifest(path: Path):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise DiagnosticError(f'manifesto invalido: {exc}') from exc
    check(not isinstance(data, dict) or data.get('schema') != SCHEMA,
          f'schema obrigatorio: {SCHEMA}')
    sessions = data.get('sessions')
    check(not isinstance(sessions, list) or not 1 <= len(sessions) <= MAX_SESSIONS,
          f'sessions: exige lista de 1 a {MAX_SESSIONS} sessoes')
    seen = set()
    validated = []
    for idx, session in enumerate(sessions):
        check(not isinstance(session, dict), f'sessions[{idx}]: objeto obrigatorio')
        game = session.get('game')
        run = session.get('session')
        check(not isinstance(game, str) or not NAME.fullmatch(game), f'sessions[{idx}].game invalido')
        check(not isinstance(run, str) or not NAME.fullmatch(run), f'sessions[{idx}].session invalido')
        check((game, run) in seen, f'sessao repetida: {game}/{run}')
        seen.add((game, run))
        logdir = get_path(path.parent, session.get('logs_dir'), f'{game}/{run}.logs_dir')
        check(not logdir.is_dir(), f'diretorio de logs nao encontrado: {logdir}')
        rom = None
        if session.get('rom_file') is not None:
            rom = get_path(path.parent, session['rom_file'], f'{game}/{run}.rom_file')
            check(not rom.is_file(), f'ROM nao encontrada: {rom}')
        validated.append((game, run, logdir, rom))
    return validated


def build(manifest_path: Path, out: Path):
    sessions = validate_manifest(manifest_path)
    # Avoid report files masquerading as newly collected diagnostic input.
    output_dir = out.resolve()
    for _, _, logdir, _ in sessions:
        check(output_dir == logdir or output_dir.is_relative_to(logdir),
              'saida nao pode estar dentro do diretorio de logs')
    results, issues, warnings = [], [], []
    for game, run, logdir, rom_file in sessions:
        files = {}
        contents = {}
        for key, filename in FILE_NAMES.items():
            value, digest = read_log(logdir / filename)
            contents[key] = value or ''
            if digest:
                files[key] = {'name': filename, 'sha256': digest}
        hints = sorted({m.lower() for m in ROM_HINT.findall(contents['hints'])})
        check(len(hints) > 1, f'{game}/{run}: fingerprints ROM conflitantes nos hints')
        rom_record = {
            'file_sha256': sha256(rom_file) if rom_file else None,
            'hint_rom_id': hints[0] if hints else None,
            'provenance': 'rom_file_sha256' if rom_file else ('runtime_hint_id_unverified' if hints else 'unknown'),
        }
        reason_match = REASON.search(contents['trace'])
        reason = reason_match.group(1).lower() if reason_match else ''
        error, qa_failed = parse_error(contents['qa'], contents['error'])
        pc_matches = PC.findall(contents['trace'])
        frame_match = FRAME.search(contents['trace'])
        frame_number = int(frame_match.group(1)) if frame_match else None
        if reason or error or qa_failed:
            category, subsystem = classify(reason, error)
            kind = 'crash' if reason else 'runtime_failure'
            if qa_failed and not error and not reason:
                kind = 'runtime_failure'
            issue = {
                'game': game, 'session': run, 'category': category,
                'subsystem': subsystem, 'event': kind,
                'reason': reason or ('qa_failed' if qa_failed else 'last_error'),
                'last_pc': pc_matches[-1].upper() if pc_matches else None,
                'frame': frame_number,
                'rom_scope': rom_record,
                'sources': [key for key in ('trace', 'qa', 'error') if key in files],
            }
            issues.append(issue)
        elif contents['unresolved'].strip():
            # Observed unresolved sites without failure trace are evidence to
            # triage, not proof of crash.
            issues.append({
                'game': game, 'session': run, 'category': 'cfg.unresolved_flow',
                'subsystem': 'CPU/CFG', 'event': 'unresolved_sites_only',
                'reason': 'unresolved_targets_file', 'last_pc': None, 'frame': None,
                'rom_scope': rom_record, 'sources': ['unresolved'],
            })
        if not files:
            warnings.append(f'{game}/{run}: nenhum arquivo de diagnostico reconhecido')
        if not rom_file:
            warnings.append(f'{game}/{run}: SHA-256 da ROM nao verificado; fingerprints dos hints nao sao prova')
        results.append({'game': game, 'session': run, 'rom_scope': rom_record,
                        'evidence_files': files, 'has_primary_failure': bool(reason or error or qa_failed)})
    grouped = defaultdict(list)
    for issue in issues:
        grouped[issue['category']].append(issue)
    clusters = []
    for category, found in grouped.items():
        games = sorted({f['game'] for f in found})
        verified_failures = [f for f in found if f['event'] != 'unresolved_sites_only']
        # This is symptom co-occurrence only; independent ROMs may have completely
        # different causes for the same category (e.g., different CFG sites).
        clusters.append({
            'category': category, 'subsystem': found[0]['subsystem'],
            'games': games, 'independent_games': len(games),
            'session_events': len(found), 'failure_events': len(verified_failures),
            'cross_game_candidate': len({f['game'] for f in verified_failures}) >= 2,
            'priority': ('high' if len({f['game'] for f in verified_failures}) >= 2 else
                         'medium' if verified_failures else 'low'),
            'suggested_check': SUGGESTIONS[category],
            'warning': 'Sintoma similar nao comprova causa compartilhada; PC e hints nunca sao migrados entre ROMs.',
            'examples': sorted(found, key=lambda f: (f['game'], f['session'])),
        })
    priority_rank = {'high': 0, 'medium': 1, 'low': 2}
    clusters.sort(key=lambda c: (priority_rank[c['priority']], -c['independent_games'], c['category']))
    results.sort(key=lambda x: (x['game'], x['session']))
    report = {
        'schema': OUTPUT_SCHEMA, 'generator_version': '0.4.36.81',
        'source_manifest_sha256': sha256(manifest_path),
        'games_count': len({g for g, _, _, _ in sessions}), 'sessions_count': len(sessions),
        'failure_events': sum(r['has_primary_failure'] for r in results),
        'clusters': clusters, 'sessions': results, 'warnings': warnings,
        'safety': 'Somente relatorio; nao altera ROM, codigo, porta, hints nem corrige automaticamente jogos.',
    }
    return report


def markdown(report):
    lines = [
        '# Forja65 — diagnostico cruzado v0.4.36.81', '',
        f"Jogos: **{report['games_count']}** · Sessoes: **{report['sessions_count']}** · Falhas registradas: **{report['failure_events']}**", '',
        '**Atencao:** recorrencia de sintomas nao prova causa raiz. Os enderecos sao locais a cada ROM; nenhuma correcao foi aplicada.', '',
        '| Prioridade | Componente | Categoria | Jogos distintos | Falhas |',
        '|---|---|---|---:|---:|',
    ]
    for c in report['clusters']:
        lines.append(f"| {c['priority']} | {c['subsystem']} | `{c['category']}` | {c['independent_games']} | {c['failure_events']} |")
    if not report['clusters']:
        lines.append('| — | — | Nenhuma ocorrencia observada | 0 | 0 |')
    lines.extend(['', '## Proximas verificacoes'])
    for c in report['clusters']:
        lines.append(f"- **{c['category']}** ({', '.join(c['games'])}): {c['suggested_check']}")
        for ex in c['examples'][:8]:
            address = f" PC={ex['last_pc']}" if ex['last_pc'] else ''
            frame = f" frame={ex['frame']}" if ex['frame'] is not None else ''
            lines.append(f"  - {ex['game']}/{ex['session']}: {ex['event']}{address}{frame} ({ex['rom_scope']['provenance']})")
    if report['warnings']:
        lines.extend(['', '## Avisos'])
        for warning in report['warnings']:
            lines.append('- ' + warning)
    return '\n'.join(lines) + '\n'


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True, help='JSON com uma sessao por jogo/execucao')
    parser.add_argument('--out', type=Path, required=True, help='Diretorio novo para relatorios')
    parser.add_argument('--fail-on-findings', action='store_true', help='Retorna 1 quando ha falha registrada (CI)')
    args = parser.parse_args(argv)
    try:
        manifest = args.manifest.resolve(strict=True)
        report = build(manifest, args.out)
        out = args.out.resolve()
        check(out == manifest.parent or manifest.is_relative_to(out), 'nao sobrescrever manifesto na saida')
        out.mkdir(parents=True, exist_ok=True)
        (out / 'crossgame-summary.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        (out / 'crossgame-summary.md').write_text(markdown(report), encoding='utf-8')
        print(f"Forja65 crossgame v81: {report['games_count']} jogo(s), {report['sessions_count']} sessoes, {report['failure_events']} falhas, {len(report['clusters'])} categorias")
        print(f'Relatorios: {out}')
        return 1 if args.fail_on_findings and report['failure_events'] else 0
    except (DiagnosticError, OSError, UnicodeError) as exc:
        print(f'ERRO: {exc}', file=sys.stderr)
        return 2


if __name__ == '__main__':
    sys.exit(main())
