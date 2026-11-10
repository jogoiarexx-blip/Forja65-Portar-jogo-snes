'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),os=require('os'),C=require('../forja65-core.js');
const root=path.resolve(__dirname,'..'),helper=fs.readFileSync(path.join(root,'tools/native_oracle_build.py'),'utf8');
const rom=C.loadRom(C.makeSyntheticRom(),'portable-oracle.sfc'),files=C.generateProject(rom,C.analyze(rom,64));
assert.strictEqual(files['tools/native_oracle_build.py'],helper,'browser/CLI exports must carry the same portable builder');
assert(files['docs/NATIVE-ORACLE-BUILD.txt'].includes('CMake'));
assert(files['forja65-build-manifest.txt'].includes('file=tools/native_oracle_build.py '));
// The standalone browser bundle must export the same tools without Node require.
const browser={TextEncoder,TextDecoder};vm.runInNewContext(fs.readFileSync(path.join(root,'forja65-core.js'),'utf8'),browser);
const BC=browser.Forja65Core,br=BC.loadRom(BC.makeSyntheticRom()),browserFiles=BC.generateProject(br,BC.analyze(br,64));
assert.strictEqual(browserFiles['tools/native_oracle_build.py'],helper);
assert.strictEqual(browserFiles['docs/NATIVE-ORACLE-BUILD.txt'],files['docs/NATIVE-ORACLE-BUILD.txt']);
const python=process.env.PYTHON|| (process.platform==='win32'?'python':'python3');
const result=cp.spawnSync(python,[path.join(root,'tests/tools/test_native_oracle_build.py')],{encoding:'utf8'});
assert.ifError(result.error);assert.strictEqual(result.status,0,result.stderr||result.stdout);
// Execute the actual exported helper: an invalid prebuilt must fail explicitly,
// even if compilation is also unavailable. This must never silently fall back.
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-exported-oracle-'));
try{
 const file=path.join(dir,'exported.py');fs.writeFileSync(file,files['tools/native_oracle_build.py']);
 const probe=cp.spawnSync(python,['-c',
  'import importlib.util, pathlib; s=importlib.util.spec_from_file_location("exported",'+JSON.stringify(file)+'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.load_native_library(pathlib.Path("unused"), [], [], prebuilt_env="FORJA_EXPORTED_MISSING")'],
  {encoding:'utf8',env:{...process.env,FORJA_EXPORTED_MISSING:path.join(dir,'missing-library'),CMAKE_COMMAND:'missing-cmake'}});
 assert.ifError(probe.error);assert.notStrictEqual(probe.status,0,'invalid exported prebuilt must fail');
 assert(probe.stderr.includes('pré-compilada inválida'),probe.stderr);
 assert(!probe.stderr.includes('CMake não encontrado'),'must not compile after invalid prebuilt');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
console.log('native-oracle-v0350-regression: OK browser_export=identical invalid_exported_prebuilt=rejected');
