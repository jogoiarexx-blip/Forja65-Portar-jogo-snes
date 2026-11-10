'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict'),F=require('../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom(),'windows-capture-cleanup.sfc'),p=F.generateProject(rom,F.analyze(rom,128));
const names=['obj_capture_probe_smoke','dma_forensics_smoke','pixel_ownership_smoke'];
for(const n of names)assert(p['tests/'+n+'.cpp'],'every generated project must carry '+n);
assert(p['tests/capture_test_io.hpp'],'capture readers need scoped file ownership');
assert(p['BUILD-WINDOWS.cmd'].includes('ctest --test-dir build-win -C Release --output-on-failure || goto :testerr'));
assert(p['BUILD-WINDOWS.cmd'].includes('COMPILACAO CONCLUIDA, MAS OS TESTES NATIVOS FALHARAM.'));
assert(p['BUILD-WINDOWS.cmd'].includes('LastTest.log'));
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-windows-cleanup-'));
try{
 for(const[n,v]of Object.entries(p))if(n.startsWith('src/')||n.startsWith('tests/')){fs.mkdirSync(path.dirname(path.join(d,n)),{recursive:true});fs.writeFileSync(path.join(d,n),v);}
 let env={...process.env,FORJA65_HEADLESS:'1',FORJA65_PPU_TRACE:'0'};
 if(process.platform==='linux'){
  const guard=path.join(d,'windows-delete-guard.so');cp.execFileSync('cc',['-shared','-fPIC',path.join(__dirname,'fixtures/windows-delete-guard.c'),'-ldl','-o',guard]);env.LD_PRELOAD=guard;
 }
 for(const name of names){
  const bin=path.join(d,name+(process.platform==='win32'?'.exe':''));
  cp.execFileSync(process.env.CXX||'c++',['-std=c++20','-O1','-g0','-DFORJA65_ENABLE_TRACE=0','-I',path.join(d,'src'),path.join(d,'tests',name+'.cpp'),'-o',bin],{stdio:'inherit'});
  // Repeated executions exercise cleanup of the prior run as well as first use.
  for(let run=0;run<2;run++){
   const q=cp.spawnSync(bin,[],{cwd:d,env,encoding:'utf8'});assert.equal(q.status,0,name+': '+q.stdout+q.stderr);assert(!q.stderr.includes('WINDOWS_DELETE_GUARD'),name+' retained a handle during cleanup');process.stdout.write(q.stdout);
  }
 }
 assert(p['CMakeLists.txt'].includes('foreach(_probe IN ITEMS dma_forensics_smoke pixel_ownership_smoke)'));
 assert(p['CMakeLists.txt'].includes('add_test(NAME ${_probe} COMMAND ${_probe})'));
 console.log('WINDOWS_CAPTURE_CLEANUP_V0395_PASS generated=3 runs=6 strict-delete='+String(process.platform==='linux'));
}finally{fs.rmSync(d,{recursive:true,force:true});}
