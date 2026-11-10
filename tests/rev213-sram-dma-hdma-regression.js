'use strict';
// Standalone generator + native-runtime integration test; no commercial ROM.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const F=require(process.env.FORJA65_CORE_OVERRIDE||'../forja65-core');
const src=F.generateProject(F.loadRom(F.makeSyntheticRom(),'rev213-hw.sfc'),F.analyze(F.loadRom(F.makeSyntheticRom(),'rev213-hw.sfc'),128));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev213-sram-'));
try {
  for(const [name,data] of Object.entries(src))if(name.startsWith('src/')&&name.endsWith('.hpp'))fs.writeFileSync(path.join(dir,path.basename(name)),data);
  const cpp=path.join(__dirname,'fixtures','rev213_sram_dma_hdma.cpp');
  const exe=path.join(dir,process.platform==='win32'?'probe.exe':'probe');
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-Wall','-Wextra','-Wpedantic','-Werror',cpp,'-I'+dir,'-o',exe,...(process.platform==='win32'?['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm']:[])],{cwd:dir,timeout:120000,stdio:'inherit'});
  const output=cp.execFileSync(exe,[],{cwd:dir,timeout:60000,encoding:'utf8',env:{...process.env,FORJA65_HDMA_V0_TRANSFER:'0'}});
  if(!output.includes('REV213_SRAM_DMA_HDMA_PASS'))throw new Error(output);
  console.log(output.trim());
} finally {fs.rmSync(dir,{recursive:true,force:true});}
