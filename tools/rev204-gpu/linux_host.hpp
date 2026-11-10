#pragma once
// Forja65 REV203/REV204: host Linux SDL2 carregado em tempo de execucao (dlopen).
// Nao precisa de SDK do SDL2 para compilar. Nunca e iniciado nos replays headless.
// REV204: janela com OpenGL ou Vulkan para a apresentacao pela GPU, teclas de video e caminho da CPU com filtros.
#if defined(__linux__)
#include <dlfcn.h>
#include <cstdint>
#include <array>
#include <stdexcept>
#include <string>
#include <vector>
#include <algorithm>
#include <cstring>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <chrono>
#include <thread>

class ForjaLinuxSDL2 {
  using Win=void; using Renderer=void; using Texture=void; using Controller=void; using GLContext=void;
  struct SdlRect{int x,y,w,h;};
  void* library{}; Win* window{}; Renderer* renderer{}; Texture* texture{}; GLContext* glContext{};
  std::array<Controller*,2> pads{};
  unsigned texW{},texH{};
  bool initialized{},paused{},closed{},captureRequested{},legacyScale{},fullscreen{};
  std::uint32_t windowFlags{};
  std::uint64_t scanCount{};
  std::array<unsigned char,256> eventBytes{};
  std::vector<std::uint32_t> keys;
  int (*sdlInit)(std::uint32_t){};
  void (*sdlQuit)(){};
  Win* (*createWindow)(const char*,int,int,int,int,std::uint32_t){};
  void (*destroyWindow)(Win*){};
  Renderer* (*createRenderer)(Win*,int,std::uint32_t){};
  void (*destroyRenderer)(Renderer*){};
  Texture* (*createTexture)(Renderer*,std::uint32_t,int,int,int){};
  void (*destroyTexture)(Texture*){};
  int (*updateTexture)(Texture*,const void*,const void*,int){};
  int (*renderClear)(Renderer*){};
  int (*renderCopy)(Renderer*,Texture*,const void*,const void*){};
  void (*renderPresent)(Renderer*){};
  int (*renderIntegerScale)(Renderer*,int){};
  int (*renderLogicalSize)(Renderer*,int,int){};
  int (*pollEvent)(void*){};
  const std::uint8_t* (*getKeyboard)(int*){};
  void (*pumpEvents)(){};
  int (*numJoysticks)(){};
  int (*isGameController)(int){};
  Controller* (*openController)(int){};
  void (*closeController)(Controller*){};
  int (*controllerAttached)(Controller*){};
  std::uint8_t (*controllerButton)(Controller*,int){};
  std::int16_t (*controllerAxis)(Controller*,int){};
  int (*addMapping)(const char*){};
  // opcionais (REV204): ausentes = recurso indisponivel, nunca erro fatal
  int (*rendererOutputSize)(Renderer*,int*,int*){};
  void (*setTitle)(Win*,const char*){};
  int (*setFullscreenFn)(Win*,std::uint32_t){};
  void (*getWindowSize)(Win*,int*,int*){};
  int (*usableBounds)(int,SdlRect*){};
  const char* (*getError)(){};
  int (*glSetAttribute)(int,int){};
  void (*glResetAttributes)(){};
  GLContext* (*glCreateContext)(Win*){};
  int (*glMakeCurrent)(Win*,GLContext*){};
  void (*glDeleteContext)(GLContext*){};
  void* (*glGetProcAddress)(const char*){};
  void (*glSwapWindow)(Win*){};
  int (*glSetSwapInterval)(int){};
  void (*glGetDrawableSize)(Win*,int*,int*){};
  int (*vkGetInstanceExtensions)(Win*,unsigned*,const char**){};
  int (*vkCreateSurface)(Win*,void*,std::uint64_t*){};
  void* (*vkGetVkGetInstanceProcAddr)(){};
  void (*vkGetDrawableSize)(Win*,int*,int*){};
  template<class T> void symbol(T&fn,const char*name){
    fn=reinterpret_cast<T>(dlsym(library,name));
    if(!fn)throw std::runtime_error(std::string("SDL2 function missing: ")+name);
  }
  template<class T> void optional(T&fn,const char*name){fn=reinterpret_cast<T>(dlsym(library,name));}
  void scanPads(){
    if(scanCount++%120u!=0u)return;
    for(auto &p:pads){if(p){closeController(p);p=nullptr;}}
    unsigned n=0;for(int i=0;i<numJoysticks()&&n<2;i++){
      if(isGameController(i))if(auto*pad=openController(i))pads[n++]=pad;
    }
  }
  bool key(const std::uint8_t*kb,int n,int code)const{return kb&&code>=0&&code<n&&kb[code];}
  std::uint16_t samplePad(Controller*pad)const{
    if(!pad||!controllerAttached(pad))return 0;
    auto b=[&](int code){return controllerButton(pad,code)!=0;};
    std::uint16_t j=0;
    if(b(3)){j|=0x8000;}if(b(1)){j|=0x4000;}
    if(b(4)){j|=0x2000;}if(b(6)){j|=0x1000;}
    if(b(11)||controllerAxis(pad,1)<-9000)j|=0x0800;
    if(b(12)||controllerAxis(pad,1)>9000)j|=0x0400;
    if(b(13)||controllerAxis(pad,0)<-9000)j|=0x0200;
    if(b(14)||controllerAxis(pad,0)>9000)j|=0x0100;
    if(b(2)){j|=0x0080;}if(b(0)){j|=0x0040;}
    if(b(9)){j|=0x0020;}if(b(10)){j|=0x0010;}
    return j;
  }
  std::string sdlError()const{return getError?std::string(getError()):std::string();}
public:
  // Codigos das teclas de video enfileiradas por events(): sym do SDL | FJ_SHIFT | FJ_ALT.
  static constexpr std::uint32_t kShift=0x01000000u,kAlt=0x02000000u;
  static constexpr std::uint32_t kWindowOpenGL=0x00000002u,kWindowVulkan=0x10000000u;
  ForjaLinuxSDL2()=default;
  ForjaLinuxSDL2(const ForjaLinuxSDL2&)=delete;
  ForjaLinuxSDL2& operator=(const ForjaLinuxSDL2&)=delete;
  ~ForjaLinuxSDL2(){shutdown();}
  bool active()const{return initialized&&window;}
  bool isClosed()const{return closed;}
  bool takeCapture(){const bool requested=captureRequested;captureRequested=false;return requested;}
  std::vector<std::uint32_t> takeKeys(){std::vector<std::uint32_t> k;k.swap(keys);return k;}
  // Carrega a SDL2 e inicia video/controles, sem abrir janela.
  void load(){
    if(initialized)return;
    if(!library)library=dlopen("libSDL2-2.0.so.0",RTLD_NOW|RTLD_LOCAL);
    if(!library)library=dlopen("libSDL2.so",RTLD_NOW|RTLD_LOCAL);
    if(!library)throw std::runtime_error("SDL2 nao encontrada: instale libSDL2-2.0.so.0 para jogar no Linux");
    try{
      symbol(sdlInit,"SDL_Init");symbol(sdlQuit,"SDL_Quit");
      symbol(createWindow,"SDL_CreateWindow");symbol(destroyWindow,"SDL_DestroyWindow");
      symbol(createRenderer,"SDL_CreateRenderer");symbol(destroyRenderer,"SDL_DestroyRenderer");
      symbol(createTexture,"SDL_CreateTexture");symbol(destroyTexture,"SDL_DestroyTexture");
      symbol(updateTexture,"SDL_UpdateTexture");symbol(renderClear,"SDL_RenderClear");
      symbol(renderCopy,"SDL_RenderCopy");symbol(renderPresent,"SDL_RenderPresent");
      symbol(renderIntegerScale,"SDL_RenderSetIntegerScale");symbol(renderLogicalSize,"SDL_RenderSetLogicalSize");
      symbol(pollEvent,"SDL_PollEvent");symbol(getKeyboard,"SDL_GetKeyboardState");
      symbol(pumpEvents,"SDL_PumpEvents");symbol(numJoysticks,"SDL_NumJoysticks");
      symbol(isGameController,"SDL_IsGameController");symbol(openController,"SDL_GameControllerOpen");
      symbol(closeController,"SDL_GameControllerClose");symbol(controllerAttached,"SDL_GameControllerGetAttached");
      symbol(controllerButton,"SDL_GameControllerGetButton");symbol(controllerAxis,"SDL_GameControllerGetAxis");
      symbol(addMapping,"SDL_GameControllerAddMapping");
      optional(rendererOutputSize,"SDL_GetRendererOutputSize");optional(setTitle,"SDL_SetWindowTitle");
      optional(setFullscreenFn,"SDL_SetWindowFullscreen");optional(getWindowSize,"SDL_GetWindowSize");
      optional(usableBounds,"SDL_GetDisplayUsableBounds");optional(getError,"SDL_GetError");
      optional(glSetAttribute,"SDL_GL_SetAttribute");optional(glResetAttributes,"SDL_GL_ResetAttributes");
      optional(glCreateContext,"SDL_GL_CreateContext");optional(glMakeCurrent,"SDL_GL_MakeCurrent");
      optional(glDeleteContext,"SDL_GL_DeleteContext");optional(glGetProcAddress,"SDL_GL_GetProcAddress");
      optional(glSwapWindow,"SDL_GL_SwapWindow");optional(glSetSwapInterval,"SDL_GL_SetSwapInterval");
      optional(glGetDrawableSize,"SDL_GL_GetDrawableSize");
      optional(vkGetInstanceExtensions,"SDL_Vulkan_GetInstanceExtensions");optional(vkCreateSurface,"SDL_Vulkan_CreateSurface");
      optional(vkGetVkGetInstanceProcAddr,"SDL_Vulkan_GetVkGetInstanceProcAddr");optional(vkGetDrawableSize,"SDL_Vulkan_GetDrawableSize");
      if(sdlInit(0x00000020u|0x00000200u|0x00002000u)!=0)throw std::runtime_error("SDL2 nao conseguiu inicializar video/joystick; verifique DISPLAY ou SDL_VIDEODRIVER");
      initialized=true;
      const char*mapFile=std::getenv("FORJA65_SDL2_MAPPING_FILE");
      if(!mapFile&&std::filesystem::exists("gamecontrollerdb.txt"))mapFile="gamecontrollerdb.txt";
      if(mapFile){std::ifstream file(mapFile);std::string line;
        while(std::getline(file,line)){if(!line.empty()&&line[0]!='#')addMapping(line.c_str());}}
    }catch(...){shutdown();throw;}
  }
  // Janela redimensionavel; extra = kWindowOpenGL ou kWindowVulkan para a GPU.
  bool openWindow(std::uint32_t extra,int w,int h,std::string& why){
    closeWindow();
    windowFlags=0x00000004u|0x00000020u|0x00002000u|extra; // SHOWN | RESIZABLE | ALLOW_HIGHDPI
    window=createWindow("Forja65 Native Port",0x2FFF0000,0x2FFF0000,w,h,windowFlags);
    if(!window){why="SDL_CreateWindow: "+sdlError();return false;}
    if(fullscreen&&setFullscreenFn)setFullscreenFn(window,0x00001001u);
    return true;
  }
  void closeWindow(){
    if(texture&&destroyTexture){destroyTexture(texture);}texture=nullptr;texW=texH=0;
    if(renderer&&destroyRenderer){destroyRenderer(renderer);}renderer=nullptr;
    if(glContext&&glDeleteContext){if(glMakeCurrent)glMakeCurrent(window,nullptr);glDeleteContext(glContext);}glContext=nullptr;
    if(window&&destroyWindow){destroyWindow(window);}window=nullptr;windowFlags=0;
  }
  bool openRenderer(std::string& why){
    renderer=createRenderer(window,-1,0x00000002u); // SDL_RENDERER_ACCELERATED
    if(!renderer)renderer=createRenderer(window,-1,0); // software fallback
    if(!renderer){why="SDL_CreateRenderer: "+sdlError();return false;}
    return true;
  }
  // OpenGL 3.3 core: atributos antes da janela, contexto depois.
  bool glAvailable()const{return glSetAttribute&&glCreateContext&&glGetProcAddress&&glSwapWindow;}
  void glPrepare(){
    if(glResetAttributes)glResetAttributes();
    glSetAttribute(17,3);glSetAttribute(18,3);glSetAttribute(21,1); // versao 3.3, perfil core
    glSetAttribute(5,1);                                             // buffer duplo
  }
  bool glCreate(std::string& why){
    glContext=glCreateContext(window);if(!glContext){why="SDL_GL_CreateContext: "+sdlError();return false;}
    if(glMakeCurrent&&glMakeCurrent(window,glContext)!=0){why="SDL_GL_MakeCurrent: "+sdlError();return false;}
    return true;
  }
  void* glProc(const char* n){return glGetProcAddress?glGetProcAddress(n):nullptr;}
  void glSwap(){glSwapWindow(window);}
  void glInterval(int i){if(glSetSwapInterval)glSetSwapInterval(i);}
  bool vulkanAvailable()const{return vkGetInstanceExtensions&&vkCreateSurface&&vkGetVkGetInstanceProcAddr;}
  std::vector<std::string> vkExtensions(){
    unsigned n=0;std::vector<std::string> out;
    if(!vkGetInstanceExtensions(window,&n,nullptr)||!n)return out;
    std::vector<const char*> names(n);if(!vkGetInstanceExtensions(window,&n,names.data()))return out;
    for(unsigned i=0;i<n;++i){out.emplace_back(names[i]);}return out;
  }
  bool vkSurface(void* instance,std::uint64_t* surface){return vkCreateSurface(window,instance,surface)!=0;}
  void* vkLoader(){return vkGetVkGetInstanceProcAddr?vkGetVkGetInstanceProcAddr():nullptr;}
  // Tamanho em pixels da area de desenho (HiDPI incluido).
  void drawableSize(int& w,int& h){
    w=h=0;
    if((windowFlags&kWindowOpenGL)&&glGetDrawableSize)glGetDrawableSize(window,&w,&h);
    else if((windowFlags&kWindowVulkan)&&vkGetDrawableSize)vkGetDrawableSize(window,&w,&h);
    else if(renderer&&rendererOutputSize)rendererOutputSize(renderer,&w,&h);
    if((w<=0||h<=0)&&getWindowSize&&window)getWindowSize(window,&w,&h);
  }
  void title(const std::string& t){if(window&&setTitle)setTitle(window,t.c_str());}
  void setFullscreen(bool on){fullscreen=on;if(window&&setFullscreenFn)setFullscreenFn(window,on?0x00001001u:0u);}
  bool isFullscreen()const{return fullscreen;}
  // Area util da tela principal (sem barras); 1280x960 se a SDL nao informar.
  void usableArea(unsigned& w,unsigned& h){
    SdlRect r{};if(usableBounds&&usableBounds(0,&r)==0&&r.w>0&&r.h>0){w=(unsigned)r.w;h=(unsigned)r.h;}else{w=1280;h=960;}
  }
  // REV203: abre a janela padrao com o renderizador do SDL (mantido para ports e testes antigos).
  void initialize(){
    load();std::string why;
    if(!openWindow(0,768,672,why))throw std::runtime_error("SDL2 nao conseguiu criar janela Linux: "+why);
    if(!openRenderer(why))throw std::runtime_error("SDL2 nao conseguiu criar renderizador: "+why);
    legacyScale=true;
  }
  void shutdown(){
    for(auto &p:pads){if(p&&closeController)closeController(p);p=nullptr;}
    closeWindow();
    if(initialized&&sdlQuit){sdlQuit();}initialized=false;
    if(library){dlclose(library);}library=nullptr;
  }
  void events(){
    if(!initialized)return;
    while(pollEvent(eventBytes.data())){
      std::uint32_t type=0;std::memcpy(&type,eventBytes.data(),sizeof(type));
      if(type==0x100u)closed=true; // SDL_QUIT
      if(type==0x300u){ // SDL_KEYDOWN: repeat no byte 13, sym no 20, mod no 24
        std::int32_t sym=0;std::memcpy(&sym,eventBytes.data()+20,sizeof(sym));
        std::uint16_t mod=0;std::memcpy(&mod,eventBytes.data()+24,sizeof(mod));
        if(eventBytes[13]==0){
          if(sym==0x4000003E)paused=!paused; // F5
          else if(sym==0x40000041)captureRequested=true; // F8
          else if(sym==0x40000040||sym==0x40000042||sym==0x40000043||sym==0x40000044||sym==0x40000045||(sym==0x0D&&(mod&0x0300u)))
            keys.push_back((std::uint32_t)sym|((mod&0x0003u)?kShift:0u)|((mod&0x0300u)?kAlt:0u)); // F7 F9 F10 F11 F12 Alt+Enter
        }
      }
    }
    while(paused&&!closed){
      std::this_thread::sleep_for(std::chrono::milliseconds(12));
      while(pollEvent(eventBytes.data())){
        std::uint32_t type=0;std::memcpy(&type,eventBytes.data(),sizeof(type));
        if(type==0x100u)closed=true;
        if(type==0x300u&&eventBytes[13]==0){std::int32_t sym=0;std::memcpy(&sym,eventBytes.data()+20,sizeof(sym));
          if(sym==0x4000003E)paused=false;
        }
      }
    }
  }
  std::array<std::uint16_t,2> readInput(){
    std::array<std::uint16_t,2> out{};
    if(!initialized)return out;
    pumpEvents();int n=0;const auto* kb=getKeyboard(&n);
    if(key(kb,n,27))out[0]|=0x8000; // X
    if(key(kb,n,29))out[0]|=0x4000; // Z
    if(key(kb,n,225)||key(kb,n,229))out[0]|=0x2000; // shift
    if(key(kb,n,40))out[0]|=0x1000; // return
    if(key(kb,n,82))out[0]|=0x0800;
    if(key(kb,n,81))out[0]|=0x0400;
    if(key(kb,n,80))out[0]|=0x0200;
    if(key(kb,n,79))out[0]|=0x0100;
    if(key(kb,n,4))out[0]|=0x0080; // A
    if(key(kb,n,22))out[0]|=0x0040; // S
    if(key(kb,n,20))out[0]|=0x0020; // Q
    if(key(kb,n,26))out[0]|=0x0010; // W
    scanPads();out[0]|=samplePad(pads[0]);out[1]|=samplePad(pads[1]);
    return out;
  }
  // Imagem ja pronta no tamanho da janela (caminho da CPU com filtros).
  void showCanvas(const std::uint32_t*pixels,unsigned w,unsigned h){
    if(!renderer||!pixels||!w||!h)return;
    if(!texture||w!=texW||h!=texH){
      if(texture)destroyTexture(texture);
      texture=createTexture(renderer,0x16362004u,1,(int)w,(int)h); // ARGB8888, STREAMING
      if(!texture)throw std::runtime_error("SDL2 nao conseguiu criar textura do framebuffer");
      texW=w;texH=h;
    }
    if(updateTexture(texture,nullptr,pixels,(int)(w*4u))!=0)throw std::runtime_error("SDL_UpdateTexture falhou");
    renderClear(renderer);renderCopy(renderer,texture,nullptr,nullptr);renderPresent(renderer);
  }
  // REV203: framebuffer do SNES em escala inteira pelo SDL.
  void show(const std::uint32_t*pixels,unsigned w,unsigned h){
    if(!renderer||!pixels||!w||!h)return;
    if(!texture||w!=texW||h!=texH){
      if(texture)destroyTexture(texture);
      // Framebuffer uses 0xAARRGGBB on little-endian machines.
      texture=createTexture(renderer,0x16362004u,1,(int)w,(int)h); // SDL_PIXELFORMAT_ARGB8888, STREAMING
      if(!texture)throw std::runtime_error("SDL2 nao conseguiu criar textura do framebuffer");
      texW=w;texH=h;
      renderLogicalSize(renderer,(int)w,(int)h);
      renderIntegerScale(renderer,1);
    }
    if(updateTexture(texture,nullptr,pixels,(int)(w*4u))!=0)throw std::runtime_error("SDL_UpdateTexture falhou");
    renderClear(renderer);renderCopy(renderer,texture,nullptr,nullptr);renderPresent(renderer);
  }
};
#endif
