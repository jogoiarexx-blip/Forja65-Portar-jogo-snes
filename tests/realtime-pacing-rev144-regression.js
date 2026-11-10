#!/usr/bin/env node
'use strict';
// REV144: tempo real no Windows. (1) timeBeginPeriod(1) - sem ele o Sleep/sleep_until tem resolucao de ~15,6 ms e o
// ritmo de 60 Hz virava quadros de 15,6/31,2 ms (jogo lento, audio picotado); (2) com audio ao vivo o DAC comanda o
// ritmo (fila de 4 blocos, ~64 ms); (3) sem audio, ritmo na frequencia real (60,0988 Hz NTSC) com espera hibrida;
// (4) traceWramWrite sem getenv a cada escrita (relido uma vez por quadro).
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const F=require(path.join(__dirname,'..','forja65-core.js'));
const rom=F.loadRom(F.makeSyntheticRom(),'rt.sfc'),files=F.generateProject(rom,F.analyze(rom,256)),rt=files['src/runtime.hpp'],hdr=files['src/pcm_audio_output.hpp'];
assert(rt.includes('void initWindow(){timeBeginPeriod(1);'),'janela sem timeBeginPeriod(1)');
assert(rt.includes('timeEndPeriod(1);}'),'janela sem timeEndPeriod(1)');
assert(rt.includes('if(apu.pcmOutput&&apu.pcmOutput->pacesHost())return;'),'ritmo nao cede ao audio');
assert(rt.includes('21477272.0/357366.0'),'ritmo sem a frequencia real do NTSC');
assert(rt.includes('wramTraceEnvFrame'),'traceWramWrite ainda le o ambiente a cada escrita');
assert(hdr.includes('FORJA65_AUDIO_LATENCY_BLOCKS')&&hdr.includes('queuedBlocks()'),'PCM sem fila curta');
assert.strictEqual(hdr,fs.readFileSync(path.join(__dirname,'..','native','pcm_audio_output.hpp'),'utf8'),'native/pcm_audio_output.hpp desatualizado');
if(process.env.FORJA65_SKIP_NATIVE_TESTS){console.log('realtime-pacing-rev144: estrutura OK (compilacao pulada)');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rt144-'));
try{fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),hdr);const out=path.join(dir,'t');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-Wall','-Wextra','-Werror','-O1','-I'+dir,'-D_WIN32','-I'+path.join(__dirname,'fixtures','winmm_v0435'),path.join(__dirname,'fixtures','pcm_realtime_rev144.cpp'),'-o',out],{stdio:'inherit'});
  cp.execFileSync(out,[],{stdio:'inherit'});console.log('realtime-pacing-rev144: PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
