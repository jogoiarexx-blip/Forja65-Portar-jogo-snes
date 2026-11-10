#!/usr/bin/env python3
"""REV149: locate the first reproducible CPU/PPU divergence after a checkpoint.

Two candidate button sequences are replayed from the same fork checkpoint.
A fail-closed self-check repeats the baseline at the first differing point.
No memory or gameplay result is modified and difference alone is not a bug.
"""
import argparse, hashlib, json
from pathlib import Path
from datetime import datetime, timezone
from native_control_client_rev147 import PortEmu
from verify_fork_multi_rev148 import parse_sequence


def mask_at(sequence, index):
    if index < 0 or index >= sum(n for n,_ in sequence):
        raise IndexError(index)
    for n,mask in sequence:
        if index<n:return mask
        index-=n
    raise AssertionError('unreachable')


def clipped(sequence, length):
    """Return an exact-length playback prefix, preserving the input schedule."""
    if length < 0 or length > sum(n for n,_ in sequence):raise ValueError('bad prefix length')
    result=[]
    for n,mask in sequence:
        take=min(n,length)
        if take:result.append((take,mask))
        length-=take
        if not length:break
    return result


def same_length(a,b):
    return sum(n for n,_ in a)==sum(n for n,_ in b)


def probe(e, sequence, n, tag, out, initial_frame, screenshot):
    e.load('rev149-base')
    if e.frame()!=initial_frame:raise AssertionError('bad fork restored frame')
    for frames,mask in clipped(sequence,n):e.run(frames,mask)
    if e.frame()!=initial_frame+n:raise AssertionError('input frame scheduling error')
    wr=e.ram(0,0x20000)
    signature={'wram_sha256':hashlib.sha256(wr).hexdigest(),'frame':e.frame()}
    if screenshot:
        image=out/f'{tag}-{n}.ppm';e.shot(str(image));signature['fb_sha256']=hashlib.sha256(image.read_bytes()).hexdigest()
    return signature


def scan_first_disagreement(total, sampler, limit=1000):
    """Find earliest differing observed frame, including transient reconvergence.

    Binary search cannot establish earliest divergence when differences disappear
    at later frames. Exact scanning is opt-in and bounded to avoid indefinite
    native execution. `sampler(frame)` returns comparable state signatures.
    """
    if not isinstance(total,int) or total<0 or not isinstance(limit,int) or limit<1:
        raise ValueError('invalid scan length or limit')
    if total>limit:
        raise ValueError(f'exact scan needs {total} frame-pairs (limit={limit})')
    for frame in range(1,total+1):
        before,after=sampler(frame)
        if before!=after:return frame
    return None


def compare(game,assets,out,initial,baseline,variant,trace=None,screenshot=True,exact_scan=False,scan_limit=1000):
    if not same_length(baseline,variant):raise ValueError('sequences must have identical total frame length')
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    result={'schema':'forja65.first-divergence.rev149','generated_utc':datetime.now(timezone.utc).isoformat(),
       'initial_requested':initial,'baseline':baseline,'variant':variant,'bootstrap':'replay' if trace else 'idle',
       'total_frames':sum(n for n,_ in baseline),'status':'INCOMPLETE','first_difference_offset':None,
       'exact_scan_requested':exact_scan,'exact_scan_limit':scan_limit,
       'warning':'A reproducible difference does not by itself indicate a fault or better game progression.'}
    e=PortEmu(game=game,assets=assets)
    try:
        if trace:e.trace(trace,initial)
        else:e.run(initial,0)
        begin=e.frame();e.save('rev149-base');result['restored_frame']=begin
        probes=0
        def test(n):
            nonlocal probes
            a=probe(e,baseline,n,'base',out,begin,screenshot)
            b=probe(e,variant,n,'variant',out,begin,screenshot)
            probes+=1
            return a,b
        end=result['total_frames']
        if exact_scan:
            # Exhaustive scan is the only correct way to find transient
            # differences without assuming monotonic signatures.
            earliest=scan_first_disagreement(end,test,scan_limit)
            result['exact_frame_pairs_checked']=probes
            if earliest is None:
                result['status']='NO_DIVERGENCE_IN_WINDOW'
            else:
                a1,b1=test(earliest)
                a2,b2=test(earliest)
                result['status']='EXACT_TRANSIENT_DIVERGENCE' if a1==a2 and b1==b2 and a1!=b1 else 'NONDETERMINISTIC_CHECKPOINT'
                if result['status']=='EXACT_TRANSIENT_DIVERGENCE':
                    result['first_difference_offset']=earliest
                    result['first_difference_absolute_frame']=begin+earliest
                    result['first_a']=a1;result['first_b']=b1
            result['number_of_pair_probes']=probes
            return result
        a,b=test(end)
        if a==b:
            result['status']='NO_FINAL_DIVERGENCE';result['final_a']=a;result['final_b']=b
            result['warning']='No final difference, but transient divergence was not excluded. Use --exact-scan.'
        else:
            # Find earliest divergence. Input-state determinism assumes the
            # two programs have a shared prefix and a difference persists.
            lo,hi=0,end
            while lo+1<hi:
                mid=(lo+hi)//2
                x,y=test(mid)
                if x==y:lo=mid
                else:hi=mid
            cand=hi
            a1,b1=test(cand)
            a2=probe(e,baseline,cand,'baseline-repeat',out,begin,screenshot)
            b2=probe(e,variant,cand,'variant-repeat',out,begin,screenshot)
            if a1!=a2 or b1!=b2:
                result['status']='NONDETERMINISTIC_CHECKPOINT'
            else:
                result['status']='REPRODUCIBLE_DIVERGENCE';result['first_difference_offset']=cand
                result['first_difference_absolute_frame']=begin+cand
                result['previous_match_offset']=lo
                result['first_a']=a1;result['first_b']=b1
                # Hash divergence need not be monotonic if states reconverge;
                # report explicitly rather than claim mathematical proof.
                result['search_caveat']='binary search assumes differences remain observable after their first occurrence'
        result['number_of_pair_probes']=probes
        return result
    finally:
        e.close();(out/'first-divergence-report.json').write_text(json.dumps(result,indent=2)+'\n')

def main():
 p=argparse.ArgumentParser(description=__doc__)
 for field in ('game','assets','out'):p.add_argument('--'+field,required=True)
 p.add_argument('--initial',type=int,default=120)
 p.add_argument('--base',default='40:0x8000,60:0x8200')
 p.add_argument('--variant',default='40:0x8000,60:0x8000')
 p.add_argument('--trace');p.add_argument('--no-screenshot',action='store_true')
 p.add_argument('--exact-scan',action='store_true',help='scan every frame; detects reconvergent/transient differences')
 p.add_argument('--scan-limit',type=int,default=1000,help='maximum frames for exact scan')
 a=p.parse_args();base=parse_sequence(a.base);variant=parse_sequence(a.variant)
 if a.initial<1:p.error('initial frame must be positive')
 result=compare(a.game,a.assets,a.out,a.initial,base,variant,a.trace,not a.no_screenshot,a.exact_scan,a.scan_limit)
 print(json.dumps(result,indent=2));return 0 if result['status'] in ('NO_FINAL_DIVERGENCE','REPRODUCIBLE_DIVERGENCE','NO_DIVERGENCE_IN_WINDOW','EXACT_TRANSIENT_DIVERGENCE') else 3
if __name__=='__main__':raise SystemExit(main())
