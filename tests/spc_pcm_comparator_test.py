#!/usr/bin/env python3
"""Self-contained regression: evidence equality is insufficient without PCM equality."""
import sys
import tempfile
from pathlib import Path
import wave

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from compare_spc_aot import load, compare


def put(dir,name,values):
    (dir/name).write_text(''.join(f'{k}={v}\n' for k,v in values.items()),encoding='utf-8')


def generate(dir,mode,mutate=False):
    dir.mkdir()
    qa=dict(runtime_started='PASS',rom='a',frames='120',instructions='100',
        framebuffer_hash='b',wram_hash='c',dsp_native_samples='40')
    native=dict(rom='a',frames='120',instructions='100',cpu_interpreter_instructions='10',
        cpu_aot_instructions='90',DSP_NATIVE_BACKEND='YES',
        APU_NATIVE_BACKEND='YES' if mode=='aot' else 'NO',
        dsp_native_samples='40',
        apu_aot_instructions='50' if mode=='aot' else '0',
        apu_interpreter_spc_cycles='10' if mode=='aot' else '100',
        apu_aot_spc_cycles='90' if mode=='aot' else '0')
    audio=dict(wav_requested='1',wav_opened='1',wav_frames='40',sample_rate='32000',
               channels='2',generated_frames='40',dsp_samples='40',backend_error='')
    put(dir,'forja65-qa-status.txt',qa)
    put(dir,'forja65-native-dependency-report.txt',native)
    put(dir,'forja65-spc-upload.txt',{'spc_backend':'aot_opcode' if mode=='aot' else 'interpreter'})
    put(dir,'forja65-audio-report.txt',audio)
    with wave.open(str(dir/'forja65-native-audio.wav'),'wb') as f:
        f.setnchannels(2);f.setframerate(32000);f.setsampwidth(2)
        data=(b'\x00\x01\x00\x02')*40
        if mutate:data=data[:-4]+b'\x01\x01\x00\x02'
        f.writeframes(data)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        a,b=Path(tmp)/'ref',Path(tmp)/'aot'
        generate(a,'ref');generate(b,'aot')
        assert not compare(load(a),load(b),require_audio=True),'identical PCM should pass'
        with wave.open(str(b/'forja65-native-audio.wav'),'rb') as r:
            frames=r.readframes(r.getnframes())
        with wave.open(str(b/'forja65-native-audio.wav'),'wb') as w:
            w.setnchannels(2);w.setsampwidth(2);w.setframerate(32000)
            w.writeframes(frames[:-4]+b'\x03\x04\x05\x06')
        result=compare(load(a),load(b),require_audio=True)
        assert any('PCM SHA256' in x for x in result),result
        (b/'forja65-native-audio.wav').unlink()
        try:compare(load(a),load(b),require_audio=True)
        except ValueError as e:assert 'Missing WAV' in str(e)
        else:raise AssertionError('missing audio must not pass')
        assert not compare(load(a),load(b),require_audio=False), 'legacy counters should still match'
    print('SPC_PCM_A_B_COMPARATOR_REGRESSION_PASS (equal/mismatch/missing audio)')

if __name__=='__main__':main()
