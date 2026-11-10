from pathlib import Path
import zipfile,hashlib,json,sys
jobs=[('work144','Forja65-REV144-TIMING-RETOMADA-FONTE.zip'),('final-fight3-rev143','Final-Fight-3-REV143-RETOMADA-FONTE.zip'),('final-fight3-rev144','Final-Fight-3-REV144-TIMING-FONTE.zip')]
results=[]
for folder,name in jobs:
 if len(sys.argv)>1 and folder not in sys.argv[1:]:continue
 root=Path(folder);rows=[]
 with zipfile.ZipFile(name,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
  for p in sorted(root.rglob('*')):
   if not p.is_file() or p.is_symlink():continue
   rel=p.relative_to(root)
   if any(x in ('build-linux','build-windows-cross','__pycache__','control','node_modules') or x.startswith('.') for x in rel.parts):continue
   if '.gch' in p.name or p.suffix in ('.o','.gch','.pyc','.wav','.ppm') or p.name in ('matrix-run.lock','MANIFEST-ENTREGA.sha256'):continue
   data=p.read_bytes();z.writestr(str(p),data);rows.append(hashlib.sha256(data).hexdigest()+'  '+str(p))
  z.writestr(folder+'/MANIFEST-ENTREGA.sha256','\n'.join(rows)+'\n')
 with zipfile.ZipFile(name) as z:
  assert z.testzip() is None
  for line in rows:
   sha,path=line.split('  ',1);assert hashlib.sha256(z.read(path)).hexdigest()==sha
 p=Path(name);result=dict(file=str(p.resolve()),files=len(rows),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest());results.append(result);print(json.dumps(result),flush=True)
Path('package-progress-results.json').write_text(json.dumps(results,indent=2)+'\n')
