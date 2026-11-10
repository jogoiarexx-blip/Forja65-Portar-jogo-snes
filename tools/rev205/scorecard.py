#!/usr/bin/env python3
"""Forja65 REV205 - notas MEDIDAS (nao estimadas) a partir das evidencias.

  python3 scorecard.py --conformidade PASTA/conformidade.json [--desempenho PASTA/desempenho.json]
                       [--prova PASTA/prova.json ...] --out notas.md

Regras (cada nota diz de onde vem):
  * Areas de hardware (OAM/sprites, CGRAM, VRAM, DMA, HDMA, janelas, Mode 7, color math, CPU ...):
    nota = 10 x (pontos de controle IGUAIS ao bsnes) / (pontos comparaveis). Um ponto em que bsnes e Snes9x
    discordam entre si nao conta contra nem a favor. ROM que nem gera/compila conta como divergente.
  * Jogabilidade comprovada independentemente: 10 x (provas IDENTICO_AO_BSNES + ESTADO_IDENTICO_AO_BSNES +
    MARCOS_COMPROVADOS) / provas. A tabela mostra tambem quantas amostras tiveram a imagem igual.
    Sem prova nenhuma a nota e "sem evidencia" (nao vira zero nem dez).
  * Desempenho global: 10 x min(1, pior_tempo_real / 2) x (fracao de ports com p99 <= 16,64 ms).
    Ou seja, 10 exige que o PIOR port rode a 2x o tempo real e que nenhum quadro passe do orcamento de 60 Hz no p99.
"""
import argparse, json, os

