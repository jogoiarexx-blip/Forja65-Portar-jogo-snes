'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require(process.env.FORJA65_TEST_CORE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64));
const phaseFlags=files['src/runtime.hpp'].includes('mosaicHOffset')?['-DFORJA65_TEST_MOSAIC_PHASE_STATE=1']:[]; 
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-mosaic-rev162-'));
try{
 for(const [n,v]of Object.entries(files))if(n.startsWith('src/')){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,v);}
 fs.copyFileSync(path.join(__dirname,'fixtures/ppu_mode7_mosaic_rev162.cpp'),path.join(dir,'probe.cpp'));
 let failed=false;
 for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')){
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,...phaseFlags,'-Wall','-Wextra','-Werror','-DFORJA65_ENABLE_TRACE=0','-I'+path.join(dir,'src'),path.join(dir,'probe.cpp'),'-o',path.join(dir,'probe')],{stdio:'inherit'});
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('FORJA65_')));
  const args=process.env.FORJA65_TEST_EXTBG_ONLY?['--extbg-only']:(process.env.FORJA65_TEST_HDMA_ONLY?['--hdma-only']:[]);
  const r=cp.spawnSync(path.join(dir,'probe'),args,{cwd:dir,env:{...env,FORJA65_HEADLESS:'1',FORJA65_SPC_PROFILE:'reference',...(process.env.FORJA65_HDMA_V0_TRANSFER?{FORJA65_HDMA_V0_TRANSFER:process.env.FORJA65_HDMA_V0_TRANSFER}:{})},encoding:'utf8',timeout:180000});
  process.stdout.write(opt+' '+(r.stdout||''));process.stderr.write(r.stderr||'');
  if(r.status!==0){failed=true;if(!process.env.FORJA65_SCORE_ONLY)throw new Error('Mode 7 mosaic failed '+opt+' '+(r.error||r.signal||r.status));}
 }
 if(failed)process.exitCode=1;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
