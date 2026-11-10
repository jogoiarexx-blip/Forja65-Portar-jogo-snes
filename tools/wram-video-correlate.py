#!/usr/bin/env python3
"""Join observed WRAM writes with end-of-frame video state; observational only."""
import argparse,csv,json,collections
from pathlib import Path

def correlate(writes_path, video_path):
    with open(video_path,encoding='utf-8',newline='') as f:
        video=list(csv.DictReader(f))
    if not video or not {'frame','framebuffer','joy1','pc'}.issubset(video[0]):
        raise ValueError('Missing/empty video-state trace')
    by_frame={}
    for row in video:
        frame=int(row['frame'])
        if frame in by_frame: raise ValueError('Duplicate video frame')
        by_frame[frame]=row
    with open(writes_path,encoding='utf-8',newline='') as f:
        writes=list(csv.DictReader(f))
    if not writes or not {'frame','address','old','new','writer_pc','joy1'}.issubset(writes[0]):
        raise ValueError('Missing/empty WRAM write trace')
    groups=collections.defaultdict(list)
    for row in writes:
        addr=int(row['address'],16); old=int(row['old']); new=int(row['new']); frame=int(row['frame'])
        if not 0x7E0000 <= addr <= 0x7FFFFF or not 0 <= old <= 255 or not 0 <= new <= 255:
            raise ValueError('Invalid WRAM event')
        groups[addr].append((frame,old,new,row['writer_pc'].upper()))
    result={}
    video_frames=sorted(by_frame)
    for addr,events in sorted(groups.items()):
        frames={f for f,_,_,_ in events}
        visible=sorted(f for f in frames if f in by_frame)
        transitions=[]
        for f,old,new,pc in events:
            if old!=new:
                transitions.append({'frame':f,'old':old,'new':new,'writer_pc':'$'+pc,
                                    'video_observed':f in by_frame,
                                    'framebuffer':by_frame[f]['framebuffer'] if f in by_frame else None})
        decreases=sum(new<old for _,old,new,_ in events)
        increases=sum(new>old for _,old,new,_ in events)
        result[f'${addr:06X}']={'writes':len(events),'changes':len(transitions),'decreases':decreases,
            'increases':increases,'video_frames_matched':len(visible),
            'distinct_video_hashes_at_write_frames':len({by_frame[f]['framebuffer'] for f in visible}),
            'writers':dict(collections.Counter('$'+pc for _,_,_,pc in events).most_common()),
            'transitions':transitions[:200], 'transitions_truncated':max(0,len(transitions)-200)}
    return {'schema':'forja65.wram-video-correlation.v1','video_frames':len(video_frames),
            'video_first_frame':video_frames[0],'video_last_frame':video_frames[-1],
            'addresses':result,'get_ready_timer_confirmed':False,
            'limitations':'Frame joins only; a changed framebuffer is not proof of a displayed countdown digit. Needs SNES capture/oracle and input+motion verification.'}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('writes',type=Path);p.add_argument('video',type=Path);p.add_argument('--out',type=Path)
    a=p.parse_args();result=correlate(a.writes,a.video);serialized=json.dumps(result,indent=2,ensure_ascii=False)+'\n'
    if a.out: a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(serialized,encoding='utf-8')
    print(serialized,end='')
if __name__=='__main__': main()
