#!/usr/bin/env python3
"""Cross-project conservative evidence gate for SNES gameplay paths.

Compares same-frame captures from controlled replay branches. Pixel deltas are
observations, never proof of collision, score arithmetic or stage completion.
P6 PPM requires only stdlib; PNG additionally requires Pillow.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import wave

TRACE = re.compile(r'^frame=(\d+)\s+joy1=([0-9a-fA-F]{4})\s+joy2=([0-9a-fA-F]{4})$')


def read_image(file):
    file = Path(file)
    data = file.read_bytes()
    if data.startswith(b'P6'):
        m = re.match(rb'P6\s+(\d+)\s+(\d+)\s+255\s', data)
        if not m:
            raise ValueError('Invalid PPM P6 header')
        w, h = map(int, m.groups())
        rgb = data[m.end():]
        if not 0 < w <= 4096 or not 0 < h <= 4096 or len(rgb) != w * h * 3:
            raise ValueError('Invalid/truncated PPM raster')
    elif data.startswith(b'\x89PNG\r\n\x1a\n'):
        try:
            from PIL import Image
        except ImportError as exc:
            raise ValueError('PNG needs Pillow; use native PPM captures') from exc
        with Image.open(file) as im:
            im = im.convert('RGB')
            w, h = im.size
            rgb = im.tobytes()
    else:
        raise ValueError('Expected PNG or P6 PPM')
    return w, h, rgb


def trace_events(file):
    out = []
    for line_no, line in enumerate(Path(file).read_text(encoding='utf-8-sig').splitlines(), 1):
        s = line.split('#')[0].strip()
        if not s:
            continue
        m = TRACE.fullmatch(s)
        if not m:
            raise ValueError(f'Invalid trace line {line_no}')
        row = (int(m.group(1)), int(m.group(2), 16), int(m.group(3), 16))
        if out and row[0] <= out[-1][0]:
            raise ValueError('Trace frames must increase')
        out.append(row)
    if not out:
        raise ValueError('Empty trace')
    return out


def state_at(events, frame):
    state = (0, 0)
    for f, p1, p2 in events:
        if f > frame:
            break
        state = (p1, p2)
    return state


def validate_fork(base, variant, fork):
    a, b = trace_events(base), trace_events(variant)
    times = sorted({0, fork - 1} | {f for f, _, _ in a+b if f <= fork})
    if fork < 1 or any(state_at(a, t) != state_at(b, t) for t in times if t < fork):
        raise ValueError('Replay branches differ before fork')
    after = sorted({fork} | {f for f, _, _ in a+b if f >= fork})
    different = next((t for t in after if state_at(a, t) != state_at(b, t)), None)
    if different is None:
        raise ValueError('Replay branches never diverge')
    return {'fork': fork, 'first_different_input_frame': different,
            'identical_input_before_fork': True}


def diff_roi(a, b, rect, w, h):
    if len(rect) != 4 or any(type(n) is not int for n in rect):
        raise ValueError('Invalid ROI coordinates')
    x0,y0,x1,y1 = rect
    if not (0 <= x0 < x1 <= w and 0 <= y0 < y1 <= h):
        raise ValueError('ROI outside picture')
    count = 0
    for y in range(y0,y1):
        for x in range(x0,x1):
            k = (y*w+x)*3
            count += a[k:k+3] != b[k:k+3]
    return {'changed_pixels':count, 'total_pixels': (x1-x0)*(y1-y0),
            'change_fraction':round(count/((x1-x0)*(y1-y0)),6)}


def compare_audio(path_a, path_b):
    with wave.open(str(path_a),'rb') as a, wave.open(str(path_b),'rb') as b:
        pa = (a.getnchannels(),a.getsampwidth(),a.getframerate(),a.getnframes())
        pb = (b.getnchannels(),b.getsampwidth(),b.getframerate(),b.getnframes())
        if pa != pb or pa[0:3] != (2,2,32000):
            raise ValueError(f'Incompatible WAV formats {pa} vs {pb}')
        frame_bytes = pa[0]*pa[1]
        first = None
        processed = 0
        while processed < pa[3]:
            aa = a.readframes(min(8192, pa[3]-processed))
            bb = b.readframes(min(8192, pa[3]-processed))
            if aa != bb and first is None:
                first_byte = next(i for i,(x,y) in enumerate(zip(aa,bb)) if x != y)
                first = processed + first_byte//frame_bytes
            processed += len(aa)//frame_bytes
        return {'same_format':True,'different':first is not None,
                'first_different_second':None if first is None else round(first/pa[2],5),
                'audio_fidelity_proven':False}


def evaluate(base, variant, regions, base_trace=None, variant_trace=None,
             fork_frame=None, audio_base=None, audio_variant=None, pre_base=None, pre_variant=None):
    w,h,a = read_image(base)
    w2,h2,b = read_image(variant)
    if (w,h) != (w2,h2):
        raise ValueError('Captures have different dimensions')
    if (base_trace is None) != (variant_trace is None) or ((base_trace is None) != (fork_frame is None)):
        raise ValueError('Trace comparison requires base, variant and fork together')
    branch = validate_fork(base_trace,variant_trace,int(fork_frame)) if base_trace else None
    if bool(pre_base) != bool(pre_variant):
        raise ValueError('Before-fork capture requires both paths')
    if pre_base:
        psize_a,psize_b=read_image(pre_base),read_image(pre_variant)
        if psize_a != psize_b:
            raise ValueError('Replay captures already differ before fork')
    if (audio_base is None) != (audio_variant is None):
        raise ValueError('Audio comparison requires both WAVs')
    deltas={name:diff_roi(a,b,coords,w,h) for name,coords in regions.items()}
    audio=compare_audio(audio_base,audio_variant) if audio_base else None
    return {'schema':'forja65.gameplay.evidence/1', 'dimensions':[w,h],
            'source_sha256':{'base':hashlib.sha256(Path(base).read_bytes()).hexdigest(),
                             'variant':hashlib.sha256(Path(variant).read_bytes()).hexdigest()},
            'branch':branch,'pre_fork_capture_identical':True if pre_base else None,
            'roi_deltas':deltas,'audio':audio,
            'observations':{'board_visual_changed':deltas.get('board',{}).get('changed_pixels',0)>0,
                            'shooter_visual_changed':deltas.get('shooter',{}).get('changed_pixels',0)>0,
                            'score_visual_changed':deltas.get('score',{}).get('changed_pixels',0)>0},
            'gameplay_validation':{'projectile_fired':'not_independently_proven',
                  'bubble_collision':'not_independently_proven',
                  'group_removal':'not_independently_proven',
                  'scoring_correct':'not_independently_proven',
                  'stage_transition':'not_independently_proven',
                  'audio_fidelity':'not_independently_proven'},
            'warning':'Pixel and audio differences only establish A/B reactions, not rule correctness.'}


def main():
    p=argparse.ArgumentParser(description=__doc__)
    for key in ('base','variant','regions','output'):
        p.add_argument('--'+key, required=True)
    p.add_argument('--base-trace');p.add_argument('--variant-trace');p.add_argument('--fork-frame',type=int)
    p.add_argument('--audio-base');p.add_argument('--audio-variant')
    p.add_argument('--pre-base');p.add_argument('--pre-variant')
    args=p.parse_args()
    try:
        data=evaluate(args.base,args.variant,json.loads(args.regions),
                      args.base_trace,args.variant_trace,args.fork_frame,args.audio_base,args.audio_variant,
                      args.pre_base,args.pre_variant)
        out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True)
        out.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
        print('EVIDENCE_OK',json.dumps(data['observations']))
    except (OSError, ValueError, wave.Error) as exc:
        print('EVIDENCE_FAIL',exc,file=sys.stderr)
        return 2
    return 0

if __name__=='__main__':
    sys.exit(main())
