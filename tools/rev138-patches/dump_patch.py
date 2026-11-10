"""REV138: comando 'dump' no modo de controle (estado completo para comparar com a referencia)."""
import json,sys
SHOT='if(c=="shot"){std::string p;in>>p;writeFramePpm(p);std::printf("ok\\n");std::fflush(stdout);continue;}'
DUMP=('if(c=="dump"){std::string p;in>>p;std::ofstream o(p,std::ios::binary);auto w32=[&](std::uint32_t v){o.write((const char*)&v,4);};'
 'const CpuState*cp=(const CpuState*)forja65ControlCpu;o.write("FJDMP1\\0\\0",8);const std::uint64_t fr=frameCounter;o.write((const char*)&fr,8);'
 'w32(lastInstructionPc&0xFFFFFFu);w32(cp?cp->a:0u);w32(cp?cp->x:0u);w32(cp?cp->y:0u);w32(cp?cp->s:0u);w32(cp?cp->d:0u);w32(cp?cp->db:0u);'
 'w32(cp?(unsigned)((cp->n<<7)|(cp->v<<6)|(cp->m8<<5)|(cp->x8<<4)|(cp->decimalMode<<3)|(cp->i<<2)|(cp->z<<1)|(cp->c?1:0)):0u);w32(cp?(cp->e?1u:0u):0u);w32(currentScanline);'
 'o.write((const char*)ram.data(),0x20000);o.write((const char*)ppu.vram.data(),0x10000);o.write((const char*)ppu.oam.data(),544);o.write((const char*)ppu.cgram.data(),512);'
 'w32(fbWidth);w32(fbHeight);o.write((const char*)framebuffer.data(),(std::streamsize)(framebuffer.size()*4));o.close();std::printf("ok\\n");std::fflush(stdout);continue;}')
DECL='inline const void* forja65ControlCpu=nullptr; // REV138: CpuState ativo (main.cpp), lido pelo comando "dump"\n'
def patch_runtime(t):
    if 'if(c=="dump")' in t: return t
    assert SHOT in t; t=t.replace(SHOT,SHOT+'\n    '+DUMP,1)
    a='// O port vira um'; assert a in t; t=t.replace(a,DECL+a,1); return t
def patch_main(m):
    if 'forja65ControlCpu=&cpu' in m: return m
    a='int main(){CpuState cpu;'; assert a in m; return m.replace(a,a+'forja65ControlCpu=&cpu;',1)
def js(s): return json.dumps(s)[1:-1]
if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='port':
        d=sys.argv[2]; p=d+'/src/runtime.hpp'; t=patch_runtime(open(p).read()); open(p,'w').write(t)
        p=d+'/src/main.cpp'; t=patch_main(open(p).read()); open(p,'w').write(t); print('port ok')
    else:
        p=sys.argv[2]; s=open(p).read()
        a=js(SHOT); assert s.count(a)==1, s.count(a)
        s=s.replace(a,a+js('\n    '+DUMP),1)
        b=js('// O port vira um'); assert s.count(b)==1, s.count(b)
        s=s.replace(b,js(DECL)+b,1)
        open(p,'w').write(s); print('core ok')
