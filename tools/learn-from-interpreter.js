#!/usr/bin/env node
'use strict';
// Forja65 REV135 - aprender com o interpretador de fallback.
//
// O port gerado pela REV133+ grava forja65-cpu-interpreter.txt com cada ponto em que a execucao
// saiu do codigo nativo (PC, estado M/X, origem e contagem). Esta ferramenta fecha o ciclo:
//   1. le o log e CLASSIFICA cada entrada pela instrucao de origem decodificada na ROM
//      (retorno RTS/RTL sem frame nativo, tabela JMP/JSR (abs,X), vetor indireto, chamada direta...);
//   2. VALIDA: so aceita destino em ROM, com estado coerente (E=1 exige M=X=1) e primeira
//      instrucao decodificavel e executavel; o resto vai para "rejeitados" com o motivo;
//   3. grava as sementes como runtime hints (formato padrao do Forja, ligadas ao fingerprint
//      da ROM) e um relatorio com a proveniencia de cada uma; opcionalmente guarda no cofre
//      de conhecimento (FORJA65_KNOWLEDGE_HOME);
//   4. com --port, roda o analisador com as sementes (ele mesmo expande as tabelas indexadas a
//      partir do alvo observado) e INTEGRA no port so o que falta: rotinas novas (renomeadas com
//      sufixo da revisao, sem colidir com nada), linhas de dispatch de (PC,estado) ainda nao
//      cobertas, aliases de ROM e o CMakeLists. O que o port ja cobre continua com o dono antigo.
//
// Uso:
//   node tools/learn-from-interpreter.js --rom jogo.sfc --log forja65-cpu-interpreter.txt --out pasta
//        [--port pasta-do-port] [--tag r135] [--budget 200000] [--vault] [--per-file 150]
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const C=require('../forja65-core.js');

function args(argv){const o={tag:'r135',budget:200000,perFile:150};for(let i=0;i<argv.length;i++){const a=argv[i];
  if(a==='--vault')o.vault=true;else if(a.startsWith('--')){const k=a.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase());o[k]=argv[++i];}}
  o.budget=+o.budget;o.perFile=+o.perFile;return o;}

