// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const assert=require('assert');
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'scene-capture.sfc');
const a=C.analyze(rom,2048);
const p=C.generateProject(rom,a);
const vm=C.VERSION.match(/^0\.(3|4)\.(\d+)/); assert(vm&&(Number(vm[1])>3||Number(vm[2])>=23));
for(const f of ['RUN-CAPTURE-SCENE.cmd','tests/scene_capture_smoke.cpp','docs/HOST-RUNTIME.txt'])assert(p[f],`arquivo scene capture ausente: ${f}`);
const rt=String(p['src/runtime.hpp']),cm=String(p['CMakeLists.txt']),main=String(p['src/main.cpp']);
for(const q of ['captureNativeScene','maybeCaptureNativeScene','FORJA65_CAPTURE_FRAME','FORJA65_CAPTURE_DIR','NPAL','NTIL','NMAP','capture-manifest.txt','preview.ppm','NSPR','writeNativeOamLayer','framebufferHash','cart_hash_fnv1a64'])assert(rt.includes(q),`runtime de captura sem ${q}`);
for(const q of ['add_executable(scene_capture_smoke','add_test(NAME scene_capture_smoke','TARGET scene_capture_smoke POST_BUILD'])assert(cm.includes(q),`CMake captura sem ${q}`);
assert(main.includes('hw.maybeCaptureNativeScene()'),'main nao dispara captura por frame');
for(const q of ['FORJA65_CAPTURE_FRAME','FORJA65_CAPTURE_DIR','FORJA65_CAPTURE_STOP'])assert(p['RUN-CAPTURE-SCENE.cmd'].includes(q),`runner captura sem ${q}`);
const meta=JSON.parse(p['analysis.json']);
for(const q of ['native_scene_capture','scene_capture_rom_hash','scene_capture_frame_hash','scene_capture_asset_manifest','scene_capture_ppm_preview','native_sprite_capture','nspr_oam_layer'])assert(meta.hardware[q]===true,`metadata sem ${q}`);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v0323-'));
fs.mkdirSync(path.join(dir,'src'));
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),rt);
fs.writeFileSync(path.join(dir,'scene_test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\n#include <filesystem>\n#include <fstream>\n#include <cstring>\nint main(){namespace fs=std::filesystem;SnesRuntime hw;hw.ppu.bgmode=1;hw.ppu.tm=1;hw.ppu.brightness=15;hw.ppu.cgram[2]=0x1f;hw.ppu.vram[0]=0x80;hw.framebuffer.assign(hw.fbWidth*hw.fbHeight,0xFF112233u);auto out=fs::path("${dir.replace(/\\/g,'\\\\')}")/"capture";assert(hw.captureNativeScene(out.string(),"test"));assert(fs::exists(out/"test.nscene"));assert(fs::exists(out/"capture-manifest.txt"));assert(fs::exists(out/"oam-layer.nspr"));std::ifstream f(out/"palette.npal",std::ios::binary);char m[4]{};f.read(m,4);assert(std::memcmp(m,"NPAL",4)==0);return 0;}\n`);
try{cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'scene_test.cpp'),'-o',path.join(dir,'scene_test')],{stdio:'inherit'});cp.execFileSync(path.join(dir,'scene_test'),[],{stdio:'inherit'});}catch(e){throw new Error('falha compilando/executando scene capture C++ v0.3.23: '+e.message)}
console.log('native-scene-capture-v0323-regression: OK');
