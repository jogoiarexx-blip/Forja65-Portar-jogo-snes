#!/usr/bin/env python3
"""REV212: ROM-scoped native port workbench, independent of game-specific disassembly.

No commercial game addresses, source, ROM bytes or assets are embedded.
Profiles provide *test coverage checklists*, not fictitious replay inputs.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys

HERE=Path(__file__).resolve().parent
SCHEMA='forja65.native-port.profile.v1'
CONTRACT_SCHEMA='forja65.native-port.contract.v1'
# Suggestions only. Nothing in these profiles is accepted as a completed replay.
SCENES = [
    ('boot','Inicializacao e titulo'),
    ('menu','Menu e selecao'),
    ('level1','Primeira fase e controles'),
    ('transition','Transicao, NMI e carregamento de recursos'),
    ('death','Morte, reinicio e game over'),
    ('save','Persistencia SRAM, desligar e continuar'),
    ('audio','Musicas e efeitos, sincronizacao DSP/APU'),
    ('ending','Fim de campanha e retorno ao menu'),
]
GAME_PROFILES={
    'dkc2': {'name':'Donkey Kong Country 2','tags':['DMA/HDMA','WRAM dinâmica','efeitos de água','cooperativo']},
    'dkc3': {'name':'Donkey Kong Country 3','tags':['DMA/HDMA','WRAM dinâmica','mapa','minigames']},
    'smw': {'name':'Super Mario World','tags':['Mode 7','save/SRAM','sprites','eventos de overworld']},
    'zelda3': {'name':'The Legend of Zelda: A Link to the Past','tags':['overworld/dungeon','sprites','save/SRAM','APU/DSP']},
    'generic': {'name':'Jogo SNES sem perfil especifico','tags':['CPU/PPU','APU/DSP','DMA/HDMA','SRAM']},
}


def _load_rom_probe():
    spec=importlib.util.spec_from_file_location('forja_rev212_rom_probe',HERE/'rev212_rom_probe.py')
    module=importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def infer_game(title: str | None) -> str:
    x=(title or '').upper()
    if any(s in x for s in ('DONKEY KONG 2','DONKEY KONG COUNTRY 2','DKC2','DIDDY\'S KONG')):
        return 'dkc2'
    if any(s in x for s in ('DONKEY KONG 3','DONKEY KONG COUNTRY 3','DKC3','DIXIE KONG')):
        return 'dkc3'
    if 'SUPER MARIO WORLD' in x or 'SUPER MARIOWORLD' in x:
        return 'smw'
    if 'ZELDA' in x:
        return 'zelda3'
    return 'generic'


def _safe_name(name: str) -> str:
    if not isinstance(name,str) or not re.fullmatch(r'[\w .()\-]{1,96}',name,flags=re.UNICODE):
        raise ValueError('Nome do projeto invalido')
    return name


def prepare(rom: Path, out: Path, *, game='auto', name=None, frames=600, hash_every=60) -> dict:
    probe=_load_rom_probe().probe(rom)
    if game=='auto':
        game=infer_game((probe['cartridge'] or {}).get('title'))
    if game not in GAME_PROFILES:
        raise ValueError(f'perfil nao suportado: {game}')
    if not 1 <= hash_every <= frames <= 1000000:
        raise ValueError('frames/hash_every invalidos')
    if out.exists() and any(out.iterdir()):
        raise ValueError('Pasta de projeto ja contem arquivos: a preparacao nao sobrescreve')
    profile=GAME_PROFILES[game]
    display=_safe_name(name or (probe['cartridge'] or {}).get('title') or profile['name'])
    out.mkdir(parents=True,exist_ok=True)
    # Do not put absolute ROM paths in the profile or contract: a new machine
    # must supply the matching ROM via --rom and verify its SHA-256 again.
    manifest={
        'schema':SCHEMA, 'name':display, 'game_template':game,
        'rom_sha256':probe['sha256'], 'rom_size':probe['file_size'],
        'suggested_chip':probe['possible_chip'], 'rom_layout':(probe['cartridge'] or {}).get('layout'),
        'qa_focus':profile['tags'], 'status':'PLANEJADO_SEM_CERTIFICACAO',
        'coverage': [{'id':slug,'goal':description,'status':'PENDENTE_REPLAY_REAL'} for slug,description in SCENES],
    }
    contract={'schema':CONTRACT_SCHEMA,'rom_sha256':probe['sha256'],
              'routes':[{'name':'boot', 'frames':frames,'hash_every':hash_every}]}
    (out/'perfil.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'rotas.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'rom-diagnostico.json').write_text(json.dumps(probe,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (out/'replays').mkdir(exist_ok=True)
    (out/'replays'/'COMO-CAPTURAR.txt').write_text(
        'Uma rota de boot sem entradas NAO valida campanha.\n'
        'Grave entradas reais e reproduziveis (frame=N joy1=XXXX) usando o Forja65.\n'
        'Adicione rotas ao rotas.json: name, frames, hash_every, input (arquivo no replays/).\n'
        'Para prova comparada, adicione oracle_progress (frame,fb_fnv1a64) OU\n'
        'wram_reference_manifest (frame,path, arquivos de WRAM 128 KiB) e wram_every.\n'
        'Todos os replays precisam corresponder a mesma ROM e ao mesmo estado inicial.\n', encoding='utf-8')
    (out/'LEIA-PRIMEIRO.md').write_text(
        '# Plano de port '+display+'\n\n'
        f'Perfil: `{game}`  | ROM SHA-256: `{probe["sha256"]}`\n\n'
        '1. Use `python tools/rev212_rom_probe.py SUA_ROM.sfc` para confirmar dump/mapeamento.\n'
        '2. No Forja65: `python tools/rev211_native_workflow.py --rom SUA_ROM.sfc '
        '--port SAIDA_PORT --contract PASTA_DESTE_PLANO/rotas.json --max-iter 8`.\n'
        '3. Adicione roteiros reais para os itens `PENDENTE_REPLAY_REAL` de perfil.json.\n'
        '4. Inspecione relatórios do gate e o primeiro frame divergente da WRAM.\n'
        '5. Somente empacote com `--package` depois de aprovar TODAS as rotas exigidas.\n\n'
        'Aprovar `boot` NAO certifica campanha, EXE Windows, gamepad ou audio real.\n'
        'Nao ha ROM, assets ou codigo dos projetos de referencia neste plano.\n\n'
        '## Riscos por subsistema\n' + '\n'.join('- '+s for s in profile['tags'])+'\n\n'
        '## Avisos do dump\n'+'\n'.join('- '+s for s in probe['warnings'])+'\n',encoding='utf-8')
    return manifest


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--rom',type=Path,required=True)
    ap.add_argument('--out',type=Path,required=True)
    ap.add_argument('--game',choices=['auto']+list(GAME_PROFILES),default='auto')
    ap.add_argument('--name')
    ap.add_argument('--frames',type=int,default=600)
    ap.add_argument('--hash-every',type=int,default=60)
    a=ap.parse_args(argv)
    try:
        r=prepare(a.rom.resolve(strict=True),a.out.resolve(),game=a.game,name=a.name,frames=a.frames,hash_every=a.hash_every)
        print(f"PLANO_CRIADO: {a.out} / perfil={r['game_template']} / status={r['status']}")
        return 0
    except (OSError,ValueError) as exc:
        print('ERRO:',exc,file=sys.stderr)
        return 2

if __name__=='__main__':
    raise SystemExit(main())
