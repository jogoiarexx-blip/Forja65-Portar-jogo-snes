#!/usr/bin/env python3
"""Regression of trace-layout and source-integrity checks for object reuse."""
import importlib.util
from pathlib import Path
import tempfile

script = Path(__file__).resolve().parents[1] / 'tools/check-incremental-abi.py'
spec = importlib.util.spec_from_file_location('abi_guard', script)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as t:
    root=Path(t); base=root/'base'; cand=root/'candidate'
    for p in [base, cand]:
        (p/'src').mkdir(parents=True)
        for file in [*m.REQUIRED, 'generated_000.cpp']:
            (p/'src'/file).write_text('equal', encoding='utf-8')
    ninja=root/'build.ninja'
    ninja.write_text('build CMakeFiles/forja65_generated.dir/src/dispatch.cpp.o: CXX_COMPILER in.cpp\n  DEFINES = -DFORJA65_ENABLE_TRACE=0\n  FLAGS = -O0 -DNDEBUG -std=gnu++20 -include /one/path/pch.hxx\n')
    correct='-std=gnu++20 -O0 -DNDEBUG -DFORJA65_ENABLE_TRACE=0'
    assert m.verify(base, cand, ninja, correct, ['generated_000.cpp'])['checked_files']==5
    def rejects(action):
        try: action()
        except ValueError: return
        raise AssertionError('guard accepted an unsafe object reuse')
    rejects(lambda: m.verify(base,cand,ninja,'-std=gnu++20 -O0 -DNDEBUG',[]))
    rejects(lambda: m.verify(base,cand,ninja,'-std=gnu++20 -DFORJA65_ENABLE_TRACE=0',[]))
    rejects(lambda: m.verify(base,cand,ninja,'-std=gnu++17 -DNDEBUG -DFORJA65_ENABLE_TRACE=0',[]))
    (cand/'src/generated_000.cpp').write_text('altered', encoding='utf-8')
    rejects(lambda: m.verify(base,cand,ninja,correct,['generated_000.cpp']))
    (cand/'src/generated_000.cpp').write_text('equal', encoding='utf-8')
    rejects(lambda: m.verify(base,cand,ninja,correct,['../outside.cpp']))
print('PASS: 6 cases for Forja65 incremental ABI safety gate')
