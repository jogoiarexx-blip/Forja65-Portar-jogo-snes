#!/usr/bin/env python3
"""Deterministic OAM wall-collision regression; portable across Forja65 ports.

Verifies a *specific* piece with a stable tile signature reaches its expected
left/right horizontal bounds, never crosses them, and continues moving vertically.
Does not prove collisions with stacked tiles or line clear behavior.
"""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

SPRITE_RE = re.compile(r'^slot=(\d+) x=(-?\d+) y=(-?\d+) size=(\d+) tile=(\d+) attr=([0-9a-fA-F]+) hflip=([01]) vflip=([01])$')
INPUT_RE = re.compile(r'^frame=(\d+) joy1=([0-9a-fA-F]{4}) joy2=([0-9a-fA-F]{4})$')
BUTTONS = {'hold_left': '0200', 'hold_right': '0100'}


def read_piece(path, tiles, x_range=(80, 180), y_range=(32, 175)):
    content = path.read_text(encoding='utf-8')
    if not content.startswith('FORJA65_OAM_SPRITES 1\n'):
        raise ValueError(f'{path}: OAM header invalido')
    found = {}
    for line in content.splitlines()[1:]:
        if line.startswith('obsel=') or line.startswith('visible_slots='):
            continue
        m = SPRITE_RE.fullmatch(line)
        if m is None:
            raise ValueError(f'{path}: linha OAM invalida: {line[:100]}')
        slot,x,y,size,tile,attr,hflip,vflip = m.groups()
        x,y,size,tile=int(x),int(y),int(size),int(tile)
        if (tile in tiles and size==8 and x_range[0]<=x<x_range[1]
                and y_range[0]<=y<y_range[1]):
            if tile in found:
                raise ValueError(f'{path}: tile de peca duplicado: {tile}')
            found[tile] = (x, y)
    if set(found) != set(tiles):
        raise ValueError(f'{path}: peca incompleta, encontrados={sorted(found)}, esperados={sorted(tiles)}')
    min_x=min(x for x,y in found.values())
    min_y=min(y for x,y in found.values())
    shape=tuple((t,found[t][0]-min_x,found[t][1]-min_y) for t in tiles)
    return {'x':min_x,'y':min_y,'shape':shape}


def parse_trace(trace):
    events={}
    for n,line in enumerate(trace.read_text(encoding='utf-8-sig').splitlines(),1):
        line=line.split('#',1)[0].strip()
        if not line:
            continue
        m=INPUT_RE.fullmatch(line)
        if not m: raise ValueError(f'{trace}:{n}: linha invalida')
        frame=int(m.group(1))
        if frame in events:raise ValueError(f'{trace}:{n}: quadro duplicado')
        events[frame]=(m.group(2).lower(),m.group(3).lower())
    if 0 not in events: raise ValueError('replay sem quadro zero')
    return events


def create_trace(trace, start, stop, button):
    events=parse_trace(trace)
    if not (0<start<stop):raise ValueError('intervalo de controle invalido')
    if any(start <= f <= stop for f in events):
        raise ValueError('controle sustentado sobrepoe comando existente')
    prev=max(f for f in events if f<start)
    if events[prev] != ('0000','0000'):
        raise ValueError('botao anterior nao foi liberado')
    events[start]=(button,'0000')
    events[stop]=('0000','0000')
    return '# Wall QA generated deterministic input\n'+'\n'.join(
        f'frame={f} joy1={v[0]} joy2={v[1]}' for f,v in sorted(events.items()))+'\n'


def run_cases(game,cart,trace,output,frames,start,stop):
    game,cart,trace=Path(game).resolve(),Path(cart).resolve(),Path(trace).resolve()
    if not (game.is_file() and cart.is_file() and trace.is_file()):
        raise FileNotFoundError('game, cart ou replay nao encontrado')
    if min(frames)>=start or max(frames)<=stop:
        raise ValueError('capturas devem incluir antes do controle e apos sua liberacao')
    for name,button in BUTTONS.items():
        d=output/name
        (d/'assets').mkdir(parents=True,exist_ok=True)
        shutil.copy2(cart,d/'assets'/'cart-data.bin')
        (d/'input.txt').write_text(create_trace(trace,start,stop,button),encoding='utf-8')
        captures=d/'captures'
        if captures.exists():shutil.rmtree(captures)
        env=os.environ.copy()
        for key in list(env):
            if key.startswith('FORJA65_SPC_') or key in ('FORJA65_FRAME_HASHES','FORJA65_INPUT_RECORD'):
                env.pop(key,None)
        env.update(FORJA65_HEADLESS='1', FORJA65_UNCAPPED='1', FORJA65_CAPTURE_STOP='1',
                   FORJA65_HEADLESS_FRAMES=str(max(frames)),
                   FORJA65_CAPTURE_FRAMES=','.join(map(str,frames)),
                   FORJA65_CAPTURE_DIR=str(captures.resolve()),
                   FORJA65_INPUT_REPLAY=str((d/'input.txt').resolve()))
        with (d/'run.log').open('w',encoding='utf-8') as log:
            result=subprocess.run([str(game)],cwd=d,env=env,stdout=log,stderr=subprocess.STDOUT)
        if result.returncode: raise RuntimeError(f'{name}: runtime error={result.returncode}; veja {d / "run.log"}')
        for frame in frames:
            if not (captures/f'frame-{frame}'/'oam-sprites.txt').is_file():
                raise RuntimeError(f'{name}: captura OAM ausente no quadro {frame}')
        qa=d/'forja65-qa-status.txt'
        if not qa.exists() or 'runtime_started=PASS' not in qa.read_text():
            raise RuntimeError(f'{name}: runtime nao confirmou inicializacao')
        print('CAPTURE_PASS',name,max(frames),flush=True)


