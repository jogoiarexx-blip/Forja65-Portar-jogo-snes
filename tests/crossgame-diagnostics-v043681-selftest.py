#!/usr/bin/env python3
"""Isolated regression tests; fixtures are synthetic, not commercial-game evidence."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'tools' / 'crossgame-diagnostics-v043681.py'
spec = importlib.util.spec_from_file_location('forja65_crossgame_v81', SCRIPT)
mod = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = mod
spec.loader.exec_module(mod)


class CrossGameTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.sessions = []
        self.manifest = self.root / 'sessions.json'

    def add(self, game='DKC3', run='r1', files=None, rom=False):
        directory = self.root / 'inputs' / game / run
        directory.mkdir(parents=True)
        for name, body in (files or {}).items():
            (directory / name).write_text(body, encoding='utf-8')
        item = {'game': game, 'session': run, 'logs_dir': f'inputs/{game}/{run}'}
        if rom:
            romfile = directory / 'game.sfc'
            romfile.write_bytes(f'ROM_{game}_{run}'.encode())
            item['rom_file'] = f'inputs/{game}/{run}/game.sfc'
        self.sessions.append(item)
        return directory

    def write_manifest(self):
        self.manifest.write_text(json.dumps({'schema': mod.SCHEMA, 'sessions': self.sessions}), encoding='utf-8')
        return self.manifest

    def result(self):
        return mod.build(self.write_manifest(), self.root / 'output')

    def test_two_games_same_symptom_priority(self):
        for name, pc in [('DKC3', 'b68140'), ('Bomberman', '00ca45')]:
            self.add(name, files={'forja65-crash-trace.txt': f'reason=unresolved-flow\nframe=77 instruction=200\n{pc} A=0\n',
                                  'forja65-runtime-hints.txt': f'rom={"a"*16} target=00abcd from={pc} kind=FLOW e=0 m=0 x=0 c=0\n'})
        report = self.result()
        self.assertEqual(report['games_count'], 2)
        self.assertEqual(report['failure_events'], 2)
        cluster = report['clusters'][0]
        self.assertEqual((cluster['priority'], cluster['category'], cluster['independent_games']), ('high', 'cfg.unresolved_flow', 2))
        self.assertEqual({item['last_pc'] for item in cluster['examples']}, {'B68140', '00CA45'})
        self.assertTrue(all(item['rom_scope']['provenance'] == 'runtime_hint_id_unverified' for item in cluster['examples']))

    def test_two_sessions_same_game_not_cross_game(self):
        for run in ('r1', 'r2'):
            self.add('DKC3', run, {'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        report = self.result()
        self.assertEqual(report['clusters'][0]['independent_games'], 1)
        self.assertEqual(report['clusters'][0]['priority'], 'medium')
        self.assertFalse(report['clusters'][0]['cross_game_candidate'])

    def test_distinct_types_not_equivalent(self):
        self.add('SMW', files={'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        self.add('MMX', files={'forja65-last-error.txt': 'APU audio not responding\n'})
        report = self.result()
        self.assertEqual(len(report['clusters']), 2)
        self.assertTrue(all(not c['cross_game_candidate'] for c in report['clusters']))

    def test_no_logs_warn_only(self):
        self.add()
        report = self.result()
        self.assertEqual(report['failure_events'], 0)
        self.assertEqual(len(report['clusters']), 0)
        self.assertTrue(any('nenhum arquivo' in w for w in report['warnings']))

    def test_qa_only_failure(self):
        self.add(files={'forja65-qa-status.txt': 'FORJA65_QA 1\nruntime_started=FAIL\nerror=fluxo CFG nao resolvido em pc=12046456\n'})
        self.assertEqual(self.result()['clusters'][0]['category'], 'cfg.unresolved_flow')

    def test_qa_fail_without_message(self):
        self.add(files={'forja65-qa-status.txt': 'runtime_started=FAIL\n'})
        issue = self.result()['clusters'][0]['examples'][0]
        self.assertEqual((issue['reason'], issue['category']), ('qa_failed', 'runtime.other'))

    def test_hint_only_does_not_claim_failure(self):
        self.add(files={'forja65-runtime-hints.txt': 'rom=1234567890abcdef target=B68140 from=B68110 kind=FLOW\n'})
        report = self.result()
        self.assertEqual(report['failure_events'], 0)
        self.assertEqual(len(report['clusters']), 0)

    def test_unresolved_sites_low_confidence(self):
        self.add(files={'forja65-unresolved-targets.txt': 'B68110 -> B68140\n'})
        c = self.result()['clusters'][0]
        self.assertEqual((c['priority'], c['failure_events'], c['cross_game_candidate']), ('low', 0, False))

    def test_verified_rom_file_is_hashed(self):
        self.add(files={'forja65-crash-trace.txt': 'reason=unresolved-flow\n'}, rom=True)
        item = self.result()['sessions'][0]['rom_scope']
        self.assertEqual(len(item['file_sha256']), 64)
        self.assertEqual(item['provenance'], 'rom_file_sha256')

    def test_source_hashes(self):
        directory = self.add(files={'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        file = directory / 'forja65-crash-trace.txt'
        report = self.result()
        self.assertEqual(report['sessions'][0]['evidence_files']['trace']['sha256'], mod.sha256(file))

    def test_conflicting_fingerprints_rejected(self):
        self.add(files={'forja65-runtime-hints.txt': 'rom=1234567890abcdef target=000001\nrom=abcdef1234567890 target=000002\n'})
        with self.assertRaises(mod.DiagnosticError):
            self.result()

    def test_unknown_category(self):
        self.add(files={'forja65-crash-trace.txt': 'reason=super-rare-thing\n'})
        self.assertEqual(self.result()['clusters'][0]['category'], 'runtime.other')

    def test_untrusted_code_is_not_executed(self):
        marker = self.root / 'bad.txt'
        self.add(files={'forja65-last-error.txt': f'$(touch {marker})\n'})
        self.result()
        self.assertFalse(marker.exists())

    def test_duplicate_session_rejected(self):
        self.add()
        self.sessions.append(dict(self.sessions[0]))
        with self.assertRaises(mod.DiagnosticError):
            self.result()

    def test_invalid_manifest_schema(self):
        self.manifest.write_text('{"schema":"wrong","sessions":[]}', encoding='utf-8')
        with self.assertRaises(mod.DiagnosticError):
            mod.build(self.manifest, self.root/'output')

    def test_missing_logs_directory_rejected(self):
        self.sessions.append({'game':'SMW','session':'test','logs_dir':'missing'})
        with self.assertRaises(mod.DiagnosticError):
            self.result()

    def test_output_inside_source_rejected(self):
        dir = self.add()
        with self.assertRaises(mod.DiagnosticError):
            mod.build(self.write_manifest(), dir / 'reports')

    def test_large_log_rejected(self):
        directory = self.add()
        (directory / 'forja65-crash-trace.txt').write_bytes(b'A' * (mod.MAX_FILE_BYTES + 1))
        with self.assertRaises(mod.DiagnosticError):
            self.result()

    def test_main_writes_both_reports_and_does_not_change_inputs(self):
        dir = self.add(files={'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        source = dir/'forja65-crash-trace.txt'
        previous = source.read_bytes()
        self.write_manifest()
        code = mod.main(['--manifest', str(self.manifest), '--out', str(self.root/'output')])
        self.assertEqual(code, 0)
        json_report = json.loads((self.root/'output'/'crossgame-summary.json').read_text())
        self.assertEqual(json_report['failure_events'], 1)
        self.assertIn('CPU/CFG', (self.root/'output'/'crossgame-summary.md').read_text())
        self.assertEqual(source.read_bytes(), previous)

    def test_ci_flag(self):
        self.add(files={'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        self.write_manifest()
        code = mod.main(['--manifest', str(self.manifest), '--out', str(self.root/'report'), '--fail-on-findings'])
        self.assertEqual(code, 1)

    def test_cli_subprocess(self):
        self.add(files={'forja65-qa-status.txt': 'runtime_started=PASS\n'})
        self.write_manifest()
        done = subprocess.run([sys.executable, str(SCRIPT), '--manifest', str(self.manifest), '--out', str(self.root/'out')],
                              capture_output=True, text=True, timeout=10)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn('0 falhas', done.stdout)

    def test_invalid_game_name_rejected(self):
        self.add(game='SMW')
        self.sessions[0]['game'] = '../outside'
        with self.assertRaises(mod.DiagnosticError):
            self.result()

    def test_qa_success_without_error_is_not_failure(self):
        self.add(files={'forja65-qa-status.txt': 'runtime_started=PASS\nframes=4000\n'})
        self.assertEqual(self.result()['failure_events'], 0)

    def test_report_clusters_stable_order(self):
        self.add('SMW', files={'forja65-last-error.txt': 'PPU rendering failed\n'})
        self.add('MMX', files={'forja65-last-error.txt': 'PPU rendering failed\n'})
        self.add('DKC3', files={'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        clusters = self.result()['clusters']
        self.assertEqual([c['priority'] for c in clusters], ['high', 'medium'])
        self.assertEqual(clusters[0]['category'], 'ppu.obj')


    def test_manifest_auto_discovery_end_to_end(self):
        self.add('DKC3', 'round1', {'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        self.add('Bomberman', 'round1', {'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        generator = SCRIPT.with_name('crossgame-make-manifest-v043681.py')
        generated = self.root / 'inputs' / 'manifest.json'
        done = subprocess.run([sys.executable, str(generator), '--root', str(self.root/'inputs'), '--out', str(generated)], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)
        actual = json.loads(generated.read_text(encoding='utf-8'))
        self.assertEqual(len(actual['sessions']), 2)
        report = mod.build(generated, self.root/'output')
        self.assertTrue(report['clusters'][0]['cross_game_candidate'])

    def test_manifest_discovery_empty_rejected(self):
        root = self.root / 'empty'
        root.mkdir()
        generator = SCRIPT.with_name('crossgame-make-manifest-v043681.py')
        done = subprocess.run([sys.executable, str(generator), '--root', str(root), '--out', str(root/'manifest.json')], capture_output=True, text=True)
        self.assertEqual(done.returncode, 2)
        self.assertFalse((root/'manifest.json').exists())

    def test_manifest_discovery_ignores_unrelated_files(self):
        self.add('SMW', 'run1', {'not-a-forja-log.txt': 'unrelated'})
        generator = SCRIPT.with_name('crossgame-make-manifest-v043681.py')
        done = subprocess.run([sys.executable, str(generator), '--root', str(self.root/'inputs'), '--out', str(self.root/'manifest.json')], capture_output=True, text=True)
        self.assertEqual(done.returncode, 2)

    def test_manifest_discovery_does_not_misname_games(self):
        self.add('SMW', 'round1', {'forja65-runtime-hints.txt': 'rom=1234567890abcdef\n'})
        self.add('MMX', 'round1', {'forja65-crash-trace.txt': 'reason=unresolved-flow\n'})
        generator = SCRIPT.with_name('crossgame-make-manifest-v043681.py')
        out = self.root/'manifest-auto.json'
        done = subprocess.run([sys.executable, str(generator), '--root', str(self.root/'inputs'), '--out', str(out)], capture_output=True, text=True)
        self.assertEqual(done.returncode, 0, done.stderr)
        data = json.loads(out.read_text(encoding='utf-8'))
        self.assertEqual({i['game'] for i in data['sessions']}, {'SMW', 'MMX'})

    def test_report_read_only_legacy_fixture(self):
        legacy = SCRIPT.parents[1] / 'reports' / 'validation-v0393' / 'traversal-round12'
        if not legacy.is_dir():
            self.skipTest('older fixture was not packaged')
        self.sessions.append({'game':'LEGACY_FIXTURE','session':'round12','logs_dir':str(legacy)})
        report = self.result()
        self.assertEqual(report['games_count'], 1)
        self.assertEqual(report['clusters'][0]['category'], 'cfg.unresolved_flow')
        self.assertFalse(report['clusters'][0]['cross_game_candidate'])

if __name__ == '__main__':
    unittest.main(verbosity=2)
