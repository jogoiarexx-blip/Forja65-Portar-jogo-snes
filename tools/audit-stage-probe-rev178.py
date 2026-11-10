#!/usr/bin/env python3
"""REV178: audit observational WRAM course samples, never claim a level is won.

Works on DKC3-ZERO REV051 stage trace (opt-in) and future compatible ports.
Comparison is port-vs-port at exact frame numbers, NOT Snes9x equivalence.
"""
from __future__ import annotations
import argparse
import csv
import json
import re
from pathlib import Path

FORMAT='FORJA65_DKC3_STAGE_PROBE 1'
COLUMNS=('frame','reason','room','level','x','y','lives','map','bonus','pc','cpu_instructions','interpreter_instructions')
ROM=re.compile(r'^[0-9a-f]{16}$')
META=re.compile(r'^# FORJA65_DKC3_STAGE_PROBE 1 rom=([0-9a-f]{16})(?: replay=([0-9a-f]{16}|none))?$')
class StageRows(list):
    def __init__(self, iterable=(), replay='legacy'):
        super().__init__(iterable)
        self.replay=replay
NUMERIC=set(COLUMNS)-{'reason','pc'}


def parse_csv(path:Path):
    with path.open(newline='',encoding='utf-8') as f:
        head=f.readline().strip()
        m=META.fullmatch(head)
        if not m:
            raise ValueError(f'{path}: invalid schema header / ROM hash')
        rom=m.group(1)
        replay=m.group(2) or 'legacy' 
        reader=csv.DictReader(f)
        if tuple(reader.fieldnames or ())!=COLUMNS:
            raise ValueError(f'{path}: wrong columns')
        rows=StageRows(replay=replay)
        for i,row in enumerate(reader,3):
            if None in row or any(row[k] in (None,'') for k in COLUMNS):
                raise ValueError(f'{path}:{i}: missing/extra cells')
            parsed={}
            for k in COLUMNS:
                if k in NUMERIC:
                    if not re.fullmatch(r'[0-9]+',row[k]):
                        raise ValueError(f'{path}:{i}: bad decimal {k}')
                    parsed[k]=int(row[k])
                else:
                    parsed[k]=row[k]
            if parsed['reason'] not in ('periodic','transition') or not re.fullmatch(r'[0-9a-fA-F]{1,6}',parsed['pc']):
                raise ValueError(f'{path}:{i}: bad reason or PC')
            if rows and parsed['frame']<=rows[-1]['frame']:
                raise ValueError(f'{path}:{i}: non-monotonic frame')
            if rows and (parsed['cpu_instructions']<rows[-1]['cpu_instructions'] or
                         parsed['interpreter_instructions']<rows[-1]['interpreter_instructions']):
                raise ValueError(f'{path}:{i}: counter regression')
            if parsed['interpreter_instructions']>parsed['cpu_instructions']:
                raise ValueError(f'{path}:{i}: interpreted > all')
            if not (0<=parsed['room']<=255 and 0<=parsed['level']<=255 and
                    0<=parsed['x']<=65535 and 0<=parsed['y']<=65535 and
                    0<=parsed['map']<=255 and 0<=parsed['lives']<=255 and 0<=parsed['bonus']<=255):
                raise ValueError(f'{path}:{i}: invalid WRAM values')
            rows.append(parsed)
    return rom,rows


def audit(rom, rows, target_room, baseline=None, tolerance=16):
    if not rows:
        return {'schema':'forja65.stage-audit.rev178','rom':rom,'samples':0,'status':'NO_EVIDENCE',
                'completed':False,'warning':'No stage samples: cannot infer state or completion'}
    seen=[r for r in rows if r['room']==target_room and r['level']==target_room and r['map']!=1]
    first=rows[0];last=rows[-1]
    out={'schema':'forja65.stage-audit.rev178','rom':rom,'target_room':f'{target_room:02X}',
         'samples':len(rows),'input_replay_fingerprint':getattr(rows,'replay','legacy'),'start_frame':first['frame'],'end_frame':last['frame'],
         'observed_room_frames':[r['frame'] for r in seen[:10]],
         'status':'TARGET_ROOM_OBSERVED' if seen else 'TARGET_ROOM_NOT_OBSERVED',
         'completed':False,'warning':'Room presence is not a stage-clear flag; no stage-clear evidence in this schema.',
         'interpreter_instructions_delta':last['interpreter_instructions']-first['interpreter_instructions'],
         'cpu_instructions_delta':last['cpu_instructions']-first['cpu_instructions']}
    if baseline is not None:
        b_rom,b_rows=baseline
        if b_rom!=rom:raise ValueError('baseline ROM fingerprint differs')
        input_id=getattr(rows,'replay','legacy')
        baseline_id=getattr(b_rows,'replay','legacy')
        if input_id not in ('legacy','none') and baseline_id not in ('legacy','none') and input_id!=baseline_id:
            out['comparison']={'status':'DIFFERENT_REPLAY_INPUTS','same_input_proven':False,
                'replay':input_id,'baseline_replay':baseline_id,
                'first_mismatch':None,'not_a_reference_oracle':True}
            return out
        same_input_proven=input_id not in ('legacy','none') and input_id==baseline_id
        b_idx={r['frame']:r for r in b_rows}
        pairs=[(r,b_idx[r['frame']]) for r in rows if r['frame'] in b_idx]
        mismatches=[]
        for a,b in pairs:
            fields=[k for k in ('room','level','lives','map','bonus') if a[k]!=b[k]]
            if max(abs(a['x']-b['x']),abs(a['y']-b['y']))>tolerance:fields+=['position']
            if fields:mismatches.append({'frame':a['frame'],'fields':fields,'port':{k:a[k] for k in ('room','level','x','y','lives')},'baseline':{k:b[k] for k in ('room','level','x','y','lives')}})
        out['comparison']={'matching_sample_frames':len(pairs),'same_input_proven':same_input_proven,
            'first_mismatch':mismatches[0] if mismatches else None,
            'status':'NO_OVERLAPPING_SAMPLES' if not pairs else ('DIVERGED' if mismatches else ('MATCHED_SAMPLED_STATE' if same_input_proven else 'SAMPLED_STATES_MATCH_INPUT_UNVERIFIED')),
            'not_a_reference_oracle':True}
    return out


def main(argv=None):
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--trace',type=Path,required=True)
    ap.add_argument('--baseline',type=Path)
    ap.add_argument('--target-room',type=lambda x:int(x,16),default=0x32)
    ap.add_argument('--position-tolerance',type=int,default=16)
    ap.add_argument('--expect-rom')
    ap.add_argument('--out',type=Path,required=True)
    args=ap.parse_args(argv)
    if not 0<=args.target_room<=255 or args.position_tolerance<0:
        ap.error('invalid room/tolerance')
    rom,rows=parse_csv(args.trace)
    if args.expect_rom and args.expect_rom!=rom:
        raise SystemExit('ROM fingerprint mismatch')
    base=parse_csv(args.baseline) if args.baseline else None
    obj=audit(rom,rows,args.target_room,base,args.position_tolerance)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f"AUDIT status={obj['status']} samples={obj['samples']} completed=NOT_PROVEN")
    if base:
        print(f"PORT-TO-PORT comparison={obj['comparison']['status']}")

if __name__=='__main__':main()
