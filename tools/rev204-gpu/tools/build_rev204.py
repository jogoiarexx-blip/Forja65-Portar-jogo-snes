#!/usr/bin/env python3
"""Monta os templates REV204 (video GPU) e injeta no forja65-core.js."""
import base64, os, re, subprocess, sys
G=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
core=sys.argv[1]
S=os.path.join(G,'shaders')
rd=lambda *p: open(os.path.join(G,*p)).read()
# SPIR-V
for n in ('vk.vert','vk.frag'):
    subprocess.run(['glslangValidator','-V','-g0',os.path.join(S,n),'-o',os.path.join(S,n+'.spv')],check=True,capture_output=True)
b64=lambda n: base64.b64encode(open(os.path.join(S,n+'.spv'),'rb').read()).decode()
common=rd('gpu_common.inc')
subs={'@@FJ_BODY@@':rd('shaders','body.glsl'),'@@FJ_GL_VERT@@':rd('shaders','gl330.vert'),'@@FJ_GL_FRAG_PRE@@':rd('shaders','pre_gl330.frag'),
 '@@FJ_GL_FRAG_POST@@':rd('shaders','post_glsl.frag'),'@@FJ_HLSL_PRE@@':rd('shaders','pre_hlsl.txt'),'@@FJ_HLSL_POST@@':rd('shaders','post_hlsl.txt'),
 '@@FJ_HLSL_VS@@':rd('shaders','vs.hlsl'),'@@FJ_VK_VERT64@@':b64('vk.vert'),'@@FJ_VK_FRAG64@@':b64('vk.frag')}
for k,v in subs.items():
    assert k in common,k
    common=common.replace(k,v)
assert '@@' not in common
core_cpp='#if (defined(_WIN32)||defined(__linux__))&&!defined(FORJA65_VIDEO_NO_GPU)\n'+common+rd('gpu_d3d11.inc')+rd('gpu_vulkan.inc')+rd('gpu_presenter.inc')+'#endif\n'
prelude=('// Forja65 REV204: declaracoes para a apresentacao pela GPU (carregadas em tempo de execucao, sem SDK).\n'
 '#ifdef _WIN32\n#include <d3d11.h>\n#include <dxgi.h>\n#include <d3dcompiler.h>\n#endif\n'
 '#if defined(_WIN32)||defined(__linux__)\n'+rd('vk_min.h')+'#endif\n')
linux_video=rd('linux_video.inc')
host=rd('linux_host.hpp')
readme=('Forja65 REV204 - shaders dos filtros de video na GPU\n\n'
 'forja65-filters.glsl e o corpo comum (mesmo texto em GLSL e HLSL, por macros). O runtime monta:\n'
 '- OpenGL 3.3: prefixo GLSL 330 + corpo + main (compilado pelo driver);\n'
 '- Direct3D 11: prefixo HLSL + corpo + psMain (compilado por D3DCompile, ps_4_0);\n'
 '- Vulkan: SPIR-V embutido, gerado com glslangValidator -V a partir do prefixo GLSL 450 + corpo.\n'
 'Os filtros seguem os da CPU (REV198): sharp, nearest, bilinear, FXAA, Scale2x/3x (regras na CPU), CRT, LCD e CAS.\n')
for name,txt in (('core',core_cpp),('prelude',prelude),('linux_video',linux_video),('host',host),('body',rd('shaders','body.glsl'))):
    assert '`' not in txt and '${' not in txt, name
doc=rd('VIDEO-GPU-REV204.txt')
js=open(core).read()
consts=('const FORJA65_REV204_GPU_PRELUDE=String.raw`'+prelude+'`;\n'
 'const FORJA65_REV204_GPU_CORE=String.raw`'+core_cpp+'`;\n'
 'const FORJA65_REV204_LINUX_VIDEO=String.raw`'+linux_video+'`;\n'
 'const FORJA65_REV204_SHADER_BODY_FILE=String.raw`'+rd('shaders','body.glsl')+'`;\n'
 'const FORJA65_REV204_SHADER_README='+repr(readme).replace("'",'"') if False else None)
import json
consts=('const FORJA65_REV204_GPU_PRELUDE=String.raw`'+prelude+'`;\n'
 'const FORJA65_REV204_GPU_CORE=String.raw`'+core_cpp+'`;\n'
 'const FORJA65_REV204_LINUX_VIDEO=String.raw`'+linux_video+'`;\n'
 'const FORJA65_REV204_SHADER_BODY_FILE=String.raw`'+rd('shaders','body.glsl')+'`;\n'
 'const FORJA65_REV204_SHADER_README='+json.dumps(readme)+';\n'
 'const FORJA65_REV204_DOC='+json.dumps(doc)+';\n')
# troca o host Linux REV203
m=re.search(r'const FORJA65_REV203_LINUX_HOST=String\.raw`.*?`;\n',js,re.S)
assert m
js=js[:m.start()]+'const FORJA65_REV203_LINUX_HOST=String.raw`'+host+'`;\n'+js[m.end():]
# remove injecao anterior (reexecucao)
js=re.sub(r'// REV204-GPU-BEGIN\n.*?// REV204-GPU-END\n','',js,flags=re.S)
anchor='function generateProject(rom,a,options={}){'
assert js.count(anchor)==1
js=js.replace(anchor,'// REV204-GPU-BEGIN\n'+consts+rd('rev204_attach.js')+'// REV204-GPU-END\n'+anchor)
call='  attachRev203Host(files);\n'
assert js.count(call)==1
if 'attachRev204Gpu(files);' not in js: js=js.replace(call,call+'  attachRev204Gpu(files);\n')
open(core,'w').write(js)
print('ok core_cpp',len(core_cpp),'prelude',len(prelude))