function mergeStackReturnOffsets(oldText,genText,extraOffsets=[]){
  // une a tabela de alvos de retorno por pilha (RTS/RTL sem frame nativo) do port com a gerada a partir das sementes
  const re=/(static const std::uint32_t kForja65StackReturnOffsets\[\]=\{)([^}]*)(\};)/;
  const mo=oldText.match(re),mg=genText.match(re);if(!mo||!mg)return {text:oldText,added:0};
  const nums=s=>s.split(',').map(x=>x.trim()).filter(x=>/^0x[0-9A-Fa-f]+u$/.test(x)).map(x=>parseInt(x.slice(2,-1),16));
  const a=new Set(nums(mo[2])),b=[...nums(mg[2]),...extraOffsets];let added=0;for(const v of b)if(!a.has(v)){a.add(v);added++;}
  if(!added)return {text:oldText,added:0};
  const body=[...a].sort((x,y)=>x-y).map(v=>'0x'+v.toString(16).toUpperCase().padStart(6,'0')+'u').join(',');
  return {text:oldText.replace(re,(_,h,_b,e)=>h+body+e),added};
}
function parseLog(text){
  const rows=[];
  for(const raw of String(text).split(/\r?\n/)){
    const p=raw.trim().split(/\s+/);if(p.length!==4||!/^[0-9A-Fa-f]{6}$/.test(p[0])||!/^from=[0-9A-Fa-f]{6}$/.test(p[2])||!/^count=\d+$/.test(p[3])||!Number.isSafeInteger(Number(p[3].slice(6))))continue;
    const st=p[1].toUpperCase();if(st==='E1'){rows.push({target:parseInt(p[0],16),e:1,m:1,x:1,from:parseInt(p[2].slice(5),16),count:+p[3].slice(6)});continue;}
    const m=st.match(/^(E1)?M([01])X([01])$/);if(!m)continue;
    rows.push({target:parseInt(p[0],16),e:m[1]?1:0,m:+m[2],x:+m[3],from:parseInt(p[2].slice(5),16),count:+p[3].slice(6)});
  }
  return rows;
}
const isWram=pc=>{const b=(pc>>>16)&0xFF,o=pc&0xFFFF;return b===0x7E||b===0x7F||((b<0x40||(b>=0x80&&b<0xC0))&&o<0x2000);};
const BAD_FIRST=new Set(['BRK','COP','STP','WDM']);
function classify(rom,row){
  const st={emulation:!!row.e,m8:!!row.m,x8:!!row.x,carry:null};
  let src=null;try{src=C.decodeOne(rom,row.from,st);}catch(_){}
  const mn=src?src.mnemonic:'?',mode=src?src.mode:'?';
  let kind;
  if(row.from===row.target)kind='REENTRADA-ESTADO';
  else if(mn==='RTS'||mn==='RTL')kind='RETORNO-SEM-FRAME';
  else if(mode==='AbsoluteIndexedIndirectX')kind='TABELA-INDEXADA';
  else if(mode==='AbsoluteIndirect'||mode==='AbsoluteIndirectLong'||mode==='DirectIndirect')kind='VETOR-INDIRETO';
  else if(mn==='JSR'||mn==='JSL'||mn==='JMP'||mn==='JML'||mn==='BRA'||mn==='BRL')kind='CHAMADA-DIRETA-NAO-ANALISADA';
  else kind='OUTRO';
  return {kind,source:mn+' '+mode};
}
function validate(rom,row){
  if(row.e&&(!row.m||!row.x))return 'estado-impossivel-E1';
  if(isWram(row.target))return 'codigo-em-wram';
  if(C.snesToRom(rom,row.target)===null)return 'fora-da-rom';
  let ins;try{ins=C.decodeOne(rom,row.target,{emulation:!!row.e,m8:!!row.m,x8:!!row.x,carry:null});}catch(_){return 'nao-decodifica';}
  if(!ins||BAD_FIRST.has(ins.mnemonic))return 'primeira-instrucao-invalida('+(ins&&ins.mnemonic)+')';
  return null;
}
// REV174 R9: reports from a different ROM must never become AOT seeds.
// Legacy hand-authored 4-column snippets remain usable in old workflows;
// structured reports, however, require a matching fingerprint or a matching
// FORJA65_NATIVE_DEPENDENCY_AUDIT 1 supplied with --audit.
function verifyLogRomIdentity(logText,rom,options={}){
  const src=String(logText),fingerprint=C.romFingerprint(rom).toLowerCase();
  const structured=/^FORJA65_CPU_INTERPRETER 1\s*$/m.test(src);
  const all=[...src.matchAll(/^rom=([^\r\n]*)$/gm)].map(m=>m[1]);
  if(all.length>1)throw new Error('interpreter log: more than one ROM fingerprint');
  if(all.length && !/^[a-fA-F0-9]{16}$/.test(all[0]))throw new Error('interpreter log: malformed ROM fingerprint');
  if(all.length && all[0].toLowerCase()!==fingerprint)throw new Error('interpreter log: ROM mismatch');
  let auditHash=null;
  if(options.auditText!=null){
    const audit=String(options.auditText);
    if(!/^FORJA65_NATIVE_DEPENDENCY_AUDIT 1\s*$/m.test(audit))throw new Error('interpreter audit: invalid schema');
    const matches=[...audit.matchAll(/^rom=([^\r\n]*)$/gm)].map(m=>m[1]);
    if(matches.length!==1||!/^[a-fA-F0-9]{16}$/.test(matches[0]))throw new Error('interpreter audit: invalid fingerprint');
    auditHash=matches[0].toLowerCase();
    if(auditHash!==fingerprint)throw new Error('interpreter audit: ROM mismatch');
  }
  if(structured&&!all.length&&!auditHash)throw new Error('interpreter log: structured report lacks ROM proof (supply matching --audit)');
  return {rom:fingerprint,source:all.length?'log':auditHash?'audit':'legacy-unverified'};
}

const hex6=v=>(v>>>0).toString(16).toUpperCase().padStart(6,'0');

