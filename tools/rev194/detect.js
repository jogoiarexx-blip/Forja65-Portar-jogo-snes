const F=require(process.argv[2]),fs=require('fs');
for(const f of process.argv.slice(3)){let r;try{r=F.loadRom(new Uint8Array(fs.readFileSync(f)),f);console.log(f,r.header.mapping,r.header.board||"-",r.header.coprocessor||'',r.header.headerOffset.toString(16));}catch(e){console.log(f,'ERRO',e.message.slice(0,60));}}
