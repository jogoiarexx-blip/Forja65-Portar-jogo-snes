from pathlib import Path

INPUT_HELPERS=r'''  // REV201: keyboard stays player 1; host input never changes deterministic replays.
#ifdef _WIN32
  static std::uint16_t forja65XInputMask(const XINPUT_GAMEPAD&g){
    const auto b=g.wButtons;std::uint16_t j=0;
    if(b&XINPUT_GAMEPAD_Y)j|=0x8000;
    if(b&XINPUT_GAMEPAD_B)j|=0x4000;
    if(b&XINPUT_GAMEPAD_BACK)j|=0x2000;
    if(b&XINPUT_GAMEPAD_START)j|=0x1000;
    if((b&XINPUT_GAMEPAD_DPAD_UP)||g.sThumbLY>9000)j|=0x0800;
    if((b&XINPUT_GAMEPAD_DPAD_DOWN)||g.sThumbLY<-9000)j|=0x0400;
    if((b&XINPUT_GAMEPAD_DPAD_LEFT)||g.sThumbLX<-9000)j|=0x0200;
    if((b&XINPUT_GAMEPAD_DPAD_RIGHT)||g.sThumbLX>9000)j|=0x0100;
    if(b&XINPUT_GAMEPAD_X)j|=0x0080;
    if(b&XINPUT_GAMEPAD_A)j|=0x0040;
    if(b&XINPUT_GAMEPAD_LEFT_SHOULDER)j|=0x0020;
    if(b&XINPUT_GAMEPAD_RIGHT_SHOULDER)j|=0x0010;
    return j;
  }
  static std::uint16_t forja65WinmmMask(UINT device){
    JOYINFOEX q{};q.dwSize=sizeof(q);q.dwFlags=JOY_RETURNALL;
    if(joyGetPosEx(device,&q)!=JOYERR_NOERROR)return 0;
    JOYCAPSW cap{};if(joyGetDevCapsW(device,&cap,sizeof(cap))!=JOYERR_NOERROR)return 0;
    const std::wstring name(cap.szPname);
    const bool ps=name.find(L"Wireless Controller")!=std::wstring::npos||name.find(L"DualShock")!=std::wstring::npos||name.find(L"DualSense")!=std::wstring::npos||name.find(L"PS4")!=std::wstring::npos||envText("FORJA65_WINMM_LAYOUT")=="playstation";
    auto btn=[&](unsigned n){return n>=1u&&n<=32u&&(q.dwButtons&(1u<<(n-1u)))!=0;};
    std::uint16_t j=0;
    if(ps){if(btn(1))j|=0x8000;if(btn(2))j|=0x4000;if(btn(4))j|=0x0080;if(btn(3))j|=0x0040;if(btn(9))j|=0x2000;if(btn(10))j|=0x1000;}
    else{if(btn(4))j|=0x8000;if(btn(2))j|=0x4000;if(btn(3))j|=0x0080;if(btn(1))j|=0x0040;if(btn(7))j|=0x2000;if(btn(8))j|=0x1000;}
    if(btn(5))j|=0x0020;if(btn(6))j|=0x0010;
    if(q.dwPOV!=JOY_POVCENTERED){const auto deg=q.dwPOV%36000u;
      if(deg<=4500u||deg>=31500u)j|=0x0800;
      if(deg>=13500u&&deg<=22500u)j|=0x0400;
      if(deg>=22500u&&deg<=31500u)j|=0x0200;
      if(deg>=4500u&&deg<=13500u)j|=0x0100;
    }
    auto axis=[&](DWORD v,UINT lo,UINT hi,int negative,int positive){
      if(hi<=lo)return;const std::uint64_t r=std::uint64_t(hi)-lo;
      if(std::uint64_t(v-lo)*10u<r*3u)j|=(std::uint16_t)negative;
      if(std::uint64_t(v-lo)*10u>r*7u)j|=(std::uint16_t)positive;
    };
    if(q.dwXpos>=cap.wXmin&&q.dwXpos<=cap.wXmax)axis(q.dwXpos,cap.wXmin,cap.wXmax,0x0200,0x0100);
    if(q.dwYpos>=cap.wYmin&&q.dwYpos<=cap.wYmax)axis(q.dwYpos,cap.wYmin,cap.wYmax,0x0800,0x0400);
    return j;
  }
  struct Forja65Sdl2Pads {
    using Pad=void;using InitFn=int(__cdecl*)(std::uint32_t);using QuitFn=void(__cdecl*)(std::uint32_t);
    using NumFn=int(__cdecl*)();using IsFn=int(__cdecl*)(int);using OpenFn=Pad*(__cdecl*)(int);
    using CloseFn=void(__cdecl*)(Pad*);using ButtonFn=std::uint8_t(__cdecl*)(Pad*,int);
    using AxisFn=std::int16_t(__cdecl*)(Pad*,int);using UpdateFn=void(__cdecl*)();
    using AttachedFn=int(__cdecl*)(Pad*);using MappingsFn=int(__cdecl*)(const char*);
    HMODULE dll{};InitFn init{};QuitFn quit{};NumFn count{};IsFn is{};
    OpenFn open{};CloseFn close{};ButtonFn button{};AxisFn axis{};UpdateFn update{};
    AttachedFn attached{};MappingsFn mappings{};std::array<Pad*,2> pads{};
    std::uint64_t lastScan{UINT64_MAX};bool ready{};
    template<class T>bool symbol(T&out,const char*name){out=reinterpret_cast<T>(GetProcAddress(dll,name));return out!=nullptr;}
    Forja65Sdl2Pads(){
      if(envText("FORJA65_SDL2")=="0")return;
      dll=LoadLibraryW(L"SDL2.dll");if(!dll)return;
      if(!(symbol(init,"SDL_InitSubSystem")&&symbol(quit,"SDL_QuitSubSystem")&&symbol(count,"SDL_NumJoysticks")&&symbol(is,"SDL_IsGameController")&&symbol(open,"SDL_GameControllerOpen")&&symbol(close,"SDL_GameControllerClose")&&symbol(button,"SDL_GameControllerGetButton")&&symbol(axis,"SDL_GameControllerGetAxis")&&symbol(update,"SDL_GameControllerUpdate")&&symbol(attached,"SDL_GameControllerGetAttached")&&symbol(mappings,"SDL_GameControllerAddMappingsFromFile")))return;
      if(init(0x00002000u)!=0)return;ready=true;
      if(std::filesystem::exists("gamecontrollerdb.txt"))mappings("gamecontrollerdb.txt");
    }
    ~Forja65Sdl2Pads(){for(auto &p:pads)if(p&&close)close(p);if(ready)quit(0x00002000u);if(dll)FreeLibrary(dll);}
    unsigned sample(std::uint64_t frame,std::array<std::uint16_t,2>&dst){
      if(!ready)return 0;
      update();
      if(lastScan==UINT64_MAX||frame>=lastScan+120u){
        for(auto &p:pads){if(p){close(p);p=nullptr;}}
        unsigned found=0;const int n=count();for(int i=0;i<n&&found<2u;i++)if(is(i)){if(auto*p=open(i))pads[found++]=p;}
        lastScan=frame;
      }
      unsigned found=0;
      for(auto*p:pads){if(!p||!attached(p))continue;
        auto b=[&](int id){return button(p,id)!=0;};std::uint16_t j=0;
        if(b(3))j|=0x8000;if(b(1))j|=0x4000;
        if(b(4))j|=0x2000;if(b(6))j|=0x1000;
        if(b(11)||axis(p,1)<-9000)j|=0x0800;
        if(b(12)||axis(p,1)>9000)j|=0x0400;
        if(b(13)||axis(p,0)<-9000)j|=0x0200;
        if(b(14)||axis(p,0)>9000)j|=0x0100;
        if(b(2))j|=0x0080;if(b(0))j|=0x0040;
        if(b(9))j|=0x0020;if(b(10))j|=0x0010;
        dst[found++]=j;
      }
      return found;
    }
  };
#endif
'''

