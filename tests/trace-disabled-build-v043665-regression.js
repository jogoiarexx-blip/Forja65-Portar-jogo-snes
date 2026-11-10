'use strict';
// Compile and run both public trace APIs, from the source header and the
// actual generated runtime. Disabled observers must not create trace files.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const F = require(process.env.FORJA65_SOURCE_CORE || '../forja65-core');
const rom = F.loadRom(F.makeSyntheticRom(), 'trace-disabled-build-v043665.sfc');
const files = F.generateProject(rom, F.analyze(rom, 128));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forja-trace-build-65-'));
try {
  fs.writeFileSync(path.join(dir, 'runtime.hpp'), files['src/runtime.hpp']);
  fs.writeFileSync(path.join(dir, 'pcm_audio_output.hpp'), files['src/pcm_audio_output.hpp']);
  fs.copyFileSync(path.join(__dirname, '../native/forja_trace.hpp'), path.join(dir, 'forja_trace.hpp'));
  for (const generated of [false, true]) {
    fs.writeFileSync(path.join(dir, 'probe.cpp'), `
#include "${generated ? 'runtime.hpp' : 'forja_trace.hpp'}"
#include <cassert>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
int main() {
  ForjaBusClockTrace bus;
  ForjaTrace trace;
  bus.start("bus.csv");
  trace.start("cpu.csv", "synthetic");
  bus.emit(0,0,0x8000,"read","CPU",0x7e0010,0x5a);
  bus.emit(1,0,0x8000,"write","CPU",0x7e0010,0xa5,"false");
  trace.emit(0,0x8000,0x8000,"instruction","ROM",0x8000,0xea);
  bus.close();
  trace.close();
  ${generated ? 'auto hw=std::make_unique<SnesRuntime>(); hw->write8(0x7e0010,0x5a); assert(hw->read(0x7e0010)==0x5a);' : ''}
#if FORJA65_ENABLE_TRACE
  assert(std::filesystem::exists("bus.csv") && std::filesystem::exists("cpu.csv"));
  std::ifstream f("bus.csv");
  std::string s((std::istreambuf_iterator<char>(f)),{});
  assert(s.find(",90,unknown")!=std::string::npos);
  assert(s.find(",165,false")!=std::string::npos);
  assert(s.find("# written=2 dropped=0")!=std::string::npos);
#else
  assert(!bus.enabled && !trace.enabled);
  assert(!std::filesystem::exists("bus.csv") && !std::filesystem::exists("cpu.csv"));
#endif
  std::cout << "TRACE_BUILD_PASS\\n";
}
`);
    for (const enabled of [0, 1]) for (const opt of ['-O0', '-O2']) {
      const runDir = path.join(dir, `${generated}-${enabled}-${opt}`);
      fs.mkdirSync(runDir);
      const exe = path.join(runDir, process.platform === 'win32' ? 'probe.exe' : 'probe');
      cp.execFileSync(process.env.CXX || 'g++', ['-std=c++20', opt,
        `-DFORJA65_ENABLE_TRACE=${enabled}`, '-I'+dir, path.join(dir,'probe.cpp'), '-o', exe,
        ...(process.platform === 'win32' && generated ? ['-luser32','-lgdi32','-lxinput9_1_0','-lwinmm'] : [])],
        {cwd: runDir, timeout: 120000, stdio: 'pipe'});
      const output = cp.execFileSync(exe, [], {cwd: runDir, timeout: 30000, encoding:'utf8'});
      assert.match(output, /TRACE_BUILD_PASS/);
      console.log(`TRACE_BUILD_PASS generated=${+generated} trace=${enabled} opt=${opt}`);
    }
  }
} finally {
  fs.rmSync(dir, {recursive:true, force:true});
}
