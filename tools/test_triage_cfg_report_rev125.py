#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest
HERE = pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('triage',HERE/'triage-cfg-report.py')
triage=importlib.util.module_from_spec(spec);spec.loader.exec_module(triage)
class TestTriage(unittest.TestCase):
    def test_limits_and_false_vector_are_not_gameplay(self):
        a=triage.triage('''Decodificadas (enderecos unicos): 8530\nCobertura de traducao do CFG descoberto: 100.0%\nSTATUS: PORT_AINDA_NAO_JOGAVEL\n- $5801F8 [CFG-LIMIT] limite de rotina\n- [CFG-LIMIT] limite global de 65536 variantes\n- $588028 [VECTOR] BRK sem vetor ROM resolvido\n- $58E07A [CFG-NONROM-TARGET] JSL -> $920982 nao aponta para ROM\n''')
        self.assertEqual(a['decoded_unique'],8530)
        self.assertEqual(a['reported_translation_coverage_pct'],100.0)
        self.assertEqual(len(a['global_budget_limits']),1)
        self.assertEqual(a['likely_speculative_brk_cop_count'],1)
        self.assertEqual(a['unresolved_by_bank']['58'],2)
        self.assertEqual(a['status'],'PORT_AINDA_NAO_JOGAVEL')
    def test_empty(self):
        a=triage.triage('')
        self.assertIsNone(a['decoded_unique'])
        self.assertFalse(a['warnings'])
if __name__=='__main__':unittest.main()
