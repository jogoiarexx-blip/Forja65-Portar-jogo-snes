#!/usr/bin/env python3
"""Forja65 REV135 replay coverage matrix: deterministic modes, controls and audio.

Validates real QA frame counts, trace inputs, framebuffer signatures, new PC states,
interpreter fallbacks and (optionally) audible PCM.  It DOES NOT declare game logic
correct without a reference/score/collision oracle. Standard library only.
"""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
import wave

QA_LINE = re.compile(r'^([A-Za-z][A-Za-z0-9_]*)=(.*)$')
TRACE_LINE = re.compile(r'^frame=(\d+)\s+joy1=([0-9a-fA-F]{4})\s+joy2=([0-9a-fA-F]{4})$')


def fields(path):
    if not path.exists():
        return {}
    return dict(m.groups() for line in path.read_text(errors='replace').splitlines()
                if (m := QA_LINE.fullmatch(line.strip())))


def validate_trace(path):
    events = []
    for lineno, line in enumerate(path.read_text(encoding='utf-8-sig').splitlines(), 1):
        line = line.split('#', 1)[0].strip()
        if not line:
            continue
        match = TRACE_LINE.fullmatch(line)
        if not match:
            raise ValueError(f'{path}:{lineno} malformed event')
        n = int(match.group(1))
        if events and n <= events[-1][0]:
            raise ValueError(f'{path}:{lineno} out-of-order or duplicate frame')
        events.append((n, int(match.group(2),16),int(match.group(3),16)))
    if not events:
        raise ValueError(f'{path}: empty trace')
    return events


def inspect_audio(folder,qa,requested):
    report = fields(folder / 'forja65-audio-report.txt')
    out = {'requested': bool(requested), 'report': report, 'wav_present': False,
           'pcm_observed': False, 'fidelity_confirmed': False}
    if not requested:
        return out
    wav = folder / 'forja65-native-audio.wav'
    if not wav.exists():
        return out
    try:
        with wave.open(str(wav),'rb') as wf:
            total = wf.getnframes()
            fmt=(wf.getnchannels(),wf.getsampwidth(),wf.getframerate())
            out.update(wav_present=True, frames=total, format=list(fmt),
                       sha256=hashlib.sha256(wav.read_bytes()).hexdigest())
    except (wave.Error,OSError,EOFError) as exc:
        out['wav_error']=str(exc)
        return out
    out['pcm_observed']=(fmt==(2,2,32000) and total>0 and
                         int(report.get('nonzero_frames','0'))>0 and
                         int(report.get('peak','0'))>0 and
                         int(report.get('wav_frames','0'))==total)
    return out


def collect_progress(path):
    if not path.is_file():
        return []
    with path.open(newline='') as f:
        rows=list(csv.DictReader(f))
    seen=set()
    for row in rows:
        fr=int(row['frame'])
        if fr in seen:
            raise ValueError(f'duplicate progress frame {fr} in {path}')
        seen.add(fr)
    return rows


