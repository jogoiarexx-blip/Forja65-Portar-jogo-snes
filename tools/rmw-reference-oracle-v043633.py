#!/usr/bin/env python3
"""Audit observable RMW operand bus accesses against a documented 65C816 micro-op model.

Reference model: Tom Harte/CLK 65816Storage.cpp read_modify_write() (as
consulted 2026-10-14), which describes emulation-mode old-value write vs.
native-mode extra INTERNAL operand read. These CLK internal operations are not
ordinary S-CPU peripheral accesses: ares and Snes9x model an internal idle.
Select --bus-model scpu for runtime peripheral traces. No physical timing claim.
The model covers the *operand* bus accesses only, excluding opcode, addressing,
and indexed-address internal cycles. Expected events are not injected in runtime.
"""
import argparse
import importlib.util
import json
from difflib import SequenceMatcher
from pathlib import Path

HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('forja_bus_clock_parser', HERE / 'compare-runtime-bus-clock-v043631.py')
CLOCK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CLOCK)
OPERATIONS = {'INC','DEC','ASL','LSR','ROL','ROR','TSB','TRB'}


def next_address(address):
    # 65C816 16-bit operand high byte is selected within the same data bank.
    return (address & 0xff0000) | ((address + 1) & 0xffff)


def expected_events(address, old_value, new_value, bits, mode, bus_model="clk_internal") :
    """Operand accesses for one RMW, not instruction fetches or extra index cycles."""
    if bits not in (8, 16) or mode not in ('native','emulation'):
        raise ValueError('bits must be 8/16 and mode must be native/emulation')
    if not 0 <= address <= 0xffffff or not 0 <= old_value <= (1 << bits)-1 or not 0 <= new_value <= (1 << bits)-1:
        raise ValueError('Address or word value out of range')
    hi = next_address(address)
    expected = [dict(kind='read',address=address,value=old_value&255,dummy=False)]
    if bits == 16:
        expected.append(dict(kind='read',address=hi,value=(old_value>>8)&255,dummy=False))
    if mode == 'native':
        expected.append(dict(kind='read',address=hi if bits == 16 else address,
                             value=(old_value>>8)&255 if bits == 16 else old_value&255,dummy=True))
    else:
        expected.append(dict(kind='write',address=hi if bits == 16 else address,
                             value=(old_value>>8)&255 if bits == 16 else old_value&255,dummy=True))
    if bits == 16:
        expected.append(dict(kind='write',address=hi,value=(new_value>>8)&255,dummy=False))
    expected.append(dict(kind='write',address=address,value=new_value&255,dummy=False))
    if bus_model == "scpu":
        expected = [event for event in expected if not event["dummy"]]
    elif bus_model != "clk_internal":
        raise ValueError("bus_model must be scpu or clk_internal")
    return expected


def key(event):
    return event['kind'], event['address'], event['value']


def audit(events, address, old_value, new_value, bits, mode, bus_model="clk_internal"):
    """Use edit alignment: report omitted events even when later events match."""
    expected = expected_events(address,old_value,new_value,bits,mode,bus_model)
    observed = [{'kind':x['kind'],'address':x['address'],'value':x['value'],
                 'dummy':x.get('dummy','unknown'),'pc':x.get('pc'),'seq':x.get('seq')}
                for x in events]
    aligner = SequenceMatcher(a=[key(e) for e in expected],b=[key(e) for e in observed],autojunk=False)
    missing,extra,mismatch=[],[],[]
    for action,a0,a1,b0,b1 in aligner.get_opcodes():
        if action == 'equal':
            for expected_row,observed_row in zip(expected[a0:a1],observed[b0:b1]):
                # A genuinely unknown classification must not be promoted to verified.
                got = observed_row['dummy']
                if got not in ('unknown',str(expected_row['dummy']).lower(),expected_row['dummy']):
                    mismatch.append({'expected':expected_row,'observed':observed_row,'reason':'dummy_flag'})
        else:
            if action in ('delete','replace'):
                missing.extend([{'expected_index':i,**expected[i]} for i in range(a0,a1)])
            if action in ('insert','replace'):
                extra.extend([{'observed_index':i,**observed[i]} for i in range(b0,b1)])
    passed = not (missing or extra or mismatch)
    return {'match':passed,'mode':mode,'width_bits':bits,'operand_address':address,
            'expected_events':len(expected),'observed_events':len(observed),
            'missing_events':missing,'unexpected_events':extra,'classification_mismatches':mismatch,
            'timing_checked':False,'bus_microcycle_accurate':False,
            'oracle_scope':bus_model, 'physical_scpu_verified':False,
            'note':'This detects omitted/extra recorded accesses; it does not measure clock accuracy.'}


def load_operand_events(path, pc=None):
    text = Path(path).read_text(encoding='utf-8-sig')
    if '# FORJA_BUS_CLOCK_TRACE' not in text:
        raise ValueError('Expected native FORJA_BUS_CLOCK_TRACE capture')
    # Files may be capped; a truncated trace must never be accepted as complete.
    trailers = [line for line in text.splitlines() if line.startswith('# written=')]
    if not trailers:
        raise ValueError('Trace footer missing: capture may be interrupted or truncated')
    import re
    trailer = re.fullmatch(r'# written=(\d+) dropped=(\d+)',trailers[-1])
    if not trailer or int(trailer.group(2)) != 0:
        raise ValueError('Trace incomplete or dropped events')
    all_events = CLOCK.load(path)
    if int(trailer.group(1)) < len(all_events):
        raise ValueError('Trace footer count inconsistent with captured rows')
    if pc is not None:
        all_events=[event for event in all_events if event['pc']==pc]
    return all_events


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('trace',type=Path,help='One operation capture; optionally filter with --pc')
    ap.add_argument('--opcode',required=True,choices=sorted(OPERATIONS),help='Mnemonic is a report label; not inferred from trace')
    ap.add_argument('--mode',required=True,choices=['native','emulation'])
    ap.add_argument('--bits',type=int,required=True,choices=[8,16])
    ap.add_argument('--address',required=True,type=lambda s:int(s,0))
    ap.add_argument('--old',required=True,type=lambda s:int(s,0))
    ap.add_argument('--new',required=True,type=lambda s:int(s,0))
    ap.add_argument('--bus-model',choices=['scpu','clk_internal'],default='clk_internal',help='CLK includes internal pin operations; scpu uses ares/Snes9x qualified data bus')
    ap.add_argument('--pc',type=lambda s:int(s,0),help='Filter CPU accesses using captured instruction PC')
    ap.add_argument('--output',type=Path)
    args=ap.parse_args(argv)
    try:
        records=load_operand_events(args.trace,args.pc)
        result=audit(records,args.address,args.old,args.new,args.bits,args.mode,args.bus_model)
    except (ValueError,OSError) as exc:
        result={'match':False,'error':str(exc)}
    result['opcode']=args.opcode
    printed=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    print(printed,end='')
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        args.output.write_text(printed,encoding='utf-8')
    return 0 if result['match'] else 1

if __name__=='__main__':
    raise SystemExit(main())
