'use strict';
// Optional persistent scan cache. Corruption and I/O failures never block ports.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const digest=v=>crypto.createHash('sha256').update(v).digest('hex');
function createInventoryCache(directory,options={}){
 const file=key=>path.join(directory,digest(key)+'.json'),pending=new Map();let deferred=!!options.deferred;
 const write=(key,payload)=>{fs.mkdirSync(directory,{recursive:true});const p=file(key),tmp=p+'.'+process.pid+'.'+crypto.randomBytes(6).toString('hex')+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify({key,sha256:digest(payload),payload}));fs.renameSync(tmp,p);}finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}};
 return {
  getItem(key){if(pending.has(key))return pending.get(key);const p=file(key);if(!fs.existsSync(p))return null;try{if(fs.statSync(p).size>8*1024*1024)return null;const e=JSON.parse(fs.readFileSync(p,'utf8'));if(e.key!==key||typeof e.payload!=='string'||digest(e.payload)!==e.sha256)return null;return e.payload;}catch(_){return null;}},
  setItem(key,payload){if(deferred)pending.set(key,payload);else write(key,payload);},
  commit(){let saved=0,failed=0;for(const [key,payload]of pending)try{write(key,payload);saved++;}catch(_){failed++;}pending.clear();deferred=false;return {saved,failed};}
 };
}
module.exports={createInventoryCache};