def run_case(binary,cart,trace,folder,conf,timeout):
    folder.mkdir(parents=True,exist_ok=True)
    (folder/'assets').mkdir(exist_ok=True)
    shutil.copy2(cart,folder/'assets'/'cart-data.bin')
    shutil.copy2(trace,folder/'input.trace')
    env={k:v for k,v in os.environ.items() if not k.startswith('FORJA65_')}
    count=int(conf['frames']); capture=conf.get('captures',[])
    if any((not isinstance(x,int) or isinstance(x,bool) or x<1 or x>count) for x in capture):
        raise ValueError(f'bad capture frame in {conf["name"]}')
    env.update(FORJA65_HEADLESS='1',FORJA65_HEADLESS_FRAMES=str(count),
               FORJA65_CPU_INTERPRETER='1',FORJA65_INPUT_REPLAY=str((folder/'input.trace').resolve()),
               FORJA65_FRAME_PROGRESS_CSV=str((folder/'frame-progress.csv').resolve()),
               FORJA65_FRAME_PROGRESS_EVERY='10',FORJA65_SRAM_PATH=str((folder/'save.srm').resolve()))
    if capture:
        env.update(FORJA65_CAPTURE_FRAMES=','.join(map(str,sorted(set(capture)))),
                   FORJA65_CAPTURE_DIR=str((folder/'captures').resolve()),FORJA65_CAPTURE_STOP='0')
    if conf.get('audio'):
        env.update(FORJA65_AUDIO_DUMP='1',FORJA65_AUDIO_MODE='native')
    started=time.monotonic()
    try:
        result=subprocess.run([str(binary)],cwd=folder,env=env,stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT,timeout=timeout)
        rc=result.returncode; output=result.stdout.decode(errors='replace'); timed_out=False
    except subprocess.TimeoutExpired as exc:
        rc=None; timed_out=True; output=(exc.stdout or b'').decode(errors='replace')
    (folder/'replay.log').write_text(output)
    qa=fields(folder/'forja65-qa-status.txt'); progress=collect_progress(folder/'frame-progress.csv')
    seen_frames=int(qa.get('frames','-1'))
    captures={str(n): (folder/'captures'/f'frame-{n}'/'preview.ppm').is_file() for n in capture}
    interp=(folder/'forja65-cpu-interpreter.txt')
    fallback=interp.exists() and interp.stat().st_size>0
    audio=inspect_audio(folder,qa,conf.get('audio',False))
    match=rc==0 and not timed_out and qa.get('runtime_started')=='PASS' and seen_frames==count
    match=match and all(captures.values())
    traces=validate_trace(trace)
    # Input trace must be actually visible in progress CSV at selected sample frames.
    # Important: sampled every ten frames; short pulses may fall between samples,
    # so do not require a sampled hit for every pulse.
    observed_buttons=sorted({row.get('joy1') for row in progress if row.get('joy1') not in ('0','0000','')})
    return {'case':conf['name'],'pass':match,'frame_goal':count,'frames':seen_frames,
        'return_code':rc,'timeout':timed_out,'seconds':round(time.monotonic()-started,2),
        'rom_fingerprint':qa.get('rom'),'fallback_report_present':fallback,
        'qa':qa,'audio':audio,'captures_present':captures,'input_events':len(traces),
        'observed_joy1_samples':observed_buttons,
        'progress':{str(row['frame']):{'pc':row['pc'],'fb':row['fb_fnv1a64'],
                                     'instructions':row['instructions'], 'joy1':row.get('joy1')}
                    for row in progress},
        'logic_validation':{'collision':'not_proven','scoring':'not_proven',
                            'next_stage':'not_proven','audio_fidelity':'not_proven'}}


def read_ppm(path):
    data=path.read_bytes()
    if not data.startswith(b'P6\n'):raise ValueError(f'not P6 image: {path}')
    i=3; parts=[]
    while len(parts)<3:
        while i<len(data) and data[i] in b' \t\r\n':i+=1
        if i<len(data) and data[i]==35:
            while i<len(data) and data[i]!=10:i+=1
            continue
        e=i
        while i<len(data) and data[i] not in b' \t\r\n':i+=1
        if e==i:raise ValueError('incomplete PPM header')
        parts.append(int(data[e:i]))
    w,h,m=parts
    if w<=0 or h<=0 or w>8192 or h>8192 or m!=255 or i>=len(data) or data[i] not in b' \t\r\n':
        raise ValueError(f'invalid PPM dimensions: {path}')
    i+=2 if data[i:i+2]==b'\r\n' else 1
    rgb=data[i:]
    if len(rgb)!=w*h*3:raise ValueError(f'truncated PPM: {path}')
    return w,h,rgb


def region_differences(base,variant,regions):
    w,h,a=read_ppm(base);vw,vh,b=read_ppm(variant)
    if (w,h)!=(vw,vh):raise ValueError('different image sizes')
    results={}
    for key,rect in regions.items():
        if (not isinstance(rect,list) or len(rect)!=4 or
            any(not isinstance(v,int) for v in rect)):
            raise ValueError(f'invalid ROI {key}')
        x0,y0,x1,y1=rect
        if not (0<=x0<x1<=w and 0<=y0<y1<=h):raise ValueError(f'ROI outside frame: {key}')
        count=0
        for y in range(y0,y1):
            for x in range(x0,x1):
                k=(y*w+x)*3
                if a[k:k+3]!=b[k:k+3]:count+=1
        results[key]=count
    return results


