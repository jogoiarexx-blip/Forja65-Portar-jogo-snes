'use strict';
// v.103 CRLF repair for the Windows checkpoint scripts.
// REV136: the original assertion compared the CURRENT generator's C++ with the archived
// .103 core byte-for-byte. That pin became permanently false once later audited revisions
// (REV122-REV135: MDR, SST conformance, interpreter, runtime control) changed the runtime,
// although the CRLF repair itself never touched C++. The historical proof is kept pinned to
// the archived core, and the active generator is checked for the property the repair needs:
// script CRLF never leaks into generated C++ sources.
const assert=require('node:assert/strict'),C=require('../forja65-core'),Old=require('../crossfeed-historico/v0436103-pre-crlf/forja65-core');
const bytes=C.makeSyntheticRom(),rom=C.loadRom(bytes),a=C.analyze(rom,64),after=C.generateProject(rom,a);
const oldRom=Old.loadRom(Old.makeSyntheticRom()),before=Old.generateProject(oldRom,Old.analyze(oldRom,64));
for(const n of Object.keys(before).filter(n=>n.startsWith('src/')))assert(!before[n].includes('\r'),'archived .103 C++ must be LF-only: '+n);
for(const n of Object.keys(after).filter(n=>n.startsWith('src/')))assert(!after[n].includes('\r\n'),'CRLF repair must not leak into generated C++ '+n);
for(const n of ['CHECKPOINT-CREATE-WINDOWS.cmd','CHECKPOINT-RESUME-WINDOWS.cmd']){assert(after[n].startsWith('@echo off\r\n'));assert(!/(?<!\r)\n/.test(after[n]),'all script lines need CRLF');}
console.log('WINDOWS_CHECKPOINT_CRLF_CPP_PRESERVATION_PASS');
