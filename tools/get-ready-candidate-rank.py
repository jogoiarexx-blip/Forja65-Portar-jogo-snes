#!/usr/bin/env python3
"""Rank observed WRAM candidates without claiming timer or gameplay equivalence."""
import argparse,csv,json,collections
from pathlib import Path

def analyze(writes,video):
    with open(writes,newline='',encoding='utf-8') as f: events=list(csv.DictReader(f))
    with open(video,newline='',encoding='utf-8') as f: frames=list(csv.DictReader(f))
    if not events or not frames: raise ValueError('Nonempty WRAM writer and video traces required')
    require={'frame','address','old','new','writer_pc'}
    if not require.issubset(events[0]) or not {'frame','framebuffer'}.issubset(frames[0]):raise ValueError('Required CSV columns absent')
    hashes={}
    for x in frames:
        frame=int(x['frame'])
        if frame in hashes:raise ValueError('Duplicate video frame')
        hashes[frame]=x['framebuffer']
    ordered_frames=sorted(hashes)
    video_changes={f: (i>0 and hashes[f]!=hashes[ordered_frames[i-1]]) for i,f in enumerate(ordered_frames)}
    groups=collections.defaultdict(list)
    for e in events:
        a=int(e['address'].removeprefix('$'),16)
        if not 0x7e0000<=a<=0x7fffff:raise ValueError('Invalid WRAM address')
        old,new=int(e['old']),int(e['new'])
        if not 0<=old<=255 or not 0<=new<=255:raise ValueError('Invalid WRAM byte value')
        groups[a].append((int(e['frame']),old,new,e['writer_pc'].upper()))
    items=[]
    for addr,rows in groups.items():
        rows.sort(key=lambda x:x[0]); changes=[r for r in rows if r[1]!=r[2]]
        reductions=[r for r in changes if r[2]==r[1]-1]
        # Explicit sequence can occur over many frames, but must be observed in order.
        countdown=[]
        for r in changes:
            if r[1:3]==((3,2),(2,1),(1,0))[len(countdown)]:
                countdown.append({'frame':r[0],'from':r[1],'to':r[2],'writer_pc':'$'+r[3]})
                if len(countdown)==3:break
        writers=collections.Counter('$'+r[3] for r in changes)
        matched=sum(r[0] in hashes for r in changes)
        changed_video=sum(bool(video_changes.get(r[0],False)) for r in changes)
        unseen=sum(r[0] not in hashes for r in changes)
        covered_ratio=round(matched/len(changes),4) if changes else 0.0
        score= (60 if len(countdown)==3 else 15*len(countdown))+min(len(reductions),10)*2+min(matched,10)
        items.append({'address':f'${addr:06X}','rank_score_diagnostic_only':score,'writes':len(rows),
          'value_changes':len(changes),'decrement_by_one':len(reductions),'video_frames_matched':matched,'video_frames_changed':changed_video,
          'writer_changes_without_video':unseen,'video_coverage_ratio':covered_ratio,
          'ordered_03_02_01_00_observed':len(countdown)==3,'partial_sequence':countdown,
          'writers':dict(writers.most_common()),'timer_confirmed':False})
    items.sort(key=lambda x:(-x['rank_score_diagnostic_only'],x['address']))
    return {'schema':'forja65.get-ready-candidates.v23','candidates':items,
      'get_ready_confirmed':False,'gameplay_confirmed':False,
      'video_trace':{'frames':len(frames),'unique_frames':len(hashes),'duplicate_frames':0,
                     'first_frame':ordered_frames[0],'last_frame':ordered_frames[-1]},
      'limitations':['Memory value sequence is not proof of on-screen GET READY digits',
      'Framebuffer changes on matching frames do not establish causality',
      'A missing video frame is not a visual mismatch; capture coverage is reported explicitly',
      'Requires frame-aligned original SNES video and code path verification',
      'Character motion and firing need separate input-response checks',
      'C0:F923 is unresolved and must not be inferred from synthetic test data']}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('writes',type=Path);p.add_argument('video',type=Path);p.add_argument('--out',type=Path)
    a=p.parse_args();data=analyze(a.writes,a.video);payload=json.dumps(data,indent=2,ensure_ascii=False)+'\n'
    if a.out:a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(payload,encoding='utf-8')
    print(payload,end='')
if __name__=='__main__':main()
