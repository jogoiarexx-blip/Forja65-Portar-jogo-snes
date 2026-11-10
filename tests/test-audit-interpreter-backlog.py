from pathlib import Path
from tempfile import TemporaryDirectory
import importlib.util
spec=importlib.util.spec_from_file_location('backlog',str(Path(__file__).resolve().parents[1]/'tools/audit-interpreter-backlog.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with TemporaryDirectory() as d:
 p=Path(d)
 before=p/'before.txt';after=p/'after.txt';disp=p/'dispatch.cpp';ha=p/'ha.txt';hb=p/'hb.txt'
 before.write_text('FORJA65_CPU_INTERPRETER 1\nblocks=3\ninstructions=11\nB39520 M0X0 from=B393FA count=3\nB2E5C9 M0X0 from=B2E5A8 count=2\n')
 after.write_text('FORJA65_CPU_INTERPRETER 1\nblocks=2\ninstructions=3\nB2E5C9 M0X0 from=B2E5A8 count=1\n')
 disp.write_text('static const Dispatch kForja65Dispatch[]={\n{0xB39520u,false,false,false,false,false,&sub_X,0xB39520u},\n{0xB2E5C9u,false,false,false,true,true,&sub_Y,0xB2E5C9u},\n};\n')
 ha.write_text('frame=1 wram=abc framebuffer=def\nframe=2 wram=xxx framebuffer=yyy\n')
 hb.write_text(ha.read_text())
 a=m.read_entries(before);assert len(a)==2
 s=m.compare(a,m.read_entries(after),disp,ha,hb)
 assert s['equivalencia_comprovada'] and s['ocorrencias_antes']==5 and s['ocorrencias_depois']==1
 assert s['entradas'][0]['cobertura']=='despacho-estatico-presente' and s['entradas'][0]['execucao']=='fallback-ausente-em-replay-equivalente'
 assert s['entradas'][1]['cobertura']=='despacho-condicional-carry' and s['entradas'][1]['execucao']=='fallback-reduzido-em-replay-equivalente'
 hb.write_text('frame=1 wram=abc framebuffer=WRONG\nframe=2 wram=xxx framebuffer=yyy\n')
 s=m.compare(a,m.read_entries(after),disp,ha,hb)
 assert not s['equivalencia_comprovada'] and all(x['execucao']=='nao-validado' for x in s['entradas'])
 try:m.read_entries(p/'bad.txt')
 except FileNotFoundError:pass
 else:raise AssertionError('missing file accepted')
 before.write_text('FORJA65_CPU_INTERPRETER 1\ninstructions=0\n');assert not m.read_entries(before)
 before.write_text('FORJA65_CPU_INTERPRETER 1\nblocks=1\ninstructions=50\n')
 try:m.read_entries(before)
 except ValueError:pass
 else:raise AssertionError('empty nonzero log accepted')
 print('BACKLOG_AUDITOR_7_ASSERTIONS_PASS')
