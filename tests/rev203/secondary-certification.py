from pathlib import Path
import importlib.util
p=Path(__file__).resolve().parents[2]/'tools/rev200-certify-route.py'
spec=importlib.util.spec_from_file_location('cert',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
for bad in [dict(sa1_backend='INTERPRETER_RESEARCH',sa1_interpreter_instructions='99'),dict(sa1_backend='INTERPRETER_RESEARCH',sa1_interpreter_instructions='0'),dict(sa1_backend='AOT_UNAVAILABLE')]:
 try:m.require_secondary_aot(bad)
 except ValueError:pass
 else:raise AssertionError('secondary interpreter certified')
m.require_secondary_aot({})
m.require_secondary_aot(dict(sa1_backend='NONE',sa1_interpreter_instructions='0'))
print('REV203_SECONDARY_CERTIFICATION_PASS')
