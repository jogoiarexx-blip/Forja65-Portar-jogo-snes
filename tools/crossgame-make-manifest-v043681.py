#!/usr/bin/env python3
"""Discover Forja65 log bundles by game/session without modifying source logs.

Layout:
  root/DKC3/round-001/forja65-crash-trace.txt
  root/Bomberman/round-001/forja65-qa-status.txt
Only two levels are scanned (game/session); no project directories are merged.
"""
import argparse
import json
import os
from pathlib import Path
import sys

SCHEMA = 'forja65.crossgame.sessions.v1'
SUPPORTED = ('forja65-crash-trace.txt', 'forja65-qa-status.txt',
             'forja65-last-error.txt', 'forja65-runtime-hints.txt',
             'forja65-unresolved-targets.txt')
import re
NAME = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,79}$')


def discover(root):
    if not root.is_dir():
        raise ValueError(f'diretorio de entrada ausente: {root}')
    results = []
    for game_dir in sorted(root.iterdir()):
        if not game_dir.is_dir() or game_dir.is_symlink() or not NAME.fullmatch(game_dir.name):
            continue
        for run_dir in sorted(game_dir.iterdir()):
            if not run_dir.is_dir() or run_dir.is_symlink() or not NAME.fullmatch(run_dir.name):
                continue
            if not any((run_dir/name).is_file() and not (run_dir/name).is_symlink() for name in SUPPORTED):
                continue
            results.append({'game': game_dir.name, 'session': run_dir.name, 'logs_dir': run_dir})
    if not results:
        raise ValueError('nenhum log encontrado. Use <pasta>/<jogo>/<sessao>/forja65-crash-trace.txt')
    if len(results) > 128:
        raise ValueError('limite de 128 sessoes excedido')
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    try:
        root, out = args.root.resolve(), args.out.resolve()
        results = discover(root)
        data = {'schema': SCHEMA, 'sessions': [
            {'game': item['game'], 'session': item['session'],
             'logs_dir': os.path.relpath(item['logs_dir'], out.parent).replace('\\', '/')}
            for item in results]}
        out.parent.mkdir(parents=True, exist_ok=True)
        # Never place the generated manifest within a run's log directory.
        if any(out == item['logs_dir'] or out.is_relative_to(item['logs_dir']) for item in results):
            raise ValueError('manifesto nao pode ser criado dentro da pasta de logs de uma sessao')
        out.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
        print(f'Manifesto criado: {out} ({len(results)} sessao/sessoes)')
        return 0
    except (ValueError, OSError) as exc:
        print(f'ERRO: {exc}', file=sys.stderr)
        return 2

if __name__ == '__main__':
    sys.exit(main())
