#!/usr/bin/env python3
"""Import the two narrowly proven REV174 PPU fixes into a REV136 generated port.

This is NOT a wholesale runtime upgrade, nor a converter for V3 checkpoints.
All substitutions match complete legacy fragments; unknown templates fail closed.
The current REV174 generator already contains the corrected behavior.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path

FIXES = {
 "shared_horizontal_scroll_latch": (
  'std::uint8_t bgOfsByte{},m7Byte{},cgAddr{},cgSavedByte{};',
  'std::uint8_t bgOfsByte{},bgHofsByte{},m7Byte{},cgAddr{},cgSavedByte{};'),
 "scroll_register_write": (
  'void writeScroll(unsigned i,std::uint8_t v){if(i>=8)return;unsigned bg=i>>1;if((i&1u)==0)scrollX[bg]=(std::uint16_t)(((std::uint16_t)v<<8)|(bgOfsByte&~7u)|((scrollX[bg]>>8)&7u));else scrollY[bg]=(std::uint16_t)(((std::uint16_t)v<<8)|bgOfsByte);bgOfsByte=v;if(i<2){auto q=(std::uint16_t)(((std::uint16_t)v<<8)|m7Byte);if(i==0)m7Hofs=q;else m7Vofs=q;m7Byte=v;}}',
  'void writeScroll(unsigned i,std::uint8_t v){if(i>=8)return;unsigned bg=i>>1;if((i&1u)==0){scrollX[bg]=(std::uint16_t)(((std::uint16_t)v<<8)|(bgOfsByte&~7u)|(bgHofsByte&7u));bgHofsByte=v;}else scrollY[bg]=(std::uint16_t)(((std::uint16_t)v<<8)|bgOfsByte);bgOfsByte=v;if(i<2){auto q=(std::uint16_t)(((std::uint16_t)v<<8)|m7Byte);if(i==0)m7Hofs=q;else m7Vofs=q;m7Byte=v;}}'),
 "subscreen_backdrop": (
  'LayerPixel out{sub?fixed15():palette15(0),5,0,1,255,true};',
  'LayerPixel out{palette15(0),5,0,1,255,true};'),
}

def apply(source: str) -> tuple[str,list[str]]:
  # Reject PPU layouts which are not the exact historical template.
  if 'struct PpuState {' not in source or 'LayerPixel compose(' not in source:
    raise ValueError('Not a supported PPU runtime.hpp')
  result=source;changed=[]
  for label,(before,after) in FIXES.items():
    n_before=result.count(before);n_after=result.count(after)
    if n_before+n_after!=1:
      raise ValueError(f'Unsafe or unknown template at {label}: old={n_before}, new={n_after}')
    if n_before:
      result=result.replace(before,after,1);changed.append(label)
  return result,changed

def main() -> int:
  ap=argparse.ArgumentParser(description=__doc__)
  ap.add_argument('runtime',type=Path,help='Generated port src/runtime.hpp')
  ap.add_argument('--apply',action='store_true',help='Overwrite input after checks (default: dry run)')
  ap.add_argument('--output',type=Path,help='Write to a different path, keeping input intact')
  a=ap.parse_args()
  if a.apply and a.output:ap.error('Choose --apply or --output, not both')
  raw=a.runtime.read_bytes()
  original=raw.decode('utf-8')
  modified,changes=apply(original)
  if a.apply or a.output:
    dest=a.output or a.runtime
    dest.parent.mkdir(parents=True,exist_ok=True)
    # In-place is atomic; no input file is modified on validation failure.
    if dest == a.runtime:
      tmp=dest.with_suffix(dest.suffix+'.rev174-tmp')
      tmp.write_bytes(modified.encode('utf-8'))
      tmp.replace(dest)
    else:dest.write_text(modified,encoding='utf-8')
  print(json.dumps({'changes':changes,'changes_count':len(changes),
    'sha256_before':hashlib.sha256(raw).hexdigest(),
    'sha256_after':hashlib.sha256(modified.encode('utf-8')).hexdigest(),
    'written':bool(a.apply or a.output)},ensure_ascii=False,indent=2))
  return 0

if __name__=='__main__':raise SystemExit(main())
