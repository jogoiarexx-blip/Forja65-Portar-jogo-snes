const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const F=require('../forja65-core.js');
function ok(x,m){if(!x)throw new Error(m)}
const rom=F.loadRom(F.makeSyntheticRom(),'v024.sfc'),a=F.analyze(rom,1024),p=F.generateProject(rom,a);
ok(a.apuBridge==='SPC700_IPL_256_OPCODE_RUNTIME_DSP_BRR','SPC700/DSP runtime not announced');
const h=p['src/runtime.hpp'];
ok(h.includes('struct SpcDsp'),'SpcDsp missing');
ok(h.includes('decodeBlock'),'BRR decoder missing');
ok(h.includes('writeReg'),'DSP register interface missing');
ok(h.includes('spcRead'),'SPC memory read interface missing');
ok(h.includes('spcWrite'),'SPC memory write interface missing');
ok(h.includes('saveManifest'),'SPC upload manifest missing');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-v024-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});
fs.writeFileSync(path.join(dir,'src','runtime.hpp'),h);
fs.writeFileSync(path.join(dir,'v024_test.cpp'),`#include "src/runtime.hpp"\n#include <cassert>\n#include <fstream>\n#include <vector>\nint main(){\n  ApuBridge a;\n  // Synthetic SPC upload metadata.\n  a.write(2,0x00);a.write(3,0x02);a.write(1,0x55);a.write(0,0);a.write(1,0x66);a.write(0,1);\n  assert(a.uploadBase==0x0200);assert(a.uploadCount>=2);\n  // Source directory at $0200, sample at $0300.\n  a.spc.ram[0x0200]=0x00;a.spc.ram[0x0201]=0x03;a.spc.ram[0x0202]=0x00;a.spc.ram[0x0203]=0x03;\n  // BRR: one looping block with non-zero nibbles.\n  a.spc.ram[0x0300]=0x03;for(int i=1;i<9;i++)a.spc.ram[0x0300+i]=0x77;\n  a.spcWrite(0xF2,0x5D);a.spcWrite(0xF3,0x02); // DIR\n  a.spcWrite(0xF2,0x00);a.spcWrite(0xF3,0x7F); // V0 VOL L\n  a.spcWrite(0xF2,0x01);a.spcWrite(0xF3,0x7F); // V0 VOL R\n  a.spcWrite(0xF2,0x02);a.spcWrite(0xF3,0x00); // pitch lo\n  a.spcWrite(0xF2,0x03);a.spcWrite(0xF3,0x10); // pitch 0x1000\n  a.spcWrite(0xF2,0x04);a.spcWrite(0xF3,0x00); // SRCN 0\n  a.spcWrite(0xF2,0x05);a.spcWrite(0xF3,0x00); // GAIN mode\n  a.spcWrite(0xF2,0x07);a.spcWrite(0xF3,0x7F); // direct gain\n  a.spcWrite(0xF2,0x0C);a.spcWrite(0xF3,0x7F); // MVOL L\n  a.spcWrite(0xF2,0x1C);a.spcWrite(0xF3,0x7F); // MVOL R\n  a.spcWrite(0xF2,0x4C);a.spcWrite(0xF3,0x01); // KON voice0\n  auto pcm=a.dsp.render(a.spc.ram,128);bool nz=false;for(auto v:pcm)if(v){nz=true;break;}assert(nz);\n  assert(SpcDsp::saveWav("spc-test.wav",pcm));std::ifstream w("spc-test.wav",std::ios::binary);char riff[4]{};w.read(riff,4);assert(riff[0]=='R'&&riff[1]=='I'&&riff[2]=='F'&&riff[3]=='F');\n  assert(a.spcRead(0xF3)==1); // current DSP reg is KON and contains last value\n  return 0; }\n`);
cp.execFileSync('g++',['-std=c++20','-O2',path.join(dir,'v024_test.cpp'),'-o',path.join(dir,'v024_test')],{stdio:'inherit'});cp.execFileSync(path.join(dir,'v024_test'),[],{cwd:dir,stdio:'inherit'});
console.log('SPC/DSP Stage 1 v0.2.4 regression: PASS',{apu:a.apuBridge});
