#!/usr/bin/env python3
"""Forja65 deterministic gameplay input A/B validator (stdlib only).

Runs a baseline and four isolated input pulses, comparing actual PPU captures.
This checks observable visual response, not correctness against a SNES reference.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

BUTTONS = {'left': '0200', 'right': '0100', 'rotate': '0080', 'down': '0400'}
CASES = ('baseline', *BUTTONS)
EVENT = re.compile(r'^frame=(\d+)\s+joy1=([0-9a-fA-F]{4})\s+joy2=([0-9a-fA-F]{4})$')


def read_ppm(path):
    data = path.read_bytes()
    if not data.startswith(b'P6\n'):
        raise ValueError(f'{path}: imagem PPM P6 invalida')
    index, tokens = 3, []
    while len(tokens) < 3:
        while index < len(data) and data[index] in b' \t\r\n':
            index += 1
        if index < len(data) and data[index] == 35:
            while index < len(data) and data[index] != 10:
                index += 1
            continue
        start = index
        while index < len(data) and data[index] not in b' \t\r\n':
            index += 1
        if start == index:
            raise ValueError(f'{path}: header incompleto')
        try:
            tokens.append(int(data[start:index]))
        except ValueError as exc:
            raise ValueError(f'{path}: dimensoes invalidas') from exc
    w, h, maximum = tokens
    if not (0 < w <= 8192 and 0 < h <= 8192 and maximum == 255):
        raise ValueError(f'{path}: tamanho/maximo invalido')
    if index >= len(data) or data[index] not in b' \t\r\n':
        raise ValueError(f'{path}: sem separador RGB')
    index += 2 if data[index:index+2] == b'\r\n' else 1
    rgb = data[index:]
    if len(rgb) != w*h*3:
        raise ValueError(f'{path}: captura truncada: {len(rgb)} bytes RGB')
    return w, h, rgb


def compare_images(a, b, roi):
    w, h, ar = read_ppm(a)
    bw, bh, br = read_ppm(b)
    if (w,h)!=(bw,bh):
        raise ValueError('imagens possuem tamanhos diferentes')
    x0,y0,x1,y1=roi
    if not (0<=x0<x1<=w and 0<=y0<y1<=h):
        raise ValueError(f'ROI {roi} fora da imagem {w}x{h}')
    inside = outside = 0
    for p in range(w*h):
        k = p*3
        if ar[k:k+3] != br[k:k+3]:
            x,y=p%w,p//w
            if x0 <= x < x1 and y0 <= y < y1:
                inside+=1
            else:
                outside+=1
    return {'within_piece_roi':inside,'outside_piece_roi':outside,
            'different_pixels':inside+outside}


def capture(root, name, frame):
    return root/name/'captures'/f'frame-{frame}'/'preview.ppm'


def validate(root, before=1834, after=(1843, 1850, 1860), roi=(104,40,160,128), min_pixels=64):
    root=Path(root)
    results={}
    # Branches must share the exact same state BEFORE the isolated button event.
    for name in BUTTONS:
        m=compare_images(capture(root,'baseline',before),capture(root,name,before),roi)
        if m['different_pixels']:
            raise ValueError(f'{name}: divergencia ANTES do comando no quadro {before}: {m}')
        comparisons=[]
        for frame in after:
            m=compare_images(capture(root,'baseline',frame),capture(root,name,frame),roi)
            comparisons.append({'frame':frame,**m})
            if m['within_piece_roi'] < min_pixels:
                raise ValueError(f'{name}: sem resposta suficiente da peca no quadro {frame}: {m}')
            if m['outside_piece_roi']:
                raise ValueError(f'{name}: alteracao fora da regiao da peca no quadro {frame}: {m}')
        results[name]={'before_identical':True,'after':comparisons}
    # Opposite directions and other actions should not collapse to the same frame.
    for left,right in (('left','right'),('left','rotate'),('rotate','down'),('right','down')):
        m=compare_images(capture(root,left,after[0]),capture(root,right,after[0]),roi)
        if m['within_piece_roi'] < min_pixels:
            raise ValueError(f'{left}/{right} produziram imagens indistinguiveis')
    return {'pass':True,'before_frame':before,'after_frames':list(after),'piece_roi':list(roi),
            'cases':results,'note':'A/B de controles e framebuffer; nao prova colisoes ou fidelidade ao SNES original'}


def load_input_schedule(path):
    events={}
    for lineno,line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(),1):
        line=line.split('#',1)[0].strip()
        if not line:
            continue
        m=EVENT.fullmatch(line)
        if not m:
            raise ValueError(f'{path}:{lineno}: linha de entrada invalida')
        frame=int(m.group(1))
        if frame in events:
            raise ValueError(f'{path}:{lineno}: quadro duplicado {frame}')
        events[frame]=(m.group(2).lower(),m.group(3).lower())
    if 0 not in events:
        raise ValueError('replay nao contem quadro 0')
    return events


def build_trace(events, pulse, hold, button):
    events=events.copy()
    if button is not None:
        if any(f in events for f in (pulse,pulse+hold)):
            raise ValueError('pulso coincide com um evento do replay original')
        # Do not silently change existing controller state.
        previous=[f for f in events if f < pulse]
        if not previous or events[max(previous)] != ('0000','0000'):
            raise ValueError('pulso exige controles liberados antes do evento')
        events[pulse]=(button,'0000')
        events[pulse+hold]=('0000','0000')
    return '# Replay gerado para teste A/B do Forja65\n'+'\n'.join(
        f'frame={f} joy1={v[0]} joy2={v[1]}' for f,v in sorted(events.items()))+'\n'


def run_cases(game, cart, trace, output, pulse, hold, frames):
    events=load_input_schedule(trace)
    game,cart=Path(game).resolve(),Path(cart).resolve()
    if not game.is_file() or not cart.is_file():
        raise FileNotFoundError('game ou assets/cart-data.bin ausente; compile primeiro')
    if min(frames)<=0 or max(frames)<=pulse+hold:
        raise ValueError('capturas precisam ocorrer depois do pulso e sua liberacao')
    # Captures are intentionally independent; each uses identical runtime settings.
    for name in CASES:
        folder=output/name
        (folder/'assets').mkdir(parents=True,exist_ok=True)
        shutil.copy2(cart,folder/'assets'/'cart-data.bin')
        (folder/'input.txt').write_text(build_trace(events,pulse,hold,BUTTONS.get(name)),encoding='utf-8')
        captures=folder/'captures'
        if captures.exists():
            shutil.rmtree(captures)
        env=os.environ.copy()
        env.update(FORJA65_HEADLESS='1',FORJA65_UNCAPPED='1',FORJA65_CAPTURE_STOP='1',
                   FORJA65_HEADLESS_FRAMES=str(max(frames)),FORJA65_CAPTURE_FRAMES=','.join(map(str,frames)),
                   FORJA65_CAPTURE_DIR=str(captures.resolve()),FORJA65_INPUT_REPLAY=str((folder/'input.txt').resolve()))
        # Avoid inherited debug/experimental overrides from other launches.
        for key in list(env):
            if key.startswith('FORJA65_SPC_') or key in ('FORJA65_FRAME_HASHES','FORJA65_INPUT_RECORD'):
                env.pop(key,None)
        with (folder/'run.log').open('w',encoding='utf-8') as log:
            finished=subprocess.run([str(game)],cwd=folder,env=env,stdout=log,stderr=subprocess.STDOUT)
        if finished.returncode:
            raise RuntimeError(f'{name}: jogo terminou com erro {finished.returncode}, veja {folder / "run.log"}')
        for frame in frames:
            if not capture(output,name,frame).is_file():
                raise RuntimeError(f'{name}: faltou captura do quadro {frame}')
        qa=folder/'forja65-qa-status.txt'
        if not qa.is_file() or 'runtime_started=PASS' not in qa.read_text():
            raise RuntimeError(f'{name}: runtime nao confirmou inicializacao')
        print(f'CAPTURA_OK {name} {max(frames)} quadros',flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--game',type=Path,help='executavel C++ opcional; sem ele valida capturas existentes')
    parser.add_argument('--cart',type=Path)
    parser.add_argument('--trace',type=Path)
    parser.add_argument('--pulse',type=int,default=1835)
    parser.add_argument('--hold',type=int,default=6)
    parser.add_argument('--before',type=int,default=1834)
    parser.add_argument('--after',default='1843,1850,1860')
    parser.add_argument('--roi',default='104,40,160,128')
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    try:
        after=tuple(int(v) for v in args.after.split(','))
        roi=tuple(int(v) for v in args.roi.split(','))
        if len(after)<1 or len(roi)!=4 or args.before>=args.pulse or args.pulse+args.hold>=min(after):
            raise ValueError('parametros de quadros/ROI invalidos')
        if args.game:
            if not args.cart or not args.trace:
                raise ValueError('--game requer --cart e --trace')
            run_cases(args.game,args.cart,args.trace,args.output,args.pulse,args.hold,
                      sorted(set((args.before,*after))))
        report=validate(args.output,args.before,after,roi)
        report_file=args.report or args.output/'resultado-controles.json'
        report_file.parent.mkdir(parents=True,exist_ok=True)
        report_file.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
        for name,r in report['cases'].items():
            print('CONTROLE_OK',name,[(i['frame'],i['within_piece_roi']) for i in r['after']])
        print('QA_CONTROLES_PASS')
        return 0
    except (OSError,ValueError,RuntimeError) as exc:
        print('QA_CONTROLES_FAIL:',exc,file=sys.stderr)
        return 2


if __name__=='__main__':
    raise SystemExit(main())
