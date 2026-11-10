#!/usr/bin/env python3
"""REV212: trustworthy planned-vs-observed native port coverage matrix.

This report NEVER upgrades 'AOT route passed' to 'campaign beaten'.
It consumes Forja65 native-port gate evidence and a ROM-bound profile.
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import sys

SCHEMA='forja65.native-port.coverage.v1'


def summarize(profile: dict, gate: dict) -> dict:
    if profile.get('schema') != 'forja65.native-port.profile.v1':
        raise ValueError('schema de perfil invalido')
    if gate.get('schema') not in ('forja65.native-port.gate.v1','forja65.native-port.gate.v2'):
        raise ValueError('schema de gate invalido')
    if profile.get('rom_sha256') != gate.get('rom_sha256'):
        raise ValueError('ROM de perfil e gate diferem: nenhum resultado aproveitado')
    if not isinstance(gate.get('routes'),list) or not isinstance(profile.get('coverage'),list):
        raise ValueError('gate ou perfil sem lista de rotas')
    statuses = {r.get('name'):r.get('status') for r in gate['routes'] if isinstance(r,dict)}
    matched=[]
    for item in profile['coverage']:
        id=item['id']
        ok=(gate.get('status')=='APROVADO_ROTAS_AOT' and statuses.get(id)=='APROVADO_ROTA_AOT')
        matched.append({'id':id,'goal':item['goal'],
                        'status':'ROTA_AOT_VERIFICADA' if ok else 'PENDENTE_CERTIFICACAO',
                        'route_result':statuses.get(id,'NAO_EXECUTADA')})
    passed=sum(x['status']=='ROTA_AOT_VERIFICADA' for x in matched)
    return {'schema':SCHEMA,'rom_sha256':profile['rom_sha256'],
            'game_template':profile['game_template'],'routes_observed':len(gate['routes']),
            'checkpoints_planned':len(matched),'checkpoints_with_aot_route_proof':passed,
            'coverage':matched, 'qualifier':(
                'ROTA_AOT_VERIFICADA e evidência restrita aos quadros/inputs/condicoes da rota. '
                'Nao certifica audio, controles fisicos, compatibilidade de PC ou campanha completa.')}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile',type=Path,required=True)
    parser.add_argument('--gate',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    a=parser.parse_args(argv)
    try:
        result=summarize(json.loads(a.profile.read_text()),json.loads(a.gate.read_text()))
        a.output.parent.mkdir(parents=True,exist_ok=True)
        a.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f"PROVA_AOT_POR_CHECKPOINT={result['checkpoints_with_aot_route_proof']}/{result['checkpoints_planned']}")
        return 0
    except (OSError,ValueError,KeyError,TypeError) as exc:
        print('ERRO:',exc,file=sys.stderr)
        return 2

if __name__=='__main__':
    raise SystemExit(main())
