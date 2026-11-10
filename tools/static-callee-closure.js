'use strict';
// Conservative graph closure over decoded routines. This is not observed reachability.
function staticCalleeClosure(analysis,seeds,toRom){
 const byRom=new Map(),fs=analysis.functions||[];
 fs.forEach((f,index)=>{for(const pc of new Set([f.start,...(f.instructions||[]).map(i=>i.pc)])){const off=toRom(pc);if(off===null||off===undefined)continue;if(!byRom.has(off))byRom.set(off,new Set());byRom.get(off).add(index);}});
 const targets=new Set(),visited=new Set(),undecoded=new Set(),edges=[];const queue=[...seeds];
 for(let cursor=0;cursor<queue.length;cursor++){const pc=queue[cursor]&0xffffff,off=toRom(pc);if(off===null||off===undefined||targets.has(pc))continue;targets.add(pc);const matches=byRom.get(off);if(!matches){undecoded.add(pc);continue;}
  for(const index of matches){if(visited.has(index))continue;visited.add(index);const f=fs[index];
   for(const call of f.calls||[]){const target=call.target??call.to;if(!Number.isInteger(target))continue;const ro=toRom(target);if(ro===null||ro===undefined)continue;edges.push({from:f.start,target});queue.push(target);}
  }
 }
 return {targets:[...targets].sort((a,b)=>a-b),functions:[...visited].sort((a,b)=>a-b),edges,undecoded:[...undecoded].sort((a,b)=>a-b)};
}
module.exports={staticCalleeClosure};
