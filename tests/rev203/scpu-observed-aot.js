const assert=require('assert'),fs=require('fs'),os=require('os'),path=require('path');
const {compile}=require('../../tools/compile-sa1-observed-rev203.js');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'forja-scpu-test-'));
try{
 const input=path.join(d,'trace.txt'),out=path.join(d,'forja_scpu_aot.cpp');
 fs.writeFileSync(input,'7e0220 0 eb eb eb eb\n7e0221 0 eb eb eb af\n');
 const report=compile(input,process.argv[2],process.argv[3],out,{cpu:'scpu',perFile:1});
 assert.equal(report.cpu,'scpu');
 const text=fs.readFileSync(out,'utf8');assert(text.includes('forja65_scpu_aot='));assert(!text.includes('forja65_sa1_aot='));
 assert.equal(report.parts.length,2);for(const part of report.parts)assert(fs.existsSync(path.join(d,part)));
 compile(input,process.argv[2],process.argv[3],out,{cpu:'scpu',perFile:2});
 assert(!fs.existsSync(path.join(d,report.parts[1])),'obsolete shard must be removed');
 console.log('SCPU_OBSERVED_AOT_GENERATION_PASS');
}finally{fs.rmSync(d,{recursive:true,force:true});}
