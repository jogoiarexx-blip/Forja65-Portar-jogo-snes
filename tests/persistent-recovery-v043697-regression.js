'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),M=require('../tools/analysis-memory');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-persistent-recovery-'));
try{
 const child=`const fs=require('node:fs'),M=require(${JSON.stringify(require.resolve('../tools/analysis-memory'))});fs.renameSync=()=>process.exit(0);const m=M.createAnalysisMemory(process.argv[1],{identity:{rom:'a'}});m.run({max:4},()=>({value:Buffer.alloc(1024*1024)}));m.commit();`;
 const common=path.join(dir,'snapshots');fs.mkdirSync(common);for(let n=0;n<3;n++){const isolated=path.join(dir,'writer'+n),p=cp.spawnSync(process.execPath,['-e',child,isolated]);assert.equal(p.status,0);for(const file of fs.readdirSync(path.join(isolated,'snapshots')))fs.renameSync(path.join(isolated,'snapshots',file),path.join(common,file));}
 const folder=path.join(dir,'snapshots'),temps=()=>fs.readdirSync(folder).filter(n=>n.endsWith('.tmp'));assert.equal(temps().length,3,'reproduced abandoned writes');
 const active='a'.repeat(64)+'.bin.'+process.pid+'.abcdef123456.tmp';fs.writeFileSync(path.join(folder,active),'active');fs.writeFileSync(path.join(folder,'unrelated.tmp'),'preserve');
 const m=M.createAnalysisMemory(dir,{identity:{rom:'a'}});m.run({max:4},()=>({value:Buffer.alloc(32)}));const commit=m.commit();assert.equal(temps().length,2,'recover only abandoned module writes; preserve live process and unrelated files');assert(fs.existsSync(path.join(folder,active)));assert.equal(commit.recovered,3);
 assert(fs.readdirSync(folder).filter(n=>n.endsWith('.bin')).length<=2);console.log('PERSISTENT_CRASH_RECOVERY_ACTIVE_WRITER_PRESERVATION_PASS');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
