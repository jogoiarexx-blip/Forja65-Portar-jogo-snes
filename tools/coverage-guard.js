'use strict';
// Safe preflight for an AOT project that accumulates ROM-verified CPU handlers.
// Generate into a detached staging directory first: never overwrite the game
// before checking coverage and any project-specific PPU/runtime improvements.
const fs=require('fs'),path=require('path'),os=require('os');
const {generate}=require('./project-io');
function dispatchRows(content){return String(content).split(/\r?\n/).filter(line=>/^\{0x[0-9a-f]+u,(?:true|false),/i.test(line));}
function dispatchEntryCount(content){return dispatchRows(content).length;}
function assertNonDestructive(previous,proposal,options={}){
 const oldCount=dispatchEntryCount(previous.dispatch),newCount=dispatchEntryCount(proposal.dispatch);
 if(oldCount>newCount)throw new Error('Unsafe full regeneration refused: dispatch coverage would shrink from '+oldCount+' to '+newCount+' entries. Integrate verified hints incrementally; the original project is unchanged.');
 const remaining=new Map();
 for(const row of dispatchRows(proposal.dispatch))remaining.set(row,(remaining.get(row)||0)+1);
 for(const row of dispatchRows(previous.dispatch)){
  const n=remaining.get(row)||0;
  if(!n)throw new Error('Unsafe full regeneration refused: original dispatcher entry would be removed or replaced. Integrate verified hints incrementally.');
  remaining.set(row,n-1);
 }
 // A regression to an older hardware runtime can break otherwise working PPU,
 // APU, DMA, HDMA and user-maintained fixes even if CPU coverage increases.
 if(previous.runtime && proposal.runtime && !previous.runtime.equals(proposal.runtime) && !options.allowRuntimeUpdate)
  throw new Error('Unsafe regeneration refused: runtime.hpp differs from the installed project. Review and merge hardware changes separately; the original project is unchanged.');
 return {oldCount,newCount};
}
function preflightLearnCrash(project,romPath,max,hints){
 const originalDispatch=path.join(project,'src/dispatch.cpp');
 if(!fs.existsSync(originalDispatch))return null;
 const originalRuntime=path.join(project,'src/runtime.hpp');
 const previous={dispatch:fs.readFileSync(originalDispatch,'utf8'),runtime:fs.existsSync(originalRuntime)?fs.readFileSync(originalRuntime):null};
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja65-coverage-'));
 try{
  // Preserve exactly the generation inputs and CFG cache, but not executables
  // or user source code. The temporary project is disposable.
  for(const name of ['analysis','profiles']){
   const source=path.join(project,name);if(fs.existsSync(source))fs.cpSync(source,path.join(tmp,name),{recursive:true});
  }
  for(const name of ['analysis.json','forja65-runtime-hints.txt','forja65-oracle-hints.txt']){
   const source=path.join(project,name);if(fs.existsSync(source))fs.copyFileSync(source,path.join(tmp,name));
  }
  generate({romPath,out:tmp,max,hints,update:true});
  return assertNonDestructive(previous,{dispatch:fs.readFileSync(path.join(tmp,'src/dispatch.cpp'),'utf8'),runtime:fs.readFileSync(path.join(tmp,'src/runtime.hpp'))});
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
module.exports={dispatchEntryCount,assertNonDestructive,preflightLearnCrash};
