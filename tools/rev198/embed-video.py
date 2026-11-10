#!/usr/bin/env python3
"""REV198: (re)gera a constante forja65VideoHeader em forja65-core.js a partir de tools/rev198/forja_video.hpp."""
import json,pathlib,re,sys
root=pathlib.Path(__file__).resolve().parents[2]
core=root/'forja65-core.js';hdr=(root/'tools/rev198/forja_video.hpp').read_text()
s=core.read_text()
line='const forja65VideoHeader='+json.dumps(hdr,ensure_ascii=True)+';\n'
if 'const forja65VideoHeader=' in s:
    s=re.sub(r'const forja65VideoHeader=.*?;\n',lambda m:line,s,count=1)
else:
    i=s.index('const forja65PcmAudioHeader=');j=s.index('\n',i)+1
    s=s[:j]+line+s[j:]
core.write_text(s);print('ok',len(hdr))
