"""REV212 hermetic regression tests; no proprietary ROMs or third-party code."""
from __future__ import annotations
import importlib.util
import json
import struct
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch

ROOT=Path(__file__).resolve().parents[1]

def load(name, p):
    s=importlib.util.spec_from_file_location(name,p)
    m=importlib.util.module_from_spec(s)
    assert s and s.loader
    s.loader.exec_module(m)
    return m

probe=load('rev212_probe',ROOT/'tools'/'rev212_rom_probe.py')
kit=load('rev212_kit',ROOT/'tools'/'rev212_port_kit.py')
workflow=load('rev211_workflow',ROOT/'tools'/'rev211_native_workflow.py')
auto=load('rev210_autoport',ROOT/'tools'/'rev210'/'auto-port.py')
coverage=load('rev212_coverage',ROOT/'tools'/'rev212_coverage_report.py')


def fake_rom(title='SUPER MARIO WORLD', mode=0x20, copier=False):
    data=bytearray(65536)
    at=0x7fc0 if mode in (0x20,0x23) else 0xffc0
    data[at:at+21]=title.encode('ascii').ljust(21,b' ')
    data[at+0x15]=mode
    data[at+0x16]=0x02
    data[at+0x17]=0x09
    data[at+0x18]=0x02
    data[at+0x1c:at+0x1e]=(0xEDCB).to_bytes(2,'little')
    data[at+0x1e:at+0x20]=(0x1234).to_bytes(2,'little')
    data[at+0x3c:at+0x3e]=(0x8000).to_bytes(2,'little')
    return b'\0'*512+bytes(data) if copier else bytes(data)


def save_frames(folder, frames, content):
    folder.mkdir(parents=True,exist_ok=True)
    lines=['frame,path']
    for f in frames:
        name=f'{f:010d}.wram'
        (folder/name).write_bytes(content if isinstance(content,bytes) else content[f])
        lines.append(f'{f},{name}')
    (folder/'frames.csv').write_text('\n'.join(lines)+'\n')
    return folder/'frames.csv'


class MultiGameTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base=Path(self.tmp.name)
        self.rom=self.base/'user.sfc'
        self.rom.write_bytes(fake_rom())
        self.sha=workflow.sha256_file(self.rom)

    def test_probe_header_and_hash_and_no_rom_export(self):
        info=probe.probe(self.rom)
        self.assertEqual(info['sha256'],self.sha)
        self.assertEqual(info['cartridge']['layout'],'LoROM')
        self.assertEqual(info['cartridge']['title'],'SUPER MARIO WORLD')
        self.assertTrue(info['cartridge']['checksum_complement_valid'])
        self.assertNotIn('rom_bytes',json.dumps(info))

    def test_copier_header_and_unknown_header_diagnostic(self):
        self.rom.write_bytes(fake_rom(copier=True))
        r=probe.probe(self.rom)
        self.assertTrue(r['copier_header_512'])
        self.assertIn('512 bytes',str(r['warnings']))
        self.rom.write_bytes(b'\xff'*32768)
        r=probe.probe(self.rom)
        self.assertIsNone(r['cartridge'])
        self.assertTrue(r['warnings'])

    def test_hirom_sa1_detection(self):
        self.rom.write_bytes(fake_rom(title='GENERIC HIROM',mode=0x21))
        self.assertEqual(probe.probe(self.rom)['cartridge']['layout'],'HiROM')
        self.rom.write_bytes(fake_rom(title='SA1 TEST',mode=0x23))
        self.assertIn('SA-1',probe.probe(self.rom)['possible_chip'])

    def test_profile_generic_and_game_specific_plan(self):
        out=self.base/'plan'
        res=kit.prepare(self.rom,out,game='auto')
        self.assertEqual(res['game_template'],'smw')
        self.assertEqual(res['status'],'PLANEJADO_SEM_CERTIFICACAO')
        self.assertEqual(len(res['coverage']),8)
        self.assertTrue(all(x['status']=='PENDENTE_REPLAY_REAL' for x in res['coverage']))
        self.assertEqual(json.loads((out/'rotas.json').read_text())['rom_sha256'],self.sha)
        self.assertFalse((out/'assets').exists())
        with self.assertRaisesRegex(ValueError,'sobrescreve'):
            kit.prepare(self.rom,out,game='auto')

    def test_profile_dkc2_dkc3_zelda_and_unknown(self):
        for key in ('dkc2','dkc3','zelda3','generic'):
            p=self.base/key
            r=kit.prepare(self.rom,p,game=key)
            self.assertEqual(r['game_template'],key)
            self.assertEqual(r['rom_sha256'],self.sha)
            self.assertTrue((p/'replays'/'COMO-CAPTURAR.txt').exists())

    def test_wram_contract_rejects_invalid_scope(self):
        path=self.base/'contract.json'
        def check(route):
            path.write_text(json.dumps({'schema': workflow.SCHEMA,'rom_sha256':self.sha,
                                        'routes':[route]}))
            return workflow.contract_routes(path,self.sha,600,60)
        with self.assertRaisesRegex(ValueError,'1 a 128'):
            check({'name':'boot','frames':600,'wram_every':1})
        with self.assertRaisesRegex(ValueError,'exige wram_every'):
            check({'name':'boot','frames':600,'wram_reference_manifest':'ref.csv'})
        routes=check({'name':'boot','frames':600,'wram_every':60})
        self.assertEqual(routes[0]['wram_every'],60)

    def test_wram_snapshots_identical_then_first_divergence(self):
        a=self.base/'strict'; b=self.base/'research'
        frames=list(range(0,120,60))
        blank=b'\0'*0x20000
        save_frames(a/'wram-raw',frames,blank)
        save_frames(b/'wram-raw',frames,blank)
        strict={'dir':str(a)}; research={'dir':str(b)}
        route={'frames':120,'wram_every':60,'wram_reference_manifest':None}
        self.assertEqual(workflow.verify_wram_snapshots(strict,research,route)['status'],'APROVADO_WRAM_AMOSTRADA')
        broken=bytearray(blank);broken[0x1abc]=0xFF
        save_frames(b/'wram-raw',frames,{0:blank,60:bytes(broken)})
        r=workflow.verify_wram_snapshots(strict,research,route)
        self.assertEqual(r['status'],'FALHOU')
        self.assertEqual(r['comparacoes']['research']['first_divergence']['frame'],60)

    def test_wram_external_reference_missing_frame_fail_closed(self):
        a=self.base/'strict';b=self.base/'research';external=self.base/'external'
        blank=b'\0'*0x20000
        save_frames(a/'wram-raw',[0,60],blank)
        save_frames(b/'wram-raw',[0,60],blank)
        source=save_frames(external,[0],blank)
        route={'frames':120,'wram_every':60,'wram_reference_manifest':source}
        res=workflow.verify_wram_snapshots({'dir':str(a)},{'dir':str(b)},route)
        self.assertEqual(res['status'],'FALHOU')
        self.assertIn('quadros',res['erro'])

    def test_wram_proof_integrated_into_strict_gate(self):
        blank=b'\0'*0x20000
        dirs=[]
        for n in ('strict','research'):
            d=self.base/n
            save_frames(d/'wram-raw',[0,60],blank)
            dirs.append(d)
        r={'name':'boot','frames':120,'hash_every':60,'input':None,
           'route_sha256':None,'oracle_progress':None,'oracle_sha256':None,
           'wram_every':60,'wram_reference_manifest':None}
        good={'rc':0,'frames':120,'cpu_interp':0,'sa1_interp':0,
              'cpu_aot':200,'hashes':{60:'aa',120:'bb'}}
        auto=Mock()
        auto.run_game.side_effect=[dict(good,dir=str(d)) for d in dirs]
        result=workflow.verify_route(auto,self.base/'fake-exe',self.base,r,0,20)
        self.assertEqual(result['status'],'APROVADO_ROTA_AOT')
        self.assertEqual(auto.run_game.call_args.kwargs['wram_capture'],60)

    def test_release_refuses_unapproved_report(self):
        exe=self.base/'game.exe';exe.write_bytes(b'synthetic exe')
        with self.assertRaisesRegex(ValueError,'nao aprovado'):
            workflow.make_package(exe,self.base,self.sha,{'status':'FALHOU_GATE'})

    def test_real_world_smw_title_without_space_and_dkc_titles(self):
        self.assertEqual(kit.infer_game('SUPER MARIOWORLD'),'smw')
        self.assertEqual(kit.infer_game('DONKEY KONG COUNTRY 2'),'dkc2')
        self.assertEqual(kit.infer_game('DONKEY KONG COUNTRY 3'),'dkc3')
        self.assertEqual(kit.infer_game('THE LEGEND OF ZELDA'),'zelda3')

    def test_replay_loader_selects_logical_poll_and_wall_modes(self):
        route=self.base/'demo.logic'
        route.write_text('# FORJA65_LOGIC_TRACE 1 addr=0013\n0000*10 8000*20\n')
        self.assertEqual(auto.route_input_mode(route),'FORJA65_INPUT_LOGIC')
        route.write_text('# FORJA65_INPUT_POLL 1 rom=0123456789abcdef\n')
        self.assertEqual(auto.route_input_mode(route),'FORJA65_INPUT_POLL')
        route.write_text('# FORJA65_INPUT_TRACE 1 rom=0123456789abcdef\nframe=1 joy1=0100 joy2=0000\n')
        self.assertEqual(auto.route_input_mode(route),'FORJA65_INPUT_REPLAY')

    def test_read_logic_digests_strict_validation(self):
        file=self.base/'digest.bin'
        file.write_bytes(struct.pack('<IIQQ',10,1,0xabcd,0x1234)+struct.pack('<IIQQ',12,2,0xff,0x55))
        self.assertEqual(len(auto.read_logic_digests(file)),2)
        file.write_bytes(file.read_bytes()+b'X')
        with self.assertRaisesRegex(ValueError,'truncado'):
            auto.read_logic_digests(file)

    def test_logical_gate_requires_complete_matching_input_digests(self):
        trace=self.base/'campaign.logic'
        trace.write_text('# FORJA65_LOGIC_TRACE 1 addr=0013\n0000*2\n')
        r={'name':'ending','frames':120,'hash_every':60,'input':trace,
           'route_sha256':auto.sha256_file(trace),'oracle_progress':None,'oracle_sha256':None}
        base={'rc':0,'frames':120,'cpu_interp':0,'sa1_interp':0,'cpu_aot':100,
              'hashes':{60:'a',120:'b'},'logic_done':{'wall_frame':115,'logic_inputs':2},
              'logic_digests':{1:(10,20),2:(12,22)}}
        mock=Mock();mock.route_input_mode=auto.route_input_mode
        mock.run_game.side_effect=[dict(base,dir=str(self.base)),dict(base,dir=str(self.base),hashes={60:'z',120:'b'})]
        ok=workflow.verify_route(mock,self.base/'game',self.base,r,0,20)
        self.assertEqual(ok['status'],'APROVADO_ROTA_AOT')
        self.assertEqual(ok['logical_proof']['status'],'APROVADO')
        self.assertEqual(ok['hash_divergente'],[60]) # informational for logical tapes
        bad=dict(base,logic_digests={1:(10,20),2:(99,22)})
        mock.run_game.side_effect=[base,bad]
        failed=workflow.verify_route(mock,self.base/'game',self.base,r,0,20)
        self.assertEqual(failed['status'],'FALHOU')
        self.assertEqual(failed['logical_proof']['first_divergent_index'],2)
        mock.run_game.side_effect=[base,dict(base,logic_done=None)]
        failed=workflow.verify_route(mock,self.base/'game',self.base,r,0,20)
        self.assertEqual(failed['status'],'FALHOU')

    def test_release_coverage_requires_matching_rom_and_gate(self):
        profile=kit.prepare(self.rom,self.base/'plan')
        fake_gate={'schema':'forja65.native-port.gate.v2','rom_sha256':self.sha,
                   'status':'APROVADO_ROTAS_AOT',
                   'routes':[{'name':'boot','status':'APROVADO_ROTA_AOT'}]}
        result=coverage.summarize(profile,fake_gate)
        self.assertEqual(result['checkpoints_with_aot_route_proof'],1)
        self.assertEqual(result['checkpoints_planned'],8)
        self.assertIn('Nao certifica',result['qualifier'])
        fake_gate['rom_sha256']='a'*64
        with self.assertRaisesRegex(ValueError,'diferem'):
            coverage.summarize(profile,fake_gate)

    def test_run_game_routes_logical_replay_to_runtime_env(self):
        trace=self.base/'smw.logic'
        trace.write_text('# FORJA65_LOGIC_TRACE 1 addr=0013\n0000*3\n')
        port=self.base/'native'
        (port/'assets').mkdir(parents=True)
        (port/'assets'/'cart-data.bin').write_bytes(b'private-synthetic')
        environments=[]
        def fake_sh(cmd, **kwargs):
            environments.append(kwargs['env'])
            return 2
        with patch.object(auto,'sh',side_effect=fake_sh):
            result=auto.run_game(self.base/'dummy-game',port,'rev212-probe',120,trace,
                                 True,False,60,run_timeout=2,wram_capture=60)
        env=environments[0]
        self.assertIn('FORJA65_INPUT_LOGIC',env)
        self.assertNotIn('FORJA65_INPUT_REPLAY',env)
        self.assertEqual(env['FORJA65_LOGIC_DIGEST_OUT'],'logic-digests.bin')
        self.assertEqual(env['FORJA65_WRAM_RAW_STEP'],'60')
        self.assertIsNone(result['logic_done'])
        self.assertEqual(result['rc'],2)

if __name__=='__main__':
    unittest.main()