def validate(root, frames, tiles, expected_left, expected_right,
             plateau_frames=(1875,1890,1905,1920,1935,1950,1970),
             x_range=(80,180), y_range=(32,175)):
    root=Path(root)
    if not frames or sorted(set(frames))!=list(frames):
        raise ValueError('quadros devem estar em ordem crescente sem repeticao')
    if min(frames)>=min(plateau_frames) or not set(plateau_frames).issubset(frames):
        raise ValueError('quadros de borda nao estao incluidos na captura')
    if expected_left>=expected_right:raise ValueError('limites invertidos')
    output={}
    common_shape=None
    for case,wall in (('hold_left',expected_left),('hold_right',expected_right)):
        data=[]
        for f in frames:
            path=root/case/'captures'/f'frame-{f}'/'oam-sprites.txt'
            piece=read_piece(path,tiles,x_range,y_range)
            if common_shape is None: common_shape=piece['shape']
            if piece['shape']!=common_shape:
                raise ValueError(f'{case} frame {f}: outra peca ou rotacao detectada')
            data.append({'frame':f,'x':piece['x'],'y':piece['y']})
        if case=='hold_left' and any(p['x']<wall for p in data):
            raise ValueError('peca atravessou a parede esquerda')
        if case=='hold_right' and any(p['x']>wall for p in data):
            raise ValueError('peca atravessou a parede direita')
        plateau=[p for p in data if p['frame'] in plateau_frames]
        if len(plateau)<4 or any(p['x']!=wall for p in plateau):
            raise ValueError(f'{case}: colisao nao manteve limite esperado {wall}: {plateau}')
        if case=='hold_left' and not (data[0]['x']>wall and any(p['x']<data[0]['x'] for p in data)):
            raise ValueError('comando esquerda nao deslocou a peca')
        if case=='hold_right' and not (data[0]['x']<wall and any(p['x']>data[0]['x'] for p in data)):
            raise ValueError('comando direita nao deslocou a peca')
        # Contact must not be disguised by a frozen or reset game.
        ys=[p['y'] for p in plateau]
        if any(b<a for a,b in zip(ys,ys[1:])) or len(set(ys))<3:
            raise ValueError(f'{case}: gravidade nao progrediu apos contato com borda')
        output[case]={'wall':wall,'first_x':data[0]['x'],
                      'contact_frame':next(p['frame'] for p in data if p['x']==wall),
                      'vertical_progress':ys[-1]-ys[0], 'positions':data}
    if output['hold_left']['positions'][0]!=output['hold_right']['positions'][0]:
        raise ValueError('as duas execucoes ja divergiam antes dos controles')
    return {'pass':True, 'status':'colisao_lateral_observada', 'tile_signature':list(tiles),
            'results':output,'limitations':'Nao valida empilhamento, limpeza de linhas nem equivalencia ao SNES.'}


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--game',type=Path)
    ap.add_argument('--cart',type=Path)
    ap.add_argument('--trace',type=Path)
    ap.add_argument('--frames',default='1834,1843,1860,1875,1890,1905,1920,1935,1950,1970')
    ap.add_argument('--plateau-frames',default='1875,1890,1905,1920,1935,1950,1970')
    ap.add_argument('--start',type=int,default=1835)
    ap.add_argument('--stop',type=int,default=1960)
    ap.add_argument('--tiles',default='2,3,11,5')
    ap.add_argument('--left-wall',type=int,default=88)
    ap.add_argument('--right-wall',type=int,default=144)
    ap.add_argument('--report',type=Path)
    args=ap.parse_args()
    try:
        frames=[int(x) for x in args.frames.split(',')]
        plateau=[int(x) for x in args.plateau_frames.split(',')]
        tiles=[int(x) for x in args.tiles.split(',')]
        if len(tiles)<2 or len(tiles)!=len(set(tiles)) or not all(0<=t<=255 for t in tiles):
            raise ValueError('assinatura de tiles invalida')
        if args.game:
            if not args.cart or not args.trace:raise ValueError('--game requer --cart e --trace')
            run_cases(args.game,args.cart,args.trace,args.output,frames,args.start,args.stop)
        result=validate(args.output,frames,tiles,args.left_wall,args.right_wall,plateau)
        p=args.report or args.output/'resultado-paredes.json'
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
        print('WALL_COLLISION_PASS',result['results']['hold_left']['wall'],result['results']['hold_right']['wall'])
        return 0
    except (OSError,RuntimeError,ValueError) as exc:
        print('WALL_COLLISION_FAIL',exc,file=sys.stderr)
        return 2

if __name__=='__main__':
    sys.exit(main())
