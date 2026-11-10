#!/usr/bin/env python3
"""Compare normalized SNES events or run two explicit argv adapters on one ROM/replay.

This is an adapter contract, not an emulator. Only exported fields/domains are
compared; complete streams, identical ROM/input identities and zero drops are
required. Matching micro traces never establishes gameplay compatibility.
"""
import argparse, csv, hashlib, json, re, subprocess
from pathlib import Path
DOMAINS={'CPU','PPU','DMA','HDMA','SPC700','DSP','MEMORY','VIDEO','AUDIO','TIMING'}
SUSPECTS={'CPU':['CpuState','emitInstruction','generateVariantBody'], 'PPU':['PpuState::read','PpuState::updateVramReadBuffer','SnesRuntime::ppuPortRead'], 'DMA':['SnesRuntime::executeDma'], 'HDMA':['SnesRuntime::executeHdmaLine'], 'SPC700':['SPC700 interpreter','ApuBridge'], 'DSP':['SpcDsp'], 'MEMORY':['SnesRuntime::read','SnesRuntime::write8'], 'TIMING':['SnesRuntime::advanceCpuMasterCycles','serviceCpuInterrupt'], 'VIDEO':['PpuState::renderOutputSegment'], 'AUDIO':['SpcDsp','ApuBridge::tickDspMasterCycles']}

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read_trace(path):
    try:items=[json.loads(x) for x in Path(path).read_text().splitlines() if x.strip()]
    except (OSError,ValueError) as e:raise ValueError(f'{path}: unreadable trace: {e}') from e
    if len(items)<3:raise ValueError('trace must contain header, events and footer')
    if any(not isinstance(x,dict) for x in items):raise ValueError('trace records must be objects')
    header,footer=items[0],items[-1];events=items[1:-1]
    if header.get('kind')!='header' or header.get('schema')!='forja65.events.v1':raise ValueError('unsupported event trace schema')
    for field in ['rom_sha256','input_sha256']:
        if not re.fullmatch('[a-f0-9]{64}',str(header.get(field,''))):raise ValueError('missing/invalid '+field)
    if not isinstance(header.get('source'),dict) or not header['source'].get('name') or not header['source'].get('revision'):raise ValueError('reference/candidate provenance required')
    domains=header.get('domains')
    if not isinstance(domains,list) or not domains or any(not isinstance(d,str) for d in domains) or len(set(domains))!=len(domains) or not set(domains)<=DOMAINS:raise ValueError('invalid comparison domains')
    if footer.get('kind')!='footer' or footer.get('complete') is not True or footer.get('dropped')!=0 or type(footer.get('dropped')) is not int:raise ValueError('incomplete or dropped event trace')
    if type(footer.get('events')) is not int or footer['events']!=len(events):raise ValueError('footer event count mismatch')
    observed=set();last_frame=-1
    for n,event in enumerate(events):
        if event.get('kind')!='event' or type(event.get('seq')) is not int or event['seq']!=n:raise ValueError('invalid event sequence')
        if type(event.get('frame')) is not int or event['frame']<last_frame:raise ValueError('invalid/decreasing frame timeline')
        if not isinstance(event.get('domain'),str):raise ValueError('invalid event domain')
        last_frame=event['frame'];observed.add(event.get('domain'))
        if event.get('domain') not in domains or not isinstance(event.get('state'),dict) or not event['state'] or not isinstance(event.get('event'),str) or not event['event']:raise ValueError('invalid event state/domain')
    if observed!=set(domains):raise ValueError('declared domain was never measured')
    return header,events

def difference(a,b,path=''):
    if type(a) is not type(b):return {'field':path,'reference':a,'candidate':b,'reason':'different types'}
    if isinstance(a,dict):
        for key in sorted(set(a)|set(b)):
            name=path+'.'+key if path else key
            if key not in a or key not in b:return {'field':name,'reference':a.get(key),'candidate':b.get(key),'reason':'missing field'}
            found=difference(a[key],b[key],name)
            if found:return found
    elif isinstance(a,list):
        if len(a)!=len(b):return {'field':path,'reference':a,'candidate':b,'reason':'different lengths'}
        for n,(x,y) in enumerate(zip(a,b)):
            found=difference(x,y,f'{path}[{n}]')
            if found:return found
    elif a!=b:return {'field':path,'reference':a,'candidate':b,'reason':'different values'}
    return None

def compare(reference,candidate):
    a,ae=read_trace(reference);b,be=read_trace(candidate)
    for key in ['rom_sha256','input_sha256']:
        if a[key]!=b[key]:raise ValueError(key+' differs; same-ROM/input comparison is invalid')
    if set(a['domains'])!=set(b['domains']):raise ValueError('comparison domain coverage differs')
    fields={d:sorted({k for e in ae if e['domain']==d for k in e['state']}) for d in a['domains']}
    first=None;matched=0
    for n in range(max(len(ae),len(be))):
        if n>=len(ae) or n>=len(be):first={'index':n,'reason':'extra/missing event','reference':ae[n] if n<len(ae) else None,'candidate':be[n] if n<len(be) else None};break
        diff=difference(ae[n],be[n])
        if diff:first={'index':n,'domain':ae[n]['domain'],'frame':ae[n]['frame'],**diff};break
        matched+=1
    domain=(first or {}).get('domain');suspects=SUSPECTS.get(domain,[])
    return {'status':'DIVERGED' if first else 'MATCH','matched_events':matched,'reference_events':len(ae),'candidate_events':len(be),'first_difference':first,'measured_fields':fields,'sources':{'reference':a['source'],'candidate':b['source']},'suspected_location':{'file':'forja65-core.js','functions':suspects} if suspects else None,'cause_is_inference':bool(first),'gameplay_verified':False}

