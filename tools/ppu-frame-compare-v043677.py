#!/usr/bin/env python3
"""Forja65 v0.4.36.77 frame diff (no dependencies).

Compare PNG (8-bit grayscale/RGB/indexed/gray-alpha/RGBA, noninterlaced) or
binary PPM P6 screenshots. Supports a single pair or directories of matched
names, emits deterministic JSON and RGB PPM heatmaps. No source is presumed to
be an independent emulator: reference provenance is explicitly recorded.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import sys
import zlib

PNG_SIGNATURE = b'\x89PNG\r\n\x1a\n'

class ImageError(ValueError):
    pass


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def ppm_tokens(blob, count):
    tokens = []
    i = 0
    while len(tokens) < count:
        while i < len(blob) and blob[i] in b' \r\n\t':
            i += 1
        if i < len(blob) and blob[i] == 35:  # #comment
            eol = blob.find(b'\n', i)
            i = len(blob) if eol < 0 else eol + 1
            continue
        if i >= len(blob):
            raise ImageError('truncated PPM header')
        start = i
        while i < len(blob) and blob[i] not in b' \r\n\t':
            i += 1
        tokens.append(blob[start:i])
    if i >= len(blob) or blob[i] not in b' \r\n\t':
        raise ImageError('PPM missing whitespace after maxval')
    # Skip exactly the required separator (CRLF is one separator).
    i += 2 if blob[i:i+2] == b'\r\n' else 1
    return tokens, i


def read_ppm(blob):
    parts, offset = ppm_tokens(blob, 4)
    if parts[0] != b'P6' or parts[3] != b'255':
        raise ImageError('only binary P6 maxval 255 supported')
    try:
        w, h = (int(x) for x in parts[1:3])
    except ValueError as exc:
        raise ImageError('invalid PPM dimensions') from exc
    validate_dims(w, h)
    pixels = blob[offset:]
    if len(pixels) != w*h*3:
        raise ImageError(f'PPM payload size mismatch: {len(pixels)} != {w*h*3}')
    return (w, h, pixels)


def validate_dims(w, h):
    if not (1 <= w <= 4096 and 1 <= h <= 4096 and w*h <= 8_388_608):
        raise ImageError('image dimensions invalid or too large')


def png_unfilter(data, w, h, channels, ctype, palette=None, transparent=None):
    stride = w*channels
    if len(data) != h*(stride+1):
        raise ImageError('invalid PNG decompressed scanline size')
    last = bytearray(stride)
    rgb = bytearray(w*h*3)
    p = 0
    out = 0
    for y in range(h):
        filter_type = data[p]
        p += 1
        row = bytearray(data[p:p+stride])
        p += stride
        if filter_type > 4:
            raise ImageError('unsupported PNG filter')
        for i in range(stride):
            a = row[i-channels] if i >= channels else 0
            b = last[i]
            c = last[i-channels] if i >= channels else 0
            if filter_type == 1:
                predictor = a
            elif filter_type == 2:
                predictor = b
            elif filter_type == 3:
                predictor = (a+b)//2
            elif filter_type == 4:
                x = a+b-c
                da, db, dc = abs(x-a), abs(x-b), abs(x-c)
                predictor = a if da <= db and da <= dc else b if db <= dc else c
            else:
                predictor = 0
            row[i] = (row[i]+predictor)&255
        for x in range(w):
            k = x*channels
            if ctype == 6:  # RGBA, composite transparent onto black
                alpha = row[k+3]
                rgb[out:out+3] = bytes((row[k+i]*alpha+127)//255 for i in range(3))
            elif ctype == 4:  # grayscale+alpha
                value = (row[k]*row[k+1]+127)//255
                rgb[out:out+3] = bytes((value,))*3
            elif ctype == 2:
                rgb[out:out+3] = row[k:k+3]
            elif ctype == 3:
                index = row[k]
                if palette is None or index*3+3 > len(palette):
                    raise ImageError('PNG palette index out of bounds')
                alpha = transparent[index] if transparent and index<len(transparent) else 255
                rgb[out:out+3] = bytes((palette[index*3+i]*alpha+127)//255 for i in range(3))
            else:
                rgb[out:out+3] = bytes([row[k]])*3
            out += 3
        last = row
    return bytes(rgb)


def read_png(blob):
    if not blob.startswith(PNG_SIGNATURE):
        raise ImageError('missing PNG signature')
    ptr=8
    image=b''
    palette=None
    transparent=None
    dims=None
    seen_ihdr=False
    seen_iend=False
    while ptr+12 <= len(blob):
        length=struct.unpack_from('>I',blob,ptr)[0]
        kind=blob[ptr+4:ptr+8]
        end=ptr+12+length
        if end>len(blob):
            raise ImageError('truncated PNG chunk')
        chunk=blob[ptr+8:ptr+8+length]
        checksum=struct.unpack_from('>I',blob,ptr+8+length)[0]
        if (zlib.crc32(kind+chunk)&0xffffffff)!=checksum:
            raise ImageError(f'bad PNG CRC for {kind!r}')
        ptr=end
        if kind==b'IHDR':
            if seen_ihdr or length!=13:
                raise ImageError('invalid PNG IHDR')
            seen_ihdr=True
            w,h,depth,ctype,compression,fmethod,interlace=struct.unpack('>IIBBBBB',chunk)
            validate_dims(w,h)
            if (depth,compression,fmethod,interlace)!=(8,0,0,0) or ctype not in (0,2,3,4,6):
                raise ImageError('PNG requires 8-bit noninterlaced grayscale/RGB/indexed/RGBA')
            dims=(w,h,ctype)
        elif kind==b'PLTE':
            palette=chunk
        elif kind==b'tRNS':
            transparent=chunk
        elif kind==b'IDAT':
            if not seen_ihdr:
                raise ImageError('PNG IDAT before IHDR')
            image+=chunk
            if len(image)>64_000_000:
                raise ImageError('PNG compressed data too large')
        elif kind==b'IEND':
            seen_iend=True
            break
    if not seen_iend or dims is None:
        raise ImageError('incomplete PNG')
    w,h,ctype=dims
    channels={0:1,2:3,3:1,4:2,6:4}[ctype]
    if ctype==3 and (not palette or len(palette)%3):
        raise ImageError('invalid PNG palette')
    try:
        d=zlib.decompressobj()
        limit=h*(w*channels+1)
        raw=d.decompress(image, limit+1)
        if len(raw)>limit or not d.eof or d.unused_data:
            raise ImageError('PNG inflated data size mismatch')
        raw+=d.flush()
    except zlib.error as exc:
        raise ImageError('invalid PNG zlib stream') from exc
    return (w,h,png_unfilter(raw,w,h,channels,ctype,palette if ctype==3 else None,transparent if ctype==3 else None))


def load_image(path):
    blob=path.read_bytes()
    ext=path.suffix.lower()
    if ext=='.ppm':
        w,h,rgb=read_ppm(blob)
    elif ext=='.png':
        w,h,rgb=read_png(blob)
    else:
        raise ImageError(f'unsupported extension: {ext} (use .ppm or .png)')
    return dict(width=w,height=h,rgb=rgb,sha256=sha256(blob),file=str(path))


def save_ppm(path,w,h,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(f'P6\n{w} {h}\n255\n'.encode('ascii')+data)


def parse_roi(text,w,h):
    if not text:
        return (0,0,w,h)
    try:
        x,y,rw,rh=(int(v) for v in text.split(','))
    except (ValueError,TypeError) as exc:
        raise ImageError('ROI must be x,y,width,height') from exc
    if rw<=0 or rh<=0 or x<0 or y<0 or x+rw>w or y+rh>h:
        raise ImageError('ROI outside image bounds')
    return x,y,rw,rh


def diff_pair(ref,actual,roi,threshold,max_samples):
    if (ref['width'],ref['height'])!=(actual['width'],actual['height']):
        raise ImageError(f'dimension mismatch: {ref["width"]}x{ref["height"]} != {actual["width"]}x{actual["height"]}')
    w,h=ref['width'],ref['height']
    x0,y0,rw,rh=parse_roi(roi,w,h)
    a,b=ref['rgb'],actual['rgb']
    changed=0
    max_channel=0
    sum_channels=0
    bbox=[w,h,-1,-1]
    hot_rows={}
    examples=[]
    heat=bytearray(w*h*3)
    for y in range(y0,y0+rh):
        for x in range(x0,x0+rw):
            k=(y*w+x)*3
            delta=(abs(a[k]-b[k]),abs(a[k+1]-b[k+1]),abs(a[k+2]-b[k+2]))
            mag=max(delta)
            max_channel=max(max_channel,mag)
            sum_channels+=sum(delta)
            if mag>threshold:
                changed+=1
                bbox[0]=min(bbox[0],x);bbox[1]=min(bbox[1],y)
                bbox[2]=max(bbox[2],x);bbox[3]=max(bbox[3],y)
                hot_rows[y]=hot_rows.get(y,0)+1
                heat[k:k+3]=bytes((255,min(255,mag*3),0))
                if len(examples)<max_samples:
                    examples.append(dict(x=x,y=y,expected=list(a[k:k+3]),actual=list(b[k:k+3]),max_delta=mag))
    return {
        'width':w,'height':h,'roi':list((x0,y0,rw,rh)),
        'pixels_compared':rw*rh,'different_pixels':changed,
        'different_fraction':round(changed/(rw*rh),9),
        'maximum_channel_difference':max_channel,
        'mean_absolute_channel_error':round(sum_channels/(rw*rh*3),6),
        'bounding_box':bbox if changed else None,
        'rows_most_affected':[{'y':y,'pixels':n} for y,n in sorted(hot_rows.items(),key=lambda it:(-it[1],it[0]))[:12]],
        'first_differences':examples,
    },bytes(heat)


def list_pairs(reference,actual):
    if reference.is_file() and actual.is_file():
        return [(reference.name,reference,actual)]
    if not reference.is_dir() or not actual.is_dir():
        raise ImageError('reference and actual must both be files or both be directories')
    def imgs(folder):
        images={}
        for p in folder.iterdir():
            if p.is_file() and p.suffix.lower() in ('.png','.ppm'):
                if p.stem in images:
                    raise ImageError(f'duplicate image stem {p.stem!r} in {folder}')
                images[p.stem]=p
        return images
    expected=imgs(reference)
    observed=imgs(actual)
    if not expected:
        raise ImageError('no reference images found')
    if set(expected)!=set(observed):
        raise ImageError(f'capture sets differ (missing: {sorted(set(expected)-set(observed))}, extra: {sorted(set(observed)-set(expected))})')
    return [(expected[name].name,expected[name],observed[name]) for name in sorted(expected)]


def run(args):
    if not (0<=args.threshold<=255 and 0<=args.max_samples<=100):
        raise ImageError('invalid threshold or max samples')
    pairs=list_pairs(args.reference,args.actual)
    reports={}
    total=0
    for name,ref_path,act_path in pairs:
        ref,act=load_image(ref_path),load_image(act_path)
        item,heat=diff_pair(ref,act,args.roi,args.threshold,args.max_samples)
        item.update(reference_sha256=ref['sha256'],actual_sha256=act['sha256'],reference_file=str(ref_path),actual_file=str(act_path))
        filename=Path(name).stem+'-heatmap.ppm'
        save_ppm(args.output_dir/filename,ref['width'],ref['height'],heat)
        item['heatmap']=filename
        reports[name]=item
        total+=item['different_pixels']
        print(f'{name}: {item["different_pixels"]}/{item["pixels_compared"]} pixels different')
    report={
        'schema':'forja65.ppu.frame_diff.v1',
        'image_normalization':'8-bit RGB, transparent PNG pixels composited onto black',
        'reference_origin':args.reference_origin,
        'independent_reference_verified':False,
        'notice':'Reference provenance is user-provided; this tool does not certify emulator or hardware accuracy.',
        'threshold_per_channel':args.threshold,
        'frames_compared':len(pairs),'total_different_pixels':total,
        'matched':total==0,
        'frames':reports,
    }
    args.output_dir.mkdir(parents=True,exist_ok=True)
    (args.output_dir/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    return 0 if total==0 else 1


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--reference',type=Path,required=True,help='PNG/PPM image or directory of reference frames')
    p.add_argument('--actual',type=Path,required=True,help='PNG/PPM image or matching directory of native frames')
    p.add_argument('--output-dir',type=Path,required=True)
    p.add_argument('--reference-origin',default='not-specified',help='Free-text provenance label (not independently verified)')
    p.add_argument('--roi',help='Optional rectangle x,y,width,height')
    p.add_argument('--threshold',type=int,default=0,help='Max allowable difference per color channel, 0-255')
    p.add_argument('--max-samples',type=int,default=16)
    args=p.parse_args()
    try:
        return run(args)
    except (ImageError,OSError) as exc:
        print('PPU_FRAME_DIFF_ERROR:',exc,file=sys.stderr)
        return 2


if __name__=='__main__':
    sys.exit(main())
