#!/usr/bin/env node
'use strict';
/* ROM-bound, read-only audit of historical and fresh CFG failure logs.
 * Observations are leads, not proof that a native port executes correctly. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const C=require('../forja65-core');
const HINT='forja65-runtime-hints.txt',TARGET='forja65-unresolved-targets.txt',RETURN='forja65-unresolved-returns.txt';
const ADDRESS=/^([0-9a-f]{1,6})\s*->\s*([0-9a-f]{1,6})(?:\s|$)/i;
const HEX=/^[0-9a-f]{16}$/i;
const hex=n=>(n>>>0).toString(16).padStart(6,'0');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const key=(rom,from,to)=>[rom||'UNBOUND',hex(from),hex(to)].join(':');
function collectFiles(roots,{maxFiles=10000,maxBytes=2*1024*1024}={}){
  const allowed=new Set([HINT,TARGET,RETURN]);const found=[],seen=new Set();
  function visit(dir){
    const rp=fs.realpathSync(dir);if(seen.has(rp))return;seen.add(rp);
    for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
      const dest=path.join(dir,item.name);
      if(item.isSymbolicLink())continue; // never follow symlinks outside selected roots
      if(item.isDirectory()){visit(dest);continue;}
      if(!item.isFile()||!allowed.has(item.name))continue;
      if(found.length>=maxFiles)throw Error('too many log files (limit '+maxFiles+')');
      const size=fs.statSync(dest).size;if(size>maxBytes)throw Error('log file exceeds '+maxBytes+' bytes: '+dest);
      found.push({path:dest,dir,kind:item.name,bytes:fs.readFileSync(dest)});
    }
  }
  for(const root of roots){const st=fs.statSync(root);if(st.isDirectory())visit(root);else if(st.isFile()){
    if(!allowed.has(path.basename(root)))throw Error('unexpected log filename: '+root);
    found.push({path:root,dir:path.dirname(root),kind:path.basename(root),bytes:fs.readFileSync(root)});
  }else throw Error('unreadable input: '+root);}
  return found.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
function audit(files,{romHash='',root=null}={}){
  if(romHash&&!HEX.test(romHash))throw Error('invalid ROM fingerprint');
  romHash=romHash.toLowerCase();
  const byRun=new Map(),runs=[],violations=[],totals={files:files.length,hints_valid:0,hints_malformed:0,hints_hash_mismatch:0,hints_unbound:0,raw_flows:0,raw_returns:0,corroborated_flows:0,corroborated_returns:0,ambiguous_multi_rom_events:0};
  for(const f of files){
    const run=byRun.get(f.dir)||{folder:root?path.relative(root,f.dir):f.dir,files:[],hints:[],foreignHints:[],raw:[],malformed:[]};
    byRun.set(f.dir,run);
    run.files.push({name:f.kind,sha256:sha(f.bytes),bytes:f.bytes.length});
    const content=f.bytes.toString('utf8');
    if(f.kind===HINT){
      const p=C.parseRuntimeHintsDetailed(content);
      for(const h of p.hints){
        if(h.rom&&romHash&&h.rom!==romHash){totals.hints_hash_mismatch++;run.foreignHints.push(h);continue;}
        if(!h.rom){totals.hints_unbound++;continue;} // not attributable to a ROM; never corroborate
        run.hints.push(h);totals.hints_valid++;
      }
      run.malformed.push(...p.rejected);
      totals.hints_malformed+=p.rejected.length;
    }else{
      let line=0;for(const src of content.split(/\r?\n/)){
        line++;if(!src.trim())continue;
        const m=src.match(ADDRESS);
        if(!m){violations.push({folder:run.folder,file:f.kind,line,reason:'malformed-raw-event'});continue;}
        const from=parseInt(m[1],16),target=parseInt(m[2],16);
        const kind=f.kind===TARGET?'FLOW':'RETURN';
        run.raw.push({kind,from,target,line,file:f.kind});
        totals[kind==='FLOW'?'raw_flows':'raw_returns']++;
      }
    }
  }
  const sites=new Map();let ambiguous=0;
  for(const run of [...byRun.values()].sort((a,b)=>a.folder.localeCompare(b.folder,'en'))){
    const rawSeen=new Set();
    for(const entry of run.raw){
      const possible=[...run.hints,...run.foreignHints].filter(h=>h.from===entry.from&&h.target===entry.target&&(entry.kind==='FLOW'?String(h.kind).toUpperCase()==='FLOW':/(RTS|RTL|RETURN)/i.test(h.kind)));
      const bound=possible.filter(h=>!romHash||h.rom===romHash);
      // The raw -> target log contains NO cartridge fingerprint. When
      // two ROM identities claim the same raw event in one folder, an
      // --rom filter alone cannot establish which ROM produced the event.
      const eventKey=entry.kind+'|'+hex(entry.from)+'|'+hex(entry.target);
      if(rawSeen.has(eventKey))continue;rawSeen.add(eventKey);
      const conflictingRoms=new Set(possible.map(h=>h.rom));
      const ambiguousRom=conflictingRoms.size>1;
      if(ambiguousRom)totals.ambiguous_multi_rom_events++;
      const matched=bound.length>0&&!ambiguousRom;
      const recKey=entry.kind+'|'+(matched?bound[0].rom:'UNVERIFIED')+'|'+hex(entry.from)+'|'+hex(entry.target);
      const rec=sites.get(recKey)||{type:entry.kind,rom:matched?bound[0].rom:null,from:hex(entry.from),target:hex(entry.target),runs:[],corroborated:false,evidence:'historical-log-only'};
      rec.runs.push({folder:run.folder,corroborated:matched});rec.corroborated ||=matched;
      sites.set(recKey,rec);
      if(matched)totals[entry.kind==='FLOW'?'corroborated_flows':'corroborated_returns']++;
    }
    const rawPairs=new Set(run.raw.map(x=>x.kind+'|'+hex(x.from)+'|'+hex(x.target)));
    const unmatched=run.hints.filter(h=>!rawPairs.has((/RTS|RTL|RETURN/i.test(h.kind)?'RETURN':'FLOW')+'|'+hex(h.from??0)+'|'+hex(h.target)));
    ambiguous+=unmatched.length;
    runs.push({folder:run.folder,files:run.files,valid_bound_hints:run.hints.length,rejected_hints:run.malformed.length,raw_events:run.raw.length,unmatched_hints:unmatched.length});
  }
  const sitesSorted=[...sites.values()].sort((a,b)=>a.type.localeCompare(b.type)||a.from.localeCompare(b.from)||a.target.localeCompare(b.target)||String(a.rom).localeCompare(String(b.rom)));
  return {schema:'forja65.cfg.evidence_audit.v1',forja_version:C.VERSION,rom_filter:romHash||null,source_type:'historical_runtime_logs',gameplay_validated:false,hardware_equivalence_proven:false,dynamic_domain_complete:false,totals:{...totals,sites:sitesSorted.length,sites_corroborated:sitesSorted.filter(x=>x.corroborated).length,unmatched_bound_hints:ambiguous},runs,sites:sitesSorted,violations,warning:'Counted sites are observations, not the universe of executable indirect targets. Without a ROM, no generated-code or gameplay coverage percentage can be claimed.'};
}
function renderMarkdown(result){
  const t=result.totals;
  return ['# Forja65 — auditoria de evidencias CFG','','- Proveniencia: logs historicos locais; nenhum jogo foi executado por esta ferramenta.',
    '- ROM filtro: `'+(result.rom_filter||'nao fornecida')+'`','- Arquivos: '+t.files+'; execucoes/pastas: '+result.runs.length,
    '- Hints com ROM declarada e valida: '+t.hints_valid+'; sem ROM (nao corroboram): '+t.hints_unbound,
    '- Hints rejeitados: '+t.hints_malformed+'; hash divergente: '+t.hints_hash_mismatch,
    '- Eventos de ROM ambigua: '+t.ambiguous_multi_rom_events+' (nao corroborados)',
    '- Eventos FLOW: '+t.raw_flows+'; pareados na mesma pasta: '+t.corroborated_flows,
    '- Eventos RTS/RTL: '+t.raw_returns+'; pareados na mesma pasta: '+t.corroborated_returns,
    '- Destinos distintos observados: '+t.sites+'; corroborados: '+t.sites_corroborated,
    '', '| Tipo | Origem | Destino | ROM declarada | Pastas | Evidencia pareada |',
    '| --- | --- | --- | --- | ---: | --- |',
    ...result.sites.map(x=>`| ${x.type} | \`${x.from}\` | \`${x.target}\` | \`${x.rom||'NAO VERIFICADA'}\` | ${x.runs.length} | ${x.corroborated?'sim':'nao'} |`),
    '', '**Limitacao:** nenhum percentual de destinos resolvidos nem gameplay aprovado pode ser inferido destes registros.', ''].join('\n');
}
function main(argv){
  const roots=[],opts={};let out=null,md=null,rom=null;
  for(let i=0;i<argv.length;i++){
    const a=argv[i];if(a==='--input')roots.push(path.resolve(argv[++i]||''));
    else if(a==='--json')out=path.resolve(argv[++i]||'');
    else if(a==='--md')md=path.resolve(argv[++i]||'');
    else if(a==='--rom')rom=path.resolve(argv[++i]||'');
    else throw Error('unknown argument '+a);
  }
  if(!roots.length)throw Error('usage: node tools/cfg-evidence-audit-v043688.js --input <logs-folder> [--rom cartridge.sfc] [--json report.json] [--md report.md]');
  if(rom)opts.romHash=C.romFingerprint(C.loadRom(fs.readFileSync(rom),path.basename(rom)));
  const report=audit(collectFiles(roots),opts);
  if(out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
  if(md){fs.mkdirSync(path.dirname(md),{recursive:true});fs.writeFileSync(md,renderMarkdown(report));}
  process.stdout.write(JSON.stringify({rom_filter:report.rom_filter,totals:report.totals,runs:report.runs.length},null,2)+'\n');
}
if(require.main===module){try{main(process.argv.slice(2));}catch(e){console.error('CFG evidence audit failed: '+e.message);process.exitCode=2;}}
module.exports={audit,collectFiles,renderMarkdown,main};
