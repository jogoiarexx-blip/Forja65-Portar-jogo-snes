'use strict';
const fs=require('node:fs'), os=require('node:os'), path=require('node:path'), cp=require('node:child_process'), assert=require('node:assert/strict');
const F=require(process.env.FORJA65_SOURCE_CORE||'../forja65-core');
const rom=F.loadRom(F.makeSyntheticRom(),'ppu-frame-compare-v043677.sfc');
const files=F.generateProject(rom,F.analyze(rom,128));
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'forja-ppu-frame-v77-'));
const tool=path.join(__dirname,'..','tools','ppu-frame-compare-v043677.py');
const py=process.env.PYTHON|| (process.platform==='win32'?'python':'python3');
let scenarios=0;
try{
  fs.writeFileSync(path.join(tmp,'runtime.hpp'),files['src/runtime.hpp']);
  fs.writeFileSync(path.join(tmp,'pcm_audio_output.hpp'),files['src/pcm_audio_output.hpp']);
  const cpp=path.join(__dirname,'fixtures','ppu_frame_pairs_v043677.cpp');
  for(const opt of (process.env.FORJA65_TEST_LEVELS||'-O0,-O2').split(',')){
    assert.ok(['-O0','-O1','-O2'].includes(opt));
    const exe=path.join(tmp,process.platform==='win32'?'fixture.exe':'fixture');
    cp.execFileSync(process.env.CXX||'g++',['-std=c++20',opt,...(process.env.FORJA65_TRACE_DISABLED==='1'?['-DFORJA65_ENABLE_TRACE=0']:[]),'-I'+tmp,cpp,'-o',exe],{timeout:120000,cwd:tmp});
    const root=path.join(tmp,'scenes');
    fs.rmSync(root,{recursive:true,force:true});
    const generated=cp.execFileSync(exe,[root],{encoding:'utf8',timeout:60000});
    assert.match(generated,/PPU_FRAME_PAIRS_V043677_PASS scenes=6/);
    const out=path.join(tmp,'diff');
    const args=[tool,'--reference',path.join(root,'reference'),'--actual',path.join(root,'actual'),'--output-dir',out,'--reference-origin','Forja65 static renderer, not an external emulator'];
    cp.execFileSync(py,args,{encoding:'utf8',timeout:30000});
    let report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
    assert.equal(report.frames_compared,6);
    assert.equal(report.total_different_pixels,0);
    assert.equal(report.matched,true);
    assert.equal(report.independent_reference_verified,false);
    // Deliberately corrupt a captured pixel in the first scene (same dimensions,
    // same format), then prove the comparator exits nonzero and pinpoints it.
    const capture=path.join(root,'actual','mode0_obj_priority.ppm');
    let buf=fs.readFileSync(capture); const sep=Buffer.from('255\n');
    const pos=buf.indexOf(sep)+sep.length;
    assert.ok(pos>sep.length);
    const x=21,y=41,w=256;
    const bad=pos+(y*w+x)*3;
    buf[bad]^=0xff;
    fs.writeFileSync(capture,buf);
    const result=cp.spawnSync(py,args,{encoding:'utf8',timeout:30000});
    assert.equal(result.status,1,result.stderr);
    report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));
    assert.equal(report.total_different_pixels,1);
    assert.deepEqual(report.frames['mode0_obj_priority.ppm'].bounding_box,[x,y,x,y]);
    fs.rmSync(root,{recursive:true,force:true});
    scenarios+=6;
    console.log(opt,`PPU_FRAME_COMPARE_V043677_PASS scenes=6 injected_mismatch=1`);
  }
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(`PPU_FRAME_COMPARE_V043677_ALL_PASS scenes=${scenarios}`);
