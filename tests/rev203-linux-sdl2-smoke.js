"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const F=require('../forja65-core.js');
if(process.platform!=='linux') {console.log('REV203_LINUX_SDL2_SMOKE_SKIP: not Linux');process.exit(0);}
const rom=F.loadRom(F.makeSyntheticRom(),'rev203-sdl-smoke.sfc');
const files=F.generateProject(rom,F.analyze(rom,256));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-rev203-sdl-'));
try {
  fs.writeFileSync(path.join(dir,'forja_linux_sdl2.hpp'),files['src/forja_linux_sdl2.hpp']);
  fs.writeFileSync(path.join(dir,'smoke.cpp'),`#include "forja_linux_sdl2.hpp"\n#include <array>\n#include <cstdint>\n#include <iostream>\nint main(){ForjaLinuxSDL2 host;host.initialize();std::array<std::uint32_t,256*224> pixels{};host.show(pixels.data(),256,224);host.events();const auto input=host.readInput();if(host.isClosed()||input[0]||input[1])return 2;host.shutdown();std::cout<<"REV203_LINUX_SDL2_DUMMY_PASS\\n";return 0;}\n`);
  const result=cp.spawnSync(process.env.CXX||'g++',['-std=c++20','-O0','smoke.cpp','-ldl','-o','smoke'],{cwd:dir,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||String(result.error));
  const run=cp.spawnSync(path.join(dir,'smoke'),[],{cwd:dir,env:{...process.env,SDL_VIDEODRIVER:'dummy',SDL_RENDER_DRIVER:'software'},encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||String(run.error));
  process.stdout.write(run.stdout||'');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
