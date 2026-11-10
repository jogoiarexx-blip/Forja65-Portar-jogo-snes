#!/usr/bin/env python3
"""Summarize preserved before/after logs without changing historical tests."""
import json,pathlib,re
root=pathlib.Path(__file__).resolve().parents[1]
folder=root/'reports/rie-v043694';result={}
for label in ('baseline','after'):
 names=set(json.loads((folder/f'{label}-js-test-names.json').read_text()))
 statuses={name:status for status,name in re.findall(r'^(PASS|FAIL) (\S+)',(folder/f'{label}-js.log').read_text(),re.M) if name in names}
 supplements=[]
 if label=='after' and (folder/'final-focused-results.json').exists():
  for row in json.loads((folder/'final-focused-results.json').read_text()):
   if row['test'] in names:statuses[row['test']]='PASS' if row['exit']==0 else 'FAIL';supplements.append(row['test'])
 result[label]={'total':len(names),'attempted':len(statuses),'passed':sum(v=='PASS' for v in statuses.values()),'failed':sorted(n for n,s in statuses.items() if s=='FAIL'),'missing':sorted(names-set(statuses)),'finalFocusedOverrides':supplements}
result['complete']=not result['baseline']['missing'] and not result['after']['missing']
result['newFailures']=sorted(set(result['after']['failed'])-set(result['baseline']['failed']))
result['resolvedFailures']=sorted((set(result['baseline']['failed'])-set(result['after']['failed']))-set(result['after']['missing']))
result['python']={label:(folder/f'{label}-python.log').read_text().splitlines()[-1] for label in ('baseline','after')}
result['limitations']=['Full JS runs were interrupted by the session; missing tests were resumed with 180-second per-test bounds. Raw logs were retained.','Final focused overrides are explicit because VERSION metadata and two review findings were fixed after the original run started.','No Windows or commercial gameplay validation.']
(folder/'suite-comparison.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:({kk:vv for kk,vv in v.items() if kk not in ('failed','missing','finalFocusedOverrides')} if isinstance(v,dict)else v) for k,v in result.items()},indent=2))
if not result['complete']:raise SystemExit(2)
if result['newFailures']:raise SystemExit(1)
