const assert=require('assert'),C=require('../../forja65-core');
const bytes=C.makeSyntheticRom();bytes[0x7fd5]=0x23;bytes[0x7fd6]=0x35;
const rom=C.loadRom(bytes),a=C.analyze(rom,128),report=C.reportText(a);
assert(report.includes('modelo SA1 experimental'),'report must describe the new board model');
assert(!report.includes('chip nao emulado'),'stale report must not hide implemented experimental support');
console.log('SA1_REPORT_PROGRESS_PASS');
