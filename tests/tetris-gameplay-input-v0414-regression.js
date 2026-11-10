// Generated runtime must refuse invalid replay and apply the same valid controls.
'use strict';
const F = require('../forja65-core.js');
const fs = require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'tetris-input-v0414.sfc');
const files=F.generateProject(rom,F.analyze(rom,512));
const hdr=files['src/runtime.hpp'];
for(const k of ['frame numbers must be strictly increasing','frame, joy1 and joy2 are required',
                'FORJA65_INPUT_REPLAY: cannot open', 'replayActive=true;return true'])
  if(!hdr.includes(k))throw Error('Generated runtime missing: '+k);
if(!files['RUN-INPUT-REPLAY.cmd'].includes('%%~fI'))throw Error('Win32 replay path is not absolute');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-v0414-gameplay-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),hdr);
 fs.copyFileSync(path.join(__dirname,'fixtures','tetris_gameplay_input_v0414.cpp'),path.join(dir,'smoke.cpp'));
 const exe=path.join(dir,process.platform==='win32'?'smoke.exe':'smoke');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-w','smoke.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_TETRIS_GAMEPLAY_INPUT_V0414_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
