// Forja65 REV199: o runtime gerado deve trazer o replay logico (FORJA65_INPUT_LOGIC) ligado ao inicio do VBlank.
'use strict';
const assert=require('assert');
const C=require('../forja65-core.js');
const files={'src/runtime.hpp':
 '  void controlFrame();\n  void initInputTraceFromEnv(){if(const char*p=std::getenv("FORJA65_INPUT_REPLAY"))if(*p)loadInputReplay(p);}\n'+
 'if(currentScanline==vis){if(controlMode&&controlAtVblank)controlFrame();}\n  void beginVblank(unsigned line){io.vblank=true;}\n'};
const src=require('fs').readFileSync(require('path').join(__dirname,'..','forja65-core.js'),'utf8');
assert(src.includes('function attachLogicReplay(files)'),'attachLogicReplay ausente');
const m=new Function('files',src.slice(src.indexOf('const FORJA65_LOGIC_REPLAY_BLOCK'),src.indexOf('function attachControlVblank(files){'))+';return attachLogicReplay(files);');
const out=m(files)['src/runtime.hpp'];
assert(out.includes('loadLogicReplay(p);return;'),'initInputTraceFromEnv nao chama o replay logico');
assert(out.includes('if(currentScanline==vis){logicReplayAtVblank();'),'gancho do VBlank ausente');
assert(out.includes('void beginVblank(unsigned line){logicReplayAtVblank();'),'gancho do beginVblank ausente');
assert(out.includes('FORJA65_LOGIC_STATE_OUT'),'registro de estado logico ausente');
assert.strictEqual(m({'src/runtime.hpp':out})['src/runtime.hpp'],out,'aplicacao deve ser idempotente');
console.log('REV199_LOGIC_REPLAY_PASS');
