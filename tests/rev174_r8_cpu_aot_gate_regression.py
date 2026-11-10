"""Regression: CPU AOT promotion gate must reject unchanged, divergent image/PCM/counters."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from rev174_r8_cpu_aot_gate import audit, QA_SAME, DEPENDENCY_SAME, AUDIO_SAME

def fake(interp):
    qa={x:'0' for x in QA_SAME}; qa.update(frames='120',instructions='100',framebuffer_hash='abc',wram_hash='def')
    dep={x:'0' for x in DEPENDENCY_SAME}; dep.update(rom_reads='1000',rom_native_reads='1000',rom_fallback_reads='0',ROM_NATIVE_READY='YES',instructions='100',cpu_interpreter_instructions=str(interp),cpu_aot_instructions=str(100-interp))
    audio={x:'0' for x in AUDIO_SAME}; audio.update(wav_frames='100')
    return dict(qa=qa,dep=dep,audio=audio,wav_hash='xyz',wav_frames=100)

a,b=fake(30),fake(10)
assert audit(a,b)['status']=='PASS',audit(a,b)
assert audit(a,a)['status']=='FAIL','no improvement is not a successful AOT promotion'
bad=fake(10);bad['wav_hash']='mutated'
assert audit(a,bad)['status']=='FAIL'
bad=fake(10);bad['qa']['framebuffer_hash']='corrupted'
assert audit(a,bad)['status']=='FAIL'
bad=fake(10);bad['dep']['instructions']='101'
assert audit(a,bad)['status']=='FAIL'
bad=fake(10);bad['dep']['apu_aot_instructions']='2'
assert audit(a,bad)['status']=='FAIL'
print('REV174 R8 CPU AOT promotion gate: 6/6 PASS')
