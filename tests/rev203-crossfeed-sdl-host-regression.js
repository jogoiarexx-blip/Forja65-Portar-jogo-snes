"use strict";
const assert=require('node:assert/strict');
const F=require('../forja65-core.js');
const rom=F.loadRom(F.makeSyntheticRom(),'rev203-test.sfc');
const files=F.generateProject(rom,F.analyze(rom,384));
const runtime=files['src/runtime.hpp'];
const host=files['src/forja_linux_sdl2.hpp'];
const cm=files['CMakeLists.txt'];
// REV204: a apresentacao Linux passa pelo LinuxVideo (GPU OpenGL/Vulkan ou CPU com filtros); show() continua no host.
assert.ok(host.includes('void show(const std::uint32_t*pixels'));
for(const term of ['SDL_GameControllerAddMapping','FORJA65_SDL2_MAPPING_FILE','std::getline(file,line)','ForjaLinuxSDL2 linuxHost','linuxHost.readInput()','linuxHost.events()','linuxVideo.present(linuxHost,framebuffer.data(),fbWidth,fbHeight)'])
  assert.ok(runtime.includes(term)||host.includes(term),'missing '+term);
assert.ok(!runtime.includes('symbol(mappings,"SDL_GameControllerAddMappingsFromFile")'),'broken export lookup has returned');
assert.ok(cm.includes('link_libraries(${CMAKE_DL_LIBS})'));
assert.ok(host.includes('SDL_RenderSetIntegerScale'));
assert.ok(!host.includes('Aero Fighters'),'host not generic');
const logic=runtime.slice(runtime.indexOf('bool loadLogicReplay('),runtime.indexOf('bool loadLogicReplay(')+2600);
assert.ok(logic.includes("line.back()=='\\r'"),'logical replay must strip Windows CR');
assert.ok(!logic.includes("line.back()=='\\\\r'"),'multi-character CRLF regression');
assert.ok(files['docs/HOST-LINUX-REV203.txt']);
console.log('REV203_CROSSFEED_SDL_HOST_GENERATOR_PASS');
