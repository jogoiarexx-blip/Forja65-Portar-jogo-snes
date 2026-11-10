// ---------------------------------------------------------------- Direct3D 11 (Windows)
#ifdef _WIN32
class GpuD3D11 : public GpuBackend {
  HMODULE libD3d{},libDxgi{},libComp{};
  IDXGIFactory1* factory{};IDXGIAdapter1* adapter{};ID3D11Device* device{};ID3D11DeviceContext* ctx{};IDXGISwapChain* chain{};
  ID3D11RenderTargetView* rtv{};ID3D11VertexShader* vs{};ID3D11PixelShader* ps{};ID3D11Buffer* cb{};ID3D11SamplerState* samp{};
  ID3D11Texture2D* tex{};ID3D11ShaderResourceView* srv{};
  unsigned scW{},scH{},texW{},texH{};bool vsync{};
  template<class T> static void rel(T*& p){if(p){p->Release();p=nullptr;}}
  static std::string narrow(const wchar_t* w){
    char b[512]{};WideCharToMultiByte(CP_UTF8,0,w,-1,b,(int)sizeof(b)-1,nullptr,nullptr);return b;
  }
  static std::string hr(HRESULT h){char b[32];std::snprintf(b,sizeof(b),"0x%08lX",(unsigned long)h);return b;}
  bool makeRtv(std::string& why){
    ID3D11Texture2D* back=nullptr;
    HRESULT h=chain->GetBuffer(0,__uuidof(ID3D11Texture2D),reinterpret_cast<void**>(&back));
    if(FAILED(h)){why="GetBuffer "+hr(h);return false;}
    h=device->CreateRenderTargetView(back,nullptr,&rtv);back->Release();
    if(FAILED(h)){why="CreateRenderTargetView "+hr(h);return false;}
    return true;
  }
  bool compile(pD3DCompile fn,const std::string& src,const char* entry,const char* target,ID3DBlob** out,std::string& why){
    ID3DBlob* err=nullptr;
    const HRESULT h=fn(src.data(),src.size(),"forja65",nullptr,nullptr,entry,target,D3DCOMPILE_OPTIMIZATION_LEVEL3,0,out,&err);
    if(FAILED(h)){why=std::string("HLSL recusado (")+entry+"): "+(err?std::string((const char*)err->GetBufferPointer(),err->GetBufferSize()):hr(h));rel(err);return false;}
    rel(err);return true;
  }
public:
  GpuApi api()const override{return GpuApi::D3D11;}
  ~GpuD3D11() override{
    if(ctx)ctx->ClearState();
    rel(srv);rel(tex);rel(samp);rel(cb);rel(ps);rel(vs);rel(rtv);rel(chain);rel(ctx);rel(device);rel(adapter);rel(factory);
    if(libComp)FreeLibrary(libComp);
  }
  bool init(const GpuSurface& s,const Settings& st,std::string& why) override{
    vsync=st.vsync;
    libD3d=LoadLibraryA("d3d11.dll");libDxgi=LoadLibraryA("dxgi.dll");
    if(!libD3d||!libDxgi){why="d3d11.dll/dxgi.dll ausentes";return false;}
    for(const char* n:{"d3dcompiler_47.dll","d3dcompiler_46.dll","d3dcompiler_43.dll"})if((libComp=LoadLibraryA(n)))break;
    if(!libComp){why="d3dcompiler_47.dll ausente (instale o runtime do DirectX)";return false;}
    typedef HRESULT(WINAPI*CreateFactory)(REFIID,void**);
    const auto createFactory=reinterpret_cast<CreateFactory>(reinterpret_cast<void*>(GetProcAddress(libDxgi,"CreateDXGIFactory1")));
    const auto createDevice=reinterpret_cast<PFN_D3D11_CREATE_DEVICE>(reinterpret_cast<void*>(GetProcAddress(libD3d,"D3D11CreateDevice")));
    const auto compileFn=reinterpret_cast<pD3DCompile>(reinterpret_cast<void*>(GetProcAddress(libComp,"D3DCompile")));
    if(!createFactory||!createDevice||!compileFn){why="funcoes do Direct3D 11 ausentes";return false;}
    HRESULT h=createFactory(__uuidof(IDXGIFactory1),reinterpret_cast<void**>(&factory));
    if(FAILED(h)){why="CreateDXGIFactory1 "+hr(h);return false;}
    // Escolha da placa: auto = a padrao do Windows (respeita a preferencia grafica do sistema);
    // dedicated = a de mais memoria dedicada; integrated = a de menos. Adaptador por software so se permitido.
    const GpuPref pref=parseGpuPref(st.gpu);
    struct Cand{IDXGIAdapter1* a;DXGI_ADAPTER_DESC1 d;bool soft;};std::vector<Cand> list;
    for(UINT i=0;;++i){IDXGIAdapter1* a=nullptr;if(factory->EnumAdapters1(i,&a)==DXGI_ERROR_NOT_FOUND)break;if(!a)continue;
      DXGI_ADAPTER_DESC1 d{};a->GetDesc1(&d);const bool sw=(d.Flags&DXGI_ADAPTER_FLAG_SOFTWARE)!=0||(d.VendorId==0x1414&&d.DeviceId==0x8c);
      list.push_back({a,d,sw});}
    Cand* pick=nullptr;
    for(auto& c:list){
      if(c.soft)continue;
      if(!pick){pick=&c;if(pref==GpuPref::Auto)break;continue;}
      if(pref==GpuPref::Dedicated&&c.d.DedicatedVideoMemory>pick->d.DedicatedVideoMemory)pick=&c;
      if(pref==GpuPref::Integrated&&c.d.DedicatedVideoMemory<pick->d.DedicatedVideoMemory)pick=&c;
    }
    if(!pick&&gpuAllowSoftware(st))for(auto& c:list)if(c.soft){pick=&c;break;}
    if(pick){adapter=pick->a;adapter->AddRef();dev=narrow(pick->d.Description);soft=pick->soft;}
    for(auto& c:list)c.a->Release();
    if(!adapter){why=list.empty()?"nenhuma placa de video encontrada":"so ha adaptador por software (Microsoft Basic Render)";return false;}
    const D3D_FEATURE_LEVEL levels[]={D3D_FEATURE_LEVEL_11_0,D3D_FEATURE_LEVEL_10_1,D3D_FEATURE_LEVEL_10_0};
    D3D_FEATURE_LEVEL got{};
    h=createDevice(adapter,D3D_DRIVER_TYPE_UNKNOWN,nullptr,0,levels,3,D3D11_SDK_VERSION,&device,&got,&ctx);
    if(FAILED(h)){why="D3D11CreateDevice "+hr(h)+" (placa sem Direct3D 10/11?)";return false;}
    RECT rc{};GetClientRect(s.hwnd,&rc);scW=(unsigned)std::max<LONG>(1,rc.right-rc.left);scH=(unsigned)std::max<LONG>(1,rc.bottom-rc.top);
    DXGI_SWAP_CHAIN_DESC d{};d.BufferDesc.Width=scW;d.BufferDesc.Height=scH;d.BufferDesc.Format=DXGI_FORMAT_B8G8R8A8_UNORM;
    d.SampleDesc.Count=1;d.BufferUsage=DXGI_USAGE_RENDER_TARGET_OUTPUT;d.OutputWindow=s.hwnd;d.Windowed=TRUE;
    // flip-discard (Windows 10), flip-sequential (8) e, por ultimo, o modelo antigo.
    const DXGI_SWAP_EFFECT effects[]={(DXGI_SWAP_EFFECT)4,(DXGI_SWAP_EFFECT)3,DXGI_SWAP_EFFECT_DISCARD};
    for(const auto e:effects){d.SwapEffect=e;d.BufferCount=e==DXGI_SWAP_EFFECT_DISCARD?1:2;h=factory->CreateSwapChain(device,&d,&chain);if(SUCCEEDED(h))break;chain=nullptr;}
    if(!chain){why="CreateSwapChain "+hr(h);return false;}
    factory->MakeWindowAssociation(s.hwnd,DXGI_MWA_NO_ALT_ENTER|DXGI_MWA_NO_WINDOW_CHANGES);
    if(!makeRtv(why))return false;
    ID3DBlob* vb=nullptr;ID3DBlob* pb=nullptr;
    if(!compile(compileFn,kGpuHlslVs,"vsMain","vs_4_0",&vb,why))return false;
    if(!compile(compileFn,std::string(kGpuHlslPre)+kGpuShaderBody+kGpuHlslPost,"psMain","ps_4_0",&pb,why)){rel(vb);return false;}
    h=device->CreateVertexShader(vb->GetBufferPointer(),vb->GetBufferSize(),nullptr,&vs);
    if(SUCCEEDED(h))h=device->CreatePixelShader(pb->GetBufferPointer(),pb->GetBufferSize(),nullptr,&ps);
    rel(vb);rel(pb);
    if(FAILED(h)){why="CreateShader "+hr(h);return false;}
    D3D11_BUFFER_DESC bd{};bd.ByteWidth=64;bd.Usage=D3D11_USAGE_DYNAMIC;bd.BindFlags=D3D11_BIND_CONSTANT_BUFFER;bd.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
    if(FAILED(h=device->CreateBuffer(&bd,nullptr,&cb))){why="CreateBuffer "+hr(h);return false;}
    D3D11_SAMPLER_DESC sd{};sd.Filter=D3D11_FILTER_MIN_MAG_MIP_LINEAR;sd.AddressU=sd.AddressV=sd.AddressW=D3D11_TEXTURE_ADDRESS_CLAMP;
    sd.ComparisonFunc=D3D11_COMPARISON_NEVER;sd.MaxLOD=D3D11_FLOAT32_MAX;
    if(FAILED(h=device->CreateSamplerState(&sd,&samp))){why="CreateSamplerState "+hr(h);return false;}
    char fl[16];std::snprintf(fl,sizeof(fl),"%u_%u",((unsigned)got>>12)&15u,((unsigned)got>>8)&15u);
    dev+=std::string(" / nivel ")+fl;
    return true;
  }
  bool draw(const std::uint32_t* src,unsigned sw,unsigned sh,unsigned cw,unsigned ch,const Rect& r,const GpuShade& p,std::string& why) override{
    HRESULT h;
    if(cw!=scW||ch!=scH){
      ctx->OMSetRenderTargets(0,nullptr,nullptr);rel(rtv);
      if(FAILED(h=chain->ResizeBuffers(0,cw,ch,DXGI_FORMAT_UNKNOWN,0))){why="ResizeBuffers "+hr(h);return false;}
      scW=cw;scH=ch;if(!makeRtv(why))return false;
    }
    if(sw!=texW||sh!=texH){
      rel(srv);rel(tex);
      D3D11_TEXTURE2D_DESC td{};td.Width=sw;td.Height=sh;td.MipLevels=1;td.ArraySize=1;td.Format=DXGI_FORMAT_B8G8R8A8_UNORM;
      td.SampleDesc.Count=1;td.Usage=D3D11_USAGE_DYNAMIC;td.BindFlags=D3D11_BIND_SHADER_RESOURCE;td.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
      if(FAILED(h=device->CreateTexture2D(&td,nullptr,&tex))){why="CreateTexture2D "+hr(h);return false;}
      if(FAILED(h=device->CreateShaderResourceView(tex,nullptr,&srv))){why="CreateShaderResourceView "+hr(h);return false;}
      texW=sw;texH=sh;
    }
    D3D11_MAPPED_SUBRESOURCE m{};
    if(FAILED(h=ctx->Map(tex,0,D3D11_MAP_WRITE_DISCARD,0,&m))){why="Map textura "+hr(h);return false;}
    for(unsigned y=0;y<sh;++y)std::memcpy(static_cast<char*>(m.pData)+(std::size_t)y*m.RowPitch,src+(std::size_t)y*sw,(std::size_t)sw*4u);
    ctx->Unmap(tex,0);
    if(FAILED(h=ctx->Map(cb,0,D3D11_MAP_WRITE_DISCARD,0,&m))){why="Map parametros "+hr(h);return false;}
    std::memcpy(m.pData,p.p,64);ctx->Unmap(cb,0);
    const float black[4]={0,0,0,1};
    ctx->OMSetRenderTargets(1,&rtv,nullptr);ctx->ClearRenderTargetView(rtv,black);
    D3D11_VIEWPORT vp{};vp.TopLeftX=(float)r.x;vp.TopLeftY=(float)r.y;vp.Width=(float)r.w;vp.Height=(float)r.h;vp.MaxDepth=1.0f;
    ctx->RSSetViewports(1,&vp);
    ctx->IASetInputLayout(nullptr);ctx->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    ctx->VSSetShader(vs,nullptr,0);ctx->PSSetShader(ps,nullptr,0);
    ctx->PSSetConstantBuffers(0,1,&cb);ctx->PSSetShaderResources(0,1,&srv);ctx->PSSetSamplers(0,1,&samp);
    ctx->Draw(3,0);
    h=chain->Present(vsync?1:0,0);
    if(FAILED(h)){why="Present "+hr(h)+(h==DXGI_ERROR_DEVICE_REMOVED?" (placa removida/reiniciada: "+hr(device->GetDeviceRemovedReason())+")":"");return false;}
    return true;
  }
};
#endif
