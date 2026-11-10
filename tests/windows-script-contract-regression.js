const assert=require('assert'),C=require('../forja65-core');const r=C.loadRom(C.makeSyntheticRom()),f=C.generateProject(r,C.analyze(r,64));
for(const n of ['BUILD-WINDOWS.cmd','BUILD-QUALITY-WINDOWS.cmd'])assert(/cmake --build [^\r\n]+ --parallel 2/.test(f[n])&&!/cmake --build [^\r\n]+ --target /.test(f[n]),'Windows default build must produce all CTest executables');
assert(f['RUN-ORACLE.cmd'].includes('bin\\game.exe'),'Oracle launcher must retain Windows separator');assert(f['RUN-ORACLE.cmd'].includes('build-win\\Release\\game.exe'));
for(const [n,text]of Object.entries(f).filter(([n])=>n.endsWith('.cmd')))assert(text.startsWith('@echo off\r\n'),n+' must use actual CRLF lines');console.log('windows-script-contract-regression: OK');
