#!/usr/bin/env python3
"""Gera forja_vk_min.h: so as declaracoes Vulkan usadas pelo backend do Forja65 (extraidas do vulkan_core.h oficial).
Uso: make_vk_min.py vulkan_core.h backend.inc saida.h"""
import re, subprocess, sys
hdr, use, out = sys.argv[1:4]
pp = subprocess.run(['gcc','-E','-P','-nostdinc','-I',__import__('os').path.join(__import__('os').path.dirname(__file__),'stub'),'-I','/usr/include','-DVK_NO_PROTOTYPES','-x','c','-'], input='#include "%s"\n'%hdr,
                    capture_output=True, text=True, check=True).stdout
version = re.search(r'#define VK_HEADER_VERSION (\d+)', open(hdr).read()).group(1)
# separa declaracoes de nivel superior
decls=[]; depth=0; cur=''
for ch in pp:
    cur+=ch
    if ch=='{': depth+=1
    elif ch=='}': depth-=1
    elif ch==';' and depth==0:
        s=cur.strip();
        if s: decls.append(s)
        cur=''
ident=re.compile(r'\b[A-Za-z_][A-Za-z0-9_]*\b')
def names(d):
    d1=re.sub(r'\s+',' ',d)
    m=re.match(r'typedef (struct|union|enum) (\w+) \{',d1)
    if m: return {m.group(2)} | set(re.findall(r'\}\s*(\w+)\s*;?$',d1))
    m=re.match(r'typedef .*\(\s*\*\s*(\w+)\)\s*\(',d1)
    if m: return {m.group(1)}
    m=re.match(r'typedef (?:struct |enum )?[\w\s\*]+?(\w+)\s*;$',d1)
    if m: return {m.group(1)}
    m=re.match(r'(?:static )?const \w+ (\w+) =',d1)
    if m: return {m.group(1)}
    m=re.match(r'(struct|enum) (\w+)\s*;',d1)
    if m: return {m.group(2)}
    return set()
table={}
for i,d in enumerate(decls):
    for n in names(d): table.setdefault(n,[]).append(i)
src=open(use).read()
want=set(re.findall(r'\b(?:PFN_vk\w+|Vk\w+)\b',src)) | {'PFN_vk'+n[2:] if not n.startswith('PFN') else n for n in re.findall(r'\bX\((vk\w+)\)',src)}
want |= {'PFN_vk'+n[2:] for n in re.findall(r'\bvk(\w+)\b',src)} if False else set()
want |= {'PFN_'+n for n in re.findall(r'X\((vk\w+)\)',src)}
want |= {'PFN_vkCreateInstance','PFN_vkGetInstanceProcAddr','PFN_vkVoidFunction'}
usedEnums=set(re.findall(r'\bVK_[A-Z0-9_]+\b',src))
enumOf={}
for i,d in enumerate(decls):
    if d.startswith('typedef enum'):
        for x in re.findall(r'\b(VK_[A-Z0-9_]+)\s*=',d): enumOf.setdefault(x,i)
need=set(); stack=[w for w in want if w in table]
for e in usedEnums:
    if e in enumOf:
        for n in names(decls[enumOf[e]]): stack.append(n)
missing=[w for w in want if w not in table and not w.startswith('VkWin32') and w not in ('PFN_vkCreateWin32SurfaceKHR',)]
while stack:
    n=stack.pop()
    for i in table[n]:
        if i in need: continue
        need.add(i)
        for t in ident.findall(decls[i]):
            if t in table and t!=n: stack.append(t)
def prune_enum(d):
    m=re.match(r'(typedef enum \w+ \{)(.*)(\}\s*\w+\s*;)$',d,re.S)
    if not m: return d
    items=[x.strip() for x in m.group(2).split(',') if x.strip()]
    keep=[x for x in items if x.split('=')[0].strip() in usedEnums or '_MAX_ENUM' in x.split('=')[0]]
    return m.group(1)+'\n  '+',\n  '.join(keep)+'\n'+m.group(3)
body=[]
for i in sorted(need):
    d=decls[i]
    if d.startswith('typedef enum'): d=prune_enum(d)
    body.append(d)
text='\n'.join(body)
with open(out,'w') as f:
    f.write('// Forja65 REV204: subconjunto das declaracoes do Vulkan (Khronos vulkan_core.h, VK_HEADER_VERSION %s,\n'%version)
    f.write('// Apache-2.0 OR MIT) usado pelo backend de video. Sem prototipos: as funcoes sao carregadas em tempo de execucao.\n')
    f.write('#ifndef VULKAN_CORE_H_\n#define FORJA65_VK_MIN 1\n#include <stddef.h>\n#include <stdint.h>\n')
    f.write(text+'\n')
    f.write('#define VK_NULL_HANDLE 0\n#define VK_TRUE 1U\n#define VK_FALSE 0U\n#define VK_WHOLE_SIZE (~0ULL)\n#define VK_SUBPASS_EXTERNAL (~0U)\n#define VK_QUEUE_FAMILY_IGNORED (~0U)\n')
    f.write('#define VK_MAKE_API_VERSION(variant, major, minor, patch) ((((uint32_t)(variant)) << 29U) | (((uint32_t)(major)) << 22U) | (((uint32_t)(minor)) << 12U) | ((uint32_t)(patch)))\n')
    f.write('#endif\n')
print('decls',len(need),'bytes',len(text),'missing',missing)
# --- extra Win32 (estruturas pequenas, escritas a mao conforme vulkan_win32.h) ---
with open(out) as f: t=f.read()
win32='''#if defined(_WIN32)
typedef VkFlags VkWin32SurfaceCreateFlagsKHR;
typedef struct VkWin32SurfaceCreateInfoKHR {
    VkStructureType                 sType;
    const void*                     pNext;
    VkWin32SurfaceCreateFlagsKHR    flags;
    HINSTANCE                       hinstance;
    HWND                            hwnd;
} VkWin32SurfaceCreateInfoKHR;
typedef VkResult (*PFN_vkCreateWin32SurfaceKHR)(VkInstance instance, const VkWin32SurfaceCreateInfoKHR* pCreateInfo, const VkAllocationCallbacks* pAllocator, VkSurfaceKHR* pSurface);
#endif
'''
t=t.replace('#define VK_NULL_HANDLE 0\n', win32+'#define VK_NULL_HANDLE 0\n')
if 'VK_STRUCTURE_TYPE_WIN32_SURFACE_CREATE_INFO_KHR = 1000009000' not in t:
    t=t.replace('VK_STRUCTURE_TYPE_MAX_ENUM','VK_STRUCTURE_TYPE_WIN32_SURFACE_CREATE_INFO_KHR = 1000009000,\n  VK_STRUCTURE_TYPE_MAX_ENUM',1)
open(out,'w').write(t)
