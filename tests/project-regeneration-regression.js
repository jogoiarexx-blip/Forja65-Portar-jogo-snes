const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert'),C=require('../forja65-core');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-update-')),rom=path.join(dir,'a.sfc'),out=path.join(dir,'p'),hint=path.join(dir,'h.txt'),cli=path.resolve(__dirname,'../tools/forja65.js');
fs.writeFileSync(rom,C.makeSyntheticRom());const loaded=C.loadRom(fs.readFileSync(rom)),pc=C.resetAddress(loaded);fs.writeFileSync(hint,`rom=${C.romFingerprint(loaded)} target=${pc.toString(16)} kind=STATE e=1 m=1 x=1 c=1\n`);
const run=args=>{let r=cp.spawnSync(process.execPath,[cli,'analyze',rom,'--out',out,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);};
run(['--hints',hint,'--max','128']);assert(fs.readFileSync(path.join(out,'analysis/runtime-hints.txt'),'utf8').includes('c=1'),'persist generation hints');
const header=path.join(out,'src/runtime.hpp'),mtime=fs.statSync(header).mtimeMs;fs.writeFileSync(path.join(out,'tests/equivalence-cases.txt'),'# custom verified vectors\n');
run(['--update']);assert.equal(fs.statSync(header).mtimeMs,mtime,'unchanged sources must retain timestamps');assert(fs.readFileSync(path.join(out,'analysis/runtime-hints.txt'),'utf8').includes('c=1'));assert.equal(fs.readFileSync(path.join(out,'tests/equivalence-cases.txt'),'utf8'),'# custom verified vectors\n');
assert.equal(JSON.parse(fs.readFileSync(path.join(out,'analysis/generation-options.json'),'utf8')).max,128,'remember analysis budget');assert.equal(C.parseRuntimeHints(fs.readFileSync(path.join(out,'analysis/runtime-hints.txt'),'utf8'))[0].observed,1,'do not recount saved observations');
console.log('project-regeneration-regression: OK');
