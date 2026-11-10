#!/usr/bin/env python3
"""Compare interpreter fallbacks with generated AOT dispatch and an equivalent replay.

AOT dispatch presence is STATIC evidence, not proof of correct execution. To make
claims about a real reduction, provide a second log and frame hashes from both
runs (same replay, ROM, environment). No ROM or checkpoint state is inferred.
"""
from __future__ import annotations
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path
import re

ENTRY_RE = re.compile(r'^(?P<pc>[0-9a-fA-F]{6})\s+(?P<state>E1|M[01]X[01]|E1M1X1)\s+from=(?P<origin>[0-9a-fA-F]{6})\s+count=(?P<count>\d+)$')
DISPATCH_RE = re.compile(r'^\s*\{0x([0-9A-Fa-f]+)u,(true|false),(true|false),(true|false),(true|false),(true|false),&sub_\w+,0x[0-9A-Fa-f]+u\},\s*$')


def read_entries(file):
    data = Path(file).read_text(encoding='utf8')
    if 'FORJA65_CPU_INTERPRETER 1' not in data and 'FORJA65_CPU_AOT_FRONTIER 1' not in data:
        raise ValueError(f'{file}: cabeçalho de log inválido')
    result = defaultdict(int)
    for line in data.splitlines():
        m = ENTRY_RE.fullmatch(line.strip())
        if not m:
            continue
        if m['state'] in {'E1', 'E1M1X1'}:
            state = 'E1'
        else:
            state = m['state']
        count = int(m['count'])
        if count <= 0:
            raise ValueError('contagem não positiva')
        key = (m['pc'].upper(), state, m['origin'].upper())
        result[key] += count
    # Header-only is permitted only for a zero-fallback run.
    if not result and not re.search(r'^instructions=0\s*$', data, re.M):
        raise ValueError(f'{file}: nenhuma entrada válida e ausência de instructions=0')
    return result


def read_dispatch(file):
    if not file:
        return {}
    text = Path(file).read_text(encoding='utf8')
    p = text.find('kForja65Dispatch[]={')
    if p < 0:
        raise ValueError('kForja65Dispatch ausente')
    end = text.find('\n};', p)
    if end < 0:
        raise ValueError('fechamento do dispatch ausente')
    rows = defaultdict(set)
    for line in text[p:end].splitlines():
        m = DISPATCH_RE.fullmatch(line)
        if m:
            pc, e, mb, xb, ck, cv = m.groups()
            st = 'E1' if e == 'true' else f'M{int(mb == "true")}X{int(xb == "true")}'
            rows[(f'{int(pc,16):06X}', st)].add('C'+str(int(cv == 'true')) if ck == 'true' else 'CQ')
    return rows


def read_hashes(path):
    if path is None:
        return None
    result = {}
    for line in Path(path).read_text(encoding='utf8').splitlines():
        if not line.startswith('frame='):
            continue
        fields = dict(m.group(1).split('=', 1) for m in re.finditer(r'([^\s=]+=[^\s]+)', line))
        if not {'frame', 'wram', 'framebuffer'} <= fields.keys():
            raise ValueError('frame sem wram/framebuffer')
        frame = int(fields['frame'])
        if frame in result:
            raise ValueError(f'frame duplicado: {frame}')
        result[frame] = (fields['wram'], fields['framebuffer'])
    if not result:
        raise ValueError(f'{path}: nenhum hash por quadro')
    return result


def compare(before, after=None, dispatch=None, before_hashes=None, after_hashes=None):
    if (before_hashes is None) != (after_hashes is None):
        raise ValueError('forneça ambos os conjuntos de hashes')
    if after is None and before_hashes is not None:
        raise ValueError('hashes exigem log de execução posterior')
    hashes_ok = None
    if before_hashes is not None:
        a, b = read_hashes(before_hashes), read_hashes(after_hashes)
        hashes_ok = a == b and len(a) == len(b)
    native = read_dispatch(dispatch)
    items = []
    for pc, state, origin in sorted(set(before) | set(after or {}), key=lambda k: (-before.get(k, 0), k)):
        prev = before.get((pc, state, origin), 0)
        now = after.get((pc, state, origin), 0) if after is not None else None
        variants = sorted(native.get((pc, state), set()))
        if not variants:
            coverage = 'sem-despacho-estatico'
        elif 'CQ' in variants or {'C0', 'C1'} <= set(variants):
            coverage = 'despacho-estatico-presente'
        else:
            coverage = 'despacho-condicional-carry'
        if after is None or hashes_ok is not True:
            runtime = 'nao-validado'
        elif now == 0 and prev > 0:
            runtime = 'fallback-ausente-em-replay-equivalente'
        elif now < prev:
            runtime = 'fallback-reduzido-em-replay-equivalente'
        elif now > prev:
            runtime = 'fallback-aumentou-em-replay-equivalente'
        else:
            runtime = 'fallback-persistente-em-replay-equivalente' if now else 'nao-observado'
        items.append(dict(pc=pc,state=state,from_pc=origin,antes=prev,depois=now,
                          variantes=variants,cobertura=coverage,execucao=runtime))
    return {'schema':'forja65.fallback-backlog.v1',
            'comparacao_hashes':('nao_fornecida' if hashes_ok is None else 'identicos' if hashes_ok else 'diferentes'),
            'equivalencia_comprovada':hashes_ok is True,
            'observado_antes':len(before), 'observado_depois':len(after) if after is not None else None,
            'ocorrencias_antes':sum(before.values()),
            'ocorrencias_depois':sum(after.values()) if after is not None else None,
            'entradas':items}


def markdown(report):
    good=report['equivalencia_comprovada']
    t=['# Forja65 — Pendências CPU/AOT por rota', '',
       '**Atenção:** cobertura C++/despacho não confirma que a rota funciona nativamente. '+
       ('Hashes idênticos em replay fornecido.' if good else 'Sem replay equivalente aprovado: todas as rotas permanecem pendentes de validação funcional.'),
       '',f"- Entradas de fallback anteriores: **{report['observado_antes']}**; ocorrências: **{report['ocorrencias_antes']}**",
       f"- Hashes comparados: **{report['comparacao_hashes']}**",'',
       '| Destino | E/M/X | Origem | Ocorrências anteriores | Despacho | Resultado executado |',
       '|---|---|---|---:|---|---|']
    for x in report['entradas']:
        t.append(f"| `{x['pc']}` | {x['state']} | `{x['from_pc']}` | {x['antes']} | {x['cobertura']} | {x['execucao']} |")
    return '\n'.join(t)+'\n'


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--before',required=True)
    p.add_argument('--after')
    p.add_argument('--dispatch')
    p.add_argument('--before-hashes')
    p.add_argument('--after-hashes')
    p.add_argument('--json-out')
    p.add_argument('--md-out')
    a=p.parse_args()
    report=compare(read_entries(a.before), read_entries(a.after) if a.after else None,
                   a.dispatch, a.before_hashes, a.after_hashes)
    if a.json_out: Path(a.json_out).write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    if a.md_out: Path(a.md_out).write_text(markdown(report),encoding='utf8')
    print('fallbacks:',report['observado_antes'],'ocorrencias:',report['ocorrencias_antes'],
          'hashes:',report['comparacao_hashes'],'validados:',sum(x['execucao']=='fallback-ausente-em-replay-equivalente' for x in report['entradas']))
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
