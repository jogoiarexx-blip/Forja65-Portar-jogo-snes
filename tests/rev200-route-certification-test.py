#!/usr/bin/env python3
"""REV200: fail-closed tests for observed returns and logical/video AOT gate."""
import importlib.util
import tempfile
from types import SimpleNamespace
from pathlib import Path

module_path=Path(__file__).resolve().parents[1]/'tools'/'rev200-certify-route.py'
spec=importlib.util.spec_from_file_location('rev200_certify',module_path)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def fixture(base):
    p=base/'project';(p/'src').mkdir(parents=True);(p/'assets').mkdir()
    # LoROM synthetic fixture; the generated alias is canonical for the
    # purpose of the proof and carries the physical offset directly.
    rom=bytearray(256)
    rom[0]=0x20;rom[1]=0x20;rom[2]=0x80     # 008000 JSR $8020 -> returns 008003
    rom[0x10]=0x22;rom[0x11:0x14]=bytes([0x20,0x80,0x00])  # 008010 JSL $008020
    (p/'assets'/'cart-data.bin').write_bytes(rom)
    dispatch='''struct Forja65AliasEntry{unsigned off,pc;};
static const Forja65AliasEntry kForja65Aliases[]={
{0x000000u,0x008000u},
{0x000003u,0x008003u},
{0x000010u,0x008010u},
{0x000014u,0x008014u},
};
static const std::uint32_t kForja65StackReturnOffsets[]={0xFFFFFFFFu};
static const Forja65DispatchEntry kForja65Dispatch[]={
{0x008000u,true,true,true,false,false,nullptr,0x008000u},
{0x008003u,true,true,true,false,false,nullptr,0x008000u},
{0x008010u,true,true,true,false,false,nullptr,0x008000u},
{0x008014u,true,true,true,false,false,nullptr,0x008000u},
};
'''
    (p/'src'/'dispatch.cpp').write_text(dispatch)
    (p/'src'/'generated_000.cpp').write_text('// $008000 JSR $8020\n// $008010 JSL $008020\n')
    return p


def evidence_fixture(folder,interpreter=0,mutated=False):
    folder.mkdir()
    state=b'';digest=b''
    for i in range(1,4):
        frame=i+2
        wr=bytes([i])*56
        if mutated and i==2:wr=bytes([8])*56
        state+=frame.to_bytes(4,'little')+i.to_bytes(4,'little')+wr
        digest+=frame.to_bytes(4,'little')+i.to_bytes(4,'little')+bytes([i])*16
    (folder/'logic-state.bin').write_bytes(state)
    (folder/'logic-digests.bin').write_bytes(digest)
    (folder/'forja65-logic-replay-done.txt').write_text('frame=6\nlogic_inputs=3\n')
    (folder/'frame-hashes.txt').write_text(''.join(f'frame={i} framebuffer=aa wram=bb pc=008000\n' for i in range(5)))
    (folder/'forja65-native-dependency-report.txt').write_text(f'instructions=1500\ncpu_interpreter_instructions={interpreter}\nrom=aabb\nframes=5\n')
    (folder/'forja65-qa-status.txt').write_text('runtime_started=PASS\nframes=5\n')