function learn(rom,rows,hash){
  const accepted=[],rejected=[],classes={},sites=new Map();
  for(const r of rows){
    const why=validate(rom,r),c=classify(rom,r);
    const rec={target:hex6(r.target),state:(r.e?'E1':'')+'M'+r.m+'X'+r.x,from:hex6(r.from),count:r.count,classe:c.kind,origem:c.source};
    if(why){rejected.push({...rec,motivo:why});continue;}
    accepted.push(rec);classes[c.kind]=(classes[c.kind]||0)+1;
    const s=sites.get(rec.from)||{from:rec.from,origem:c.source,classe:c.kind,alvos:new Set(),execucoes:0};s.alvos.add(rec.target);s.execucoes+=r.count;sites.set(rec.from,s);
  }
  const hints=accepted.map(a=>`rom=${hash} target=${a.target.toLowerCase()} from=${a.from.toLowerCase()} kind=FLOW e=${a.state.startsWith('E1')?1:0} m=${a.state.includes('M1')?1:0} x=${a.state.includes('X1')?1:0} c=?`);
  // Tabelas: quantos vizinhos o expansor conservador do Forja propoe a partir de cada alvo observado.
  const tables=[];
  for(const s of sites.values())if(s.classe==='TABELA-INDEXADA'){
    const peers=new Set();for(const t of s.alvos){const h=C.parseRuntimeHints(`rom=${hash} target=${t.toLowerCase()} from=${s.from.toLowerCase()} kind=FLOW e=0 m=0 x=0 c=?`)[0];
      try{for(const p of C.expandRuntimeFlowTableHint(rom,h,24))peers.add(hex6(p));}catch(_){} }
    for(const t of s.alvos)peers.delete(t);
    tables.push({site:s.from,origem:s.origem,observados:[...s.alvos].sort(),vizinhos_recuperados:[...peers].sort()});
  }
  const siteList=[...sites.values()].map(s=>({from:s.from,origem:s.origem,classe:s.classe,alvos:s.alvos.size,execucoes:s.execucoes})).sort((a,b)=>b.alvos-a.alvos||b.execucoes-a.execucoes);
  return {accepted,rejected,classes,sites:siteList,tables,hintsText:hints.join('\n')+'\n'};
}

