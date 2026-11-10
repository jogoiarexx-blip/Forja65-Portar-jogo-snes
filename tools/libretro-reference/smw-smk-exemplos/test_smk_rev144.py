import tempfile
from pathlib import Path
from smk_pilot import PurePursuit, Racer, B
from score_mushroom_cup import grade

def test():
    with tempfile.TemporaryDirectory() as d:
        evidence=Path(d)/'hud.png';evidence.write_bytes(b'placeholder-file-only')
        replay=Path(d)/'trace';replay.write_text('frame=1 joy1=8000 joy2=0000')
        finished={'race2_completed':True,'completed_laps':5}
        assert grade(finished)['status']=='LAPS_ONLY_UNVERIFIED_RANK'
        assert grade(finished,8,evidence)['status']=='FINISHED_UNQUALIFIED'
        assert grade(finished,4,evidence)['status']=='QUALIFIED'
        assert grade(finished,4,evidence)['classified_top4'] is True
        assert grade(finished,4,evidence,replay)['replay_exists']
        assert grade({'race2_completed':False,'completed_laps':4},2,evidence)['status']=='NO_COMPLETION'
        try:grade(finished,5,None)
        except ValueError:pass
        else:raise AssertionError('rank must require real evidence path')
        try:grade(finished,9,evidence)
        except ValueError:pass
        else:raise AssertionError('ranking >8 incorrectly accepted')
        route=[[100+i*4,100] for i in range(40)]
        pilot=PurePursuit(racing_line=route,lookahead=4)
        buf=bytearray(8*256);buf[0x18]=100;buf[0x1c]=100;buf[0xc1]=128
        mask,_=pilot.drive(bytes(buf))
        assert mask&B
        assert pilot.route_ready and len(pilot.route)==40
        assert pilot.index is not None
        print('PASS REV144: 11 pilot cached-line / race qualification checks')
if __name__=='__main__':test()
