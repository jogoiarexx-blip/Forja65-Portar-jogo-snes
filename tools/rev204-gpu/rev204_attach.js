function attachRev204Gpu(files){
  let t=files['src/runtime.hpp'];
  if(!t||t.includes('class GpuPresenter'))return files;
  const rep=(from,to,label)=>{if(!t.includes(from))throw new Error('REV204 GPU anchor absent: '+label);t=t.replace(from,to);};
  // 1) declaracoes globais (Direct3D 11 no Windows; subconjunto do Vulkan) antes do pipeline de video
  rep('// Forja65 REV198: pipeline de video do host',FORJA65_REV204_GPU_PRELUDE+'// Forja65 REV198: pipeline de video do host','prelude');
  // 2) Settings: backend, placa, vsync e software
  rep('  unsigned sharpen{60};          // % do CAS\n','  unsigned sharpen{60};          // % do CAS\n'+
    '  std::string backend{"auto"};   // REV204: auto d3d11 vulkan opengl cpu\n'+
    '  std::string gpu{"auto"};       // REV204: auto dedicated integrated\n'+
    '  bool vsync{false};             // REV204: espera o retraco do monitor\n'+
    '  bool gpuSoftware{false};       // REV204: aceita GPU por software no modo automatico\n','settings fields');
  rep('  else if(k=="sharpen"){','  else if(k=="backend")s.backend=lower(v);\n  else if(k=="gpu")s.gpu=lower(v);\n'+
    '  else if(k=="vsync")s.vsync=(v=="1"||lower(v)=="true"||lower(v)=="on");\n  else if(k=="gpu_software")s.gpuSoftware=(v=="1"||lower(v)=="true"||lower(v)=="on");\n'+
    '  else if(k=="sharpen"){','settings keys');
  rep('{"FORJA65_VIDEO_SHARPEN","sharpen"}};','{"FORJA65_VIDEO_SHARPEN","sharpen"},\n    {"FORJA65_VIDEO_BACKEND","backend"},{"FORJA65_VIDEO_GPU","gpu"},{"FORJA65_VIDEO_VSYNC","vsync"},{"FORJA65_VIDEO_GPU_SOFTWARE","gpu_software"}};','settings env');
  rep('"\\nsharpen="<<s.sharpen<<"\\n";','"\\nsharpen="<<s.sharpen<<"\\n";\n'+
    '  o<<"# backend (REV204): auto d3d11 vulkan opengl cpu. gpu: auto dedicated integrated. vsync: 0/1. F9 troca o backend.\\n";\n'+
    '  o<<"backend="<<s.backend<<"\\ngpu="<<s.gpu<<"\\nvsync="<<(s.vsync?1:0)<<"\\ngpu_software="<<(s.gpuSoftware?1:0)<<"\\n";','settings save');
  // 3) backends da GPU dentro de forja65video, antes da janela do Windows
  const winAnchor='#ifdef _WIN32\n// ---------------------------------------------------------------- janela Windows (GDI)';
  rep(winAnchor,FORJA65_REV204_GPU_CORE+winAnchor,'gpu core');
  // 4) WinHost: GPU primeiro, GDI como reserva
  rep('    if(s.fullscreen){s.fullscreen=false;setFullscreen(true);}\n    updateTitle();\n  }',
      '    if(s.fullscreen){s.fullscreen=false;setFullscreen(true);}\n    openGpu();\n    updateTitle();\n  }','winhost attach');
  rep('const bool mine=k==VK_F7||k==VK_F8||','const bool mine=k==VK_F7||k==VK_F8||k==VK_F9||','winhost keys');
  rep('    else if(k==VK_F12){screenshot();return true;}','    else if(k==VK_F12){screenshot();return true;}\n'+
    '    else if(k==VK_F9){s.backend=nextGpuBackend(s.backend);saveSettings(s);openGpu();updateTitle();return true;}','winhost f9');
  rep('    r.render(fb,fbW,fbH,cw,ch,s);\n    BITMAPINFO bi{};',
      '    lastFb=fb;lastFbW=fbW;lastFbH=fbH;\n'+
      '    if(gpu.active()){\n'+
      '      std::string why;\n'+
      '      if(gpu.present(fb,fbW,fbH,cw,ch,s,why)){if(fbW!=lastW||fbH!=lastH){lastW=fbW;lastH=fbH;updateTitle();}return;}\n'+
      '      gpuLog("falha durante o jogo ("+gpu.label()+"): "+why+"; voltando para a CPU (GDI)");gpu.close();updateTitle();\n'+
      '    }\n'+
      '    r.render(fb,fbW,fbH,cw,ch,s);\n    BITMAPINFO bi{};','winhost present');
  rep('  void screenshot(){\n    char name[64];','  void screenshot(){\n'+
      '    if(gpu.active()&&lastFb){RECT rc{};GetClientRect(hwnd,&rc);r.render(lastFb,lastFbW,lastFbH,(unsigned)std::max<LONG>(1,rc.right-rc.left),(unsigned)std::max<LONG>(1,rc.bottom-rc.top),s);}\n'+
      '    char name[64];','winhost screenshot');
  rep('+aspectKey(s.aspect)+\n      " | F7 filtro  F8 resolucao  F10 aspecto  F11 tela cheia  F12 captura";',
      '+aspectKey(s.aspect)+\n      " | "+(gpu.active()?gpu.label()+" - "+gpu.device():std::string("CPU (GDI)"))+\n      " | F7 filtro  F8 resolucao  F9 video  F10 aspecto  F11 tela cheia  F12 captura";','winhost title');
  rep('  HWND hwnd{};Renderer r;WINDOWPLACEMENT prev{};',
      '  void openGpu(){\n'+
      '    gpu.close();gpuLog("Forja65 REV204 - video Windows, backend pedido: "+s.backend+", placa: "+s.gpu,true);\n'+
      '    if(s.legacy)return;\n'+
      '    for(const auto a:gpuCandidates(s)){std::string why;GpuSurface sf;sf.hwnd=hwnd;sf.hinst=GetModuleHandleW(nullptr);\n'+
      '      if(gpu.open(a,sf,s,why)){gpuLog("ativo: "+gpu.label()+" - "+gpu.device());return;}\n'+
      '      gpuLog(std::string(gpuApiLabel(a))+": "+why);InvalidateRect(hwnd,nullptr,TRUE);}\n'+
      '    gpuLog("ativo: CPU (GDI), filtros na CPU");\n'+
      '  }\n'+
      'public:\n  void closeGpu(){gpu.close();}\nprivate:\n'+
      '  GpuPresenter gpu;const std::uint32_t* lastFb{};unsigned lastFbW{},lastFbH{};\n'+
      '  HWND hwnd{};Renderer r;WINDOWPLACEMENT prev{};','winhost members');
  // 5) janela Linux (SDL2) com GPU, depois da janela do Windows
  rep('#endif\n\n} // namespace forja65video','#endif\n'+FORJA65_REV204_LINUX_VIDEO+'\n} // namespace forja65video','linux video');
  // 6) SnesRuntime: CS_OWNDC (OpenGL), fechar a GPU antes da janela, Linux via LinuxVideo
  rep('WNDCLASSW wc{};wc.lpfnWndProc=wndProc;','WNDCLASSW wc{};wc.style=CS_OWNDC;wc.lpfnWndProc=wndProc;','owndc');
  // a janela e Unicode (RegisterClassW/CreateWindowW): DefWindowProc (A) mostrava so a 1a letra do titulo ("F").
  rep('if(m==WM_DESTROY){PostQuitMessage(0);return 0;}return DefWindowProc(h,m,w,l);}','if(m==WM_DESTROY){PostQuitMessage(0);return 0;}return DefWindowProcW(h,m,w,l);}','wndproc unicode');
  rep('void shutdownWindow(){if(hwnd&&IsWindow(hwnd))DestroyWindow(hwnd);','void shutdownWindow(){if(video)video->closeGpu();if(hwnd&&IsWindow(hwnd))DestroyWindow(hwnd);','win shutdown');
  rep('  ForjaLinuxSDL2 linuxHost;\n','  ForjaLinuxSDL2 linuxHost;\n  forja65video::LinuxVideo linuxVideo; // REV204: GPU (OpenGL/Vulkan) ou CPU com filtros\n','linux member');
  rep('  void initWindow(){linuxHost.initialize();}\n  void shutdownWindow(){linuxHost.shutdown();}',
      '  void initWindow(){linuxVideo.open(linuxHost);}\n  void shutdownWindow(){linuxVideo.close(linuxHost);linuxHost.shutdown();}','linux init');
  rep('    linuxHost.show(framebuffer.data(),fbWidth,fbHeight);','    linuxVideo.present(linuxHost,framebuffer.data(),fbWidth,fbHeight);\n    // REV204: como antes da REV203 no Linux, FORJA65_HEADLESS_FRAMES tambem limita a execucao com janela.\n    if(const char*e=std::getenv("FORJA65_HEADLESS_FRAMES"))if(*e){const unsigned lim=(unsigned)std::strtoul(e,nullptr,10);if(lim&&frameCounter>=lim)stopped=true;}','linux present');
  // REV203 mudou o padrao do modo headless no Linux para 'sem limite'; antes (e nos outros sistemas sem janela) eram 2
  // quadros sem FORJA65_HEADLESS_FRAMES. Volta ao padrao antigo (tests/cpu-native-audit-rev142 depende disso).
  rep('      const unsigned lim=(e&&*e)?(unsigned)std::strtoul(e,nullptr,10):0u;','      const unsigned lim=(e&&*e)?(unsigned)std::strtoul(e,nullptr,10):(controlMode?0u:2u);','linux headless default');
  files['src/runtime.hpp']=t;
  // 7) notebooks com duas placas (NVIDIA Optimus / AMD): pede a placa dedicada para o executavel
  const m=files['src/main.cpp'];
  if(m&&!m.includes('NvOptimusEnablement')){
    const a='#include "generated.hpp"\n';
    if(!m.includes(a))throw new Error('REV204 main.cpp anchor absent');
    files['src/main.cpp']=m.replace(a,a+'#ifdef _WIN32\n// REV204: em notebooks com duas placas, o driver usa a dedicada para este executavel.\nextern "C" __declspec(dllexport) unsigned long NvOptimusEnablement=1;\nextern "C" __declspec(dllexport) int AmdPowerXpressRequestHighPerformance=1;\n#endif\n');
  }
  files['src/forja_linux_sdl2.hpp']=FORJA65_REV203_LINUX_HOST;
  files['tools/gpu-shaders/README.txt']=FORJA65_REV204_SHADER_README;
  files['tools/gpu-shaders/forja65-filters.glsl']=FORJA65_REV204_SHADER_BODY_FILE;
  files['docs/VIDEO-GPU-REV204.txt']=FORJA65_REV204_DOC;
  return files;
}
