#!/usr/bin/env python3
"""Audit completeness of real GET READY diagnostics. Never assert gameplay from synthetic logs."""
import argparse,csv,json
from pathlib import Path

def inspect_csv(path, required):
    p=Path(path)
    if not p.is_file() or p.stat().st_size == 0:
        return {'status':'missing_or_empty','rows':0,'path':str(p)}
    try:
        with p.open(newline='', encoding='utf-8') as fh:
            reader=csv.DictReader(fh)
            fields=set(reader.fieldnames or [])
            if not required.issubset(fields):
                return {'status':'invalid_columns','rows':0,'path':str(p),'missing_columns':sorted(required-fields)}
            rows=sum(1 for _ in reader)
    except (OSError, UnicodeError, csv.Error) as e:
        return {'status':'unreadable','rows':0,'path':str(p),'error':str(e)}
    return {'status':'recorded' if rows else 'empty_capture','rows':rows,'path':str(p)}

def report(folder):
    d=Path(folder)
    artifacts={
      'neutral_wram': inspect_csv(d/'neutral-wram.csv', {'kind','frame','wram_address'}),
      'controlled_wram': inspect_csv(d/'controlled-wram.csv', {'kind','frame','wram_address'}),
      'writers': inspect_csv(d/'writers.csv', {'frame','address','writer_pc'}),
      'video': inspect_csv(d/'video.csv', {'frame'}),
    }
    good=all(v['status']=='recorded' for v in artifacts.values())
    return {'schema':'forja65.get-ready-evidence-audit.v1','capture_complete':good,
      'artifacts':artifacts,
      'timer_identified':False,'c0_f923_resolved':False,'gameplay_verified':False,
      'interpretation':'Complete capture means files are readable and nonempty, not proof of the timer, instruction parity or working controls.' if good else 'Capture incomplete. Do not infer timer, C0:F923 or gameplay from missing data.'}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('folder');ap.add_argument('--out');a=ap.parse_args()
    r=report(a.folder); payload=json.dumps(r,indent=2,ensure_ascii=False)+'\n'
    if a.out: Path(a.out).write_text(payload,encoding='utf-8')
    print(payload,end='')
    return 0 if r['capture_complete'] else 2
if __name__=='__main__': raise SystemExit(main())
