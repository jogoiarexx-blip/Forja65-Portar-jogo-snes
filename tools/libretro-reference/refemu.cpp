// Forja65 REV133 - host minimo de libretro para usar um emulador (ex.: snes9x_libretro) como REFERENCIA
// de desenvolvimento: gerar traces de controle, comparar quadros/audio com o port. Nenhum codigo de
// emulador e incluido; o core libretro e carregado em tempo de execucao (o usuario fornece o arquivo).
// Compilar: g++ -O2 -std=c++17 -I<pasta com libretro.h> refemu.cpp -o refemu -ldl   (Windows: sem -ldl)
// libretro.h: https://github.com/libretro/libretro-common/blob/master/include/libretro.h (licenca MIT)
//   dump PATH         estado completo (REV138, mesmo formato do "dump" do port: CPU, WRAM, VRAM, OAM, CGRAM, quadro)
//   cputrace PATH N   (REV138) trace por instrucao das proximas N instrucoes (core com forja_probe_trace)
// Protocolo por stdin (uma linha por comando), respostas em stdout:
//   run N MASK [MASK2] roda N quadros com joypads 1 e 2 (MASK2 omitido = zero); pad1 = MASK (hex, bits do registrador $4218: B=8000 Y=4000 ...)
//   trace FILE N      roda ate o quadro N usando um arquivo FORJA65_INPUT_TRACE
//   save SLOT | load SLOT     savestate em memoria
//   savefile PATH | loadfile PATH
//   ram ADDR LEN      imprime WRAM (offset 0..1FFFF) em hex
//   shot PATH         grava o ultimo quadro em PPM
//   audio PATH|off   grava o audio (PCM 16 bits estereo) em PATH
//   frame             imprime o numero do quadro
//   quit
// Variavel FORJA_REFEMU_VARS="chave=valor,..." responde as opcoes do core (REV197; ex.: bsnes_dsp_fast=OFF).
#include "libretro.h"  // MIT, libretro-common
#ifdef _WIN32
#include <windows.h>
#define dlopen(p,f) ((void*)LoadLibraryA(p))
#define dlsym(h,n) ((void*)GetProcAddress((HMODULE)(h),n))
static const char* dlerror(){return "LoadLibrary falhou";}
#else
#include <dlfcn.h>
#endif
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
#include <map>
#include <fstream>
#include <sstream>
#include <iostream>
static retro_environment_t envcb;
static std::vector<std::uint32_t> fb; static unsigned fbw=0,fbh=0; static retro_pixel_format pixfmt=RETRO_PIXEL_FORMAT_0RGB1555;
static unsigned joy=0,joy2=0; static unsigned long long frameNo=0;
static bool env(unsigned cmd,void*data){
  switch(cmd){
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT: pixfmt=*(retro_pixel_format*)data; return true;
    case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY: case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY: *(const char**)data="."; return true;
    case RETRO_ENVIRONMENT_GET_CAN_DUPE: *(bool*)data=true; return true;
    case RETRO_ENVIRONMENT_GET_VARIABLE: { // REV197: FORJA_REFEMU_VARS="chave=valor,..." (ex.: bsnes_dsp_fast=OFF)
      auto*v=(retro_variable*)data; v->value=nullptr; static std::map<std::string,std::string> vars=[](){std::map<std::string,std::string> m;
        if(const char*e=std::getenv("FORJA_REFEMU_VARS")){std::stringstream ss(e);std::string kv;while(std::getline(ss,kv,',')){auto q=kv.find('=');if(q!=std::string::npos)m[kv.substr(0,q)]=kv.substr(q+1);}}return m;}();
      auto it=vars.find(v->key?v->key:""); if(it==vars.end())return false; v->value=it->second.c_str(); return true; }
    case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE: *(bool*)data=false; return true;
    case RETRO_ENVIRONMENT_GET_LOG_INTERFACE: return false;
    default: return false;
  }
}
static void video(const void*data,unsigned w,unsigned h,size_t pitch){
  if(!data)return; fbw=w;fbh=h;fb.resize(w*h);
  for(unsigned y=0;y<h;y++){const auto*row=(const std::uint8_t*)data+y*pitch;for(unsigned x=0;x<w;x++){std::uint32_t c;
    if(pixfmt==RETRO_PIXEL_FORMAT_XRGB8888)c=((const std::uint32_t*)row)[x]&0xFFFFFF;
    else if(pixfmt==RETRO_PIXEL_FORMAT_RGB565){std::uint16_t p=((const std::uint16_t*)row)[x];c=(((p>>11)&31)*255/31)<<16|(((p>>5)&63)*255/63)<<8|((p&31)*255/31);}
    else {std::uint16_t p=((const std::uint16_t*)row)[x];c=(((p>>10)&31)*255/31)<<16|(((p>>5)&31)*255/31)<<8|((p&31)*255/31);}
    fb[y*w+x]=c;}}
}
static FILE* wavf=nullptr; static void audio(int16_t l,int16_t r){if(wavf){int16_t b[2]={l,r};fwrite(b,2,2,wavf);}} static size_t audioBatch(const int16_t*d,size_t n){if(wavf)fwrite(d,4,n,wavf);return n;}
static void poll(){}
static int16_t state(unsigned port,unsigned dev,unsigned idx,unsigned id){
  if(port>1||dev!=RETRO_DEVICE_JOYPAD)return 0; if(id>11)return 0; return ((port?joy2:joy)>>(15-id))&1u;
}
typedef void(*probe_buf)(uint8_t*);typedef void(*probe_cpu)(uint32_t*);typedef void(*probe_trace)(const char*,unsigned long long);
#define SYM(n) auto n=(decltype(&::n))dlsym(h,#n); if(!n){std::fprintf(stderr,"sem simbolo %s\n",#n);return 2;}
int main(int argc,char**argv){
  if(argc<3){std::fprintf(stderr,"uso: refemu core.so rom.sfc\n");return 2;}
  void*h=dlopen(argv[1],RTLD_NOW); if(!h){std::fprintf(stderr,"%s\n",dlerror());return 2;}
  SYM(retro_set_environment) SYM(retro_set_video_refresh) SYM(retro_set_audio_sample) SYM(retro_set_audio_sample_batch)
  SYM(retro_set_input_poll) SYM(retro_set_input_state) SYM(retro_init) SYM(retro_load_game) SYM(retro_run)
  SYM(retro_serialize_size) SYM(retro_serialize) SYM(retro_unserialize) SYM(retro_get_memory_data) SYM(retro_get_memory_size)
  retro_set_environment(env); retro_set_video_refresh(video); retro_set_audio_sample(audio); retro_set_audio_sample_batch(audioBatch);
  retro_set_input_poll(poll); retro_set_input_state(state); retro_init();
  std::ifstream rf(argv[2],std::ios::binary); std::vector<char> rom((std::istreambuf_iterator<char>(rf)),{});
  retro_game_info gi{argv[2],rom.data(),rom.size(),nullptr}; if(!retro_load_game(&gi)){std::fprintf(stderr,"falha ao carregar ROM\n");return 2;}
  auto pOam=(probe_buf)dlsym(h,"forja_probe_oam");auto pCg=(probe_buf)dlsym(h,"forja_probe_cgram");auto pVram=(probe_buf)dlsym(h,"forja_probe_vram");
  auto pCpu=(probe_cpu)dlsym(h,"forja_probe_cpu");auto pTrace=(probe_trace)dlsym(h,"forja_probe_trace");auto pAram=(probe_buf)dlsym(h,"forja_probe_aram");
  std::cout<<"ready"<<std::endl;
  std::map<std::string,std::pair<std::vector<std::uint8_t>,unsigned long long>> slots;
  auto step=[&](){retro_run();frameNo++;};
  std::string line;
  while(std::getline(std::cin,line)){
    std::istringstream in(line); std::string c; in>>c; if(c.empty())continue;
    if(c=="quit")break;
    else if(c=="run"){unsigned long long n;std::string m,m2;in>>n>>m;in>>m2;joy=(unsigned)std::strtoul(m.c_str(),nullptr,16);joy2=m2.empty()?0u:(unsigned)std::strtoul(m2.c_str(),nullptr,16);for(unsigned long long k=0;k<n;k++)step();std::cout<<"ok "<<frameNo<<"\n";}
    else if(c=="trace"){std::string p;unsigned long long until;in>>p>>until;std::ifstream t(p);std::string q;struct Event{unsigned long long frame;unsigned p1,p2;};std::vector<Event> ev;
      while(std::getline(t,q)){if(q.rfind("frame=",0)!=0)continue;unsigned long long f=std::strtoull(q.c_str()+6,nullptr,10);auto j=q.find("joy1=");auto j2=q.find("joy2=");ev.push_back({f,(unsigned)std::strtoul(q.c_str()+j+5,nullptr,16),j2==std::string::npos?0u:(unsigned)std::strtoul(q.c_str()+j2+5,nullptr,16)});}
      size_t k=0;while(frameNo<until){while(k<ev.size()&&ev[k].frame<=frameNo){joy=ev[k].p1;joy2=ev[k].p2;k++;}step();}std::cout<<"ok "<<frameNo<<"\n";}
    else if(c=="save"||c=="savefile"){std::string s;in>>s;std::vector<std::uint8_t> b(retro_serialize_size());retro_serialize(b.data(),b.size());
      if(c=="save")slots[s]={b,frameNo};else{std::ofstream o(s,std::ios::binary);o.write((char*)&frameNo,8);o.write((char*)b.data(),b.size());}std::cout<<"ok\n";}
    else if(c=="load"||c=="loadfile"){std::string s;in>>s;std::vector<std::uint8_t> b;unsigned long long f=0;
      if(c=="load"){auto it=slots.find(s);if(it==slots.end()){std::cout<<"err\n";continue;}b=it->second.first;f=it->second.second;}
      else{std::ifstream i(s,std::ios::binary);i.read((char*)&f,8);b.assign(std::istreambuf_iterator<char>(i),{});}
      retro_unserialize(b.data(),b.size());frameNo=f;std::cout<<"ok "<<frameNo<<"\n";}
    else if(c=="ram"){unsigned a,n;in>>std::hex>>a>>n;auto*r=(std::uint8_t*)retro_get_memory_data(RETRO_MEMORY_SYSTEM_RAM);std::ostringstream o;for(unsigned k=0;k<n;k++){char b[4];std::snprintf(b,4,"%02x",r[(a+k)&0x1FFFF]);o<<b;}std::cout<<o.str()<<"\n";}
    else if(c=="shot"){std::string p;in>>p;std::ofstream o(p,std::ios::binary);o<<"P6\n"<<fbw<<" "<<fbh<<"\n255\n";for(auto v:fb){char px[3]={(char)(v>>16),(char)(v>>8),(char)v};o.write(px,3);}std::cout<<"ok\n";}
    else if(c=="audio"){std::string p;in>>p;if(wavf)fclose(wavf);wavf=p=="off"?nullptr:fopen(p.c_str(),"wb");std::cout<<"ok\n";}
    else if(c=="dump"){std::string p;in>>p;std::ofstream o(p,std::ios::binary);auto w32=[&](std::uint32_t v){o.write((const char*)&v,4);};
      std::uint32_t cpu[9]{};if(pCpu)pCpu(cpu);o.write("FJDMP1\0\0",8);o.write((const char*)&frameNo,8);
      // PC, A, X, Y, S, D, DB, P, E (E nao exportado: deduzido de S alto=01 em modo emulacao nao e confiavel -> 0xFF), linha V
      for(int k=0;k<7;k++)w32(cpu[k]);w32(cpu[7]&0xFFu);w32((cpu[7]>>8)&1u);w32(cpu[8]);
      auto*r=(std::uint8_t*)retro_get_memory_data(RETRO_MEMORY_SYSTEM_RAM);o.write((const char*)r,0x20000);
      std::vector<std::uint8_t> b(0x10000);if(pVram)pVram(b.data());o.write((const char*)b.data(),0x10000);
      b.assign(544,0);if(pOam)pOam(b.data());o.write((const char*)b.data(),544);b.assign(512,0);if(pCg)pCg(b.data());o.write((const char*)b.data(),512);
      w32(fbw);w32(fbh);for(auto v:fb){std::uint32_t q=0xFF000000u|v;o.write((const char*)&q,4);}std::cout<<"ok\n";}
    else if(c=="aram"){std::string p;in>>p;std::vector<uint8_t> v(65536+16);if(pAram)pAram(v.data());std::ofstream o(p,std::ios::binary);o.write((const char*)v.data(),v.size());std::cout<<(pAram?"ok\n":"err\n");}
    else if(c=="cputrace"){std::string p;unsigned long long n=0;in>>p>>n;if(pTrace)pTrace(p=="off"?"":p.c_str(),n);std::cout<<(pTrace?"ok\n":"err\n");}
    else if(c=="frame"){std::cout<<frameNo<<"\n";}
    else std::cout<<"err cmd\n";
    std::cout.flush();
  }
  return 0;
}