def compare_cases(results,manifest,root=None):
    named={r['case']:r for r in results}
    output=[]
    for conf in manifest:
        other=conf.get('compare_to')
        if not other or other not in named or conf['name'] not in named:
            continue
        left=named[other]['progress']; right=named[conf['name']]['progress']
        common=sorted(set(left)&set(right),key=int)
        first=next((int(f) for f in common if left[f]['fb']!=right[f]['fb']),None)
        pc_changed=sum(left[f]['pc']!=right[f]['pc'] for f in common)
        fb_changed=sum(left[f]['fb']!=right[f]['fb'] for f in common)
        # Ensure the fork isn't already divergent BEFORE the new input pulse.
        fork=int(conf.get('fork_frame',0))
        identical_before=all(left[f]['fb']==right[f]['fb'] and left[f]['pc']==right[f]['pc']
                             for f in common if int(f)<fork)
        suffix_pcs={right[f]['pc'] for f in common if int(f)>=fork}
        baseline_pcs={left[f]['pc'] for f in common if int(f)>=fork}
        region_checks={}
        if root is not None and conf.get('regions'):
            for frame in sorted(set(conf.get('captures',[])) &
                                set(next((x.get('captures',[]) for x in manifest if x['name']==other),[]))):
                base=root/other/'captures'/f'frame-{frame}'/'preview.ppm'
                variant=root/conf['name']/'captures'/f'frame-{frame}'/'preview.ppm'
                if base.is_file() and variant.is_file():
                    region_checks[str(frame)]=region_differences(base,variant,conf['regions'])
        output.append({'baseline':other,'variant':conf['name'],'comparison_samples':len(common),
                       'region_different_pixels':region_checks,
                       'identical_before_fork':identical_before,'first_visual_divergence':first,
                       'visual_different_samples':fb_changed,'pc_different_samples':pc_changed,
                       'variant_only_sampled_pcs':sorted(suffix_pcs-baseline_pcs),
                       'claim':'visual and sampled CPU-path differential; not a collision or score oracle'})
    return output


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--manifest',type=Path,required=True)
    p.add_argument('--binary',type=Path)
    p.add_argument('--cart',type=Path)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--timeout',type=int,default=480)
    p.add_argument('--only',help='comma-separated scenario names')
    p.add_argument('--analyze-only',action='store_true')
    args=p.parse_args(argv)
    try:
        manifest_path=args.manifest.resolve();manifest=json.loads(manifest_path.read_text())
        if not isinstance(manifest,list):raise ValueError('manifest must contain a list')
        output=args.output.resolve();output.mkdir(parents=True,exist_ok=True)
        names=[x['name'] for x in manifest]
        if len(names)!=len(set(names)) or any(not re.fullmatch(r'[a-zA-Z0-9_-]{1,48}',n) for n in names):
            raise ValueError('invalid or duplicate case names')
        chosen=set(args.only.split(',')) if args.only else set(names)
        if chosen-set(names):raise ValueError('unknown case in --only')
        binary=args.binary.resolve() if args.binary else None
        cart=args.cart.resolve() if args.cart else None
        if not args.analyze_only and (not binary or not binary.is_file() or not cart or not cart.is_file()):
            raise ValueError('real --binary and --cart required')
        results=[]
        for conf in manifest:
            if conf['name'] not in chosen:continue
            trace=(manifest_path.parent/conf['trace']).resolve()
            if not trace.is_file():raise ValueError(f'no trace: {trace}')
            validate_trace(trace)
            path=output/conf['name'];path.mkdir(parents=True,exist_ok=True)
            if args.analyze_only:
                original=path/'result.json'
                if not original.is_file():raise ValueError(f'no result: {original}')
                result=json.loads(original.read_text())
            else:
                print('RUN',conf['name'],conf['frames'],flush=True)
                result=run_case(binary,cart,trace,path,conf,args.timeout)
                (path/'result.json').write_text(json.dumps(result,indent=2)+'\n')
            results.append(result)
            print('RESULT',result['case'], 'PASS' if result['pass'] else 'FAIL',
                  'frames',result['frames'],'fallback',result['fallback_report_present'],flush=True)
        comparisons=compare_cases(results,manifest,output)
        summary={'schema':'forja65.rev135.coverage-matrix/1',
                 'case_results':[{k:v for k,v in x.items() if k not in ('progress','qa')}
                                 for x in results], 'comparisons':comparisons,
                 'passed':all(x['pass'] for x in results),
                 'scope':'behavioral observation only: collision, scoring, transitions and audio fidelity require independent proof'}
        (output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
        for comparison in comparisons:
            print('DIFF',comparison['variant'],'vs',comparison['baseline'],
                  'visual',comparison['visual_different_samples'],
                  'first',comparison['first_visual_divergence'],flush=True)
        return 0 if summary['passed'] else 1
    except (OSError,ValueError,KeyError,TypeError,json.JSONDecodeError) as exc:
        print('COVERAGE_MATRIX_ERROR:',exc,file=sys.stderr)
        return 2

if __name__=='__main__':sys.exit(main())