// ---------- integracao no port ----------
const ROW_RE=/^\{0x([0-9A-Fa-f]+)u,(true|false),(true|false),(true|false),(true|false),(true|false),&(sub_[0-9A-Za-z_]+),0x([0-9A-Fa-f]+)u\},$/;
const ALIAS_RE=/^\{0x([0-9A-Fa-f]+)u,0x([0-9A-Fa-f]+)u\},$/;
function arrayRange(text,name){
  const head=text.indexOf(name+'[]={');if(head<0)throw new Error('array '+name+' ausente');
  const start=text.indexOf('\n',head)+1,end=text.indexOf('\n};',start);return {start,end,lines:text.slice(start,end).split('\n')};
}
const rowKey=m=>[parseInt(m[1],16),m[2],m[3],m[4],m[5],m[6]].join('|');
function extractBodies(shards){
  const bodies=new Map(),re=/^void (sub_[0-9A-Za-z_]+)\(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc\) \{/mg;
  for(const text of shards){let m;re.lastIndex=0;while((m=re.exec(text))){
    let depth=0,end=-1;for(let i=m.index+m[0].length-1;i<text.length;i++){const ch=text[i];if(ch==='{')depth++;else if(ch==='}'){depth--;if(depth===0){end=i+1;break;}}}
    if(end<0)throw new Error('rotina sem fim: '+m[1]);bodies.set(m[1],text.slice(m.index,end));re.lastIndex=end;}}
  return bodies;
}
// REV138: o dispatch, o CMake e os shards aprendidos pertencem a uma unica
// operacao. Preparamos os bytes e backups antes de modificar qualquer arquivo.
// Um journal no proprio port possibilita restaurar a versao anterior se o
// processo for interrompido entre dois renames (e recupera na proxima rodada).
const TXN_DIR='.forja-learning-transaction';
function safeRelative(rel){
  if(typeof rel!=='string'||path.isAbsolute(rel)||rel.includes('\\')||rel.split('/').some(x=>!x||x==='.'||x==='..')||
     !(rel==='CMakeLists.txt'||rel==='src/dispatch.cpp'||/^src\/forja_learned_[A-Za-z0-9_-]+_[0-9]{3}\.cpp$/.test(rel)))
    throw new Error('transacao: caminho inseguro '+String(rel));
  return rel;
}
function recoverInterruptedTransaction(port){
  const txn=path.join(port,TXN_DIR),journal=path.join(txn,'journal.json');
  if(!fs.existsSync(txn))return false;
  // Impede que outro processo restaure uma transacao que ainda esta em andamento.
  const owner=path.join(txn,'owner.json');
  if(fs.existsSync(owner)){
    const data=JSON.parse(fs.readFileSync(owner,'utf8'));
    if(Number.isSafeInteger(data.pid)&&data.pid>0){
      let alive=false;
      try{process.kill(data.pid,0);alive=true;}catch(e){if(e.code==='EPERM')alive=true;else if(e.code!=='ESRCH')throw e;}
      if(alive)throw new Error('transacao: outro processo ainda esta integrando o port (PID '+data.pid+')');
    }
  }
  if(!fs.existsSync(journal)){
    // Sem journal nao houve a primeira alteracao: os arquivos foram apenas preparados.
    fs.rmSync(txn,{recursive:true,force:true});return true;
  }
  const state=JSON.parse(fs.readFileSync(journal,'utf8'));
  if(state.schema!=='forja65.learning-transaction.v1'||!Array.isArray(state.files))
    throw new Error('transacao: journal desconhecido, intervencao manual necessaria');
  // Validacao completa ANTES de restaurar: falhas nao podem provocar rollback parcial.
  const files=state.files.map((f,i)=>{
    safeRelative(f.rel);
    if(f.backup!==`backup-${i}`||typeof f.existed!=='boolean')throw new Error('transacao: journal invalido');
    const dst=path.join(port,f.rel),backup=path.join(txn,f.backup);
    if(f.existed&&!fs.existsSync(backup))throw new Error('transacao: backup ausente de '+f.rel);
    return {...f,dst,backup};
  });
  if(state.status!=='committed'){
    for(const f of files.slice().reverse()){
      if(f.existed)fs.copyFileSync(f.backup,f.dst);
      else if(fs.existsSync(f.dst))fs.unlinkSync(f.dst);
    }
  }
  fs.rmSync(txn,{recursive:true,force:true});
  return true;
}
function commitPortFiles(port,changes,options={}){
  if(!changes.length)return;
  const uniq=new Set();
  for(const change of changes){
    safeRelative(change.rel);
    if(uniq.has(change.rel))throw new Error('transacao: caminho duplicado '+change.rel);
    uniq.add(change.rel);
    const dest=path.join(port,change.rel);
    if(!fs.existsSync(path.dirname(dest)))throw new Error('transacao: pasta ausente '+change.rel);
    if(fs.existsSync(dest)&&fs.lstatSync(dest).isSymbolicLink())throw new Error('transacao: link simbolico recusado '+change.rel);
    if(change.newOnly&&fs.existsSync(dest))throw new Error('transacao: shard ja existe '+change.rel);
  }
  const txn=path.join(port,TXN_DIR);
  fs.mkdirSync(txn,{mode:0o700});
  fs.writeFileSync(path.join(txn,'owner.json'),JSON.stringify({pid:process.pid})+'\n',{flag:'wx'});
  let journalReady=false;
  try{
    const journal={schema:'forja65.learning-transaction.v1',status:'prepared',files:[]};
    for(let i=0;i<changes.length;i++){
      const change=changes[i],dst=path.join(port,change.rel),existed=fs.existsSync(dst);
      const backup=`backup-${i}`,stage=`stage-${i}`;
      if(existed)fs.copyFileSync(dst,path.join(txn,backup));
      fs.writeFileSync(path.join(txn,stage),change.content,{mode:existed?(fs.statSync(dst).mode&0o777):0o644,flag:'wx'});
      journal.files.push({rel:change.rel,existed,backup,stage});
    }
    fs.writeFileSync(path.join(txn,'journal.json'),JSON.stringify(journal,null,2)+'\n',{flag:'wx'});
    journalReady=true;
    for(let i=0;i<journal.files.length;i++){
      const f=journal.files[i];
      fs.renameSync(path.join(txn,f.stage),path.join(port,f.rel));
      // Apenas para testar rollback em uma falha entre dois commits.
      if(options.failAfter===i+1)throw new Error('transacao: falha injetada apos arquivo '+(i+1));
    }
    journal.status='committed';
    const marker=path.join(txn,'journal.next');
    fs.writeFileSync(marker,JSON.stringify(journal,null,2)+'\n');
    fs.renameSync(marker,path.join(txn,'journal.json'));
    fs.rmSync(txn,{recursive:true,force:true});
  }catch(err){
    if(journalReady){
      // A rotina de recuperacao recusa um dono ativo; nesta chamada o dono somos nos.
      fs.unlinkSync(path.join(txn,'owner.json'));
      try{recoverInterruptedTransaction(port);}catch(rollbackErr){
        throw new Error(err.message+'; ROLLBACK FALHOU: '+rollbackErr.message+' (manter '+txn+')');
      }
    }else{fs.rmSync(txn,{recursive:true,force:true});}
    throw err;
  }
}

// REV154: cross-version generator/runtime API gate. Run before the learning
// transaction: mixing REV143 AOT bodies with an older runtime otherwise emits
// C++ that cannot compile (8-parameter vs. 10-parameter CPU timing ABI).
function verifyCpuRuntimeAbi(port){
  const file=path.join(port,'src','runtime.hpp');
  if(!fs.existsSync(file))throw new Error('REV154 CPU ABI: runtime.hpp ausente');
  const source=fs.readFileSync(file,'utf8');
  const signatures=[...source.matchAll(/\bvoid\s+advanceCpuInstruction\s*\(([^)]*)\)/g)];
  const supported=signatures.some(m=>m[1].split(',').length>=10);
  if(!supported)throw new Error('REV154 CPU ABI: gerador exige advanceCpuInstruction(10 parametros); runtime oferece interface antiga. Integrar ponte de compatibilidade e revalidar timing ANTES do aprendizado');
  if(!/\b(?:static\s+)?(?:constexpr\s+)?bool\s+legacyInterruptTiming\s*\(/.test(source))
    throw new Error('REV154 CPU ABI: legacyInterruptTiming ausente no runtime do port');
  const isBridge=signatures.some(m=>m[1].split(',').length===8);
  if(isBridge&&!source.includes('FORJA65_CPU_TIMING_ABI_REV181'))
    throw new Error('REV181 CPU ABI: ponte 8/10 sem identificador de compatibilidade testado');
  return {advanceCpuInstruction:10,legacyInterruptTiming:true,legacyAdapter:isBridge};
}

function integrate(port,files,targets,tag,perFile,options={}){
  if(!/^[A-Za-z_][A-Za-z0-9_]{0,47}$/.test(tag))throw new Error('tag invalida (identificador C++: letras, numeros e _)');
  if(!Number.isSafeInteger(perFile)||perFile<1||perFile>500)throw new Error('perFile deve estar entre 1 e 500');
  recoverInterruptedTransaction(port);
  const dispFile=path.join(port,'src','dispatch.cpp'),cmakeFile=path.join(port,'CMakeLists.txt');
  let old=fs.readFileSync(dispFile,'utf8');const gen=files['src/dispatch.cpp'];
  if(old.includes('// Forja65 '+tag+': rotinas aprendidas'))throw new Error('port ja integrado com a tag '+tag);
  const oldRows=arrayRange(old,'kForja65Dispatch'),genRows=arrayRange(gen,'kForja65Dispatch');
  const have=new Set();for(const l of oldRows.lines){const m=l.match(ROW_RE);if(m)have.add(rowKey(m));}
  const parsed=genRows.lines.map(l=>l.match(ROW_RE)).filter(Boolean);
  const base=n=>n.replace(/_part\d+$/,'');
  // rotinas (com todas as partes) que cobrem um alvo aprendido ainda sem linha no port
  const wanted=new Set();
  for(const m of parsed){const pc=parseInt(m[1],16);if(targets.has(pc)&&!have.has(rowKey(m)))wanted.add(base(m[7]));}
  const suffix='_'+tag,ren=n=>n+suffix;
  const newRows=[],usedFns=new Set();
  for(const m of parsed){if(!wanted.has(base(m[7])))continue;if(have.has(rowKey(m)))continue;
    newRows.push(`{0x${m[1]}u,${m[2]},${m[3]},${m[4]},${m[5]},${m[6]},&${ren(m[7])},0x${m[8]}u},`);usedFns.add(m[7]);have.add(rowKey(m));}
  if(!newRows.length){const sr=mergeStackReturnOffsets(old,gen,options.stackReturnOffsets||[]);
    if(sr.added){commitPortFiles(port,[{rel:'src/dispatch.cpp',content:sr.text}],options);}
    return {rotinas:0,funcoes:0,linhas:0,aliases:0,arquivos:[],retornosPilha:sr.added};}
  verifyCpuRuntimeAbi(port); // falha fechada antes de modificar dispatch, CMake ou shards
  // partes da mesma rotina entram juntas (a transicao entre partes passa pelo dispatch)
  const genDecl=[...gen.matchAll(/^void (sub_[0-9A-Za-z_]+)\(CpuState&, SnesRuntime&, std::uint32_t entryPc=0x([0-9A-Fa-f]+)u\);$/mg)];
  for(const d of genDecl)if(wanted.has(base(d[1])))usedFns.add(d[1]);
  const bodies=extractBodies(Object.entries(files).filter(([k])=>/^src\/generated_\d+\.cpp$/.test(k)).map(([,v])=>v));
  const fnList=[...usedFns].sort();
  for(const f of fnList)if(!bodies.has(f))throw new Error('corpo gerado ausente: '+f);
  const nameRe=new RegExp('\\b('+fnList.map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\b','g');
  const decls=genDecl.filter(d=>usedFns.has(d[1])).map(d=>`void ${ren(d[1])}(CpuState&, SnesRuntime&, std::uint32_t entryPc=0x${d[2]}u);`);
  // aliases ROM->PC dos novos PCs
  const oldAl=arrayRange(old,'kForja65Aliases'),genAl=arrayRange(gen,'kForja65Aliases');
  const haveAl=new Set(oldAl.lines.filter(l=>ALIAS_RE.test(l)));const newPcs=new Set(newRows.map(r=>parseInt(r.slice(3,r.indexOf('u')),16)));
  const addAl=genAl.lines.filter(l=>{const m=l.match(ALIAS_RE);return m&&newPcs.has(parseInt(m[2],16))&&!haveAl.has(l);});
  const alKey=l=>{const m=l.match(ALIAS_RE);return [parseInt(m[1],16),parseInt(m[2],16)];};
  const mergedAl=[...oldAl.lines.filter(l=>ALIAS_RE.test(l)),...addAl].sort((a,b)=>{const x=alKey(a),y=alKey(b);return x[0]-y[0]||x[1]-y[1];});
  const pcOf=l=>parseInt(l.slice(3,l.indexOf('u')),16);
  const mergedRows=[...oldRows.lines.filter(l=>ROW_RE.test(l)),...newRows].map((l,i)=>[l,i]).sort((a,b)=>pcOf(a[0])-pcOf(b[0])||a[1]-b[1]).map(x=>x[0]);
  // reescreve dispatch.cpp: aliases, linhas e declaracoes
  let t=old.slice(0,oldAl.start)+mergedAl.join('\n')+old.slice(oldAl.end);
  const r2=arrayRange(t,'kForja65Dispatch');t=t.slice(0,r2.start)+mergedRows.join('\n')+t.slice(r2.end);
  const pos=t.indexOf('struct Forja65AliasEntry');if(pos<0)throw new Error('struct Forja65AliasEntry ausente');
  t=t.slice(0,pos)+`// Forja65 ${tag}: rotinas aprendidas com o interpretador de fallback (tools/learn-from-interpreter.js)\n`+decls.join('\n')+'\n'+t.slice(pos);
  // unidades novas
  const changes=[];
  const units=[];for(let i=0;i<fnList.length;i+=perFile){
    const name=`src/forja_learned_${tag}_${String(units.length).padStart(3,'0')}.cpp`;
    const code=fnList.slice(i,i+perFile).map(f=>bodies.get(f).replace(nameRe,x=>ren(x))).join('\n\n');
    changes.push({rel:name,content:'#include "generated.hpp"\n// Forja65 '+tag+': gerado de sementes aprendidas com o interpretador; nao editar.\n'+code+'\n',newOnly:true});units.push(name);}
  let cm=fs.readFileSync(cmakeFile,'utf8');const anchor='add_library(forja65_generated OBJECT ';if(cm.indexOf(anchor)<0)throw new Error('CMake sem forja65_generated');
  // registra nos DOIS ramos (observado e padrao); sem isso o ramo padrao falha no link
  {let from=0,out='';for(;;){const s=cm.indexOf(anchor,from);if(s<0){out+=cm.slice(from);break;}const e=cm.indexOf(')',s);out+=cm.slice(from,e)+' '+units.join(' ');from=e;}cm=out;}
  const sr2=mergeStackReturnOffsets(t,gen,options.stackReturnOffsets||[]);t=sr2.text;
  changes.push({rel:'src/dispatch.cpp',content:t});
  changes.push({rel:'CMakeLists.txt',content:cm});
  commitPortFiles(port,changes,options);
  return {rotinas:wanted.size,funcoes:fnList.length,linhas:newRows.length,aliases:addAl.length,arquivos:units};
}

// REV137: rejeitar mistura de ROMs antes de gerar qualquer saida ou modificar o port.
// O pacote gerado contem os bytes canonicos da ROM e um manifesto com o fingerprint
// esperado. Comparamos SHA-256 dos bytes completos, alem do fingerprint do manifesto.
function verifyPortRom(port,rom){
  const cart=path.join(port,'assets','cart-data.bin');
  const manifest=path.join(port,'forja65-build-manifest.txt');
  if(!fs.existsSync(cart))throw new Error('ROM/port identity: assets/cart-data.bin ausente; integracao recusada (fail closed)');
  if(!fs.existsSync(manifest))throw new Error('ROM/port identity: forja65-build-manifest.txt ausente; integracao recusada (fail closed)');
  const expected=Buffer.from(rom.data);
  const actual=fs.readFileSync(cart);
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const expectedSha=sha(expected),actualSha=sha(actual);
  if(actualSha!==expectedSha)throw new Error('ROM/port identity mismatch: cart-data.bin nao corresponde a ROM fornecida (SHA-256 diferente)');
  const content=fs.readFileSync(manifest,'utf8');
  const matches=[...content.matchAll(/^rom_fingerprint=([0-9a-fA-F]{16})\s*$/gm)];
  if(matches.length!==1)throw new Error('ROM/port identity: manifesto sem fingerprint unico valido');
  const expectedFNV=C.romFingerprint(rom);
  if(matches[0][1].toLowerCase()!==expectedFNV)throw new Error('ROM/port identity mismatch: fingerprint do manifesto nao corresponde a ROM fornecida');
  return {sha256:expectedSha,fnv1a64:expectedFNV};
}

function main(){
  const o=args(process.argv.slice(2));
  if(!o.rom||!o.log||!o.out){console.error('Uso: node tools/learn-from-interpreter.js --rom jogo.sfc --log forja65-cpu-interpreter.txt --out pasta [--port pasta-do-port] [--tag r135] [--budget 200000] [--vault]');process.exit(2);}
  const romBytes=fs.readFileSync(o.rom),rom=C.loadRom(new Uint8Array(romBytes),path.basename(o.rom)),hash=C.romFingerprint(rom);
  // Guarda obrigatoria ANTES de criar --out, gravar no cofre ou alterar o port.
  if(o.port)verifyPortRom(o.port,rom);
  const logText=fs.readFileSync(o.log,'utf8');
  const auditText=o.audit?fs.readFileSync(o.audit,'utf8'):null;
  const romEvidence=verifyLogRomIdentity(logText,rom,{auditText});
  const rows=parseLog(logText);
  // --stack-returns: lista (XXXXXX por linha) do observador FORJA65_STACK_RETURN_OBSERVE; vira semente M0X0 e entra na tabela de retornos
  const obsStack=[];
  if(o.stackReturns&&fs.existsSync(o.stackReturns)){for(const l of fs.readFileSync(o.stackReturns,'utf8').split(/\r?\n/)){if(/^[0-9A-Fa-f]{6}$/.test(l.trim())){const v=parseInt(l.trim(),16);obsStack.push(v);rows.push({target:v,e:0,m:0,x:0,from:v,count:1});}}}
  const L=learn(rom,rows,hash);fs.mkdirSync(o.out,{recursive:true});
  fs.writeFileSync(path.join(o.out,'forja65-learned-hints.txt'),'# Forja65 '+o.tag+': sementes aprendidas com o interpretador (rom='+hash+')\n'+L.hintsText);
  const report={schema:'forja65.interpreter-learning.v1',tag:o.tag,rom:{fnv1a64:hash,sha256:crypto.createHash('sha256').update(romBytes).digest('hex')},
    rom_evidence:romEvidence,
    log:{sha256:crypto.createHash('sha256').update(logText).digest('hex'),entradas:rows.length,execucoes:rows.reduce((n,r)=>n+r.count,0)},
    aceitas:L.accepted.length,rejeitadas:L.rejected.length,classes:L.classes,
    locais_de_despacho:L.sites.length,tabelas:L.tables,sites:L.sites,entradas:L.accepted,rejeitados:L.rejected};
  if(o.vault){const V=require('./knowledge-vault.js');report.cofre=V.instance(rom,romBytes).save({hints:L.hintsText,origin:'learn-from-interpreter '+o.tag});}
  if(o.port){
    const t0=Date.now(),a=C.analyze(rom,o.budget,C.parseRuntimeHints(L.hintsText));
    const targets=new Set(L.accepted.map(x=>parseInt(x.target,16)));
    for(const f of a.functions)if(/HINT|ORACLE-FLOW-TABLE/.test(String(f.entryName||'')))targets.add(f.start&0xFFFFFF);
    // Close only already decoded static calls. These are inferred dependencies,
    // not claims that every callee or branch was observed executing.
    const {staticCalleeClosure}=require('./static-callee-closure.js');
    const closure=staticCalleeClosure(a,[...targets],pc=>C.snesToRom(rom,pc));
    for(const target of closure.targets)targets.add(target);
    const files=C.generateProject(rom,a);
    report.analise={ms:Date.now()-t0,funcoes:a.functions.length,alvos_incluindo_tabelas:targets.size};
    report.analise.fecho_callees_estaticos={classificacao:'dependencias estaticas decodificadas; nao implica execucao observada',funcoes:closure.functions.length,arestas:closure.edges.length,alvos:closure.targets.length,nao_decodificados:closure.undecoded};
    // alvos observados como retorno por pilha sem frame nativo (RTS/RTL usado como salto) entram na tabela de retornos aceitos
    const stackOffs=[...new Set([...L.accepted.filter(x=>x.classe==='RETORNO-SEM-FRAME').map(x=>parseInt(x.target,16)),...obsStack].map(v=>C.snesToRom(rom,v)).filter(v=>v!==null))];
    report.integracao=integrate(o.port,files,targets,o.tag,o.perFile,{stackReturnOffsets:stackOffs});
  }
  fs.writeFileSync(path.join(o.out,'forja65-learned-report.json'),JSON.stringify(report,null,2)+'\n');
  const s=report;console.log(`entradas ${s.log.entradas} | aceitas ${s.aceitas} | rejeitadas ${s.rejeitadas} | locais ${s.locais_de_despacho} | classes ${JSON.stringify(s.classes)}`);
  if(s.integracao)console.log('integracao',JSON.stringify(s.integracao));
}
if(require.main===module)main();
module.exports={parseLog,classify,validate,learn,integrate,extractBodies,verifyPortRom,verifyLogRomIdentity,
  recoverInterruptedTransaction,commitPortFiles,verifyCpuRuntimeAbi};