AREA_NAMES = {
    'oam': 'OAM / sprites', 'cgram': 'CGRAM', 'vram': 'VRAM', 'dma': 'DMA', 'hdma': 'HDMA', 'window': 'Janelas',
    'mode7': 'Mode 7', 'colormath': 'Color math', 'cpu': 'CPU 65C816 (ROMs de teste)', 'hires': 'Hires / pseudo-hires',
    'mosaic': 'Mosaico', 'interlace': 'Entrelacado', 'inidisp': 'INIDISP / brilho', 'jogo': 'Jogos de codigo aberto',
    'wram': 'Portas de leitura (WRAM)'}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--conformidade', required=True)
    ap.add_argument('--desempenho', default='')
    ap.add_argument('--prova', action='append', default=[])
    ap.add_argument('--out', required=True)
    ap.add_argument('--titulo', default='Forja65 REV205 - notas medidas')
    a = ap.parse_args()
    conf = json.load(open(a.conformidade))
    # recalcula as notas a partir dos pontos (vale tambem para relatorios de versoes antigas da ferramenta)
    import importlib.util
    spec = importlib.util.spec_from_file_location('conformance', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'conformance.py'))
    C = importlib.util.module_from_spec(spec); spec.loader.exec_module(C)
    notas = C.score(conf.get('roms', []), conf.get('arbitro', 'bsnes'))
    out = {'formato': 'forja65-rev205-notas-1', 'areas': {}, 'jogabilidade': None, 'desempenho': None}
    lines = ['# ' + a.titulo, '', 'Toda nota abaixo e calculada a partir de arquivos de evidencia; nenhuma e estimada.', '',
             '## Hardware (port gerado do zero x bsnes, com Snes9x como segunda opiniao)', '',
             'Nota = 10 x pontos iguais ao bsnes / pontos comparados (o bsnes decide sempre). A coluna "sem ambiguos" tira os',
             'pontos em que o proprio Snes9x discorda do bsnes.', '',
             '| Area | Nota | Sem ambiguos | Pontos iguais | Divergentes | ROMs com erro | Referencias discordam | ROMs |', '|---|---:|---:|---:|---:|---:|---:|---:|']
    for k in sorted(notas, key=lambda x: AREA_NAMES.get(x, x)):
        n = notas[k]
        out['areas'][k] = n
        nota = n.get('nota_medida_0a10'); nota2 = n.get('nota_sem_pontos_ambiguos_0a10')
        lines.append('| %s | %s | %s | %d | %d | %d | %d | %d |' % (AREA_NAMES.get(k, k), '-' if nota is None else '%.1f' % nota,
                     '-' if nota2 is None else '%.1f' % nota2,
                     n['pontos_iguais'], n['pontos_divergentes'], n['roms_com_erro'], n['referencias_divergem'], n['roms']))
    roms = conf.get('roms', [])
    bad = []
    for r in roms:
        if r.get('erro'):
            bad.append('%s: %s' % (r['nome'], r['erro']))
            continue
        for p in r['pontos']:
            dv = [k + ('' if v == 'DIVERGE' else ' (Snes9x tambem discorda do bsnes)') for k, v in p['veredito'].items() if v in ('DIVERGE', 'REFERENCIAS_DIVERGEM')]
            if dv:
                bad.append('%s quadro %s: %s' % (r['nome'], p['quadro'], ', '.join(dv)))
    lines += ['', 'Cores de referencia: ' + ', '.join('%s (%s)' % (k, v['sha256'][:12]) for k, v in conf.get('cores', {}).items()),
              'ROMs testadas: %d' % len(roms), '']
    if bad:
        lines += ['Pontos divergentes:', ''] + ['- ' + b for b in bad[:60]] + ['']

    provas = [json.load(open(p)) | {'_arquivo': p} for p in a.prova if os.path.exists(p)]
    lines += ['## Jogabilidade comprovada independentemente', '']
    if provas:
        ok = sum(1 for p in provas if p['veredito'] in ('IDENTICO_AO_BSNES', 'ESTADO_IDENTICO_AO_BSNES', 'MARCOS_COMPROVADOS'))
        nota = 10.0 * ok / len(provas)
        out['jogabilidade'] = {'nota': round(nota, 2), 'provas': len(provas), 'aprovadas': ok}
        lines += ['Nota: **%.1f** (%d de %d provas aprovadas)' % (nota, ok, len(provas)), '',
                  '| Prova | Veredito | Amostras | Estado do jogo igual (bsnes) | Imagem igual (bsnes) | 1a divergencia |', '|---|---|---:|---:|---:|---|']
        for p in provas:
            lines.append('| %s | %s | %d | %s | %s | %s |' % (os.path.basename(os.path.dirname(p['_arquivo'])), p['veredito'], p['amostras'],
                         p.get('amostras_estado_igual', p['amostras_logico_igual']).get('bsnes'), p['amostras_imagem_igual'].get('bsnes'),
                         ', '.join('%s@%s' % kv for kv in p['primeira_divergencia'].items()) or '-'))
    else:
        lines += ['Sem evidencia (rode tools/rev205/gameplay-proof.py com a rota do jogo).']
    lines.append('')

    lines += ['## Desempenho global', '']
    if a.desempenho and os.path.exists(a.desempenho):
        d = json.load(open(a.desempenho))['resumo']
        worst = d.get('tempo_real_min_x') or 0.0
        frac = 1.0 - (len(d.get('ports_com_p99_acima_de_16_64ms', [])) / d['ports_ok'] if d.get('ports_ok') else 1.0)
        nota = 10.0 * min(1.0, worst / 2.0) * frac
        out['desempenho'] = {'nota': round(nota, 2), **d}
        lines += ['Nota: **%.1f**' % nota, '',
                  '- ports medidos: %d (ok: %d), %d quadros cada' % (d['ports'], d['ports_ok'], d['quadros_por_port']),
                  '- quadros por segundo: pior %s, mediana %s, media geometrica %s' % (d['fps_min'], d['fps_mediana'], d['fps_media_geometrica']),
                  '- pior port: %sx o tempo real (NTSC)' % worst,
                  '- pior p99 de tempo de quadro: %s ms' % d['p99_ms_pior'],
                  '- CPU interpretada no corpus: %s%% das instrucoes' % d.get('cpu_interpretada_pct'),
                  '- maquina: %s nucleos' % d['ambiente']['nproc'], '']
    else:
        lines += ['Sem evidencia (rode tools/rev205/perf-bench.py).', '']
    open(a.out, 'w').write('\n'.join(lines) + '\n')
    json.dump(out, open(os.path.splitext(a.out)[0] + '.json', 'w'), indent=1)
    print('\n'.join(lines))


if __name__ == '__main__':
    main()