def main():
    with tempfile.TemporaryDirectory() as td:
        root=Path(td);project=fixture(root)
        result=m.prove_returns(project,[0x008003,0x008014,0x008015],apply=False)
        assert result['direct_verified']==2,result
        assert result['unproven_count']==1,result
        assert not result['applied']
        assert '0xFFFFFFFFu' in (project/'src'/'dispatch.cpp').read_text()
        result=m.prove_returns(project,[0x008003,0x008014],apply=True)
        assert result['direct_verified']==2 and result['applied']
        assert result['verified_offsets']==['000003','000014']
        again=m.prove_returns(project,[0x008003,0x008014],apply=True)
        assert again['direct_verified']==0 and again['already_authorized']==2
        # Never infer unobserved/unsupported return from arbitrary ROM bytes.
        assert m.prove_returns(project,[0x008015])['unproven_count']==1
        logic=root/'inputs.logic'
        logic.write_text('# FORJA65_LOGIC_TRACE 1 addr=0013\n8000*2\n0000\n')
        assert m.read_logic(logic)==3
        logic.write_text('# FORJA65_LOGIC_TRACE 1\n8000*0\n')
        try:m.read_logic(logic)
        except ValueError:pass
        else:raise AssertionError('zero count should be rejected')
        obs=root/'observed.txt';obs.write_text('008003\n008003\n008014\n')
        assert m.observe(obs)==[0x008003,0x008014]
        obs.write_text('UNTRUSTED 008003\n')
        try:m.observe(obs)
        except ValueError:pass
        else:raise AssertionError('bad observed return format should be rejected')
        a,b=root/'a',root/'b';evidence_fixture(a);evidence_fixture(b)
        ra,rb=m.evidence(a,3,10),m.evidence(b,3,10)
        assert ra['digest_sequence_complete'] and ra['logic_sequence_complete']
        assert m.compare(ra,rb)['aligned_visual_wram_digests_equal']
        (b/'logic-digests.bin').write_bytes((b/'logic-digests.bin').read_bytes()[:-1]+b'!')
        assert not m.compare(ra,m.evidence(b,3,10))['aligned_visual_wram_digests_equal']
        (b/'logic-digests.bin').unlink()
        assert not m.evidence(b,3,10)['digest_sequence_complete']
        evidence_fixture_not_needed=True
        (a/'forja65-native-dependency-report.txt').unlink()
        assert m.evidence(a,3,10)['interpreted_instructions'] is None
        # Upgrade an existing REV199 runtime without touching its CFG.
        old_runtime=project/'src'/'runtime.hpp'
        old_runtime.write_text('FORJA65_LOGIC_STATE_OUT\n  void logicReplayAtVblank(){logicPos++;logicStateRecord();}\n')
        preview=m.upgrade_runtime(project,False)
        assert preview['status']=='upgrade_required'
        assert 'LOGIC_DIGEST' not in old_runtime.read_text()
        updated=m.upgrade_runtime(project,True)
        assert updated['status']=='upgraded'
        assert m.upgrade_runtime(project,True)['status']=='already_current'
        assert old_runtime.read_text().count('logicDigestRecord();')==1
        # Orchestration harness uses stubbed launch/build; NOT a claim that
        # the synthetic ROM has been replayed. Exercises report gating only.
        logic.write_text('# FORJA65_LOGIC_TRACE 1\n8000*2\n0000\n')
        orig_build,orig_run=m.build,m.run_game
        stub_bin=root/'game-stub';stub_bin.write_bytes(b'not-an-executable')
        def fake_build(*_args): return stub_bin
        def fake_run(_game,folder,_project,_logic,_frames,strict,_timeout,_env):
            evidence_fixture(folder,interpreter=0)
            if not strict:(folder/'returns.txt').write_text('')
            return {'exit_code':0,'executable_sha256':m.sha(stub_bin)}
        m.build,m.run_game=fake_build,fake_run
        args=SimpleNamespace(project=project,logic=logic,out=root/'campaign-pass',
             frames=10,timeout=1,jobs=1,game=None,build_dir=None,
             apply_verified=False,require_frame_equality=True)
        try:
            passed=m.campaign(args)
            assert passed['status']=='CPU_AOT_CERTIFIED',passed.get('failure')
            assert (args.out/'certification.json').is_file()
            def bad_aot(_game,folder,_project,_logic,_frames,strict,_timeout,_env):
                evidence_fixture(folder,interpreter=1 if strict else 0)
                if not strict:(folder/'returns.txt').write_text('')
                return {'exit_code':0,'executable_sha256':m.sha(stub_bin)}
            m.run_game=bad_aot
            args.out=root/'campaign-fail'
            failed=m.campaign(args)
            assert failed['status']=='NOT_CERTIFIED'
            assert 'instruction' in failed['failure']['reason']
        finally:m.build,m.run_game=orig_build,orig_run
        print('REV200_CERTIFICATION_GATES_PASS: 18 checks incl. provenance, no unproven promotion, logical/digest parity, missing metrics')


if __name__=='__main__':main()
