#!/usr/bin/env python3
"""REV210 P0: compare independent 128 KiB WRAM snapshots and annotate actual reads/writes.

Does not claim root cause. Does not patch ROM, RAM or emulator state.
"""
import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

WRAM_SIZE = 0x20000
SCHEMA = 'forja65.wram.first-divergence/1'
WRITES = ['frame', 'address', 'old', 'new', 'writer_pc', 'bus', 'joy1', 'nmi']
READS = ['frame', 'address', 'value', 'reader_pc', 'via', 'joy1', 'nmi']


def frames_from_manifest(path):
    root = Path(path).resolve()
    result = {}
    with root.open(encoding='utf-8-sig', newline='') as handle:
        rd = csv.DictReader(handle)
        if rd.fieldnames != ['frame', 'path']:
            raise ValueError(f'{root}: expected frame,path CSV')
        for row in rd:
            frame = int(row['frame'])
            if frame < 0 or frame in result or not row['path']:
                raise ValueError(f'{root}: negative/duplicate frame or empty path')
            obj = Path(row['path'])
            result[frame] = obj if obj.is_absolute() else root.parent / obj
    if not result:
        raise ValueError(f'{root}: no frames')
    return result


def read_snapshot(path):
    path = Path(path)
    data = path.read_bytes()
    if len(data) != WRAM_SIZE:
        raise ValueError(f'{path}: expected exactly {WRAM_SIZE} WRAM bytes, got {len(data)}')
    return data


def read_trace(path, header, *, pc_field):
    if not path:
        return {}
    groups = defaultdict(list)
    with Path(path).open(encoding='utf-8-sig', newline='') as handle:
        rows = csv.DictReader(handle)
        if rows.fieldnames != header:
            raise ValueError(f'{path}: header mismatch: expected {header}')
        previous = -1
        for row in rows:
            frame = int(row['frame'])
            addr = int(row['address'], 16)
            pc = int(row[pc_field], 16)
            if frame < previous or frame < 0 or not 0x7e0000 <= addr <= 0x7fffff or not 0 <= pc <= 0xffffff:
                raise ValueError(f'{path}: invalid frame/address/pc or unordered frames')
            previous = frame
            if header == WRITES:
                if row['bus'] not in ('bus', '2180'):
                    raise ValueError(f'{path}: unexpected write bus')
                values = [int(row[k]) for k in ('old', 'new')]
            else:
                if row['via'] not in ('bus', '2180'):
                    raise ValueError(f'{path}: unexpected read bus')
                values = [int(row['value'])]
            if any(not 0 <= val <= 255 for val in values):
                raise ValueError(f'{path}: WRAM byte outside range')
            groups[addr].append({'frame': frame, 'pc': f'{pc:06X}', 'via': row.get('bus', row.get('via')),
                                 'value': values[-1], **({'old': values[0]} if header == WRITES else {})})
    return groups


def sample_trace(events, addr, frame, *, count):
    entries = [r for r in events.get(addr, ()) if r['frame'] <= frame]
    return entries[-count:]


