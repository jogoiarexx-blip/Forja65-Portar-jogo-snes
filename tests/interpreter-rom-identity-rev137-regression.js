#!/usr/bin/env node
'use strict';
// REV137: aprendizado nunca pode contaminar o dispatch de outro port.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const cp=require('node:child_process');
const C=require('../forja65-core.js');
const L=require('../tools/learn-from-interpreter.js');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'forja-rev137-rom-identity-'));
try {
  const source=Buffer.from(C.makeSyntheticRom());
  const other=Buffer.from(source);other[0x1000]^=0x45;
  const srcRom=C.loadRom(source,'source.sfc');
  const portRom=C.loadRom(other,'other.sfc');
  assert.notEqual(C.romFingerprint(srcRom),C.romFingerprint(portRom));
  const port=path.join(dir,'port'),assets=path.join(port,'assets');fs.mkdirSync(assets,{recursive:true});
  const cart=path.join(assets,'cart-data.bin');
  const manifest=path.join(port,'forja65-build-manifest.txt');
  const sourcePath=path.join(dir,'source.sfc'),log=path.join(dir,'interp.txt'),out=path.join(dir,'learn');
  fs.writeFileSync(sourcePath,source);
  fs.writeFileSync(log,'009000 M0X0 from=00800A count=1\n');
  const setPort=rom=>{fs.writeFileSync(cart,Buffer.from(rom.data));fs.writeFileSync(manifest,'FORJA65_BUILD_MANIFEST 1\nrom_fingerprint='+C.romFingerprint(rom)+'\n');};
  const cli=()=>cp.spawnSync(process.execPath,[path.join(__dirname,'..','tools','learn-from-interpreter.js'),
    '--rom',sourcePath,'--log',log,'--out',out,'--port',port,'--budget','64'],{encoding:'utf8'});
  // Mismatch entre bytes completos das ROMs deve ser recusado antes de criar --out.
  setPort(portRom);
  assert.throws(()=>L.verifyPortRom(port,srcRom),/identity mismatch/);
  let p=cli();assert.notEqual(p.status,0,'ROM diferente foi aceita');
  assert.match(p.stderr,/ROM\/port identity mismatch/);
  assert(!fs.existsSync(out),'integracao invalida criou diretorio de saida');
  assert(!fs.existsSync(path.join(port,'src')),'integracao invalida criou src');
  // Mesmo asset, mas manifesto com hash de outra ROM: tambem recusar.
  setPort(srcRom);fs.writeFileSync(manifest,'rom_fingerprint='+C.romFingerprint(portRom)+'\n');
  assert.throws(()=>L.verifyPortRom(port,srcRom),/identity mismatch/);
  p=cli();assert.notEqual(p.status,0);assert(!fs.existsSync(out));
  // Falha fechada se faltarem metadados ou ROM do port.
  setPort(srcRom);fs.unlinkSync(manifest);
  assert.throws(()=>L.verifyPortRom(port,srcRom),/manifest/);
  setPort(srcRom);fs.unlinkSync(cart);
  assert.throws(()=>L.verifyPortRom(port,srcRom),/cart-data.bin ausente/);
  // Com ambos os fatores corretos, o aprendizado pode prosseguir.
  setPort(srcRom);
  assert.equal(L.verifyPortRom(port,srcRom).fnv1a64,C.romFingerprint(srcRom));
  console.log('interpreter-rom-identity-rev137: PASS (ROM errada, manifesto errado, faltantes e ROM valida)');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
