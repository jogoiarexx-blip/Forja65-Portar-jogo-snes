'use strict';
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'pcm-crossfeed-test.sfc');
const files=F.generateProject(rom,F.analyze(rom,512));
const runtime=files['src/runtime.hpp'];
for(const phrase of ['class PcmAudioOutput','waveOutOpen','void writeAudioReport(',
                     'configureAudioOutput(liveAudio,captureWav)',
                     'if(captureNativePcm){nativePcm.push_back(q[0]);',
                     'pcmOutput->push(q[0],q[1])',
                     'strictSpcScheduler','struct PpuState','struct DmaChannel']){
  assert.ok(runtime.includes(phrase),`missing preserved feature: ${phrase}`);
}
assert.ok(runtime.includes('#ifndef NOMINMAX'));
assert.ok(!runtime.includes('nativePcm.push_back(q[0]);nativePcm.push_back(q[1]);dspNativeSamples++'));
assert.ok(files['src/pcm_audio_output.hpp'].includes('writeWavHeader'));
assert.ok(files['CMakeLists.txt'].includes('add_executable(pcm_audio_output_smoke'));
assert.ok(files['RUN-WINDOWS-AUDIO.cmd'].includes('FORJA65_AUDIO_MODE=native'));
assert.ok(files['RUN-NATIVE-AUDIO.cmd'].includes('FORJA65_AUDIO_DUMP=1'));
assert.ok(files['tests/pcm_audio_output_smoke.cpp'].includes('assert(u32(hdr+40)'));
assert.ok(files['tests/audio_dsp_transport_smoke.cpp'].includes('wet.nativePcm.empty()'));
const pureSpc=F.generateSpcProject({entry:0,data:new Uint8Array(256),manifest:{}},{entry:0,instructions:[],native:0,decoded:0,unsupported:0,ratio:0,calls:[],edges:[],issues:[],status:'OK'});
assert.ok(pureSpc['runtime.hpp'].includes('class PcmAudioOutput'));
assert.ok(pureSpc['pcm_audio_output.hpp'].includes('class PcmAudioOutput'));
console.log('FORJA65_AUDIO_CROSSFEED_V019_PASS generated_files='+Object.keys(files).length);
