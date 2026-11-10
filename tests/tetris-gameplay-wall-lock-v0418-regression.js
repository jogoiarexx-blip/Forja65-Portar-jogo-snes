// Verify generator emits reusable, functional wall and piece-handoff OAM verifiers.
'use strict';
const F=require('../forja65-core.js');
const cp=require('node:child_process'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const rom=F.loadRom(F.makeSyntheticRom(),'qa-wall-lock.sfc');
const files=F.generateProject(rom,F.analyze(rom,512));
for(const p of ['tools/gameplay_wall_qa.py','tools/gameplay_lock_qa.py'])
  if(!files[p] || !files[p].includes('def validate(')) throw Error('Generated project missing OAM QA: '+p);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-wall-lock-'));
try{
  fs.mkdirSync(path.join(dir,'tools'));fs.mkdirSync(path.join(dir,'tests'));
  for(const p of ['tools/gameplay_wall_qa.py','tools/gameplay_lock_qa.py'])
    fs.writeFileSync(path.join(dir,p),files[p]);
  fs.copyFileSync(path.join(__dirname,'test_gameplay_wall_lock_qa.py'),path.join(dir,'tests','test_gameplay_wall_lock_qa.py'));
  cp.execFileSync(process.env.PYTHON||'python3',[path.join(dir,'tests','test_gameplay_wall_lock_qa.py')],{stdio:'inherit'});
  console.log('FORJA65_WALL_LOCK_GENERATION_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
