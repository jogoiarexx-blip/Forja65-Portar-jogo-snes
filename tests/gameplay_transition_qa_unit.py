#!/usr/bin/env python3
from pathlib import Path
import tempfile
import importlib.util
import json

script=Path(__file__).resolve().parents[1]/'tools'/'gameplay_transition_qa.py'
spec=importlib.util.spec_from_file_location('gameplay_qa',script)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as d:
 base=Path(d)/'base';pause=Path(d)/'pause'
 for p in (base,pause):p.mkdir()
 def save(folder,n,rgb):
  target=folder/f'frame-{n}';target.mkdir()
  (target/'preview.ppm').write_bytes(b'P6\n2 1\n255\n'+rgb)
 red=b'\xff\x00\x00'*2;blue=b'\x00\x00\xff'*2;green=b'\x00\xff\x00'*2
 save(base,1,red);save(pause,1,red)
 save(base,2,blue);save(pause,2,green)
 save(base,3,blue);save(pause,3,green)
 save(pause,4,blue)
 rules=[{'type':'same_across','frames':[1]},
        {'type':'different_across','frames':[2,3]},
        {'type':'frozen_variant','frames':[2,3]},
        {'type':'changed_variant','frames':[3,4]}]
 assert module.evaluate(base,pause,rules)['pass']
 assert not module.evaluate(base,pause,[{'type':'same_across','frames':[2]}])['pass']
 try:module.evaluate(base,pause,[{'type':'same_across','frames':[9]}]);raise AssertionError('missing image accepted')
 except FileNotFoundError:pass
 (pause/'frame-2'/'preview.ppm').write_bytes(b'P6\n2 1\n255\n\xff')
 try:module.evaluate(base,pause,rules);raise AssertionError('truncated PPM accepted')
 except ValueError:pass
print('GAMEPLAY_TRANSITION_QA_UNIT_PASS')
