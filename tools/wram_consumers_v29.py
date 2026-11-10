#!/usr/bin/env python3
"""Forja65 read/write WRAM crossfeed v2.9 (forensic evidence, not game logic).

Reads are observational and may include CPU, DMA or HDMA bus consumers.
CSVs lack an intra-frame order, therefore only a strictly earlier-frame write
can be linked to a read; matching values are compatibility, not causality.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
import csv
import hashlib
import json
from pathlib import Path

WRITE_COLUMNS={'frame','address','old','new','writer_pc','bus','joy1','nmi'}
READ_COLUMNS={'frame','address','value','reader_pc','via','joy1','nmi'}
SCHEMA='forja65.wram.consumer-crossfeed/1'

def load_csv(path:Path, columns:set[str], pc_column:str, value_column:str):
    if not path.is_file():raise ValueError(f'missing trace {path}')
    with path.open(newline='',encoding='utf-8') as fd:
        csv_reader=csv.DictReader(fd)
        if csv_reader.fieldnames is None or len(set(csv_reader.fieldnames))!=len(csv_reader.fieldnames) or set(csv_reader.fieldnames)!=columns:
            raise ValueError('invalid CSV headers')
        result=[];previous=-1
        for line,row in enumerate(csv_reader,2):
            if None in row or any(v is None for v in row.values()):raise ValueError(f'malformed row {line}')
            try:
                frame=int(row['frame']);address=int(row['address'],16)
                pc=int(row[pc_column],16);value=int(row[value_column]);joy=int(row['joy1']);nmi=int(row['nmi'])
                if any(not 0<=int(row[c])<=255 for c in (('old','new') if 'new' in row else ('value',))):raise ValueError()
            except (ValueError,TypeError) as e:raise ValueError(f'invalid numeric field line {line}') from e
            if not (0<=frame<100000000 and frame>=previous and 0x7E0000<=address<=0x7FFFFF and
                    0<=pc<=0xFFFFFF and 0<=joy<=65535 and 0<=nmi<100000000):
                raise ValueError(f'invalid address or chronological order line {line}')
            previous=frame
            result.append({'frame':frame,'address':f'{address:06X}','pc':f'{pc:06X}',
                           'value':value,'joy1':joy,'nmi':nmi,'via':row.get('via',row.get('bus',''))})
        if not result:raise ValueError('empty trace')
    return result

def analyze(writes:Path,reads:Path,first:int,last:int):
    if not 0<=first<=last:raise ValueError('invalid frame window')
    ws=load_csv(writes,WRITE_COLUMNS,'writer_pc','new')
    rs=load_csv(reads,READ_COLUMNS,'reader_pc','value')
    if any(not first<=e['frame']<=last for e in ws+rs):raise ValueError('trace outside declared window')
    by_addr=defaultdict(list)
    for w in ws:by_addr[w['address']].append(w)
    pairs=Counter();reader_count=Counter();writer_count=Counter();address_count=Counter()
    previous_frame_matches=0;unknown_prior=0;value_mismatch=0;same_frame_ambiguous=0
    for w in ws:writer_count[w['pc']]+=1
    for r in rs:
        reader_count[r['pc']]+=1;address_count[r['address']]+=1
        events=by_addr.get(r['address'],[])
        # CSV streams have no shared intra-frame sequence number. Any same-frame
        # write makes the read's producer ambiguous, even if an older writer exists.
        if any(e['frame']==r['frame'] for e in events):
            same_frame_ambiguous+=1
            continue
        previous=[e for e in events if e['frame']<r['frame']]
        if not previous:
            unknown_prior+=1
            continue
        last_writer=previous[-1]
        if last_writer['value']!=r['value']:
            # Incomplete or filtered writes, same-frame writes, or a later writer
            # can all cause disagreement. Never infer a producer from this case.
            value_mismatch+=1
            continue
        pairs[(r['address'],last_writer['pc'],r['pc'])]+=1
        previous_frame_matches+=1
    out={'schema':SCHEMA,'status':'READ_WRITER_CANDIDATES_NOT_CAUSAL_PROOF',
         'frame_window':[first,last],'write_events':len(ws),'read_events':len(rs),
         'read_pc_count':len(reader_count),'writer_pc_count':len(writer_count),
         'observed_addresses':len(address_count),'compatible_prior_frame_reads':previous_frame_matches,
         'same_frame_ambiguous':same_frame_ambiguous,'no_prior_writer':unknown_prior,
         'value_mismatch_or_incomplete_writes':value_mismatch,
         'top_reader_pcs':[{'pc':pc,'reads':n} for pc,n in reader_count.most_common(30)],
         'top_writer_pcs':[{'pc':pc,'writes':n} for pc,n in writer_count.most_common(30)],
         'address_reader_counts':[{'address':a,'reads':n} for a,n in address_count.most_common(64)],
         'compatible_pairs':[{'address':a,'writer_pc':w,'reader_pc':r,'matching_reads':n}
                             for (a,w,r),n in sorted(pairs.items(),key=lambda e:(-e[1],e[0]))[:100]],
         'input_sha256':{'writers':hashlib.sha256(writes.read_bytes()).hexdigest(),
                         'reads':hashlib.sha256(reads.read_bytes()).hexdigest()},
         'validated':{'read_observation':True,'write_observation':True,'board':False,
                      'collision':False,'score':False,'next_stage':False},
         'limitations':['CSVs are separate streams: intra-frame read/write order is unknown.',
                        'Read PC may reflect a DMA/HDMA service context; inspect via and CPU traces.',
                        'Value matches cannot prove dataflow; other untraced writes may intervene.',
                        'No label such as collision, score, or stage is assigned automatically.']}
    return out

def plan_from_writer_chain(chain:Path,limit:int=24,forced:tuple[str,...]=()):
    data=json.loads(chain.read_text(encoding='utf-8'))
    if data.get('status')!='PAIR_RECONCILED_WRITERS_ONLY' or not data.get('new_execution_validated'):
        raise ValueError('requires reconciled real v2.8 capture')
    attack=data['attack']['address_writer_pcs'];control=data['control']['address_writer_pcs']
    if not (set(attack)==set(control) and data.get('pre_fork_full_wram_equal')):
        raise ValueError('mismatched or nonidentical pre-fork evidence')
    weighted=[]
    for addr,pcs in attack.items():
        if not pcs:continue
        fire_writes=sum(pcs.values());base_writes=sum(control.get(addr,{}).values())
        extra=max(0,fire_writes-base_writes)
        # Observational triage only: no gameplay semantics, exclude proven
        # OAM buffers, known stack and saturation-heavy repeated writes.
        integer=int(addr,16)
        if 0x7E0112<=integer<=0x7E012B or 0x7E022E<=integer<=0x7E023D or 0x7E1000<=integer<=0x7E1FFF:continue
        weight=extra*2+min(fire_writes,100)-min(base_writes,100)
        weighted.append((weight,addr,fire_writes,base_writes))
    weighted.sort(key=lambda x:(-x[0],x[1]))
    forced=set(forced)
    if len(forced)>limit or any(len(a)!=6 or a[:2] not in ('7E','7F') or
                                any(c not in '0123456789ABCDEF' for c in a) for a in forced):
        raise ValueError('invalid forced addresses')
    # Forced addresses are caller-provided hypotheses, never inferred semantics.
    lookup={addr:(score,attack_writes,base_writes) for score,addr,attack_writes,base_writes in weighted}
    for addr in forced:
        if addr not in lookup:
            lookup[addr]=(0,sum(attack.get(addr,{}).values()),sum(control.get(addr,{}).values()))
    selected=[addr for score,addr,_,_ in weighted if addr not in forced][:limit-len(forced)]
    selected=sorted(forced)+selected
    choices=[{'address':addr,'attack_writes':lookup[addr][1],
              'baseline_writes':lookup[addr][2], 'triage_score':lookup[addr][0],
              'role':'UNIDENTIFIED','forced_by_caller':addr in forced} for addr in selected]
    return {'schema':'forja65.wram.consumer-plan/1','status':'PREPARED_NOT_EXECUTED',
            'source':str(chain.name),'count':len(choices),'targets':choices,
            'window':[2100,2999], 'environment':{
                'FORJA65_WRAM_READ_ADDRS':','.join(t['address'] for t in choices),
                'FORJA65_WRAM_READ_START':'2100','FORJA65_WRAM_READ_END':'2999',
                'FORJA65_WRAM_READ_MAX':'25000'},
            'limitations':['Ranked from writer traces, NOT from consumer observations.',
                           'This plan does not imply board, score, or collision evidence.']}

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--writers',type=Path);p.add_argument('--reads',type=Path)
    p.add_argument('--chain',type=Path);p.add_argument('--limit',type=int,default=24)
    p.add_argument('--force',default='',help='caller-provided comma-separated canonical addresses')
    p.add_argument('--start',type=int,default=2100);p.add_argument('--end',type=int,default=2999)
    p.add_argument('--out',required=True,type=Path)
    a=p.parse_args()
    if bool(a.chain)==bool(a.writers and a.reads):p.error('pass --chain OR both --writers and --reads')
    if not 1<=a.limit<=128:p.error('limit must be 1..128')
    try:result=plan_from_writer_chain(a.chain,a.limit,tuple(filter(None,a.force.split(',')))) if a.chain else analyze(a.writers,a.reads,a.start,a.end)
    except (OSError,ValueError,KeyError,TypeError,json.JSONDecodeError) as exc:p.error(str(exc))
    a.out.parent.mkdir(parents=True,exist_ok=True)
    a.out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'status':result['status'],'count':result.get('count'),'read_events':result.get('read_events')}))
if __name__=='__main__':main()