oldpoll='''  void pollInput(){
    if(replayActive)return;
#ifdef _WIN32
    std::uint16_t j=0;auto kd=[](int k){return (GetAsyncKeyState(k)&0x8000)!=0;};if(kd('X'))j|=0x8000;if(kd('Z'))j|=0x4000;if(kd(VK_SHIFT))j|=0x2000;if(kd(VK_RETURN))j|=0x1000;if(kd(VK_UP))j|=0x0800;if(kd(VK_DOWN))j|=0x0400;if(kd(VK_LEFT))j|=0x0200;if(kd(VK_RIGHT))j|=0x0100;if(kd('A'))j|=0x0080;if(kd('S'))j|=0x0040;if(kd('Q'))j|=0x0020;if(kd('W'))j|=0x0010;
    XINPUT_STATE xs{};if(XInputGetState(0,&xs)==ERROR_SUCCESS){const auto&g=xs.Gamepad;const auto b=g.wButtons;if((b&XINPUT_GAMEPAD_Y)!=0)j|=0x8000;if((b&XINPUT_GAMEPAD_B)!=0)j|=0x4000;if((b&XINPUT_GAMEPAD_BACK)!=0)j|=0x2000;if((b&XINPUT_GAMEPAD_START)!=0)j|=0x1000;if((b&XINPUT_GAMEPAD_DPAD_UP)!=0||g.sThumbLY>9000)j|=0x0800;if((b&XINPUT_GAMEPAD_DPAD_DOWN)!=0||g.sThumbLY<-9000)j|=0x0400;if((b&XINPUT_GAMEPAD_DPAD_LEFT)!=0||g.sThumbLX<-9000)j|=0x0200;if((b&XINPUT_GAMEPAD_DPAD_RIGHT)!=0||g.sThumbLX>9000)j|=0x0100;if((b&XINPUT_GAMEPAD_X)!=0)j|=0x0080;if((b&XINPUT_GAMEPAD_A)!=0)j|=0x0040;if((b&XINPUT_GAMEPAD_LEFT_SHOULDER)!=0)j|=0x0020;if((b&XINPUT_GAMEPAD_RIGHT_SHOULDER)!=0)j|=0x0010;}setJoy1(j);
#endif
  }'''

