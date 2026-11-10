const assert=require('assert'),fs=require('fs'),path=require('path'),cp=require('child_process');
const script=path.resolve(__dirname,'../tools/checkpoint-audit.py');
assert(fs.existsSync(script),'missing generic checkpoint auditor');
cp.execFileSync('python3',['-c',`
import importlib.util
s=importlib.util.spec_from_file_location('audit',${JSON.stringify(script)})
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
q='runtime_started=PASS\\nframes=900\\n'
r=m.classify_run(0,q,900,True)
assert r['execution_passed'] and r['capture_present']
assert r['first_stage_complete'] is None, 'frame budget must never imply stage completion'
assert not m.classify_run(0,q,1000,True)['execution_passed']
assert not m.classify_run(2,q,900,True)['execution_passed']
assert not m.classify_run(0,'runtime_started=FAIL\\nframes=900\\n',900,True)['execution_passed']
assert not m.classify_run(0,q,900,False)['capture_present']
assert m.parse_frames('900,60,900') == [60,900]
for text in ['0','-1','abc','60,,90']:
    try: m.parse_frames(text)
    except ValueError: pass
    else: raise AssertionError(text)
`],{stdio:'inherit'});
console.log('checkpoint-audit-regression: OK');
