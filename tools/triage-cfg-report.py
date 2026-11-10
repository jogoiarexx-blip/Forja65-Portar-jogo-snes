#!/usr/bin/env python3
"""REV125: Classify symptoms in the Forja CFG text report without claiming
that static coverage is game coverage. Standard library only.

Usage: python tools/triage-cfg-report.py report.txt --json output.json
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path

RE_ISSUE = re.compile(r'^- (?:(?:\$([0-9A-Fa-f]{6}) )?)\[([A-Z][A-Z0-9-]*)\] (.*)$')
RE_NUM = re.compile(r'^([^:\r\n]+):\s*(\d+)\s*$')


def triage(text):
    metrics = {}
    items = []
    for line in text.splitlines():
        n = RE_NUM.match(line)
        if n:
            metrics[n.group(1)] = int(n.group(2))
        m = RE_ISSUE.match(line)
        if m:
            items.append({'pc': m.group(1), 'kind': m.group(2), 'description': m.group(3)})
    counters = Counter(x['kind'] for x in items)
    unresolved = [x for x in items if x['kind'] in ('CFG-DYNAMIC', 'CFG-NONROM-TARGET', 'CFG-LIMIT', 'CFG-SUMMARY-LIMIT')]
    invalid_brk = [x for x in items if x['kind']=='VECTOR' and ('BRK' in x['description'] or 'COP' in x['description'])]
    global_limits = [x for x in items if x['kind']=='CFG-LIMIT' and x['pc'] is None]
    by_bank = Counter(x['pc'][:2] for x in unresolved if x['pc'])
    warnings = []
    if global_limits:
        warnings.append('O limite global de CFG foi alcançado: cobertura parcial; priorizar observacoes e dependencias confirmadas, nao apenas aumentar o teto.')
    if invalid_brk:
        warnings.append('Vetores BRK/COP encontrados ao varrer bancos ROM nao comprovam interrupcoes reais; verificar origem/proveniencia dos seeds.')
    if counters['CFG-NONROM-TARGET']:
        warnings.append('Fluxos para enderecos fora da ROM exigem revalidacao de M/X/PB, origem da semente e conteudo RAM executavel; nao promover o destino cegamente.')
    if counters['CFG-DYNAMIC']:
        warnings.append('Dispatchers dinamicos ainda exigem observacoes ou prova estrutural dos limites de indice/tabelas.')
    issues_sorted=sorted(unresolved,key=lambda i: {'CFG-NONROM-TARGET':0,'CFG-SUMMARY-LIMIT':1,'CFG-DYNAMIC':2,'CFG-LIMIT':3}.get(i['kind'],4))
    return {
       'schema':'forja65.cfg-triage.rev125', 'scope':'relatorio estatico, nao valida gameplay',
       'status':next((line.split(':',1)[1].strip() for line in text.splitlines() if line.startswith('STATUS:')),None),
       'decoded_unique':metrics.get('Decodificadas (enderecos unicos)'),
       'reported_translation_coverage_pct':next((float(m.group(1)) for line in text.splitlines() if (m:=re.search(r'Cobertura de traducao do CFG descoberto: ([\d.]+)%',line))),None),
       'issues_by_kind':dict(sorted(counters.items())), 'global_budget_limits':[x['description'] for x in global_limits],
       'likely_speculative_brk_cop_count':len(invalid_brk), 'unresolved_by_bank':dict(by_bank.most_common()),
       'priority_issues':issues_sorted[:30], 'warnings':warnings
    }


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('report',type=Path)
    p.add_argument('--json',type=Path,default=None)
    a=p.parse_args()
    result=triage(a.report.read_text(encoding='utf-8-sig',errors='replace'))
    if a.json:
        a.json.parent.mkdir(parents=True,exist_ok=True)
        a.json.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print('Forja65 CFG triage — REV125')
    print('Status:',result['status'],'| endereços decodificados:',result['decoded_unique'])
    print('Principais ocorrências:',', '.join(f'{k}={v}' for k,v in result['issues_by_kind'].items() if k in ('CFG-LIMIT','CFG-DYNAMIC','CFG-NONROM-TARGET','VECTOR')))
    print('Possíveis BRK/COP especulativos:',result['likely_speculative_brk_cop_count'])
    for warning in result['warnings']:print('ATENÇÃO:', warning)
    return 0

if __name__=='__main__':raise SystemExit(main())
