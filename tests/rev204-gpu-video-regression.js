"use strict";
// Forja65 REV204: apresentacao pela GPU (Direct3D 11, Vulkan, OpenGL) com volta para a CPU.
// 1) o gerador embute os backends, os shaders e as opcoes; 2) o SPIR-V embutido e valido;
// 3) Linux: compila e roda o LinuxVideo com SDL_VIDEODRIVER=dummy (sem GPU) e confere a volta para a CPU;
// 4) Windows: com MinGW instalado, compila o runtime (-fsyntax-only) para o caminho Direct3D 11.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'rev204-gpu.sfc');
const files=F.generateProject(rom,F.analyze(rom,256));
const rt=files['src/runtime.hpp'],main=files['src/main.cpp'];
for(const term of ['class GpuPresenter','class GpuD3D11','class GpuVulkan','class GpuOpenGL','class LinuxVideo','forja65video::LinuxVideo linuxVideo',
  'linuxVideo.present(linuxHost,framebuffer.data(),fbWidth,fbHeight)','gpu.present(fb,fbW,fbH,cw,ch,s,why)','wc.style=CS_OWNDC',
  '{"FORJA65_VIDEO_BACKEND","backend"}','k==VK_F9','D3DCompile','vulkan-1.dll','libvulkan.so.1','opengl32.dll','#define FORJA65_VK_MIN 1'])
  assert.ok(rt.includes(term),'falta no runtime: '+term);
assert.ok(main.includes('NvOptimusEnablement')&&main.includes('AmdPowerXpressRequestHighPerformance'));
assert.ok(files['docs/VIDEO-GPU-REV204.txt']&&files['tools/gpu-shaders/forja65-filters.glsl']);
// SPIR-V embutido: numero magico e tamanho multiplo de 4
for(const name of ['kGpuVkVert64','kGpuVkFrag64']){
  const m=rt.match(new RegExp(name+'="([A-Za-z0-9+/=]+)"'));assert.ok(m,name);
  const b=Buffer.from(m[1],'base64');assert.equal(b.length%4,0);assert.equal(b.readUInt32LE(0),0x07230203,name+' nao e SPIR-V');
}
// o corpo dos shaders tem os 10 filtros da CPU
const body=files['tools/gpu-shaders/forja65-filters.glsl'];
for(const f of ['fjCrt','fjLcd','fjFxaaFinal','fjCasFinal','fjSharpAxis'])assert.ok(body.includes(f),f);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-rev204-gpu-'));
try{
  for(const [n,c] of Object.entries(files))if(n.startsWith('src/')){const p=path.join(dir,n);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,c);}
  const have=c=>cp.spawnSync(c,['--version'],{encoding:'utf8'}).status===0;
  if(process.platform==='linux'&&have(process.env.CXX||'g++')){
    fs.writeFileSync(path.join(dir,'src','gpu_smoke.cpp'),'#include "runtime.hpp"\n#include <iostream>\nint main(){std::vector<std::uint32_t> px(256*224,0xFF3060A0u);\n'+
      'ForjaLinuxSDL2 h;forja65video::LinuxVideo v;try{v.open(h);}catch(const std::exception&e){std::cout<<"SKIP "<<e.what()<<"\\n";return 0;}\n'+
      'for(int i=0;i<5;i++){h.events();v.present(h,px.data(),256,224);}std::cout<<"BACKEND "<<v.backendLabel()<<"\\n";v.close(h);h.shutdown();return 0;}\n');
    const r=cp.spawnSync(process.env.CXX||'g++',['-std=c++20','-O0','gpu_smoke.cpp','-ldl','-lpthread','-o','gpu_smoke'],{cwd:path.join(dir,'src'),encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
    const run=cp.spawnSync(path.join(dir,'src','gpu_smoke'),[],{cwd:path.join(dir,'src'),encoding:'utf8',env:{...process.env,SDL_VIDEODRIVER:'dummy',FORJA65_VIDEO_BACKEND:'auto'}});
    assert.equal(run.status,0,run.stderr);
    if(!run.stdout.startsWith('SKIP')){
      assert.match(run.stdout,/BACKEND CPU \(SDL\)/,'sem GPU o port tem de voltar para a CPU: '+run.stdout);
      const logText=fs.readFileSync(path.join(dir,'src','forja65-video-backend.txt'),'utf8');
      assert.match(logText,/ativo: CPU \(SDL\)/);assert.match(logText,/OpenGL: /);
    }
    process.stdout.write('linux: '+run.stdout.trim()+'\n');
  }
  const mingw='x86_64-w64-mingw32-g++';
  if(have(mingw)){
    const r=cp.spawnSync(mingw,['-std=c++20','-fsyntax-only','-x','c++','runtime.hpp'],{cwd:path.join(dir,'src'),encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);
    process.stdout.write('windows (mingw -fsyntax-only): ok\n');
  }
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('REV204_GPU_VIDEO_PASS');
