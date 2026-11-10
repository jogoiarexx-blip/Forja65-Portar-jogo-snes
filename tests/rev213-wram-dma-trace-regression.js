'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_CORE_OVERRIDE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom(),'rev213-wram.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev213-wram-'));
try{
  for(const [name,data] of Object.entries(files))if(name.startsWith('src/')&&name.endsWith('.hpp'))fs.writeFileSync(path.join(dir,path.basename(name)),data);
  const cpp=path.join(__dirname,'fixtures','rev213_wram_dma_trace.cpp');
  const exe=path.join(dir,process.platform==='win32'?'probe.exe':'probe');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror',cpp,'-I'+dir,'-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:dir,timeout:120000,stdio:'inherit'});
  for(const mode of ['virtual','native']){
    const csv=path.join(dir,'read-'+mode+'.csv');
    const env={...process.env,FORJA65_WRAM_READ_CSV:csv,FORJA65_WRAM_READ_ADDRS:'7E0500'};
    const result=cp.spawnSync(exe,[mode],{cwd:dir,encoding:'utf8',timeout:60000,env});
    if(result.status!==0)throw new Error(mode+' '+result.stderr);
    const lines=fs.readFileSync(csv,'utf8').trim().split(/\r?\n/);
    if(lines.length!==2||!lines[1].includes(',2180,'))throw new Error('Bad WRAM read journal: '+lines.join('|'));
    console.log(result.stdout.trim());
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
