const assert=require('assert'),C=require('../forja65-core.js');
assert.equal(typeof C.firstDivergence,'function','comparison API missing');
const ref='frame=1 framebuffer=aaaa wram=bbbb pc=8000\nframe=2 framebuffer=cccc wram=dddd pc=8020\n';
const native='frame=1 framebuffer=aaaa wram=bbbb pc=8000\nframe=2 framebuffer=cccc wram=eeee pc=8020\n';
assert.equal(C.firstDivergence(ref,ref).equivalent,true);
const diff=C.firstDivergence(ref,native);assert.equal(diff.frame,2);assert.deepEqual(diff.differences,[{field:'wram',reference:'dddd',native:'eeee'}]);assert.equal(C.firstDivergence(ref,native.split('\n')[0]).reason,'MISSING_FRAME');
assert.throws(()=>C.firstDivergence('', ''),/empty/i);
assert.throws(()=>C.firstDivergence('frame=1 wram=a\nframe=1 wram=b',ref),/duplicate/i);
// No extrapolation from truncated trace. Full frame number is retained.
const data=C.makeSyntheticRom(),rom=C.loadRom(data),a=C.analyze(rom,128),hash=C.romFingerprint(rom);
const csv='# FORJA_TRACE 1 rom='+hash+'\nseq,frame,routine,pc,kind,space,address,value,source\n0,1834,32768,32769,instruction,CPU,32769,156,CPU\n# written=1 dropped=14\n';
const t=C.parseTrace(csv),map=C.buildNativeMap(rom,a,t);assert.equal(t.dropped,14);assert.equal(map.trace.complete,false);assert.equal(map.metrics.scope,'TRUNCATED_TRACE');
console.log('trace-comparison-framework-regression: OK');
const interrupted=C.parseTrace(csv.split('# written=')[0]);assert.equal(interrupted.complete,false,'interrupted capture must not claim completion');