def write_trace(path,header,events):
    Path(path).write_text('\n'.join(json.dumps(v,separators=(',',':')) for v in [header,*events,{'kind':'footer','complete':True,'dropped':0,'events':len(events)}])+'\n')

def normalize_forja(csv_path,metadata,out):
    """Bridge existing ForjaTrace CSV without inventing CPU registers/PPU internals."""
    text=Path(csv_path).read_text();lines=text.splitlines()
    first=re.fullmatch(r'# FORJA_TRACE 1 rom=([A-Fa-f0-9]+)',lines[0] if lines else '')
    if not first or first[1].lower()!=str(metadata.get('rom_fnv1a64','')).lower():raise ValueError('Forja CSV ROM fingerprint mismatch')
    footer=re.fullmatch(r'# written=(\d+) dropped=(\d+)',lines[-1] if lines else '')
    if not footer or int(footer[2])!=0:raise ValueError('Forja CSV incomplete/dropped')
    rows=list(csv.DictReader(lines[1:-1]));required={'seq','frame','pc','kind','space','address','value','source'}
    if not rows or not required<=set(rows[0]):raise ValueError('missing Forja CSV columns/events')
    if int(footer[1])!=len(rows):raise ValueError('Forja CSV footer count mismatch')
    events=[];ignored=0
    for n,row in enumerate(rows):
        if int(row['seq'])!=n:raise ValueError('Forja CSV invalid sequence')
        if row['kind'] not in {'instruction','read','write'}:ignored+=1;continue
        domain='CPU' if row['kind']=='instruction' else 'DMA' if row['source']=='DMA' else 'HDMA' if row['source']=='HDMA' else 'PPU' if row['space'] in {'PPU','VRAM','CGRAM','OAM'} else 'SPC700' if row['space']=='APU' else 'MEMORY'
        state={key:int(row[key]) for key in ['pc','address','value']};state['space']=row['space']
        events.append({'kind':'event','seq':len(events),'frame':int(row['frame']),'domain':domain,'event':row['kind'],'state':state})
    if not events:raise ValueError('no comparable hardware events')
    header={'kind':'header','schema':'forja65.events.v1',**{k:metadata[k] for k in ['rom_sha256','input_sha256','source']},'domains':sorted({e['domain'] for e in events}),'ignored_diagnostic_events':ignored,'note':'No unexported registers, cycles, DSP state or hashes are inferred.'}
    write_trace(out,header,events);read_trace(out)
    return {'status':'NORMALIZED','events':len(events),'domains':header['domains'],'ignored_diagnostic_events':ignored}

def run_spec(spec_path):
    spec_path=Path(spec_path).resolve();spec=json.loads(spec_path.read_text())
    if spec.get('schema')!='forja65.compare-run.v1':raise ValueError('unsupported run spec')
    resolve=lambda p:(spec_path.parent/p).resolve()
    rom,input_path=resolve(spec['rom']),resolve(spec['input']);identity={'rom_sha256':digest(rom),'input_sha256':digest(input_path)}
    peers={k:spec[k] for k in ['reference','candidate']};traces={k:resolve(v['trace']) for k,v in peers.items()}
    if traces['reference']==traces['candidate']:raise ValueError('reference and candidate require separate trace files')
    runs={}
    for name,peer in peers.items():
        argv=peer.get('argv');trace=traces[name]
        if not isinstance(argv,list) or not argv or any(not isinstance(a,str) for a in argv):raise ValueError('argv must be a nonempty string array')
        args=[a.replace('{rom}',str(rom)).replace('{input}',str(input_path)).replace('{trace}',str(trace)) for a in argv]
        before=trace.stat().st_mtime_ns if trace.exists() else None
        r=subprocess.run(args,cwd=resolve(peer.get('cwd','.')),capture_output=True,text=True,timeout=peer.get('timeout_seconds',120))
        runs[name]={'argv':args,'returncode':r.returncode,'stdout':r.stdout[-4000:],'stderr':r.stderr[-4000:]}
        if r.returncode:raise ValueError(f'{name} adapter exited {r.returncode}: {r.stderr[-500:]}')
        if not trace.exists() or trace.stat().st_mtime_ns==before:raise ValueError(name+' did not produce a fresh trace')
        header,_=read_trace(trace)
        if any(header[k]!=v for k,v in identity.items()):raise ValueError(name+' did not record the actual ROM/replay digests')
    if identity!={'rom_sha256':digest(rom),'input_sha256':digest(input_path)}:raise ValueError('ROM/replay was changed during comparison')
    result=compare(traces['reference'],traces['candidate']);result['runs']=runs;return result

def main():
    p=argparse.ArgumentParser(description=__doc__);commands=p.add_subparsers(dest='command',required=True)
    c=commands.add_parser('compare');c.add_argument('reference');c.add_argument('candidate')
    c=commands.add_parser('run');c.add_argument('spec')
    c=commands.add_parser('normalize-forja');c.add_argument('csv');c.add_argument('metadata')
    for c in commands.choices.values():c.add_argument('--out',required=True)
    a=p.parse_args()
    try:
        if a.command=='compare':result=compare(a.reference,a.candidate)
        elif a.command=='run':result=run_spec(a.spec)
        else:result=normalize_forja(a.csv,json.loads(Path(a.metadata).read_text()),a.out);print(json.dumps(result));return
    except (ValueError,OSError,KeyError,subprocess.TimeoutExpired) as e:result={'status':'INVALID','error':str(e),'gameplay_verified':False}
    Path(a.out).parent.mkdir(parents=True,exist_ok=True);Path(a.out).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
    raise SystemExit(0 if result['status']=='MATCH' else 1 if result['status']=='DIVERGED' else 2)
if __name__=='__main__':main()
