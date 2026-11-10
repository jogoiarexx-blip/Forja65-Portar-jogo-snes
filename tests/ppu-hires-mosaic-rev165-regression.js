'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require(process.env.FORJA65_TEST_CORE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,64));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-hires-mosaic-rev165-'));
try{
 for(const [name,data]of Object.entries(files))if(name.startsWith('src/')&&name.endsWith('.hpp')){const p=path.join(dir,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);}
 fs.copyFileSync(path.join(__dirname,'fixtures/ppu_hires_mosaic_rev165.cpp'),path.join(dir,'probe.cpp'));
 let failed=false;
 for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')){
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,'-Wall','-Wextra','-Werror','-DFORJA65_ENABLE_TRACE=0','-I'+path.join(dir,'src'),path.join(dir,'probe.cpp'),'-o',path.join(dir,'probe')],{stdio:'inherit'});
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!k.startsWith('FORJA65_')));
  const q=cp.spawnSync(path.join(dir,'probe'),[],{cwd:dir,env:{...env,FORJA65_HEADLESS:'1',FORJA65_SPC_PROFILE:'reference'},encoding:'utf8',timeout:180000});
  process.stdout.write(opt+' '+(q.stdout||''));process.stderr.write(q.stderr||'');
  if(q.status!==0){failed=true;if(!process.env.FORJA65_SCORE_ONLY)throw Error('Hires mosaic failed '+opt+' '+(q.error||q.signal||q.status));}
 }
 if(failed)process.exitCode=1;
}finally{fs.rmSync(dir,{recursive:true,force:true});}
