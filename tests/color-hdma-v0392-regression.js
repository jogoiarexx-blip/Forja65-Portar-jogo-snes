const fs=require('fs'),cp=require('child_process'),path=require('path'),os=require('os'),C=require('../forja65-core');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-color-hdma-')),r=C.loadRom(C.makeSyntheticRom());
fs.writeFileSync(path.join(d,'runtime.hpp'),C.generateProject(r,C.analyze(r,128))['src/runtime.hpp']);
fs.copyFileSync(path.join(__dirname,'hardware_color_hdma_v0392.cpp'),path.join(d,'probe.cpp'));
cp.execFileSync('g++',['-std=c++20','-O2','probe.cpp','-o','probe'],{cwd:d});
for(const args of [['blend'],['windows'],[]])cp.execFileSync(path.join(d,'probe'),args,{cwd:d,stdio:'inherit'});
