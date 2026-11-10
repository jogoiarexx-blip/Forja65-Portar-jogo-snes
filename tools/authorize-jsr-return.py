#!/usr/bin/env python3
"""ROM-verify a direct 65C816 JSR's return site and register it as a safe
redirected native return, without relaxing the general stack-return guard.

This only authorizes `JSR abs` (opcode 0x20), whose return address is PC+3.
It does not authorize indirect JSR, stack-crafted returns or arbitrary targets.
"""
import argparse
import bisect
import hashlib
import json
import re
from pathlib import Path

ADDRESS = re.compile(r'^[0-9a-fA-F]{6}$')
RETURNS = re.compile(r'(static const std::uint32_t kForja65StackReturnOffsets\[\]=\{)([^}]*)(\};)')
HEX = re.compile(r'0x([0-9a-fA-F]{6})u')
ALIASES = re.compile(r'(static const Forja65AliasEntry kForja65Aliases\[\]=\{)([^}]*?(?:\}[^;])*?)(\};)', re.S)
ALIAS_ENTRY = re.compile(r'\{0x([0-9a-fA-F]{6})u,0x([0-9a-fA-F]{6})u\}')


def rom_offset(addr, mapper):
    bank, ofs = addr >> 16, addr & 0xffff
    if mapper == 'hirom':
        if (bank & 0x7f) < 0x40 and ofs < 0x8000:
            raise ValueError('Not a HiROM ROM address')
        return ((bank & 0x3f) << 16) | ofs
    if mapper == 'lorom':
        if ofs < 0x8000:
            raise ValueError('Not a LoROM ROM address')
        return ((bank & 0x7f) << 15) | (ofs - 0x8000)
    raise ValueError('Unsupported ROM mapper')


def authorize(project, rom_path, callsite, target, mapper='hirom', apply=False):
    if not ADDRESS.fullmatch(callsite) or not ADDRESS.fullmatch(target):
        raise ValueError('Six hexadecimal digits required for both addresses')
    call = int(callsite, 16)
    ret = int(target, 16)
    if (call >> 16) != (ret >> 16) or ((call + 3) & 0xffff) != (ret & 0xffff):
        raise ValueError('Return does not match JSR absolute instruction length')
    data = Path(rom_path).read_bytes()
    orig = Path(project) / 'assets' / 'cart-data.bin'
    if not orig.is_file() or hashlib.sha256(orig.read_bytes()).digest() != hashlib.sha256(data).digest():
        raise ValueError('Project cartridge data must match provenance ROM')
    off = rom_offset(call, mapper)
    if off + 3 > len(data) or data[off] != 0x20:
        raise ValueError('ROM does not contain JSR absolute at callsite')
    # The return target is eligible only if its call was compiled into the port
    # and the return site itself already has a dispatch entry.
    calltext = f'// ${call:06X} JSR'
    sources = list((Path(project) / 'src').glob('*.cpp'))
    if not any(calltext in src.read_text(encoding='utf-8') for src in sources if src.name != 'dispatch.cpp'):
        raise ValueError('JSR callsite is not translated in this port')
    dispatch = Path(project) / 'src' / 'dispatch.cpp'
    source = dispatch.read_text(encoding='utf-8')
    if f'{{0x{ret:06X}u,' not in source:
        raise ValueError('Return target has no translated dispatcher entry')
    matches = list(RETURNS.finditer(source))
    if len(matches) != 1:
        raise ValueError('Expected exactly one return authorization array')
    m = matches[0]
    values = [int(h,16) for h in HEX.findall(m.group(2))]
    if values != sorted(set(values)):
        raise ValueError('Existing authorized return offsets must be sorted and unique')
    ret_off = rom_offset(ret, mapper)
    # The original generator's alias table predates newly integrated CFG
    # handlers. The return guard requires both the authorized return offset
    # AND a canonical alias; update both in the same verified transaction.
    alias_start = source.find('static const Forja65AliasEntry kForja65Aliases[]={')
    alias_end = source.find('};', alias_start)
    if alias_start < 0 or alias_end < 0:
        raise ValueError('Missing compiled canonical alias table')
    alias_segment = source[alias_start:alias_end+2]
    aliases = [(int(x,16),int(y,16)) for x,y in ALIAS_ENTRY.findall(alias_segment)]
    if not aliases or aliases != sorted(aliases) or len(set(x for x,_ in aliases)) != len(aliases):
        raise ValueError('Canonical aliases must be sorted by unique offset')
    mapping = dict(aliases)
    if ret_off in mapping and mapping[ret_off] != ret:
        raise ValueError('Return offset is already mapped to a different bank address')
    alias_added = ret_off not in mapping
    return_added = ret_off not in values
    newsource = source
    if return_added:
        bisect.insort(values, ret_off)
        newarr = m.group(1) + ','.join(f'0x{x:06X}u' for x in values) + m.group(3)
        newsource = newsource.replace(m.group(0), newarr, 1)
    if alias_added:
        bisect.insort(aliases, (ret_off, ret))
        # Preserve compact source format and sorted ROM-alias semantics.
        new_alias = 'static const Forja65AliasEntry kForja65Aliases[]={\n' + ''.join(
            f'{{0x{x:06X}u,0x{y:06X}u}},\n' for x,y in aliases) + '};'
        newsource = newsource.replace(alias_segment, new_alias, 1)
    if apply and (return_added or alias_added):
        dispatch.write_text(newsource, encoding='utf-8')
    return {'schema':'forja65.verified-direct-jsr-return.v1', 'source_pc':f'{call:06X}',
            'return_pc':f'{ret:06X}', 'rom_offset':f'{ret_off:06X}',
            'jsr_target':f'{data[off+1] | (data[off+2]<<8):04X}',
            'sha256':hashlib.sha256(data).hexdigest(),
            'alias_added':alias_added, 'return_offset_added':return_added,
            'already_authorized':not (return_added or alias_added),
            'applied':bool((return_added or alias_added) and apply),
            'authorization_scope':'exact direct JSR return plus compiled ROM alias; stack guard remains enabled'}



def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--project', type=Path, required=True)
    p.add_argument('--rom',type=Path,required=True)
    p.add_argument('--callsite',required=True)
    p.add_argument('--return-site',required=True)
    p.add_argument('--mapper',choices=['hirom','lorom'],default='hirom')
    p.add_argument('--apply',action='store_true')
    p.add_argument('--report',type=Path)
    a=p.parse_args()
    try:
        result=authorize(a.project,a.rom,a.callsite.upper(),a.return_site.upper(),a.mapper,a.apply)
    except (OSError,ValueError) as exc:
        p.exit(2,f'JSR return authorization rejected: {exc}\n')
    out=json.dumps(result,indent=2)+'\n'
    if a.report:
        a.report.parent.mkdir(parents=True,exist_ok=True)
        a.report.write_text(out,encoding='utf-8')
    print(out,end='')

if __name__=='__main__':main()
