#!/usr/bin/env python3
"""Import a reset-free SNES BK2 movie as a ROM-bound two-pad input trace."""
import argparse,hashlib,io,json,zipfile
from pathlib import Path
BUTTONS=['Up','Down','Left','Right','Select','Start','Y','B','X','A','L','R']
MASKS=[0x800,0x400,0x200,0x100,0x2000,0x1000,0x4000,0x8000,0x40,0x80,0x20,0x10]
def decode(data,rom_sha1):
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  header=dict(x.split(' ',1) for x in z.read('Header.txt').decode('utf-8-sig').splitlines() if ' ' in x)
  if header.get('Platform')!='SNES':raise ValueError('not a SNES movie')
  if header.get('SHA1','').lower()!=rom_sha1.lower():raise ValueError('movie/ROM SHA1 mismatch')
  if 'Savestate' in z.namelist() or 'SaveRAM' in z.namelist():raise ValueError('state-anchored movie not supported')
  lines=z.read('Input Log.txt').decode('utf-8-sig').splitlines()
 expected=['Reset','Power']+[f'P{pad} {b}' for pad in [1,2] for b in BUTTONS]
 keys=[x for x in lines if x.startswith('LogKey:')]
 if len(keys)!=1 or [x.lstrip('#') for x in keys[0][7:].split('|') if x]!=expected:raise ValueError('unexpected controller schema')
 rows=[]
 for line in lines:
  if not line.startswith('|'):continue
  parts=line.split('|')
  if len(parts)!=5 or parts[0] or parts[-1] or len(parts[1])!=2 or any(len(p)!=12 for p in parts[2:4]):raise ValueError('malformed input row')
  if parts[1]!='..':raise ValueError('reset/power events require explicit handling')
  rows.append(tuple(sum(bit for char,bit in zip(p,MASKS) if char!='.') for p in parts[2:4]))
 if not rows:raise ValueError('empty movie')
 return rows,{'author':header.get('Author',''),'rom_sha1':rom_sha1.lower(),'frames':len(rows),'movie_sha256':hashlib.sha256(data).hexdigest(),'core':header.get('Core','')}
def main():
 p=argparse.ArgumentParser();p.add_argument('movie');p.add_argument('rom');p.add_argument('output');p.add_argument('--source',default='');a=p.parse_args()
 data=Path(a.movie).read_bytes();rom=Path(a.rom).read_bytes();rows,meta=decode(data,hashlib.sha1(rom).hexdigest());h=1469598103934665603
 for b in rom:h=((h^b)*1099511628211)&0xffffffffffffffff
 lines=[f'# FORJA65_INPUT_TRACE 1 rom={h:016x}',f'# Author: {meta["author"]}; source: {a.source}'];previous=None
 for frame,mask in enumerate(rows+[(0,0)]):
  if mask!=previous:lines.append(f'frame={frame} joy1={mask[0]:04x} joy2={mask[1]:04x}');previous=mask
 out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text('\n'.join(lines)+'\n');meta.update(source=a.source,rom_fnv=f'{h:016x}',events=len(lines)-2,scope='Imported reference inputs only; not evidence of Forja completion');out.with_suffix('.json').write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta,indent=2))
if __name__=='__main__':main()
