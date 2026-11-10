import importlib.util
from pathlib import Path
p = Path(__file__).resolve().parents[1]/'tools'/'compare-snes-port-clock-rev145.py'
s=importlib.util.spec_from_file_location('compare_clock',p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
a={'runtime_started':'PASS','frames':'600','instructions':'450','framebuffer_hash':'abc','wram_hash':'cba'}
b=dict(a)
assert m.verdict(a,b)=='SAME_SNAPSHOT_NOT_FULL_REPLAY_PROOF'
b['wram_hash']='other'
assert m.verdict(a,b)=='TIMING_DIVERGENCE_REPLAY_REQUIRES_NEW_VALIDATION'
b['frames']='599'
assert m.verdict(a,b)=='DIVERGED_FRAME_COUNT'
assert m.verdict({},b)=='UNVERIFIED_EXECUTION_FAILURE'
print('PASS REV145 differential clock QA classifications')
