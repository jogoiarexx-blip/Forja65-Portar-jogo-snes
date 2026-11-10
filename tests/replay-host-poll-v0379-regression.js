'use strict';
// Removing replay ownership from pollInput must fail this behavior test.
// The actual generated Windows body runs with only OS API dependencies stubbed.
const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const C=require('../forja65-core');
const rom=C.loadRom(C.makeSyntheticRom(),'replay-poll.sfc');
const h=C.generateProject(rom,C.analyze(rom,256,[]))['src/runtime.hpp'];
const start=h.indexOf('  void pollInput(){'),end=h.indexOf('\n#ifdef _WIN32\n  static LRESULT',start);
assert(start>=0&&end>start,'generated pollInput boundary missing');
const body=h.slice(start,end);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-replay-poll-'));
try {
 const code=`#include <cstdint>
#include <cassert>
#define VK_SHIFT 1
#define VK_RETURN 2
#define VK_UP 3
#define VK_DOWN 4
#define VK_LEFT 5
#define VK_RIGHT 6
#define ERROR_SUCCESS 0
enum {XINPUT_GAMEPAD_Y=1,XINPUT_GAMEPAD_B=2,XINPUT_GAMEPAD_BACK=4,XINPUT_GAMEPAD_START=8,XINPUT_GAMEPAD_DPAD_UP=16,XINPUT_GAMEPAD_DPAD_DOWN=32,XINPUT_GAMEPAD_DPAD_LEFT=64,XINPUT_GAMEPAD_DPAD_RIGHT=128,XINPUT_GAMEPAD_X=256,XINPUT_GAMEPAD_A=512,XINPUT_GAMEPAD_LEFT_SHOULDER=1024,XINPUT_GAMEPAD_RIGHT_SHOULDER=2048};
struct XINPUT_STATE {struct {unsigned wButtons{};int sThumbLX{},sThumbLY{};} Gamepad;};
int keyboardReads{},controllerReads{};bool hostPressed{};
short GetAsyncKeyState(int key){keyboardReads++;return hostPressed&&(key=='X'||key==VK_LEFT)?short(0x8000):0;}
unsigned XInputGetState(unsigned,XINPUT_STATE* state){controllerReads++;if(!hostPressed)return 1;state->Gamepad.wButtons=XINPUT_GAMEPAD_DPAD_RIGHT;state->Gamepad.sThumbLY=10000;return 0;}
struct Runtime {bool replayActive{};std::uint16_t joy1{},joy2{};void setJoy1(std::uint16_t v){joy1=v;}
${body}
};
int main(){Runtime runtime;runtime.replayActive=true;runtime.joy1=0x1100;runtime.joy2=0x0040;
 for(bool pressed:{false,true}){hostPressed=pressed;runtime.pollInput();runtime.pollInput();assert(runtime.joy1==0x1100&&"replay must retain held input through host/vblank polls");assert(runtime.joy2==0x0040);}
 assert(keyboardReads==0&&controllerReads==0&&"replay must not poll the host");
 runtime.replayActive=false;hostPressed=true;runtime.pollInput();assert(runtime.joy1==0x8B00&&"live keyboard and controller must remain functional");assert(keyboardReads>0&&controllerReads>0);
 hostPressed=false;runtime.pollInput();assert(runtime.joy1==0&&"live release clears prior host buttons");
}`.replace('#include <cassert>','#include <cassert>\n#include <initializer_list>');
 const file=path.join(temp,'poll.cpp'),exe=path.join(temp,'poll');fs.writeFileSync(file,code);
 const build=cp.spawnSync(process.env.CXX||'c++',['-std=c++20','-D_WIN32=1',file,'-o',exe],{encoding:'utf8'});assert.strictEqual(build.status,0,build.stderr||String(build.error));
 const run=cp.spawnSync(exe,[],{encoding:'utf8'});assert.strictEqual(run.status,0,run.stderr||String(run.error));
 console.log('Replay host polling v0.3.79 behavior: PASS');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
