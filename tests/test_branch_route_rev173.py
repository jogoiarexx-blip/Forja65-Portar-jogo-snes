#!/usr/bin/env python3
"""Standalone security/determinism tests for the generic input-only route search."""
import importlib.util
import json
import tempfile
import contextlib
import io
import os
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / 'tools' / 'branch-route-search-rev173.py'
spec = importlib.util.spec_from_file_location('route173', SCRIPT)
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class BranchRouteTests(unittest.TestCase):
    def test_masks_and_bounds(self):
        self.assertEqual(r.parse_mask('c180'), 0xc180)
        for invalid in ('0x8000','-100','12345','GGGG','','8180;rm'):
            with self.assertRaises(ValueError): r.parse_mask(invalid)
        for actions in ([{'frames':0,'mask':'0100'}],
                        [{'frames':301,'mask':'0100'}],
                        [{'frames':30,'repeat':201,'mask':'0100'}]):
            with self.assertRaises(ValueError): r.expand_actions(actions)

    def test_replay_frames_and_no_victory(self):
        mask=[(3,0x8180),(4,0x0100)]
        trace=r.replay_lines(2558,mask,'abcdef')
        self.assertEqual(len(trace.splitlines()),8)
        self.assertIn('frame=2558 joy1=8180',trace)
        self.assertIn('frame=2564 joy1=0100',trace)
        s=r.summarize([{'frame':100,'x':5000,'y':600},
                       {'frame':106,'x':5200,'y':550}], min_x=5100)
        self.assertEqual(s['phase_cleared'],'NOT_VERIFIED')
        self.assertEqual(s['max_x_observed'],5200)
        self.assertEqual(s['suspicious_discontinuities'],[106])
        self.assertLess(r.rank(s), r.rank(r.summarize([
            {'frame':100,'x':5000,'y':600},{'frame':106,'x':5100,'y':550}],5100)))

    def test_config_rejects_duplicates_and_payloads(self):
        with tempfile.TemporaryDirectory() as d:
            path=Path(d)/'case.json'
            a={'candidates':[{'name':'valid','actions':[{'frames':2,'mask':'8100'}]}]}
            path.write_text(json.dumps(a))
            self.assertEqual(len(r.load_config(path)[1]),1)
            a['candidates'] *= 2
            path.write_text(json.dumps(a))
            with self.assertRaisesRegex(ValueError,'duplicate'):r.load_config(path)
            a['candidates'][1]['name']='../danger'
            path.write_text(json.dumps(a))
            with self.assertRaisesRegex(ValueError,'unsafe'):r.load_config(path)


@unittest.skipUnless(os.name == 'posix', 'fork control requires POSIX')
class RouteProtocolTests(unittest.TestCase):
    def run_port(self, directory, failure='', prefix=False, relative=False, output='results'):
        # A small real subprocess speaks the generated runtime's line protocol.
        # Failed save/load and shifted frame responses must abort the search.
        root = Path(directory)
        game = root/'bin'/'linux'/'game'
        game.parent.mkdir(parents=True)
        checkpoint = root/'tests'/'checkpoint.f65s'
        checkpoint.parent.mkdir()
        checkpoint.touch()
        game.write_text('#!'+sys.executable+'\n'+"FAILURE="+repr(failure)+'\n'+r'''import sys
from pathlib import Path
Path('launched').touch()
print('FORJA65_CHECKPOINT_LOADED frame=100', flush=True)
print('ready 100', flush=True)
frame = 100
snapshots = {}
for line in sys.stdin:
    parts = line.split()
    command = ' '.join(parts)
    if command == FAILURE:
        print('err', flush=True)
    elif parts[0] == 'save':
        snapshots[parts[1]] = frame
        print('ok', flush=True)
    elif parts[0] == 'load':
        frame = snapshots[parts[1]] + (1 if FAILURE == 'shift' else 0)
        print('ok '+str(frame), flush=True)
    elif parts[0] == 'frame': print(frame, flush=True)
    elif parts[0] == 'run':
        frame += int(parts[1]); print('ok '+str(frame), flush=True)
    elif parts[0] == 'ram':
        start, size = int(parts[1],16), int(parts[2],16)
        ram = {0x9da:18, 0x9dd:0x88, 0x9de:0x13, 0x9e0:0x58, 0x9e1:2}
        print(bytes(ram.get(start+i,0) for i in range(size)).hex(), flush=True)
    elif parts[0] == 'shot':
        if FAILURE == 'shot': print('err', flush=True)
        else:
            if FAILURE != 'missing-shot': Path(parts[1]).write_bytes(b'P6\n1 1\n255\n\0\0\0')
            print('ok', flush=True)
    elif parts[0] == 'quit': break
''')
        game.chmod(0o755)
        config = root/'config.json'
        data = {'candidates':[{'name':'a','actions':[{'frames':2,'mask':'0100'}]}]}
        if prefix: data['prefix'] = [{'frames':2,'mask':'0100'}]
        config.write_text(json.dumps(data))
        args = ['--game',str(game),'--checkpoint',str(checkpoint),
                '--config',str(config),'--output',str(root/output),'--timeout','1']
        if failure == 'missing-shot':
            stale = root/output/'best-route.ppm'
            stale.parent.mkdir(parents=True)
            stale.write_bytes(b'stale screenshot')
        previous = Path.cwd()
        try:
            if relative:
                os.chdir(root)
                args[1] = 'bin/linux/game'; args[3] = 'tests/checkpoint.f65s'
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                result = r.main(args)
            return result
        finally: os.chdir(previous)

    def test_failed_save_aborts(self):
        for command, prefix in [('save root173',False),('save prefix173',True)]:
            with self.subTest(command=command), tempfile.TemporaryDirectory() as d:
                with self.assertRaisesRegex(RuntimeError,'save'):
                    self.run_port(d,command,prefix)

    def test_failed_load_aborts(self):
        for command, prefix in [('load root173',False),('load prefix173',True)]:
            with self.subTest(command=command), tempfile.TemporaryDirectory() as d:
                with self.assertRaisesRegex(RuntimeError,'restore'):
                    self.run_port(d,command,prefix)

    def test_restored_frame_must_match(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(RuntimeError,'frame'):
                self.run_port(d,'shift')

    def test_project_relative_checkpoint_and_protocol_artifacts(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(self.run_port(d,relative=True),0)
            out = Path(d)/'results'
            self.assertTrue((out/'best-route.ppm').read_bytes().startswith(b'P6'))
            self.assertTrue(json.loads((out/'route-search-results.json').read_text())['reverified'])
            self.assertEqual(len((out/'best-route-input.txt').read_text().splitlines()),3)

    def test_prefix_snapshot_restores_its_own_frame(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(self.run_port(d,prefix=True),0)
            report = json.loads((Path(d)/'results/route-search-results.json').read_text())
            self.assertEqual(report['best']['start_frame'],102)
            self.assertEqual(report['best']['last']['frame'],104)
            self.assertEqual(len((Path(d)/'results/best-route-input.txt').read_text().splitlines()),5)

    def test_space_output_rejected_before_launch(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(SystemExit): self.run_port(d,output='has spaces')
            self.assertFalse((Path(d)/'bin/linux/launched').exists())

    def test_failed_or_missing_screenshot_aborts(self):
        for failure in ('shot','missing-shot'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as d:
                with self.assertRaisesRegex(RuntimeError,'screenshot'):
                    self.run_port(d,failure)
                self.assertFalse((Path(d)/'results/route-search-results.json').exists())


if __name__=='__main__':unittest.main()

