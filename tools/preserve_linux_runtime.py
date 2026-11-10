from pathlib import Path
import hashlib,json,zipfile,sys
v=int(sys.argv[1]);r=Path(f'final-fight3-rev{v}');paths=['build-linux/game','build-linux/game-reference','assets/cart-data.bin','src/runtime.hpp','replay-5000.trace','build-linux.py']
if v==144:paths+=['build-linux/game-cpu-aot-only','build-linux-native-only.py','verify_cpu_spc_matrix.py','matrix-spc147/summary.json','matrix-spc147/native-spc-native/4999.f65s','cpu-module-removed-spc147-5000/result.json','native-complete147-72064/result.json','native-complete147-72064/launch.json','native-complete147-72064/near-end.f65s','long-spc147-comparison.json']
else:paths+=['control_ff3_rev143.py','campaign-round5/round5.f65s','campaign-recovery145-live/frame-148509.f65s','checkpoint-192648-recovery/frame-192648.f65s','checkpoint-round5-clear/frame-249841.f65s','checkpoint-terrace/frame-291429.f65s','checkpoint-terrace/prefix-comparison.json','checkpoint-terrace-strict-load/result.json','campaign-recovery145-live/commands-canonical.jsonl','campaign-recovery145-live/commands-canonical.metadata.json','campaign-recovery145-live/commands.jsonl','checkpoint-192648-recovery/prefix-comparison.json']
paths=[x for x in paths if (r/x).is_file()]
info={'revision':v,'platform':'Linux x86_64','scope':'Headless validation; checkpoints specific to Linux/compiler/runtime ABI; never load REV143 checkpoints into REV144 or Windows','files':{x:hashlib.sha256((r/x).read_bytes()).hexdigest() for x in paths},'sources':{str(p.relative_to(r)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((r/'src').iterdir()) if p.suffix in ('.cpp','.h','.hpp')},'current_matrix':json.loads((r/'matrix-latest.json').read_text()) if (r/'matrix-latest.json').exists() else None,'long_validation':json.loads((r/'native-complete147-72064/result.json').read_text()) if (r/'native-complete147-72064/result.json').exists() else {'status':'RUNNING'},'build_cache':json.loads((r/'build-linux/build-cache.json').read_text()) if (r/'build-linux/build-cache.json').exists() else None}
(r/'runtime-info.json').write_text(json.dumps(info,indent=2)+'\n')
readme='Linux x86_64 / validacao headless. Os executaveis nao sao Windows. chmod +x build-linux/game* antes de executar. A pasta assets precisa estar no diretorio de trabalho. Consulte runtime-info.json para hashes exatos e evidencia. O game principal conserva fallback para rotas ainda nao cobertas. O binario game-cpu-aot-only, quando presente, foi linkado sem o modulo de interpretacao CPU e e experimental. Zero fallback em 5.000 frames nao certifica a campanha inteira.\n'
(r/'LEIA-ME-LINUX.md').write_text(readme)
paths+=['runtime-info.json','LEIA-ME-LINUX.md'];name=Path(f'Final-Fight-3-REV{v}-LINUX-VALIDACAO.zip');rows=[]
with zipfile.ZipFile(name,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for x in paths:
  p=r/x;data=p.read_bytes();z.writestr(str(p),data);rows.append(hashlib.sha256(data).hexdigest()+'  '+str(p))
 z.writestr(str(r)+'/MANIFEST.sha256','\n'.join(rows)+'\n')
with zipfile.ZipFile(name) as z:
 assert z.testzip() is None
 for line in rows:
  sha,p=line.split('  ',1);assert hashlib.sha256(z.read(p)).hexdigest()==sha
print(name,name.stat().st_size,hashlib.sha256(name.read_bytes()).hexdigest(),flush=True)
