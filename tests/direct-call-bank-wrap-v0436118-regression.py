from pathlib import Path
import importlib.util
p=Path(__file__).resolve().parents[1]/'tools/audit-direct-call-dependencies.py'
s=importlib.util.spec_from_file_location('audit',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
rom=bytearray(0x400000);rom[0xFFFF]=0x22;rom[0:3]=bytes.fromhex('81 80 B6');rom[0x10000:0x10003]=bytes.fromhex('34 12 C0')
r=m.audit(rom,'',0xC0FFFF,'hirom')
assert r['direct_target']=='B68081',r
assert r['continuation']=='C00003',r
for mapper in ('hirom','lorom'):
 for a in (0x7E8000,0x7F8000,-1,0x1000000):
  try:m.offset_of(a,mapper)
  except ValueError:pass
  else:raise AssertionError(f'non-ROM CPU address accepted: {a:X} {mapper}')
print('DIRECT_CALL_BANK_WRAP_PASS: PB wrap, WRAM exclusion and 24-bit bounds')
# Full LoROM banks mirror the upper ROM window into their lower half.
assert m.offset_of(0xC00000,'lorom')==0x200000
rom=bytearray(0x400000);rom[0x207fff]=0x20;rom[0x200000:0x200002]=bytes.fromhex('34 92')
r=m.audit(rom,'',0xC0FFFF,'lorom');assert r['direct_target']=='C09234',r
assert r['instruction_bytes']=='20 34 92',r
for mapper in ('bad','exhirom'):
 try:m.offset_of(0x808000,mapper)
 except ValueError:pass
 else:raise AssertionError('unsupported mapper silently accepted')
print('DIRECT_CALL_LOROM_MIRRORS_PASS')
# With no cartridge SRAM metadata, these lower windows cannot certify ROM.
for bank in (0x70,0x7D,0xF0,0xFF):
 try:m.offset_of((bank<<16)|0x100,'lorom')
 except ValueError:pass
 else:raise AssertionError('SRAM-capable lower window certified as ROM')
rom=bytearray(0x400000);rom[0x200000:0x200004]=bytes.fromhex('22 00 00 70')
assert not m.audit(rom,'',0xC00000,'lorom')['target_rom_mapped']
print('DIRECT_CALL_SRAM_WINDOW_PASS')
