'use strict';
const assert=require('node:assert/strict'),F=require('../forja65-core');
function fixture({wrongCall=false,wrongPtr=false,noMask=false,m8=false,x8=false,brokenTable=false}={}){
 const b=F.makeSyntheticRom(),stub=0x8080,base=stub+3,count=84,end=base+2*count;
 b.set([0x29,0xff,0,0x0a,0xaa,0xbf,base&255,base>>>8,0,0x85,wrongPtr?0x40:0x42,0xa5,0x96,0x29,0x0f,0,0x20,wrongCall?0x70:stub&255,stub>>>8,0x60],0x20);
 if(noMask)b[0x20]=0x09;
 b.set([0x6c,0x42,0],stub-0x8000);b.set([0x6c,0x42,0],0x70);
 const expected=[];
 for(let n=0;n<count;n++){const t=end+3*n;expected.push(t);b[base-0x8000+2*n]=t&255;b[base-0x8000+2*n+1]=t>>>8;b[t-0x8000]=0x60;}
 // First handler is deliberately odd relative to the table; the final pointer anchors its end.
 const t=expected[0];b[base-0x8000]=expected[1]&255;b[base-0x8000+1]=expected[1]>>>8;b[base-0x8000+2*(count-1)]=t&255;b[base-0x8000+2*(count-1)+1]=t>>>8;
 if(brokenTable)b[base-0x8000+10]=0;
 const rom=F.loadRom(b,'writer.sfc'),knowledge={schema:'forja65.knowledge.v1',entries:[{address:stub,state:{emulation:false,m8,x8,carry:null}}]};
 const q=F.focusAnalyze(rom,[stub,0x8070],knowledge).results;
 return {site:q[0].indirect_sites.find(x=>x.pc===stub),other:q[1].indirect_sites.find(x=>x.pc===0x8070),expected:[...new Set([expected[1],...expected.slice(1,-1),expected[0]])].sort((a,b)=>a-b)};
}
const q=fixture();
assert(q.site,'ROM indexed writer must connect the RAM trampoline without runtime hints');
assert.deepEqual(q.site.targets,q.expected,'structural targets beyond the legacy 64 candidate cap must survive');
assert.equal(q.site.resolution.rom_indexed_writers[0].entries,84);
assert.equal(q.site.resolution.index_bounds_proven,false,'mask 255 cannot prove bounds for an 84-entry table');
assert(!q.other,'evidence for a different trampoline using the same vector must not leak through the cache');
for(const opt of [{wrongCall:true},{wrongPtr:true},{noMask:true},{m8:true},{x8:true},{brokenTable:true}])assert(!fixture(opt).site,JSON.stringify(opt));
console.log('ROM_INDEXED_VECTOR_WRITER_V0396_PASS targets=83 guards=7');
