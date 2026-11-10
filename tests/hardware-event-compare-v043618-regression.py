import importlib.util,sys,json,hashlib,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('eventdiff',Path(__file__).resolve().parents[1]/'tools/compare-hardware-events.py');M=importlib.util.module_from_spec(spec);spec.loader.exec_module(M)
def reject(fn):
 try:fn()
 except ValueError:return
 raise AssertionError('invalid trace was accepted')
with tempfile.TemporaryDirectory() as folder:
 d=Path(folder);a=d/'a.jsonl';b=d/'b.jsonl'
 header={'kind':'header','schema':'forja65.events.v1','rom_sha256':'0'*64,'input_sha256':'1'*64,'source':{'name':'test','revision':'1'},'domains':['CPU','PPU']}
 events=[{'kind':'event','seq':0,'frame':0,'domain':'CPU','event':'instruction','state':{'pc':32768,'a':0x55ab,'n':False}}, {'kind':'event','seq':1,'frame':0,'domain':'PPU','event':'read','state':{'register':0x2139,'value':0x12,'vmadd':1}}]
 M.write_trace(a,header,events);M.write_trace(b,header,events);r=M.compare(a,b);assert r['status']=='MATCH' and not r['gameplay_verified'] and r['matched_events']==2
 bad=json.loads(json.dumps(events));bad[1]['state']['value']=0;M.write_trace(b,header,bad);r=M.compare(a,b);assert r['first_difference']['index']==1 and r['first_difference']['field']=='state.value' and r['suspected_location']['file']=='forja65-core.js'
 bad=json.loads(json.dumps(events));bad[0]['state']['n']=0;M.write_trace(b,header,bad);assert M.compare(a,b)['first_difference']['reason']=='different types'
 M.write_trace(b,{**header,'input_sha256':'2'*64},events);reject(lambda:M.compare(a,b))
 M.write_trace(b,header,events);items=b.read_text().splitlines();f=json.loads(items[-1]);f['dropped']=1;items[-1]=json.dumps(f);b.write_text('\n'.join(items));reject(lambda:M.compare(a,b))
 M.write_trace(b,header,events);b.write_text('\n'.join(b.read_text().splitlines()[:-1]));reject(lambda:M.compare(a,b))
 M.write_trace(b,header,[events[0],{**events[1],'seq':3}]);reject(lambda:M.compare(a,b))
 M.write_trace(b,{**header,'domains':['CPU','PPU','DSP']},events);reject(lambda:M.compare(a,b))
 csv=d/'native.csv';csv.write_text('# FORJA_TRACE 1 rom=0123456789abcdef\nseq,frame,routine,pc,kind,space,address,value,source\n0,0,32768,32768,instruction,CPU,32768,169,CPU\n1,0,32768,32770,read,PPU,8505,18,CPU\n# written=2 dropped=0\n')
 metadata={**header,'rom_fnv1a64':'0123456789abcdef'};M.normalize_forja(csv,metadata,b);h,e=M.read_trace(b);assert h['domains']==['CPU','PPU'] and e[1]['state']['address']==8505 and 'a' not in e[0]['state'];reject(lambda:M.normalize_forja(csv,{**metadata,'rom_fnv1a64':'bad'},b))
 (d/'rom.bin').write_bytes(b'ROM');(d/'replay.bin').write_bytes(b'INPUT')
 code='''import sys,json,hashlib
rom,inp,out=sys.argv[1:];h={'kind':'header','schema':'forja65.events.v1','rom_sha256':hashlib.sha256(open(rom,'rb').read()).hexdigest(),'input_sha256':hashlib.sha256(open(inp,'rb').read()).hexdigest(),'source':{'name':'adapter','revision':'1'},'domains':['CPU']};e={'kind':'event','seq':0,'frame':0,'domain':'CPU','event':'input','state':{'value':open(inp,'rb').read()[0]}};f={'kind':'footer','complete':True,'dropped':0,'events':1};open(out,'w').write('\\n'.join(json.dumps(x) for x in [h,e,f])+'\\n')'''
 run={'schema':'forja65.compare-run.v1','rom':'rom.bin','input':'replay.bin','reference':{'argv':[sys.executable,'-c',code,'{rom}','{input}','{trace}'],'trace':'ref.jsonl'},'candidate':{'argv':[sys.executable,'-c',code,'{rom}','{input}','{trace}'],'trace':'port.jsonl'}}
 config=d/'run.json';config.write_text(json.dumps(run));r=M.run_spec(config);assert r['status']=='MATCH' and all(v['returncode']==0 for v in r['runs'].values())
 run['candidate']['trace']='ref.jsonl';config.write_text(json.dumps(run));reject(lambda:M.run_spec(config))
print('HARDWARE_EVENT_COMPARE_V043618_PASS first_difference=1 truncation=rejected dropped=rejected missing_domain=rejected type_mismatch=1 replay_shared=1 forja_csv=normalized no_gameplay_claim=1')
