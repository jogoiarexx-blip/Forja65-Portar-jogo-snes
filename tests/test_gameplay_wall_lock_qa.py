#!/usr/bin/env python3
"""Positive/negative synthetic regressions for wall and active-piece handoff probes."""
import importlib.util
from pathlib import Path
import tempfile

ROOT=Path(__file__).resolve().parents[1]
def load(name):
    path=ROOT/'tools'/f'{name}.py'
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
wall=load('gameplay_wall_qa')
lock=load('gameplay_lock_qa')

def fail(fn,typ=ValueError):
    try:fn()
    except typ: return
    raise AssertionError(f'Esperava {typ.__name__}')

def oam(root,case,frame,coords):
    f=root/case/'captures'/f'frame-{frame}'/'oam-sprites.txt'
    f.parent.mkdir(parents=True,exist_ok=True)
    f.write_text('FORJA65_OAM_SPRITES 1\nobsel=0\n'+''.join(
        f'slot={i} x={x} y={y} size=8 tile={tile} attr=40 hflip=0 vflip=0\n'
        for i,(x,y,tile) in enumerate(coords))+f'visible_slots={len(coords)}\n')
    return f

def piece(x,y,tiles=(2,3,11,5)):
    return [(x,y,tiles[0]),(x+8,y,tiles[1]),(x+16,y,tiles[2]),(x+16,y-8,tiles[3])]

def ppm(root,case,frame,mark=None):
    d=root/case/'captures'/f'frame-{frame}'
    d.mkdir(parents=True,exist_ok=True)
    w=h=32
    rgb=bytearray(b'\0\0\0'*(w*h))
    if mark:
        x,y=mark
        rgb[(y*w+x)*3:(y*w+x)*3+3]=b'\xff\x00\x11'
    (d/'preview.ppm').write_bytes(b'P6\n32 32\n255\n'+rgb)

with tempfile.TemporaryDirectory() as tmp:
    r=Path(tmp)
    frames=[1,2,3,4,5,6]
    for case,xs in [('hold_left',[120,104,88,88,88,88]),('hold_right',[120,136,144,144,144,144])]:
        for frame,x in zip(frames,xs):oam(r,case,frame,piece(x,32+frame*8))
    assert wall.validate(r,frames,[2,3,11,5],88,144,(3,4,5,6))['pass']
    p=oam(r,'hold_left',5,piece(80,72))
    fail(lambda:wall.validate(r,frames,[2,3,11,5],88,144,(3,4,5,6)))
    oam(r,'hold_left',5,piece(88,72))
    oam(r,'hold_right',6,piece(136,80))
    fail(lambda:wall.validate(r,frames,[2,3,11,5],88,144,(3,4,5,6)))
    oam(r,'hold_right',6,piece(144,80))
    oam(r,'hold_left',4,piece(88,56))
    oam(r,'hold_left',5,piece(88,56))
    oam(r,'hold_left',6,piece(88,56))  # game freezes instead of falling
    fail(lambda:wall.validate(r,frames,[2,3,11,5],88,144,(3,4,5,6)))
    oam(r,'hold_left',4,piece(88,64))
    oam(r,'hold_left',5,piece(88,72))
    oam(r,'hold_left',6,piece(88,80))
    p.write_text('not-oam\n')
    fail(lambda:wall.validate(r,frames,[2,3,11,5],88,144,(3,4,5,6)))
    oam(r,'hold_left',5,piece(88,72))
    fail(lambda:wall.validate(r,frames,[2,3,11,5],88,144,(4,5,5,6)))
    # Validate replay construction rejects collisions with existing controls.
    trace=r/'input.txt'
    trace.write_text('frame=0 joy1=0000 joy2=0000\nframe=10 joy1=0000 joy2=0000\n')
    assert 'frame=12 joy1=0200' in wall.create_trace(trace,12,20,'0200')
    fail(lambda:wall.create_trace(trace,10,20,'0200'))
    assert 'frame=12 joy1=0400' in lock.make_replay(trace,12,20)
    fail(lambda:lock.make_replay(trace,10,20))

    # Handoff: original four sprites -> no active sprites (persistent picture) -> new piece.
    s=r/'lock'
    oam(r,'lock',10,piece(120,128))
    oam(r,'lock',20,[])
    oam(r,'lock',30,piece(120,48,tiles=(2,13,4,5)))
    for f in (10,20,30):ppm(r,'lock',f)
    args={'frames':(10,20,30),'board':(1,1,30,30)}
    assert lock.validate(s,**args)['pass']
    ppm(r,'lock',20,(10,10))
    fail(lambda:lock.validate(s,**args))
    ppm(r,'lock',20)
    oam(r,'lock',20,piece(120,128))
    fail(lambda:lock.validate(s,**args))
    oam(r,'lock',20,[])
    oam(r,'lock',30,piece(120,48))
    fail(lambda:lock.validate(s,**args))
    oam(r,'lock',30,piece(120,48,tiles=(2,13,4,5)))
    (s/'captures/frame-20/preview.ppm').write_bytes(b'P6\n32 32\n255\n\x00')
    fail(lambda:lock.validate(s,**args))
print('GAMEPLAY_WALL_LOCK_QA_PASS')
