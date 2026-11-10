#if defined(__linux__)&&!defined(FORJA65_VIDEO_NO_GPU)
// ---------------------------------------------------------------- janela Linux (SDL2) com GPU ou CPU (REV204)
// Mesmas teclas do Windows: F7/Shift+F7 filtro, F9 backend de video, F10 aspecto, F11 ou Alt+Enter tela cheia, F12 captura BMP.
// F5 pausa e F8 captura PPM do framebuffer continuam no host SDL.
class LinuxVideo {
public:
  Settings s;
  void open(ForjaLinuxSDL2& h){
    s=loadSettings();
    {std::ifstream probe("forja65-video.ini");if(!probe)saveSettings(loadSettings("forja65-video.ini",false));}
    h.load();
    if(s.fullscreen)h.setFullscreen(true);
    reopen(h);
  }
  void close(ForjaLinuxSDL2& h){gpu.close();h.closeWindow();}
  void present(ForjaLinuxSDL2& h,const std::uint32_t* fb,unsigned fbW,unsigned fbH){
    for(const auto k:h.takeKeys())key(h,k);
    lastFb=fb;lastFbW=fbW;lastFbH=fbH;
    int cw=0,ch=0;h.drawableSize(cw,ch);if(cw<=0||ch<=0)return;
    if(gpu.active()){
      std::string why;
      if(gpu.present(fb,fbW,fbH,(unsigned)cw,(unsigned)ch,s,why)){if(fbW!=lastW||fbH!=lastH){lastW=fbW;lastH=fbH;title(h);}return;}
      gpuLog("falha durante o jogo ("+gpu.label()+"): "+why+"; voltando para a CPU");
      gpu.close();openCpu(h);title(h);h.drawableSize(cw,ch);if(cw<=0||ch<=0)return;
    }
    r.render(fb,fbW,fbH,(unsigned)cw,(unsigned)ch,s);
    h.showCanvas(r.frame().data(),r.width(),r.height());
    if(fbW!=lastW||fbH!=lastH){lastW=fbW;lastH=fbH;title(h);}
  }
  std::string backendLabel()const{return gpu.active()?gpu.label()+" - "+gpu.device():std::string("CPU (SDL)");}
private:
  GpuPresenter gpu;Renderer r;const std::uint32_t* lastFb{};unsigned lastFbW{},lastFbH{},lastW{256},lastH{224},shots{};
  Resolution initialSize(ForjaLinuxSDL2& h)const{unsigned w,hh;h.usableArea(w,hh);return windowClientFor(s,w>80?w-40:w,hh>120?hh-80:hh);}
  bool tryGpu(ForjaLinuxSDL2& h,GpuApi a){
    std::string why;const Resolution c=initialSize(h);GpuSurface sf;
    if(a==GpuApi::OpenGL){
      if(!h.glAvailable()){gpuLog("OpenGL: SDL2 sem funcoes de OpenGL");return false;}
      h.glPrepare();
      if(!h.openWindow(ForjaLinuxSDL2::kWindowOpenGL,(int)c.w,(int)c.h,why)||!h.glCreate(why)){gpuLog("OpenGL: "+why);h.closeWindow();return false;}
      sf.glProc=[&h](const char* n){return h.glProc(n);};sf.glSwap=[&h]{h.glSwap();};sf.glSwapInterval=[&h](int i){h.glInterval(i);};
    }else if(a==GpuApi::Vulkan){
      if(!h.vulkanAvailable()){gpuLog("Vulkan: SDL2 sem suporte a Vulkan (precisa 2.0.6+)");return false;}
      if(!h.openWindow(ForjaLinuxSDL2::kWindowVulkan,(int)c.w,(int)c.h,why)){gpuLog("Vulkan: "+why);h.closeWindow();return false;}
      sf.vkExtensions=[&h]{return h.vkExtensions();};sf.vkSurface=[&h](void* i,std::uint64_t* o){return h.vkSurface(i,o);};sf.vkGetInstanceProcAddr=h.vkLoader();
    }else{gpuLog(std::string(gpuApiLabel(a))+": so existe no Windows");return false;}
    if(!gpu.open(a,sf,s,why)){gpuLog(std::string(gpuApiLabel(a))+": "+why);gpu.close();h.closeWindow();return false;}
    gpuLog("ativo: "+gpu.label()+" - "+gpu.device());
    return true;
  }
  void openCpu(ForjaLinuxSDL2& h){
    std::string why;const Resolution c=initialSize(h);
    if(!h.openWindow(0,(int)c.w,(int)c.h,why)||!h.openRenderer(why))throw std::runtime_error("SDL2 nao abriu a janela: "+why);
    gpuLog("ativo: CPU (SDL), filtros na CPU");
  }
  void reopen(ForjaLinuxSDL2& h){
    gpu.close();h.closeWindow();gpuLog("Forja65 REV204 - video Linux, backend pedido: "+s.backend+", placa: "+s.gpu,true);
    bool ok=false;for(const auto a:gpuCandidates(s))if((ok=tryGpu(h,a)))break;
    if(!ok)openCpu(h);
    title(h);
  }
  void key(ForjaLinuxSDL2& h,std::uint32_t k){
    const bool shift=(k&ForjaLinuxSDL2::kShift)!=0,alt=(k&ForjaLinuxSDL2::kAlt)!=0;
    const std::uint32_t code=k&~(ForjaLinuxSDL2::kShift|ForjaLinuxSDL2::kAlt);
    const unsigned nf=unsigned(Filter::Count),na=unsigned(Aspect::Count);
    if(code==0x40000040u)s.filter=Filter((unsigned(s.filter)+(shift?nf-1u:1u))%nf);
    else if(code==0x40000043u)s.aspect=Aspect((unsigned(s.aspect)+(shift?na-1u:1u))%na);
    else if(code==0x40000044u||(code==0x0Du&&alt)){s.fullscreen=!s.fullscreen;h.setFullscreen(s.fullscreen);}
    else if(code==0x40000042u){s.backend=nextGpuBackend(s.backend);saveSettings(s);reopen(h);return;}
    else if(code==0x40000045u){screenshot(h);return;}
    else return;
    saveSettings(s);title(h);
  }
  void screenshot(ForjaLinuxSDL2& h){
    if(!lastFb)return;int cw=0,ch=0;h.drawableSize(cw,ch);if(cw<=0||ch<=0)return;
    r.render(lastFb,lastFbW,lastFbH,(unsigned)cw,(unsigned)ch,s); // mesma imagem pelo filtro da CPU
    const Rect& q=r.rect;if(q.w<=0||q.h<=0)return;
    char name[64];std::snprintf(name,sizeof(name),"forja65-shot-%03u.bmp",++shots);
    writeBmp(name,r.frame().data()+(std::size_t)q.y*r.width()+q.x,(unsigned)q.w,(unsigned)q.h,r.width());
  }
  void title(ForjaLinuxSDL2& h){
    h.title("Forja65 Native Port - "+std::string(filterLabel(s.filter))+" | "+resolutionText(s)+" | "+aspectKey(s.aspect)+" | "+backendLabel()+
      " | F7 filtro  F9 video  F10 aspecto  F11 tela cheia  F12 captura  F5 pausa");
  }
};
#endif
