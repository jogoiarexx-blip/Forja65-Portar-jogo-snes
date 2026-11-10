#!/usr/bin/env python3
"""Strict, offline differential comparator for SPC700 $F3 write traces.

This compares observable logical writes, not CPU/DSP bus microcycles. An exact
write timing comparison is permitted only when both traces provide independently
sourced physical_write_cycle and timing_provenance metadata. Never infer a write
cycle from access_ordinal or completion_master.
"""
import argparse
import csv
import json
import pathlib
import sys

FIELDS = ('pc', 'opcode', 'dsp_addr', 'value', 'accepted')
OPTIONAL = ('access_ordinal', 'logical_accesses', 'instruction_cycles', 'completion_master',
            'instruction_id', 'spc_cycles_end', 'documented_write_cycle')
RANGES = {'pc': 65535, 'opcode': 255, 'dsp_addr': 255, 'value': 255,
          'accepted': 1, 'access_ordinal': 65535, 'logical_accesses': 65535,
          'instruction_cycles': 65535, 'completion_master': 2**64-1,
          'instruction_id': 2**64-1, 'spc_cycles_end': 2**64-1,
          'physical_write_cycle': 2**64-1, 'documented_write_cycle': 65535}
PROVENANCE = ('hardware', 'cycle_accurate_reference')

class InvalidTrace(ValueError):
    pass


def read_trace(filename):
    path = pathlib.Path(filename)
    with path.open('r', newline='', encoding='utf-8-sig') as stream:
        lines = stream.readlines()
    comments = [line.strip() for line in lines if line.lstrip().startswith('#')]
    if not lines or not ''.join(line for line in lines if line.strip() and not line.lstrip().startswith('#')):
        raise InvalidTrace(f'{path}: empty trace')
    if any('dropped=' in line and int(line.split('dropped=', 1)[1].split(';', 1)[0].strip()) != 0
           for line in comments if 'dropped=' in line):
        raise InvalidTrace(f'{path}: trace has dropped events; comparison is incomplete')
    rows = csv.DictReader(line for line in lines if line.strip() and not line.lstrip().startswith('#'))
    if not rows.fieldnames or not set(FIELDS).issubset(rows.fieldnames):
        raise InvalidTrace(f'{path}: required columns: {FIELDS}')
    result = []
    last_id, last_cycle, last_completed = None, None, None
    for n, row in enumerate(rows, 2):
        if None in row:
            raise InvalidTrace(f'{path}:{n}: extra CSV columns')
        event = {}
        for key in (*FIELDS, *OPTIONAL, 'physical_write_cycle'):
            if key not in row or row[key] is None or row[key] == '':
                continue
            if key in ('completion_master', 'documented_write_cycle') and row[key] == 'unknown':
                event[key] = None
                continue
            try:
                value = int(row[key], 10)
            except ValueError:
                raise InvalidTrace(f'{path}:{n}: invalid {key}={row[key]!r}') from None
            if not 0 <= value <= RANGES[key]:
                raise InvalidTrace(f'{path}:{n}: out-of-range {key}={value}')
            event[key] = value
        event['timing_source'] = (row.get('timing_source') or '').strip()
        documented = event.get('documented_write_cycle')
        if documented is not None:
            if event['timing_source'] != 'spc700_commands_2014_table_1_1_6d':
                raise InvalidTrace(f'{path}:{n}: documented write cycle needs a supported source')
            if event.get('opcode') != 0xDA or documented not in (4, 5):
                raise InvalidTrace(f'{path}:{n}: documented cycle only supported for MOVW dp,YA')
            if event.get('instruction_cycles') != 5:
                raise InvalidTrace(f'{path}:{n}: MOVW reference cycle must be within a 5-cycle instruction')
        event['timing_provenance'] = (row.get('timing_provenance') or '').strip()
        if 'physical_write_cycle' in event and event['timing_provenance'] not in PROVENANCE:
            raise InvalidTrace(f'{path}:{n}: physical write time requires trustworthy provenance')
        if 'access_ordinal' in event and 'logical_accesses' in event and not (1 <= event['access_ordinal'] <= event['logical_accesses']):
            raise InvalidTrace(f'{path}:{n}: impossible logical access ordinal')
        if 'instruction_id' in event:
            if last_id is not None and event['instruction_id'] < last_id:
                raise InvalidTrace(f'{path}:{n}: instruction id moves backward')
            last_id = event['instruction_id']
        if event.get('completion_master') is not None:
            if last_completed is not None and event['completion_master'] < last_completed:
                raise InvalidTrace(f'{path}:{n}: completion timestamp moves backward')
            last_completed = event['completion_master']
        if 'spc_cycles_end' in event:
            if last_cycle is not None and event['spc_cycles_end'] < last_cycle:
                raise InvalidTrace(f'{path}:{n}: SPC cycles move backward')
            last_cycle = event['spc_cycles_end']
        result.append(event)
    return result


def compare(observed, reference):
    mismatch = None
    for i in range(min(len(observed), len(reference))):
        optional_comparable = tuple(k for k in ('access_ordinal', 'logical_accesses',
                   'instruction_cycles', 'instruction_id', 'spc_cycles_end', 'documented_write_cycle')
                   if k in observed[i] and k in reference[i])
        for key in (*FIELDS, *optional_comparable):
            if observed[i][key] != reference[i][key]:
                mismatch = {'event_index': i, 'field': key, 'observed': observed[i][key],
                            'reference': reference[i][key], 'observed_event': observed[i],
                            'reference_event': reference[i]}
                break
        if mismatch is not None:
            break
    if mismatch is None and len(observed) != len(reference):
        i = min(len(observed), len(reference))
        mismatch = {'event_index': i, 'field': 'event_count', 'observed': len(observed),
                    'reference': len(reference)}
    # A reference cycle alone cannot certify our instruction-boundary trace.
    physical = {'status': 'not_comparable', 'reason': 'No verified physical write cycles in both traces'}
    if (bool(observed) and bool(reference)
            and all('physical_write_cycle' in e for e in observed + reference)
            and all(e.get('timing_provenance') in PROVENANCE for e in observed + reference)):
        physical = {'status': 'matched'}
        for i, (left, right) in enumerate(zip(observed, reference)):
            if left['physical_write_cycle'] != right['physical_write_cycle']:
                physical = {'status': 'mismatch', 'event_index': i,
                            'observed': left['physical_write_cycle'],
                            'reference': right['physical_write_cycle']}
                break
    return {'format': 'forja65-spc-f3-diff-v1', 'observed_events': len(observed),
            'reference_events': len(reference), 'logical_sequence_matches': mismatch is None,
            'first_mismatch': mismatch, 'physical_timing': physical,
            'note': 'The optional documented_write_cycle annotates the bus-table reference, NOT a write timestamp measured in this runtime. Logical access order, IDs and instruction totals do not establish microcycle accuracy'}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--observed', required=True)
    parser.add_argument('--reference', required=True)
    parser.add_argument('--report', help='write machine-readable JSON report')
    args = parser.parse_args(argv)
    try:
        report = compare(read_trace(args.observed), read_trace(args.reference))
    except (OSError, ValueError, csv.Error) as exc:
        report = {'format': 'forja65-spc-f3-diff-v1', 'error': str(exc),
                  'logical_sequence_matches': False}
    if args.report:
        pathlib.Path(args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 2 if 'error' in report else (1 if not report['logical_sequence_matches']
                                       or report['physical_timing']['status'] == 'mismatch' else 0)


if __name__ == '__main__':
    sys.exit(main())
