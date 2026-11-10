#!/usr/bin/env python3
"""Observe a falling-piece handoff using OAM and PPU; not a line-clear oracle."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

OAM=re.compile(r'^slot=\d+ x=(-?\d+) y=(-?\d+) size=(\d+) tile=(\d+) attr=[0-9a-fA-F]+ hflip=[01] vflip=[01]$')
INPUT=re.compile(r'^frame=(\d+) joy1=([0-9a-fA-F]{4}) joy2=([0-9a-fA-F]{4})$')


def piece_tiles(path, roi=(80,25,175,190)):
    data=path.read_text(encoding='utf-8')
    if not data.startswith('FORJA65_OAM_SPRITES 1\n'):
        raise ValueError('formato de OAM inesperado')
    sprites=[]
    for line in data.splitlines()[1:]:
        if line.startswith(('obsel=','visible_slots=')):continue
        m=OAM.fullmatch(line)
        if not m: raise ValueError(f'linha de OAM invalida em {path}: {line}')
        x,y,sz,t=map(int,m.groups())
        if sz==8 and roi[0]<=x<roi[2] and roi[1]<=y<roi[3]:
            sprites.append((x,y,t))
    return sprites


def read_ppm(path):
    data=path.read_bytes()
    if not data.startswith(b'P6\n'):raise ValueError('captura PPM P6 invalida')
    m=re.match(rb'P6\s+(\d+)\s+(\d+)\s+(\d+)\s',data)
    if m is None: raise ValueError('cabecalho PPM invalido')
    w,h,maxval=map(int,m.groups())
    if not (0<w<=8192 and 0<h<=8192 and maxval==255):
        raise ValueError('dimensoes PPM invalidas')
    image=data[m.end():]
    if len(image)!=w*h*3:raise ValueError('imagem PPM incompleta')
    return (w,h,image)


def board_diff(a,b,roi):
    w,h,pa=read_ppm(a)
    bw,bh,pb=read_ppm(b)
    if (w,h)!=(bw,bh):raise ValueError('dimensoes de captura mudaram')
    x0,y0,x1,y1=roi
    if not (0<=x0<x1<=w and 0<=y0<y1<=h):raise ValueError('regiao do tabuleiro invalida')
    return sum(pa[(y*w+x)*3:(y*w+x)*3+3]!=pb[(y*w+x)*3:(y*w+x)*3+3]
               for y in range(y0,y1) for x in range(x0,x1))


def validate(folder,frames=(1875,1900,1925),old_tiles=(2,3,11,5),new_tiles=(2,13,5,4),board=(88,32,170,200)):
    folder=Path(folder)
    if len(frames)!=3 or sorted(set(frames))!=list(frames):
        raise ValueError('esperados 3 quadros crescentes')
    dirs=[folder/'captures'/f'frame-{f}' for f in frames]
    samples=[piece_tiles(d/'oam-sprites.txt') for d in dirs]
    def signature(s):return sorted(t for x,y,t in s)
    if signature(samples[0])!=sorted(old_tiles):
        raise ValueError(f'primeira peca nao corresponde a assinatura: {samples[0]}')
    if samples[1]:
        raise ValueError(f'peca ainda ativa no quadro de transferencia: {samples[1]}')
    if signature(samples[2])!=sorted(new_tiles) or sorted(old_tiles)==sorted(new_tiles):
        raise ValueError(f'nova peca nao detectada: {samples[2]}')
    # No visual disappearance when the old piece is removed from OAM.
    dif=board_diff(dirs[0]/'preview.ppm',dirs[1]/'preview.ppm',board)
    if dif:
        raise ValueError(f'area do tabuleiro mudou no handoff: {dif} pixels')
    new_y=min(y for x,y,t in samples[2])
    old_y=max(y for x,y,t in samples[0])
    if new_y>=old_y:
        raise ValueError('nova peca nao apareceu proxima ao topo')
    return {'pass':True,'status':'handoff_visual_observado','frames':list(frames),
            'old_tiles':sorted(old_tiles),'new_tiles':sorted(new_tiles),
            'preserved_pixels':(board[2]-board[0])*(board[3]-board[1]),
            'new_piece_top_y':new_y,'old_piece_bottom_y':old_y,
            'limitations':'Nao demonstra limpeza de linhas nem todas as colisoes com pilha.'}


def make_replay(path,start,stop):
    events={}
    for n,line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(),1):
        line=line.split('#',1)[0].strip()
        if not line:continue
        m=INPUT.fullmatch(line)
        if not m:raise ValueError(f'{path}:{n}: entrada invalida')
        frame=int(m.group(1))
        if frame in events:raise ValueError('replay com quadro duplicado')
        events[frame]=(m.group(2).lower(),m.group(3).lower())
    if 0 not in events or not(0<start<stop) or any(start<=f<=stop for f in events):
        raise ValueError('sequencia de comandos incompatível com descida sustentada')
    prev=max(f for f in events if f<start)
    if events[prev]!=('0000','0000'):raise ValueError('controle anterior ainda ativo')
    events[start]=('0400','0000');events[stop]=('0000','0000')
    return '# Soft-drop QA replay\n'+'\n'.join(f'frame={f} joy1={j1} joy2={j2}' for f,(j1,j2) in sorted(events.items()))+'\n'


def run(game,cart,trace,folder,frames,start,stop):
    folder=Path(folder)
    game,cart,trace=Path(game).resolve(),Path(cart).resolve(),Path(trace).resolve()
    if not(game.is_file() and cart.is_file() and trace.is_file()):
        raise FileNotFoundError('executable, cart ou trace nao encontrado')
    if min(frames)<=start:raise ValueError('primeira captura precisa ocorrer depois do inicio do controle')
    (folder/'assets').mkdir(parents=True,exist_ok=True)
    shutil.copy2(cart,folder/'assets'/'cart-data.bin')
    (folder/'input.txt').write_text(make_replay(trace,start,stop),encoding='utf-8')
    cap=folder/'captures'
    if cap.exists():shutil.rmtree(cap)
    env=os.environ.copy()
    for k in list(env):
        if k.startswith('FORJA65_SPC_') or k in ('FORJA65_FRAME_HASHES','FORJA65_INPUT_RECORD'):
            env.pop(k,None)
    env.update(FORJA65_HEADLESS='1',FORJA65_UNCAPPED='1',FORJA65_CAPTURE_STOP='1',
               FORJA65_HEADLESS_FRAMES=str(max(frames)),FORJA65_CAPTURE_FRAMES=','.join(map(str,frames)),
               FORJA65_CAPTURE_DIR=str(cap.resolve()),FORJA65_INPUT_REPLAY=str((folder/'input.txt').resolve()))
    with (folder/'run.log').open('w',encoding='utf-8') as log:
        result=subprocess.run([str(game)],cwd=folder,env=env,stdout=log,stderr=subprocess.STDOUT)
    if result.returncode: raise RuntimeError(f'runtime falhou: {result.returncode}')
    qa=folder/'forja65-qa-status.txt'
    if not qa.is_file() or 'runtime_started=PASS' not in qa.read_text():
        raise RuntimeError('execucao nao confirmou inicializacao')
    for f in frames:
        if not (cap/f'frame-{f}'/'oam-sprites.txt').is_file():
            raise RuntimeError(f'faltou OAM no frame {f}')


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output',type=Path,required=True)
    ap.add_argument('--game',type=Path)
    ap.add_argument('--cart',type=Path)
    ap.add_argument('--trace',type=Path)
    ap.add_argument('--frames',default='1875,1900,1925')
    ap.add_argument('--start',type=int,default=1835)
    ap.add_argument('--stop',type=int,default=2380)
    ap.add_argument('--old-tiles',default='2,3,11,5')
    ap.add_argument('--new-tiles',default='2,13,5,4')
    ap.add_argument('--board',default='88,32,170,200')
    ap.add_argument('--report',type=Path)
    a=ap.parse_args()
    try:
        frames=tuple(int(v) for v in a.frames.split(','))
        tiles=tuple(int(v) for v in a.old_tiles.split(','))
        new=tuple(int(v) for v in a.new_tiles.split(','))
        board=tuple(int(v) for v in a.board.split(','))
        if len(board)!=4 or len(tiles)!=4 or len(new)!=4 or len(set(tiles))!=4 or len(set(new))!=4:
            raise ValueError('tiles/regiao invalidos')
        if a.game:
            if not(a.cart and a.trace):raise ValueError('--game requer --cart e --trace')
            run(a.game,a.cart,a.trace,a.output,frames,a.start,a.stop)
        r=validate(a.output,frames,tiles,new,board)
        out=a.report or a.output/'resultado-travamento.json';out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8')
        print('LOCK_HANDOFF_PASS',r['frames'],flush=True)
        return 0
    except (OSError,ValueError,RuntimeError) as exc:
        print('LOCK_HANDOFF_FAIL',exc,file=sys.stderr)
        return 2

if __name__=='__main__':sys.exit(main())
