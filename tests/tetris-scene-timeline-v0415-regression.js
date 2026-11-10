// v0.4.15: multi-frame scene capture must survive code generation.
'use strict';
const F=require('../forja65-core.js');
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const rom=F.loadRom(F.makeSyntheticRom(),'timeline-test.sfc');
const files=F.generateProject(rom,F.analyze(rom,512));
const hdr=files['src/runtime.hpp'];
if(!files['RUN-CAPTURE-TIMELINE.cmd'].includes('FORJA65_CAPTURE_FRAMES'))throw Error('Missing generated timeline script');
for(const key of ['FORJA65_CAPTURE_FRAMES','sceneTimelineFrames','sceneTimelineNext','strictly increasing positive frames'])if(!hdr.includes(key))throw Error('Generator lost '+key);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-timeline-'));
try{
 fs.writeFileSync(path.join(dir,'runtime.hpp'),hdr);
 fs.writeFileSync(path.join(dir,'main.cpp'),String.raw`#include "runtime.hpp"
#include <filesystem>
#include <cstdlib>
#include <iostream>
int main(){
#ifdef _WIN32
 _putenv_s("FORJA65_CAPTURE_FRAMES","1,3"); _putenv_s("FORJA65_CAPTURE_DIR","capture");
#else
 setenv("FORJA65_CAPTURE_FRAMES","1,3",1);setenv("FORJA65_CAPTURE_DIR","capture",1);
#endif
 SnesRuntime hw;hw.frameCounter=1;
 if(!hw.maybeCaptureNativeScene())return 1;
 if(hw.maybeCaptureNativeScene())return 2;
 hw.frameCounter=2;if(hw.maybeCaptureNativeScene())return 3;
 hw.frameCounter=3;if(!hw.maybeCaptureNativeScene()||!hw.sceneCaptureDone)return 4;
 if(!std::filesystem::exists("capture/frame-1/preview.ppm")||!std::filesystem::exists("capture/frame-3/capture-manifest.txt"))return 5;
 std::cout<<"FORJA_TIMELINE_GENERATED_PASS\n";return 0;
}`);
 const exe=path.join(dir,process.platform==='win32'?'timeline.exe':'timeline');
 cp.execFileSync(process.env.CXX||'g++',['-std=c++20','-O0','-w','main.cpp','-o',exe],{cwd:dir,stdio:'inherit'});
 cp.execFileSync(exe,[],{cwd:dir,stdio:'inherit'});
 console.log('FORJA65_TETRIS_SCENE_TIMELINE_V0415_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
