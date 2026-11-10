// v0.4.15 generator must ship working, reusable A/B visual verifier.
'use strict';
const F=require('../forja65-core.js');
const cp=require('node:child_process'), fs=require('node:fs'), os=require('node:os'), path=require('node:path');
const rom=F.loadRom(F.makeSyntheticRom(),'qa-visual.sfc');
const files=F.generateProject(rom,F.analyze(rom,512));
const qa=files['tools/gameplay_transition_qa.py'];
if(!qa || !qa.includes('frozen_variant') || !qa.includes('changed_variant')) throw Error('Generated port omitted visual QA');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-gameplay-qa-'));
try{
 fs.mkdirSync(path.join(d,'tools'));
 fs.mkdirSync(path.join(d,'tests'));
 fs.writeFileSync(path.join(d,'tools','gameplay_transition_qa.py'),qa);
 fs.copyFileSync(path.join(__dirname,'gameplay_transition_qa_unit.py'),path.join(d,'tests','gameplay_transition_qa_unit.py'));
 cp.execFileSync(process.env.PYTHON||'python3',[path.join(d,'tests','gameplay_transition_qa_unit.py')],{stdio:'inherit'});
 console.log('FORJA65_GAMEPLAY_TRANSITION_GENERATION_PASS');
}finally{fs.rmSync(d,{recursive:true,force:true});}
