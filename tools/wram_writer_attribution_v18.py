#!/usr/bin/env python3
"""Forja65 - audit-readonly correlator of WRAM candidates with actual writer PCs.

Never labels an address as score, collision, or stage purely from correlation.
"""
import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

HEAD = ('frame','address','old','new','writer_pc','bus','joy1','nmi')
SCHEMA = 'forja65.wram.writer-attribution/1'


def writer_log(path, cap=None, end=None):
    groups = defaultdict(list)
    size = 0
    latest = -1
    with Path(path).open(newline='', encoding='utf-8-sig') as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != list(HEAD):
            raise ValueError(f'{path}: invalid WRAM writer columns')
        for lineno, row in enumerate(reader, 2):
            try:
                frame = int(row['frame']); address = int(row['address'], 16)
                old = int(row['old']); new = int(row['new']); pc = int(row['writer_pc'], 16)
                joy = int(row['joy1']); nmi = int(row['nmi'])
                if frame < latest or frame < 0 or not (0x7e0000 <= address <= 0x7fffff):
                    raise ValueError('frame/address out of range or unordered')
                if not (0 <= old <= 255 and 0 <= new <= 255 and 0 <= pc <= 0xffffff and 0 <= joy <= 65535 and nmi >= 0):
                    raise ValueError('writer row value out of range')
                if row['bus'] not in ('bus','2180'):
                    raise ValueError('unknown writer bus')
                latest = frame
                groups[address].append((frame, old, new, pc, row['bus']))
                size += 1
            except (ValueError, TypeError, KeyError) as exc:
                raise ValueError(f'{path}:{lineno}: {exc}') from exc
    if size == 0:
        raise ValueError(f'{path}: no WRAM writes (missing trace or wrong filter)')
    if cap is not None and size >= cap and (end is None or latest <= end):
        raise ValueError(f'{path}: writer trace reached event cap ({cap}) inside window; evidence truncated')
    return groups, size


def load_candidate_report(path):
    data = json.loads(Path(path).read_text(encoding='utf-8'))
    if (data.get('schema') != 'forja65.wram.causality/1'
        or not data.get('pre_fork_equal') or not data.get('evidence_complete')
        or data.get('truncated_frame_count')):
        raise ValueError('WRAM candidate report lacks complete matched A/B evidence')
    fork = data['fork_frame']
    if not isinstance(fork, int) or fork < 1:
        raise ValueError('invalid fork')
    seen = set()
    for item in data['candidates']:
        address = int(item['address'], 16)
        if not 0x7e0000 <= address <= 0x7fffff or address in seen:
            raise ValueError('invalid/duplicate candidate')
        seen.add(address)
    return data


def attribute(candidate, base, attack, fork, start, end, limit=40):
    if not start <= fork <= end:
        raise ValueError('fork outside writer observation window')
    result = []
    for cand in candidate['candidates'][:limit]:
        address = int(cand['address'], 16)
        histories = {}
        for name, group in (('baseline',base),('attack',attack)):
            rows = [r for r in group.get(address, []) if start <= r[0] <= end]
            histories[name] = rows
        b, a = histories['baseline'], histories['attack']
        # pre-fork actual writer sequences should match exactly for a determinism claim.
        bp = [r for r in b if r[0] < fork]; ap = [r for r in a if r[0] < fork]
        if bp != ap:
            raise ValueError(f'pre-fork writer mismatch at {address:06X}')
        def counts(rows):
            pcs = Counter(f'{r[3]:06X}' for r in rows if r[1] != r[2] and r[0] >= fork)
            return dict(pcs.most_common(15))
        bpc, apc = counts(b), counts(a)
        bc, ac = len([r for r in b if r[0] >= fork]), len([r for r in a if r[0] >= fork])
        if not (b or a):
            continue
        result.append({
            'address':f'{address:06X}', 'candidate_changed_samples':cand['different_samples'],
            'first_different_frame':cand['first_different_frame'],
            'writes_after_fork':{'baseline':bc,'attack':ac},
            'actual_value_changes_after_fork':{
                'baseline':sum(r[1] != r[2] and r[0]>=fork for r in b),
                'attack':sum(r[1] != r[2] and r[0]>=fork for r in a)},
            'writer_pcs':{'baseline':bpc, 'attack':apc},
            'pc_only_in_attack':sorted(set(apc)-set(bpc)),
            'pc_only_in_baseline':sorted(set(bpc)-set(apc)),
            'first_attack_writes':[
                {'frame':r[0], 'old':r[1],'new':r[2],'pc':f'{r[3]:06X}', 'bus':r[4]}
                for r in a if r[0]>=fork][:6],
            'hypothesis_only': True,
        })
    return result


def build_report(candidates, baseline, attack, start, end, cap, limit):
    metadata = load_candidate_report(candidates)
    base, baseline_count = writer_log(baseline,cap,end)
    test, attack_count = writer_log(attack,cap,end)
    rows = attribute(metadata,base,test,metadata['fork_frame'],start,end,limit)
    return {'schema':SCHEMA,'fork_frame':metadata['fork_frame'],'window':[start,end],
        'writer_event_counts':{'baseline':baseline_count,'attack':attack_count},
        'addresses_with_actual_writer':len(rows),'candidate_count':metadata['candidate_count'],
        'addresses':rows,'validated':{'writer_pc_attribution':bool(rows),'collision':False,
            'score':False,'board_clear':False,'next_stage':False},
        'source_hashes_sha256':{name:hashlib.sha256(Path(path).read_bytes()).hexdigest()
          for name,path in (('candidates',candidates),('baseline',baseline),('attack',attack))},
        'warning':'PCs are actual writers, not proven game-rule handlers. Gameplay requires independent state/ROM oracle.'}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    for arg in ('candidates','baseline','attack'):
        p.add_argument('--'+arg,required=True,type=Path)
    p.add_argument('--start',type=int,default=2000)
    p.add_argument('--end',type=int,default=3000)
    p.add_argument('--cap',type=int,default=500000)
    p.add_argument('--limit',type=int,default=40)
    p.add_argument('--out',type=Path)
    args=p.parse_args()
    if args.limit<1 or args.cap<1:p.error('invalid limit or cap')
    try:r=build_report(args.candidates,args.baseline,args.attack,args.start,args.end,args.cap,args.limit)
    except (OSError,ValueError,KeyError,TypeError) as exc:p.error(str(exc))
    output=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    if args.out:
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(output,encoding='utf-8')
    print(json.dumps({'writer_event_counts':r['writer_event_counts'],'addresses_with_actual_writer':r['addresses_with_actual_writer'],'validated':r['validated']},indent=2))

if __name__=='__main__':main()
