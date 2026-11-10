#!/usr/bin/env python3
"""Read-only structural probe of two full-WRAM replay series (generic SNES tool).

Requires identical pre-fork WRAM, same ROM QA, complete ordered 128-KiB snapshots.
An observed change in a record is not proof of board logic, collision or points.
"""
from __future__ import annotations
import argparse
from collections import Counter
import csv
import hashlib
import json
from pathlib import Path
import re

SCHEMA = 'forja65.wram.record-probe/1'
IMAGE_SIZE = 131072
COLUMNS = ['frame','file','pc','joy1','bytes']
FILE_RE = re.compile(r'wram-(\d{8,}).bin\Z')
QA_RE = re.compile(r'^([a-z][a-z0-9_]*)=(\S+)$', re.M)


def load(folder: Path):
    csv_path = folder/'snapshots.csv'
    with csv_path.open(newline='',encoding='utf-8-sig') as fd:
        reader = csv.DictReader(fd)
        if reader.fieldnames != COLUMNS:
            raise ValueError('unexpected manifest fields')
        data={}; prev=-1
        for row in reader:
            name=row['file']; m=FILE_RE.fullmatch(name)
            if m is None or not row['frame'].isdecimal() or int(row['frame'])!=int(m[1]):
                raise ValueError('invalid snapshot frame/name')
            frame=int(row['frame'])
            if frame<=prev or row['bytes']!=str(IMAGE_SIZE):
                raise ValueError('unordered frame or wrong declared size')
            blob=(folder/name).read_bytes()
            if len(blob)!=IMAGE_SIZE:
                raise ValueError(f'incomplete 128 KiB WRAM: {name}')
            data[frame]=blob;prev=frame
    if len(data)<3 or len(data)>64:
        raise ValueError('3..64 snapshots required')
    qa_text=(folder/'forja65-qa-status.txt').read_text(encoding='utf-8')
    qa=dict(QA_RE.findall(qa_text))
    if not qa.get('rom') or qa.get('runtime_started')!='PASS' or not qa.get('frames','').isdecimal():
        raise ValueError('missing or invalid QA fields')
    if int(qa['frames'])<=max(data):
        raise ValueError('QA frame count does not cover snapshots')
    return data,qa,hashlib.sha256(csv_path.read_bytes()).hexdigest()


def records(image:bytes, start:int, count:int, stride:int, tag_offset:int):
    # The initial 3 fields are modelled 16-bit words; tail bytes must also be
    # compared or changes at offsets >=6 would disappear silently.
    return [tuple(int.from_bytes(image[start+i*stride+pos:start+i*stride+pos+2],'little')
                  for pos in ([o for o in (0,2,4) if o != tag_offset]+[tag_offset]))
            +tuple(image[start+i*stride+6:start+(i+1)*stride]) for i in range(count)]


