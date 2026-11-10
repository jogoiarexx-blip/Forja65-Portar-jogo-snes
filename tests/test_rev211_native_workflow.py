"""Offline regression checks for the contract, final gate, and ROM-free release."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
from unittest.mock import Mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('native_workflow', ROOT/'tools'/'rev211_native_workflow.py')
workflow = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(workflow)


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.rom = self.root/'private.sfc'
        self.rom.write_bytes(b'synthetic-only-rom-not-a-real-game')
        self.sha = workflow.sha256_file(self.rom)
        self.contract = self.root/'routes.json'

    def make_contract(self, routes):
        workflow.write_json(self.contract, {'schema': workflow.SCHEMA,
                                             'rom_sha256': self.sha, 'routes': routes})
        return workflow.contract_routes(self.contract, self.sha, 600, 60)

    def test_init_and_pin(self):
        self.assertEqual(workflow.main(['--rom', str(self.rom), '--init-contract', str(self.contract)]), 0)
        routes = workflow.contract_routes(self.contract, self.sha, 300, 60)
        self.assertEqual(routes[0]['frames'], 600)
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            workflow.contract_routes(self.contract, '1' * 64, 300, 60)

    def test_contract_rejects_duplicate_route(self):
        with self.assertRaisesRegex(ValueError, 'duplicado'):
            self.make_contract([{'name':'x','frames':10},{'name':'x','frames':12}])

    def test_contract_rejects_no_inputs_and_malformed_period(self):
        with self.assertRaisesRegex(ValueError, 'nao encontrado'):
            self.make_contract([{'name':'x','frames':10,'input':'missing.txt'}])
        with self.assertRaisesRegex(ValueError, 'hash_every'):
            self.make_contract([{'name':'x','frames':5,'hash_every':6}])

    def test_different_rom_rejected_before_compilation(self):
        port = self.root/'port'
        (port/'assets').mkdir(parents=True)
        (port/'assets'/'cart-data.bin').write_bytes(b'OTHER ROM')
        self.assertEqual(workflow.main(['--rom', str(self.rom), '--port', str(port)]), 2)
        self.assertFalse((port/'build-auto').exists())

    def evidence(self):
        return {'name':'boot','frames':120,'hash_every':60,'input':None,'route_sha256':None,
                'oracle_progress':None,'oracle_sha256':None}

    def test_final_gate_accepted_only_with_full_hashes_and_no_interpreter(self):
        result = {'rc':0,'frames':120,'cpu_interp':0,'sa1_interp':0,'cpu_aot':120000,
                  'hashes':{60:'abcd',120:'deff'}}
        auto = Mock()
        auto.run_game.side_effect=[result.copy(), result.copy()]
        accepted=workflow.verify_route(auto, self.root/'game', self.root, self.evidence(), 0, 20)
        self.assertEqual(accepted['status'], 'APROVADO_ROTA_AOT')
        bad = dict(result, hashes={60:'abcd'})
        auto.run_game.side_effect=[bad, result.copy()]
        refused=workflow.verify_route(auto, self.root/'game', self.root, self.evidence(), 0, 20)
        self.assertEqual(refused['status'], 'FALHOU')
        self.assertEqual(refused['faltando_estrito'],[120])
        auto.run_game.side_effect=[result.copy(), dict(result, rc=2)]
        refused=workflow.verify_route(auto, self.root/'game', self.root, self.evidence(), 0, 20)
        self.assertEqual(refused['status'], 'FALHOU')
        auto.run_game.side_effect=[dict(result, cpu_interp=1), result.copy()]
        refused=workflow.verify_route(auto, self.root/'game', self.root, self.evidence(), 0, 20)
        self.assertEqual(refused['status'], 'FALHOU')

    def test_external_oracle_hash_mismatch_fails_closed(self):
        oracle = self.root/'ref.csv'
        oracle.write_text('frame,fb_fnv1a64\n60,abcd\n120,dead\n')
        r = self.evidence()
        r['oracle_progress'] = oracle
        auto = Mock()
        auto.load_hashes.return_value={60:'abcd',120:'dead'}
        auto.run_game.side_effect=[dict(rc=0,frames=120,cpu_interp=0,sa1_interp=0,cpu_aot=120000,hashes={60:'abcd',120:'deff'})]*2
        result=workflow.verify_route(auto, self.root/'game', self.root, r, 1, 20)
        self.assertEqual(result['status'],'FALHOU')
        self.assertEqual(result['oracle_divergente'],[120])

    def test_rom_free_package_only_allowed_files(self):
        exe = self.root/'game.exe'
        exe.write_bytes(b'not-a-compiled-program')
        p = self.root/'port'
        (p/'assets').mkdir(parents=True)
        (p/'assets'/'cart-data.bin').write_bytes(b'secret-ROM-bytes')
        result = workflow.make_package(exe, p, self.sha, {'status':'APROVADO_ROTAS_AOT'})
        with zipfile.ZipFile(result) as z:
            self.assertIn('game.exe',z.namelist())
            self.assertIn('INICIAR-PORT.cmd',z.namelist())
            self.assertIn('Instalar-ROM.ps1',z.namelist())
            self.assertNotIn('assets/cart-data.bin',z.namelist())
            self.assertNotIn('assets/native-rom-data.bin',z.namelist())
            self.assertIn(self.sha, z.read('Instalar-ROM.ps1').decode())


if __name__ == '__main__':
    unittest.main()
