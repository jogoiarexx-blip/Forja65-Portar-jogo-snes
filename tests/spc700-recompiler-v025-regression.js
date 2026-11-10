const C=require('../forja65-core.js');
const ram=new Uint8Array(65536);ram.fill(0);
const base=0x0200;const code=[0xE8,0x0C,0xC4,0xF2,0xE8,0x22,0xC4,0xF3,0xCD,0x03,0x8D,0x02,0xBC,0x68,0x23,0xF0,0x01,0x00,0xFF];ram.set(code,base);
const cap=C.loadSpcCapture(ram,'upload_base=0x0200\nupload_count=19\nentry_candidate=0x0200\n');
const a=C.spcAnalyze(cap);
if(a.unsupported!==0) throw new Error('SPC unsupported='+a.unsupported+' '+C.spcReportText(a));
if(a.native<9) throw new Error('SPC native coverage too small '+a.native);
const cpp=C.spcCpp(cap,a);
for(const q of ['goto S_0202','forja65SpcExecute<0xC4u>(apu)']){
 if(!cpp.includes(q)) throw new Error('missing generated fragment '+q);
}
const files=C.generateSpcProject(cap,a);if(!files['spc700_native.cpp']||!files['runtime.hpp'])throw new Error('missing SPC generated files');
console.log('SPC700 recompiler v0.2.5 regression: PASS',{decoded:a.decoded,native:a.native,edges:a.edges.length,calls:a.calls.length});
