'use strict';
const F=require('../../forja65-core'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
module.exports=function runProbe(label,source){
 const rom=F.loadRom(F.makeSyntheticRom()),files=F.generateProject(rom,F.analyze(rom,128));
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-'+label+'-'));
 try{
  fs.writeFileSync(path.join(dir,'runtime.hpp'),files['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  fs.writeFileSync(path.join(dir,'probe.cpp'),'#include "runtime.hpp"\n#include <cassert>\n#include <iostream>\n'+source);
  cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O2','-Wall','-Wextra','-Wpedantic','-Werror','probe.cpp','-o','probe'],{cwd:dir,stdio:'inherit'});
  cp.execFileSync(path.join(dir,'probe'),[],{cwd:dir,stdio:'inherit'});
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
 return files;
};
