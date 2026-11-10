#!/usr/bin/env python3
"""REV135 QA gating regression — no fake green result on truncated runs/silence."""
import importlib.util
from pathlib import Path
import tempfile
import wave

path = Path(__file__).resolve().parents[1]/'tools'/'replay-coverage-matrix.py'
spec = importlib.util.spec_from_file_location('coverage_matrix',path)
M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)

def test():
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp)
        trace=root/'good.trace';trace.write_text('# valid\nframe=950 joy1=1000 joy2=0000\nframe=960 joy1=0000 joy2=0000\n')
        assert len(M.validate_trace(trace))==2
        for t in ('frame=950 joy1=GGGG joy2=0000\n','frame=950 joy1=1000 joy2=0000\nframe=950 joy1=0000 joy2=0000\n'):
            trace.write_text(t)
            try:M.validate_trace(trace)
            except ValueError:pass
            else:raise AssertionError('accepted invalid input')
        result_a={'case':'base','progress':{'100':{'fb':'x','pc':'AA'},'200':{'fb':'y','pc':'AB'}}}
        result_b={'case':'shot','progress':{'100':{'fb':'x','pc':'AA'},'200':{'fb':'z','pc':'CC'}}}
        good=M.compare_cases([result_a,result_b],[{'name':'base'},{'name':'shot','compare_to':'base','fork_frame':150}])[0]
        assert good['identical_before_fork'] and good['first_visual_divergence']==200
        bad=M.compare_cases([result_a,result_b],[{'name':'base'},{'name':'shot','compare_to':'base','fork_frame':250}])[0]
        assert not bad['identical_before_fork']
        folder=root/'audio';folder.mkdir()
        with wave.open(str(folder/'forja65-native-audio.wav'),'wb') as out:
            out.setnchannels(2);out.setsampwidth(2);out.setframerate(32000)
            out.writeframes(b'\x00\x00\x00\x00'*100)
        (folder/'forja65-audio-report.txt').write_text('wav_frames=100\nnonzero_frames=0\npeak=0\n')
        assert not M.inspect_audio(folder,{},True)['pcm_observed']
        (folder/'forja65-audio-report.txt').write_text('wav_frames=100\nnonzero_frames=50\npeak=140\n')
        assert M.inspect_audio(folder,{},True)['pcm_observed']
        assert not M.inspect_audio(folder,{},False)['pcm_observed']
        frame_a=root/'a.ppm';frame_b=root/'b.ppm'
        frame_a.write_bytes(b'P6\n2 1\n255\n'+b'\x00\x00\x00'*2)
        frame_b.write_bytes(b'P6\n2 1\n255\n'+b'\x00\x00\x00'+b'\xff\xff\xff')
        assert M.region_differences(frame_a,frame_b,{'left':[0,0,1,1], 'right':[1,0,2,1]})=={'left':0,'right':1}
        try:M.region_differences(frame_a,frame_b,{'offscreen':[0,0,3,1]})
        except ValueError:pass
        else:raise AssertionError('invalid region accepted')
    print('REV135_COVERAGE_QA_SMOKE_PASS')

if __name__=='__main__':test()
