const assert=require('assert'),fs=require('fs'),p=require('path');
const src=fs.readFileSync(p.join(__dirname,'..','forja65-core.js'),'utf8');
for(const x of ['appendWramWatch();appendFrameHash()','FORJA65_WRAM_WATCH_ADDRS','FORJA65_WRAM_WATCH_CSV','w.addr+k','if(a>=0x20000u']) assert(src.includes(x),x);
console.log('REV171 generator generic WRAM watch hooks PASS');
