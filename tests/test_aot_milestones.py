#!/usr/bin/env python3
"""Regression tests for golden milestone comparisons (doesn't run the game)."""
import importlib.util
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location('milestones', Path(__file__).parent.parent / 'tools' / 'audit-aot-milestones.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
with tempfile.TemporaryDirectory() as t:
    d = Path(t)
    ref = d/'golden'; h = d/'hashes'
    ref.write_text('# expected\nframe=0 wram=abc # starts\nframe=2 wram=ff # goal\n')
    h.write_text('frame=0 framebuffer=0 wram=0abc pc=1234\nframe=1 framebuffer=0 wram=12 pc=1234\n')
    r = audit.audit(ref, h)
    assert r['checked_milestones'] == 1 and r['matching_milestones'] == 1
    assert r['pending_future_milestones'] == 1
    h.write_text(h.read_text()+'frame=2 framebuffer=0 wram=00f0 pc=1234\n')
    r = audit.audit(ref, h)
    assert r['mismatched_milestones'] == 1 and not r['all_observed_milestones_match']
    h.write_text('frame=1 framebuffer=0 wram=00ff pc=1234\n')
    try:
        audit.audit(ref, h)
        raise AssertionError('expected discontinuity')
    except ValueError as ex:
        assert 'discontinuity' in str(ex)
print('3 audit milestone tests PASS')