newpoll='''  void pollInput(){
    if(replayActive)return;
#ifdef _WIN32
    std::uint16_t keyboard=0;
    auto kd=[](int k){return (GetAsyncKeyState(k)&0x8000)!=0;};
    if(kd('X'))keyboard|=0x8000;if(kd('Z'))keyboard|=0x4000;
    if(kd(VK_SHIFT))keyboard|=0x2000;if(kd(VK_RETURN))keyboard|=0x1000;
    if(kd(VK_UP))keyboard|=0x0800;if(kd(VK_DOWN))keyboard|=0x0400;
    if(kd(VK_LEFT))keyboard|=0x0200;if(kd(VK_RIGHT))keyboard|=0x0100;
    if(kd('A'))keyboard|=0x0080;if(kd('S'))keyboard|=0x0040;
    if(kd('Q'))keyboard|=0x0020;if(kd('W'))keyboard|=0x0010;
    std::array<std::uint16_t,2> pads{};
    static Forja65Sdl2Pads sdl;const auto backend=envText("FORJA65_INPUT_BACKEND");const unsigned sdlCount=(backend.empty()||backend=="sdl")?sdl.sample(frameCounter,pads):0u;
    if(!sdlCount&&backend!="sdl"){
      unsigned connected=0;
      for(DWORD i=0;i<4u&&connected<2u&&backend!="winmm";i++){
        XINPUT_STATE xs{};
        if(XInputGetState(i,&xs)==ERROR_SUCCESS)pads[connected++]=forja65XInputMask(xs.Gamepad);
      }
      if(!connected&&backend!="xinput"){
        const UINT n=std::min<UINT>(joyGetNumDevs(),16u);
        for(UINT i=0;i<n&&connected<2u;i++){
          JOYINFOEX q{};q.dwSize=sizeof(q);q.dwFlags=JOY_RETURNALL;
          if(joyGetPosEx(i,&q)==JOYERR_NOERROR)pads[connected++]=forja65WinmmMask(i);
        }
      }
    }
    // Preserve keyboard + controller simultaneously; never leak physical input into logical replays.
    setJoy1(std::uint16_t(keyboard|pads[0]));setJoy2(pads[1]);
#endif
  }'''

