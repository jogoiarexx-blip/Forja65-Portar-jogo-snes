import sys,pickle
d=pickle.load(open(sys.argv[1],'rb'))
out=['# FORJA65_INPUT_TRACE 1','# FORJA65_ENV FORJA65_SPC_PROFILE=reference','# FORJA65_ENV FORJA65_EXECUTION=reference']+['# '+x for x in sys.argv[3:]]
last=None
for f,m in sorted(d['ev']):
    if m!=last: out.append(f'frame={f} joy1={m:04x} joy2=0000'); last=m
out.append(f'# fim quadro {d["end"]}')
open(sys.argv[2],'w').write('\n'.join(out)+'\n'); print(len(out),d['end'])
