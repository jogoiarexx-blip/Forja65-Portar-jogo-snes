"""Tests of the v0.4.36.1 external compiled checkpoint gate."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SCRIPT=Path(__file__).resolve().parents[1]/'tools'/'verify-compiled-replay.py'
spec=importlib.util.spec_from_file_location('verify_replay',SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ReplayGateTests(unittest.TestCase):
    def test_runtime_pass_and_refuses_dirty_directory(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);game=root/'fake-game';assets=root/'assets';assets.mkdir()
            (assets/'cart-data.bin').write_bytes(b'ROM')
            game.write_text('#!/usr/bin/env python3\nfrom pathlib import Path\nPath("forja65-qa-status.txt").write_text("runtime_started=PASS\\nrom=1234567890abcdef\\nframes=5\\n")\n')
            game.chmod(0o755)
            result=mod.run_checkpoint(game,5,root/'qa',expected_rom='1234567890abcdef')
            self.assertTrue(result['passed'])
            self.assertFalse(result['claimed_equivalence_to_snes'])
            self.assertTrue(json.loads((root/'qa'/'checkpoint-result.json').read_text())['passed'])
            with self.assertRaisesRegex(ValueError,'previous diagnostics'):
                mod.run_checkpoint(game,5,root/'qa',expected_rom='1234567890abcdef')

    def test_reports_wrong_rom_instead_of_claiming_pass(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);game=root/'fake-game';assets=root/'assets';assets.mkdir()
            (assets/'cart-data.bin').write_bytes(b'ROM')
            game.write_text('#!/usr/bin/env python3\nfrom pathlib import Path\nPath("forja65-qa-status.txt").write_text("runtime_started=PASS\\nrom=1234567890abcdef\\nframes=5\\n")\n')
            game.chmod(0o755)
            result=mod.run_checkpoint(game,5,root/'qa',expected_rom='0000000000000000')
            self.assertFalse(result['passed'])
            self.assertIn('rom_fingerprint_mismatch',result['problems'])

    def test_hint_means_fail_even_if_executable_says_pass(self):
        with tempfile.TemporaryDirectory() as d:
            root=Path(d);game=root/'fake-game';assets=root/'assets';assets.mkdir()
            (assets/'cart-data.bin').write_bytes(b'ROM')
            game.write_text('#!/usr/bin/env python3\nfrom pathlib import Path\nPath("forja65-qa-status.txt").write_text("runtime_started=PASS\\nrom=1234567890abcdef\\nframes=5\\n")\nPath("forja65-runtime-hints.txt").write_text("unresolved\\n")\n')
            game.chmod(0o755)
            result=mod.run_checkpoint(game,5,root/'qa',expected_rom='1234567890abcdef')
            self.assertFalse(result['passed'])
            self.assertIn('new_unresolved_flow',result['problems'])

if __name__=='__main__':unittest.main()
