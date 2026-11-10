import re,subprocess,sys,os
mn=sys.argv[1]
t=open(mn).read()
structs=re.findall(r'typedef (?:struct|union) (\w+) \{(.*?)\}\s*\w+\s*;',t,re.S)
lines=[]
for name,body in structs:
    if name.startswith('VkWin32'):continue
    lines.append('P("%s",sizeof(%s),0,"");'%(name,name))
    for m in body.split(';'):
        m=m.strip()
        if not m:continue
        mm=re.search(r'(\w+)\s*(\[[^\]]*\])?$',m)
        if mm: lines.append('P("%s",offsetof(%s,%s),1,"%s");'%(name,name,mm.group(1),mm.group(1)))
prog=lambda inc:'#include <stdio.h>\n#include <stddef.h>\n%s\n#define P(a,b,c,d) printf("%%s %%s %%zu\\n",a,d,(size_t)(b))\nint main(){%s return 0;}\n'%(inc,'\n'.join(lines))
for tag,inc in [('min','#include "%s"'%os.path.abspath(mn)),('real','#define VK_NO_PROTOTYPES\n#include <vulkan/vulkan_core.h>')]:
    open('/tmp/claude-0/abi_%s.c'%tag,'w').write(prog(inc))
    subprocess.run(['gcc','-o','/tmp/claude-0/abi_%s'%tag,'/tmp/claude-0/abi_%s.c'%tag],check=True)
a=subprocess.run(['/tmp/claude-0/abi_min'],capture_output=True,text=True).stdout
b=subprocess.run(['/tmp/claude-0/abi_real'],capture_output=True,text=True).stdout
print('structs',len(structs),'checks',len(a.splitlines()),'EQUAL' if a==b else 'DIFF')
