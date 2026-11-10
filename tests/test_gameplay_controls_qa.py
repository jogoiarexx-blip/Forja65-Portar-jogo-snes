#!/usr/bin/env python3
"""Synthetic error-path tests for reusable control and capture verifier."""
import importlib.util
from pathlib import Path
import sys
import tempfile

script=Path(sys.argv[1]) if __name__=='__main__' and len(sys.argv)>1 else Path(__file__).resolve().parents[1]/'tools'/'gameplay_controls_qa.py'
spec=importlib.util.spec_from_file_location('gameplay_controls_qa',script)
qa=importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)

def save(root,case,frame,marks):
    w,h=16,12
    rgb=bytearray(b'\0\0\0'*(w*h))
    for x,y in marks:
        n=(y*w+x)*3
        rgb[n:n+3]=b'\x10\x88\xee'
    dest=root/case/'captures'/f'frame-{frame}'/'preview.ppm'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_bytes(b'P6\n16 12\n255\n'+rgb)
    return dest

def must_fail(fn,typ):
    try: fn()
    except typ:return
    raise AssertionError(f'{typ.__name__} deveria ter sido lançado')

with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)
    points={
        'left':[(4,2),(4,3),(5,2),(5,3)],
        'right':[(7,2),(7,3),(8,2),(8,3)],
        'rotate':[(4,4),(5,4),(6,4),(7,4)],
        'down':[(7,5),(8,5),(7,6),(8,6)]}
    for name in qa.CASES:
        for frame in (4,6,7):
            save(root,name,frame,points.get(name,[]) if frame>4 else [])
    roi=(3,1,12,9)
    assert qa.validate(root,4,(6,7),roi,min_pixels=3)['pass']
    baseline=root/'baseline'/'captures'/'frame-6'/'preview.ppm'
    p=save(root,'left',4,[(4,2)])
    must_fail(lambda:qa.validate(root,4,(6,7),roi,3),ValueError)
    save(root,'left',4,[])
    save(root,'left',6,[])
    must_fail(lambda:qa.validate(root,4,(6,7),roi,3),ValueError)
    save(root,'left',6,points['left'])
    save(root,'right',6,points['right']+[(0,0)])
    must_fail(lambda:qa.validate(root,4,(6,7),roi,3),ValueError)
    save(root,'right',6,points['right'])
    broken=root/'right'/'captures'/'frame-7'/'preview.ppm'
    broken.write_bytes(b'P6\n16 12\n255\n\x00')
    must_fail(lambda:qa.validate(root,4,(6,7),roi,3),ValueError)
    broken.unlink()
    must_fail(lambda:qa.validate(root,4,(6,7),roi,3),FileNotFoundError)
    # Reject incomplete/malformed replay and pulses colliding with existing inputs.
    trace=root/'input.txt'
    trace.write_text('frame=0 joy1=0000 joy2=0000\nframe=10 joy1=0000 joy2=0000\n')
    events=qa.load_input_schedule(trace)
    assert 'frame=12 joy1=0200' in qa.build_trace(events,12,6,'0200')
    must_fail(lambda:qa.build_trace(events,10,6,'0200'),ValueError)
    trace.write_text('frame=0 joy1=0000 joy2=0000\nframe=0 joy1=0000 joy2=0000\n')
    must_fail(lambda:qa.load_input_schedule(trace),ValueError)
    trace.write_text('frame=0 joy1=0000 joy2=0000\nframe=1 joy1=ZZZZ joy2=0000\n')
    must_fail(lambda:qa.load_input_schedule(trace),ValueError)
print('FORJA65_GAMEPLAY_CONTROLS_QA_SMOKE_PASS')