def analyze(forja, reference, *, forja_writers=None, reference_writers=None,
            forja_reads=None, reference_reads=None, limit=64, trace_context=8):
    if set(forja) != set(reference):
        missing_oracle = sorted(set(forja) - set(reference))
        missing_forja = sorted(set(reference) - set(forja))
        raise ValueError(f'frame sets differ: no reference {missing_oracle[:10]}, no Forja {missing_forja[:10]}')
    if not 1 <= limit <= 4096 or not 1 <= trace_context <= 100:
        raise ValueError('limit must be 1..4096 and trace-context 1..100')
    writers = {'forja': read_trace(forja_writers, WRITES, pc_field='writer_pc'),
               'reference': read_trace(reference_writers, WRITES, pc_field='writer_pc')}
    readers = {'forja': read_trace(forja_reads, READS, pc_field='reader_pc'),
               'reference': read_trace(reference_reads, READS, pc_field='reader_pc')}
    first = None
    total_bytes = 0
    for frame in sorted(forja):
        a, b = read_snapshot(forja[frame]), read_snapshot(reference[frame])
        total_bytes += WRAM_SIZE
        if a == b:
            continue
        differences = [i for i in range(WRAM_SIZE) if a[i] != b[i]]
        addresses = []
        for i in differences[:limit]:
            addr = 0x7e0000 + i
            addresses.append({
                'address': f'{addr:06X}', 'forja_value': a[i], 'reference_value': b[i],
                'writers': {side: sample_trace(events, addr, frame, count=trace_context)
                            for side, events in writers.items()},
                'readers': {side: sample_trace(events, addr, frame, count=trace_context)
                            for side, events in readers.items()},
            })
        first = {'frame': frame, 'different_bytes': len(differences), 'displayed': len(addresses),
                 'omitted': len(differences) - len(addresses), 'addresses': addresses}
        break
    return {
        'schema': SCHEMA, 'frames_compared': len(forja) if first is None else sum(k <= first['frame'] for k in forja),
        'bytes_compared': total_bytes, 'first_divergence': first,
        'traces_available': {'forja_writers': bool(forja_writers), 'reference_writers': bool(reference_writers),
                             'forja_reads': bool(forja_reads), 'reference_reads': bool(reference_reads)},
        'limitations': [
            'Snapshots compare only the supplied end-of-frame WRAM; no CPU/PPU/APU timing equivalence is implied.',
            'Writers/readers are selected by frame, not ordered by CPU cycle; matching a PC is not proof of causality.',
            'Unlogged addresses or truncated trace windows cannot establish absence of reads/writes.',
            'First divergence means first DIFFERENT SUPPLIED SNAPSHOT, not necessarily first diverging CPU instruction.',
        ],
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    group = p.add_mutually_exclusive_group(required=True)
    group.add_argument('--forja-bin', type=Path, help='single raw 128 KiB WRAM dump')
    group.add_argument('--forja-snapshots', type=Path, help='CSV frame,path of raw 128 KiB dumps')
    p.add_argument('--reference-bin', type=Path)
    p.add_argument('--reference-snapshots', type=Path)
    p.add_argument('--frame', type=int, default=0, help='frame index for single dump mode')
    p.add_argument('--forja-writers', type=Path)
    p.add_argument('--reference-writers', type=Path)
    p.add_argument('--forja-reads', type=Path)
    p.add_argument('--reference-reads', type=Path)
    p.add_argument('--limit', type=int, default=64)
    p.add_argument('--trace-context', type=int, default=8)
    p.add_argument('--json', type=Path, help='write result to file (stdout if omitted)')
    args = p.parse_args(argv)
    if args.forja_bin:
        if not args.reference_bin or args.reference_snapshots or args.frame < 0:
            p.error('single dump mode needs --reference-bin and --frame >= 0')
        forja, reference = {args.frame: args.forja_bin}, {args.frame: args.reference_bin}
    else:
        if not args.reference_snapshots or args.reference_bin:
            p.error('manifest mode needs --reference-snapshots')
        forja, reference = frames_from_manifest(args.forja_snapshots), frames_from_manifest(args.reference_snapshots)
    try:
        result = analyze(forja, reference, forja_writers=args.forja_writers,
                         reference_writers=args.reference_writers, forja_reads=args.forja_reads,
                         reference_reads=args.reference_reads, limit=args.limit,
                         trace_context=args.trace_context)
    except (ValueError, OSError) as exc:
        p.exit(2, f'WRAM_COMPARE_ERROR: {exc}\n')
    output = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.json:
        args.json.write_text(output, encoding='utf-8')
    else:
        print(output, end='')
    return 1 if result['first_divergence'] is not None else 0


if __name__ == '__main__':
    raise SystemExit(main())
