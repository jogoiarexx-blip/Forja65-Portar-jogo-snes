'use strict';
// REV146: generated C++ must reject malformed SPC oscillator overrides instead
// of silently reverting to a different APU frequency (breaking replay QA).
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const F = require('../forja65-core');
const rom = F.loadRom(F.makeSyntheticRom());
const generated = F.generateProject(rom,F.analyze(rom,64))['src/runtime.hpp'];
const m = generated.match(/^inline std::int64_t forja65SpcHz\(\)\{[^\n]+\}/m);
assert(m, 'missing generated clock parser');
const dir = fs.mkdtempSync(path.join(os.tmpdir(),'forja-spc-hz-'));
try {
  fs.writeFileSync(path.join(dir,'clock.cpp'),
    `#include <cstdlib>\n#include <cstdint>\n#include <stdexcept>\n#include <iostream>\n${m[0]}\nint main(){try{std::cout<<forja65SpcHz()<<"\\n";return 0;}catch(const std::exception&e){std::cerr<<e.what();return 3;}}\n`);
  const cc=cp.spawnSync('g++',['-std=c++17','-O0','clock.cpp','-o','clock'],{cwd:dir,encoding:'utf8'});
  assert.equal(cc.status,0,cc.stderr);
  const probe=(val)=>cp.spawnSync(path.join(dir,'clock'),[],{
    cwd:dir,env:{...process.env,FORJA65_SPC_HZ:val},encoding:'utf8'});
  assert.equal(probe('1025280').stdout.trim(),'1025280');
  assert.equal(probe('1024000').stdout.trim(),'1024000');
  for(const bad of ['0','abc','1025280oops','1200000','-1']){
    const x=probe(bad);
    assert.equal(x.status,3,`bad override ${bad} returned status ${x.status}`);
    assert.match(x.stderr,/FORJA65_SPC_HZ invalido/);
  }
  console.log('SPC_CLOCK_ENV_REV146_PASS valid=2 rejected=5');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
