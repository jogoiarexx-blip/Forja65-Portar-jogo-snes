// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const fs=require('fs');const vm=require('vm');const path=require('path');
const root=path.resolve(__dirname,'..');const src=fs.readFileSync(path.join(root,'forja65-core.js'),'utf8');const ctx={console,TextEncoder,TextDecoder};vm.createContext(ctx);vm.runInContext(src,ctx);const C=ctx.Forja65Core;
if(!C) throw new Error('Forja65Core ausente');
if(!/^(?:0\.3\.|0\.4\.)/.test(C.VERSION)) throw new Error('versao inesperada '+C.VERSION);
const rom=C.loadRom(C.makeSyntheticRom(),'hd-test.sfc');const a=C.analyze(rom);const files=C.generateProject(rom,a);const rt=files['src/runtime.hpp'];
for(const q of ['bestIntegerScale','fitClientToIntegerScale','SetStretchBltMode(dc,COLORONCOLOR)','FillRect(dc,&rc,black)','int sc=std::max(1,std::min(cw/(int)fbWidth,ch/(int)fbHeight))','int dw=(int)fbWidth*sc,dh=(int)fbHeight*sc','Integer HD']) if(!rt.includes(q)) throw new Error('runtime HD faltando: '+q);
if(/StretchDIBits\(dc,0,0,rc\.right,rc\.bottom/.test(rt)) throw new Error('stretch arbitrario antigo ainda presente');
if(!files['analysis.json'].includes('"integer_scale": true')) throw new Error('metadata integer_scale ausente');
console.log('HD_INTEGER_SCALE_V032_PASS');
