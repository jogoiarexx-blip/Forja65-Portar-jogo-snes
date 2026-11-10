#!/usr/bin/env python3
"""Continue the user's SMK native port from the verified MC1 replay toward Donut Plains 1.

Development-mode autonomous driving: never writes to WRAM, never edits lap or race state.
If the second race is not observed and completed, writes an explicit FAIL verdict.
Requires a native Linux build with Forja65's FORJA65_CONTROL protocol.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import sys
from datetime import datetime, timezone

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from smk_pilot import PurePursuit, Racer, B
from portemu import PortEmu


def parse_trace(path):
    rows=[]
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if line.startswith('frame='):
            parts=dict(p.split('=',1) for p in line.split())
            rows.append((int(parts['frame']),int(parts['joy1'],16)))
    if not rows or any(rows[i][0]>=rows[i+1][0] for i in range(len(rows)-1)):
        raise ValueError('replay first-race frame ordering invalid')
    return rows


def emit_trace(path, rows):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    out=['# FORJA65_INPUT_TRACE 1', '# FORJA65_ENV FORJA65_SPC_PROFILE=reference',
         '# FORJA65_ENV FORJA65_EXECUTION=reference',
         '# SMK Mario Circuit 1 + attempted Donut Plains 1, WRAM observed; inspect QA report']
    previous=None
    for frame,joy in rows:
        if joy!=previous:
            out.append(f'frame={frame} joy1={joy:04x} joy2=0000')
            previous=joy
    path.write_text('\n'.join(out)+'\n',encoding='utf-8')


def read_state(e):
    memory=e.ram(0x1000,0x800)
    return memory, Racer.parse(memory), int(e.ram(0x100,1)[0])


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--game',required=True,help='native Linux build/game')
    p.add_argument('--assets',required=True)
    p.add_argument('--trace',required=True,help='verified Mario Circuit 1 input trace')
    p.add_argument('--out',default='fase2/evidencias')
    p.add_argument('--race-kart',type=int,default=4,choices=range(1,8))
    p.add_argument('--lookahead',type=int,default=20)
    p.add_argument('--step',type=int,default=4)
    p.add_argument('--max-next-race-frames',type=int,default=13000)
    p.add_argument('--racing-line',default='',help='pre-recorded CPU racing-line JSON')
    p.add_argument('--line-kart',type=int,default=4,choices=range(1,8))
    p.add_argument('--line-lap',type=int,default=0,choices=range(4))
    a=p.parse_args()
    if a.step<1 or a.step>16: p.error('--step 1..16 only')
    out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
    first=parse_trace(a.trace)
    e=PortEmu(game=a.game,assets=a.assets)
    second_events=[]
    status={'tool':'SMK TWO RACES REV144','race1':'replay from user project',
            'race1_frame':8523,'race2':'NOT_STARTED','race2_completed':False,
            'completed_laps':0,'observations':[],'generated_at':datetime.now(timezone.utc).isoformat()}
    current=0
    def run(n,mask):
        nonlocal current
        fr=e.frame()
        if mask!=current:
            second_events.append((fr,mask));current=mask
        e.run(n,mask)
    def report():
        (out/'race-progress.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
        emit_trace(out/'smk_two_races_attempt.trace',first+second_events)
    try:
        # Replay from power on; the controller records only new inputs after frame 8524.
        e.trace(a.trace,8524)
        m,p0,mode=read_state(e)
        initial_lap=p0.lap
        print(f'MC1 result frame={e.frame()} mode={mode} lap={initial_lap} cp={p0.checkpoints}',flush=True)
        status['race1_final_observation']={'mode':mode,'lap':initial_lap,'checkpoint':p0.checkpoints}
        try: e.shot(str(out/'01-mario-circuit-results.ppm'))
        except Exception as err:status['screenshot_warning']=str(err)
        # A race reset (completed >= 5 to 0..1) must be seen *after* results;
        # don't call a new race started just because an intermediate menu appeared.
        was_completed=initial_lap>=5
        prior=(p0.x,p0.y)
        started=False
        for i in range(75):
            run(4,B)
            run(104,0)
            _,player,mode=read_state(e)
            was_completed=was_completed or player.lap>=5
            if i%3==0:
                print(f'continue frame={e.frame()} mode={mode} lap={player.lap} xy={player.x},{player.y}',flush=True)
            if was_completed and -1 <= player.lap <= 1 and (player.x,player.y)!=prior:
                # Wait through the start countdown. Active race is confirmed by changing positions.
                run(120,B)
                _,player,mode=read_state(e)
                started=-1 <= player.lap <= 1
                if started:break
        if not started:
            status['error']='Second race reset was not observed after first-race results'
            print('NOT PROVEN: no second race observed',flush=True)
            return 3
        status['race2']='STARTED_UNVERIFIED_TRACK'
        status['race2_start_frame']=e.frame()
        print('SECOND RACE START',e.frame(),'mode',mode,flush=True)
        line=None
        if a.racing_line:
            line_info=json.loads(Path(a.racing_line).read_text(encoding='utf8'))
            expected_hash=line_info.get('cart_data_sha256')
            import hashlib
            actual_hash=hashlib.sha256((Path(a.assets)/'cart-data.bin').read_bytes()).hexdigest()
            if expected_hash!=actual_hash:
                raise ValueError('racing-line cache does not match current ROM assets SHA256')
            raw_line=line_info['routes'][str(a.line_kart)][str(a.line_lap)]
            if len(raw_line)<25:raise ValueError('pre-recorded racing line has fewer than 25 points')
            line=[(p[0],p[1]) for p in raw_line]
            status['racing_line']={'file':str(a.racing_line),'kart':a.line_kart,
                                   'lap':a.line_lap,'points':len(line)}
            print('PRECOMPUTED CPU LINE',status['racing_line'],flush=True)
        pilot=PurePursuit(kart=a.race_kart,lookahead=a.lookahead,racing_line=line)
        max_lap=0
        previous_lap=-1
        status['lap_splits']={}
        for i in range(max(1,a.max_next_race_frames//a.step)):
            memory,player,mode=read_state(e)
            max_lap=max(max_lap,player.lap)
            if player.lap>previous_lap and player.lap>=0:
                status['lap_splits'][str(player.lap)]=e.frame()
                print('LAP',player.lap,'frame',e.frame(),flush=True)
                previous_lap=player.lap
            if player.lap>=5:
                status['race2']='FINISHED_LAP_COUNTER'
                status['race2_completed']=True
                status['finish_frame']=e.frame()
                break
            buttons,_=pilot.drive(memory)
            run(a.step,buttons)
            if i%(max(1,120//a.step))==0:
                obs={'frame':e.frame(),'mode':mode,'lap':player.lap,
                     'checkpoints':player.checkpoints,'x':player.x,'y':player.y}
                status['observations'].append(obs)
                print('drive',obs,flush=True)
        status['completed_laps']=max_lap
        status['race2_end_frame']=e.frame()
        try:e.shot(str(out/'02-donut-plains-attempt.ppm'))
        except Exception as err:status['screenshot_warning_last']=str(err)
        if not status['race2_completed']:
            status['race2']='NOT_FINISHED'
            status['error']='Race2 lap counter did not reach 5 before the frame budget'
        return 0 if status['race2_completed'] else 4
    except Exception as err:
        status['error']=f'{type(err).__name__}: {err}'
        print(status['error'],file=sys.stderr,flush=True)
        return 2
    finally:
        report()
        e.close()

if __name__=='__main__':sys.exit(main())