def analyze(baseline:Path,attack:Path,fork:int,start:int,count:int,stride:int=6,tag_offset:int=4):
    if not 0<fork or not 0<=start<IMAGE_SIZE or not 1<=count<=8192:
        raise ValueError('invalid fork/start/count')
    if not 6<=stride<=64 or tag_offset not in (0,2,4):
        raise ValueError('invalid record stride or tag offset')
    if start+count*stride>IMAGE_SIZE:
        raise ValueError('record range outside WRAM')
    b,qb,hb=load(baseline);a,qa,ha=load(attack)
    if sorted(a)!=sorted(b) or qa['rom']!=qb['rom']:
        raise ValueError('different snapshots or ROM')
    frames=sorted(a); prefix=[f for f in frames if f<fork]; post=[f for f in frames if f>=fork]
    if not prefix or not post:
        raise ValueError('snapshots must span fork')
    if any(a[f]!=b[f] for f in prefix):
        raise ValueError('full WRAM A/B prefix mismatch')
    initial=records(a[prefix[-1]],start,count,stride,tag_offset)
    # Search for an initial exact copy in another WRAM address. A matching source
    # is structural evidence, never automatically proof of a logical game board.
    initial_blob=a[prefix[-1]][start:start+count*stride]
    copy_candidates=[]
    search_start=0
    while len(copy_candidates)<16:
        match=a[prefix[-1]].find(initial_blob,search_start)
        if match<0:break
        if match!=start and (match+len(initial_blob)<=start or match>=start+len(initial_blob)):
            copy_candidates.append(match)
        search_start=match+1
    common,count_tag=Counter(r[2] for r in initial).most_common(1)[0]
    if count_tag<count*0.7 or len(set(initial))<4:
        raise ValueError('region has no strong repeated tag / enough distinct records')
    timeline=[]; first_different=None;first_changed_tag=None
    changed_addresses=set()
    for f in frames:
        br=records(b[f],start,count,stride,tag_offset)
        ar=records(a[f],start,count,stride,tag_offset)
        different=[i for i,(x,y) in enumerate(zip(br,ar)) if x!=y]
        different_tag=sum(ar[i][2]!=br[i][2] for i in different)
        if f>=fork and different and first_different is None:first_different=f
        if f>=fork and different_tag and first_changed_tag is None:first_changed_tag=f
        for i in different:
            base=start+stride*i
            for o in range(stride):
                if a[f][base+o]!=b[f][base+o]:changed_addresses.add(base+o)
        timeline.append({'frame':f,'changed_records_ab':len(different),
            'changed_tags_ab':different_tag,
            'attack_changed_from_pre':sum(x!=y for x,y in zip(ar,initial)),
            'baseline_changed_from_pre':sum(x!=y for x,y in zip(br,initial)),
            'attack_dominant_tag_count':sum(r[2]==common for r in ar),
            'baseline_dominant_tag_count':sum(r[2]==common for r in br),
            'example_record_indices':different[:12]})
    stable_sources=[]
    for off in copy_candidates:
        if all(img[off:off+count*stride]==initial_blob for img in list(a.values())+list(b.values())):
            stable_sources.append(f'{0x7e0000+off:06X}')
    # Observational tracing only: generate 1..256 addresses per pass.
    all_addresses=[f'{0x7e0000+offset:06X}' for offset in sorted(changed_addresses)]
    groups=[all_addresses[i:i+256] for i in range(0,len(all_addresses),256)]
    return {'schema':SCHEMA,'status':'STRUCTURED_INPUT_RESPONSE' if first_different is not None else 'NO_POST_FORK_DIFFERENCE',
      'rom':qa['rom'],'frames':frames,'fork_frame':fork,
      'record_layout':{'start':f'{0x7e0000+start:06X}','last_byte':f'{0x7e0000+start+count*stride-1:06X}',
          'records':count,'stride_bytes':stride,'tag_offset':tag_offset,
          'dominant_initial_tag':f'{common:04X}','dominant_initial_tag_records':count_tag,
          'initial_distinct_records':len(set(initial))},
      'pre_fork_full_wram_equal':True,
      'initial_exact_copy_locations':[f'{0x7e0000+o:06X}' for o in copy_candidates],
      'unchanged_copy_locations_in_all_snapshots':stable_sources,
      'timeline':timeline,'first_observed_changed_record_frame':first_different,
      'first_observed_changed_tag_frame':first_changed_tag,
      'changed_byte_addresses':len(all_addresses),
      'suggested_writer_filters':groups,
      'provenance':{'baseline_manifest_sha256':hb,'attack_manifest_sha256':ha,
          'baseline_images_sha256':hashlib.sha256(b''.join(b[f] for f in frames)).hexdigest(),
          'attack_images_sha256':hashlib.sha256(b''.join(a[f] for f in frames)).hexdigest()},
      'validated':{'recorded_ab_difference':first_different is not None,
           'board_cells':False,'collision':False,'score':False,'board_clear':False,'next_stage':False},
      'limitations':['Recorded 16-bit fields do not establish their game meaning.',
          'No writer PCs for this record region have been captured by this tool.',
          'First observed change may have occurred between sparse checkpoints.',
          'Full recorded replay does not clear the board or prove a transition.']}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--baseline',required=True,type=Path)
    p.add_argument('--attack',required=True,type=Path)
    p.add_argument('--fork',required=True,type=int)
    p.add_argument('--start',required=True,help='WRAM address hex, e.g. 7E1A98')
    p.add_argument('--records',required=True,type=int)
    p.add_argument('--stride',type=int,default=6)
    p.add_argument('--tag-offset',type=int,default=4)
    p.add_argument('--out',type=Path)
    args=p.parse_args()
    try:
        address=int(args.start.removeprefix('0x'),16)
        if not 0x7e0000<=address<=0x7fffff:raise ValueError('start must be canonical 7E/7F WRAM')
        result=analyze(args.baseline,args.attack,args.fork,address-0x7e0000,args.records,args.stride,args.tag_offset)
    except (ValueError,OSError,KeyError,TypeError) as e:p.error(str(e))
    data=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if args.out:
        args.out.parent.mkdir(parents=True,exist_ok=True)
        args.out.write_text(data,encoding='utf-8')
    print(json.dumps({'status':result['status'],'layout':result['record_layout'],
          'changed_addresses':result['changed_byte_addresses'],
          'first_change':result['first_observed_changed_record_frame'],
          'writer_filter_passes':len(result['suggested_writer_filters'])},indent=2))

if __name__=='__main__':main()