def patch_runtime(s):
    if 'REV201: keyboard stays player 1' in s:return s
    anchor='  void pollInput(){'
    assert s.count(anchor)==1, ('missing input anchor',s.count(anchor))
    assert s.count(oldpoll)==1, 'old poll block mismatch'
    s=s.replace(oldpoll, newpoll)
    s=s.replace(anchor,INPUT_HELPERS+anchor,1)
    find='initMigrationModes(path);initSram(sramBytes);'
    repl='initMigrationModes(path);initPersistentSramPath();initSram(sramBytes);'
    assert s.count(find)==1
    s=s.replace(find,repl)
    anchor='  void initSram(std::size_t bytes){'
    pathfunc='''  // REV201: per-ROM stable save path. An explicit SRAM path always wins.
  void initPersistentSramPath(){
    if(sramPath!="save.srm"||!envText("FORJA65_SRAM_PATH").empty())return;
    const auto folder=std::filesystem::path("saves");
    std::error_code ec;std::filesystem::create_directories(folder,ec);
    if(ec)throw std::runtime_error("Cannot create SRAM save directory: "+ec.message());
    sramPath=(folder/(cartHashHex()+".srm")).string();
  }
'''
    assert s.count(anchor)==1
    s=s.replace(anchor,pathfunc+anchor,1)
    # Detect read errors without truncating a good save. Default state still 0xFF where no save exists.
    old='std::ifstream f(sramPath,std::ios::binary);if(f)f.read((char*)sram.data(),(std::streamsize)sram.size());'
    new='''std::ifstream f(sramPath,std::ios::binary);if(f){
      f.read((char*)sram.data(),(std::streamsize)sram.size());
      if(f.gcount()!=(std::streamsize)sram.size())throw std::runtime_error("Incomplete SRAM save: "+sramPath);
      std::fprintf(stderr,"FORJA65_SRAM_LOADED %s",sramPath.c_str());
    }'''
    assert s.count(old)==1
    s=s.replace(old,new,1)
    # Post-save notification can be checked by runtime tests/users.
    assert 'sramDirty=false;sramSaveError.clear();' in s
    s=s.replace('sramDirty=false;sramSaveError.clear();','sramDirty=false;sramSaveError.clear();std::fprintf(stderr,"FORJA65_SRAM_SAVED %s",sramPath.c_str());',1)
    # Autosave after frames; stop when headless or replay for deterministic traces; flush on quit remains.
    anchor='frameCounter++;writeFrameProgress();'
    assert s.count(anchor)==1
    s=s.replace(anchor,anchor+'''
    // REV201: commit battery-backed RAM every five seconds (300 NTSC frames).
    // Headless/replay certification remains isolated from automatic writes.
    if(!headless&&!replayActive&&sramDirty&&(frameCounter%300u)==0u)saveSram();''',1)
    # Force manual save via F6 (edge) on Windows as extra assurance.
    anchor='  void present(){if(headless){'
    assert s.count(anchor)==1
    s=s.replace(anchor,'''  void checkSramHotkey(){
    if(headless||replayActive)return;
    static bool wasDown=false;
    const bool down=(GetAsyncKeyState(VK_F6)&0x8000)!=0;
    if(down&&!wasDown)saveSram();wasDown=down;
  }
'''+anchor,1)
    present='MSG msg{};while(PeekMessage(&msg,nullptr,0,0,PM_REMOVE))'
    assert s.count(present)==1
    s=s.replace(present,'checkSramHotkey();'+present,1)
    return s

