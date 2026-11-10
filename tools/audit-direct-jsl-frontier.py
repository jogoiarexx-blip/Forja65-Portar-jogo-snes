#!/usr/bin/env python3
"""Cross-check an observed 65C816 JSL with the ROM, CPU trace and error.

This tool does not infer a destination or forgive stack errors. It produces a
strict proof for the focused generator, binding the last trace instruction to
the actual ROM bytes and the runtime hint. HiROM, 4 MiB unheadered ROMs.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path

TRACE = re.compile(r'^([0-9a-fA-F]{6})\s+.*?\bE=([01])\s+M=([01])\s+X8=([01])\s+C=([01])\s*$')
HINT = re.compile(r'^rom=([0-9a-f]{16})\s+target=([0-9a-f]{6})\s+from=([0-9a-f]{6})\s+kind=FLOW\s+e=([01])\s+m=([01])\s+x=([01])\s+c=([01])\s*$')
ERROR = re.compile(r'^fluxo CFG nao resolvido em pc=(\d+) target=(\d+)\s*$')

def audit(rom: bytes, trace: str, hints: str, error: str, source: int, target: int):
    if len(rom) != 0x400000:
        raise ValueError('Expected unheadered 4MiB HiROM')
    if not (0x800000 <= source <= 0xffffff and 0x800000 <= target <= 0xffffff):
        raise ValueError('Only SNES ROM bank addresses can be checked')
    if source & 0xffff > 0xfffb:
        raise ValueError('JSL crosses bank boundary')
    offset = source & 0x3fffff
    op = rom[offset:offset+4]
    if len(op) != 4 or op[0] != 0x22:
        raise ValueError('ROM does not contain a JSL at the source')
    actual_target = op[1] | (op[2]<<8) | (op[3]<<16)
    if actual_target != target:
        raise ValueError('JSL ROM target does not match the reported target')
    parsed_error = ERROR.search(error.strip())
    if not parsed_error or (int(parsed_error[1]), int(parsed_error[2])) != (source, target):
        raise ValueError('Last CFG error differs from JSL source/target')
    instruction_lines = [m for line in trace.splitlines() if (m := TRACE.fullmatch(line.strip()))]
    if not instruction_lines:
        raise ValueError('No CPU trace instruction found')
    last = instruction_lines[-1]
    if int(last[1], 16) != source:
        raise ValueError('Last CPU instruction is not the JSL source')
    state = dict(zip(('e','m','x','c'), map(int, (last[2],last[3],last[4],last[5]))))
    valid_hints = [m for line in hints.splitlines() if (m := HINT.fullmatch(line.strip()))]
    matched = [m for m in valid_hints if int(m[2],16)==target and int(m[3],16)==source and
               tuple(map(int, (m[4],m[5],m[6],m[7])))==tuple(state.values())]
    if len(matched) != 1:
        raise ValueError('Missing unique ROM-bound FLOW hint with the measured CPU flags')
    hash_from_hint=matched[0][1]
    if len({m[1] for m in matched})!=1:
        raise ValueError('Ambiguous ROM hint')
    return {
        'schema':'forja65.direct-jsl-frontier.v1',
        'status':'JSL_ROM_TRACE_ERROR_CROSSCHECKED',
        'mapper':'HiROM',
        'rom_sha256':hashlib.sha256(rom).hexdigest(),
        'rom_fingerprint':hash_from_hint,
        'source':f'{source:06X}',
        'target':f'{target:06X}',
        'physical_offset':offset,
        'opcode':op.hex(' ').upper(),
        'return_pc':f'{(source+4):06X}',
        'stack_return_word':f'{(source+3)&0xffff:04X}',
        'cpu_state':state,
        'evidence':{'rom_opcode':True,'trace_last_pc':True,'cpu_flags':True,'runtime_hint':True,'last_error':True},
        'scope':'Observed JSL callsite; validates routing, not callee execution or RTL correctness.'
    }

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--rom',required=True,type=Path)
    p.add_argument('--trace',required=True,type=Path)
    p.add_argument('--hints',required=True,type=Path)
    p.add_argument('--last-error',required=True,type=Path)
    p.add_argument('--source',required=True)
    p.add_argument('--target',required=True)
    p.add_argument('--output',required=True,type=Path)
    a=p.parse_args()
    source=int(a.source.replace(':','').removeprefix('0x'),16)
    target=int(a.target.replace(':','').removeprefix('0x'),16)
    result=audit(a.rom.read_bytes(),a.trace.read_text(),a.hints.read_text(),a.last_error.read_text(),source,target)
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps({'status':result['status'],'source':result['source'],'target':result['target'],'cpu_state':result['cpu_state']}))

if __name__=='__main__':main()
