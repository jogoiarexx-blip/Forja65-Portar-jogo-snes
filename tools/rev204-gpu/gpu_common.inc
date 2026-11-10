// ---------------------------------------------------------------- GPU (REV204)
// Apresentacao pela placa de video: Direct3D 11 (Windows), Vulkan ou OpenGL 3.3, escolhida em tempo de execucao,
// com volta automatica para a CPU. So o framebuffer pronto do PPU vai para a GPU, que aplica o filtro e escala;
// o jogo (CPU 65C816, PPU, APU, DMA) continua igual e deterministico. Os shaders seguem os filtros da CPU (REV198).
enum class GpuApi : unsigned { Auto, D3D11, Vulkan, OpenGL, Cpu, Count };
inline const char* gpuApiKey(GpuApi a){static const char* k[]={"auto","d3d11","vulkan","opengl","cpu"};return k[std::min<unsigned>(unsigned(a),4u)];}
inline const char* gpuApiLabel(GpuApi a){static const char* k[]={"Auto","Direct3D 11","Vulkan","OpenGL","CPU"};return k[std::min<unsigned>(unsigned(a),4u)];}
inline GpuApi parseGpuApi(const std::string& v){
  const std::string s=lower(trim(v));
  if(s=="d3d11"||s=="d3d"||s=="dx11"||s=="direct3d"||s=="direct3d11")return GpuApi::D3D11;
  if(s=="vulkan"||s=="vk")return GpuApi::Vulkan;
  if(s=="opengl"||s=="gl")return GpuApi::OpenGL;
  if(s=="cpu"||s=="software"||s=="gdi"||s=="sdl")return GpuApi::Cpu;
  return GpuApi::Auto;
}
enum class GpuPref : unsigned { Auto, Dedicated, Integrated };
inline GpuPref parseGpuPref(const std::string& v){
  const std::string s=lower(trim(v));
  if(s=="dedicated"||s=="dedicada"||s=="discrete"||s=="high"||s=="performance")return GpuPref::Dedicated;
  if(s=="integrated"||s=="integrada"||s=="low"||s=="power")return GpuPref::Integrated;
  return GpuPref::Auto;
}
// Ordem automatica: Windows tenta D3D11, Vulkan e OpenGL; Linux tenta OpenGL e Vulkan. Depois, a CPU.
inline std::vector<GpuApi> gpuCandidates(const Settings& s){
  const GpuApi a=parseGpuApi(s.backend);
  if(a==GpuApi::Cpu)return {};
  if(a!=GpuApi::Auto)return {a};
#ifdef _WIN32
  return {GpuApi::D3D11,GpuApi::Vulkan,GpuApi::OpenGL};
#else
  return {GpuApi::OpenGL,GpuApi::Vulkan};
#endif
}
// Placa por software (llvmpipe, WARP, lavapipe...) so e aceita quando escolhida explicitamente ou com gpu_software=1:
// no modo automatico ela nao alivia a CPU, entao o caminho da CPU e preferivel.
inline bool gpuAllowSoftware(const Settings& s){return s.gpuSoftware||parseGpuApi(s.backend)!=GpuApi::Auto;}
inline bool gpuSoftwareName(std::string n){
  n=lower(n);
  for(const char* k:{"llvmpipe","softpipe","swrast","software","gdi generic","basic render","swiftshader","lavapipe","warp"})
    if(n.find(k)!=std::string::npos)return true;
  return false;
}
inline void gpuLog(const std::string& line,bool reset=false){
  std::ofstream o("forja65-video-backend.txt",reset?std::ios::trunc:std::ios::app);
  if(o)o<<line<<"\n";
}

// Parametros do shader (4 x vec4, iguais em GLSL, HLSL e SPIR-V):
// P0 = textura (L,A), destino (L,A); P1 = filtro, mascara CRT, nitidez CAS, escala k; P2 = ganho CRT, mascara on, grade LCD on.
struct GpuShade { float p[16]{}; };
class GpuPrep {
public:
  const std::uint32_t* src{};unsigned sw{},sh{};GpuShade sp{};
  explicit GpuPrep(unsigned threads=~0u):pool(std::make_unique<RowPool>(threads)){}
  void build(const std::uint32_t* fb,unsigned fbW,unsigned fbH,unsigned rw,unsigned rh,const Settings& s){
    const Filter f=s.filter;src=fb;sw=fbW;sh=fbH;
    // Scale2x/Scale3x sao regras de pixel art: ficam na CPU (custam pouco a 256x224) e a GPU amplia o resultado.
    if(f==Filter::Scale2x){scale2x(fb,fbW,fbH,pre,*pool);src=pre.px.data();sw=pre.w;sh=pre.h;}
    else if(f==Filter::Scale3x||f==Filter::Scale3xFxaa){scale3x(fb,fbW,fbH,pre,*pool);src=pre.px.data();sw=pre.w;sh=pre.h;}
    float id=0,k=1;
    switch(f){
      case Filter::Nearest:id=1;break;
      case Filter::Bilinear:id=2;break;
      case Filter::Fxaa:{id=3;unsigned kmax=2u;if(const char* e=std::getenv("FORJA65_VIDEO_FXAA_SCALE"))if(*e)kmax=std::clamp((unsigned)std::strtoul(e,nullptr,10),1u,4u);
        k=(float)std::clamp(std::min(rw/std::max(1u,sw),rh/std::max(1u,sh)),1u,kmax);break;}
      case Filter::Scale3xFxaa:id=3;k=1;break;
      case Filter::Crt:id=7;break;
      case Filter::Lcd:id=8;break;
      case Filter::Cas:id=9;k=(float)std::clamp(std::min(rw/std::max(1u,sw),rh/std::max(1u,sh)),1u,3u);break;
      default:id=0;break; // sharp, scale2x, scale3x
    }
    const unsigned dim=std::min(s.crtMask,100u)*256u/100u;
    const double boost=std::lround(256.0*1.18*3.0/(1.0+2.0*dim/256.0))/256.0;
    const float p[16]={(float)sw,(float)sh,(float)rw,(float)rh, id,dim/256.0f,(float)std::min(s.sharpen,100u),k,
      (float)boost,(rw>=sw*2u)?1.0f:0.0f,(rw>=sw*3u&&rh>=sh*3u)?1.0f:0.0f,0.0f, 0,0,0,0};
    std::copy(p,p+16,sp.p);
  }
private:
  std::unique_ptr<RowPool> pool;Image pre;
};

// Janela nativa entregue ao backend. No Windows basta o HWND; no Linux a janela e do SDL2 e o host passa as funcoes.
struct GpuSurface {
#ifdef _WIN32
  HWND hwnd{};HINSTANCE hinst{};
#endif
  std::function<void*(const char*)> glProc;
  std::function<void()> glSwap;
  std::function<void(int)> glSwapInterval;
  std::function<std::vector<std::string>()> vkExtensions;
  std::function<bool(void*,std::uint64_t*)> vkSurface;
  void* vkGetInstanceProcAddr{};
};
class GpuBackend {
public:
  virtual ~GpuBackend()=default;
  virtual GpuApi api()const=0;
  virtual bool init(const GpuSurface& s,const Settings& st,std::string& why)=0;
  // Desenha src (sw x sh) no retangulo r de uma area cw x ch e apresenta. false = falha (o chamador volta para a CPU).
  virtual bool draw(const std::uint32_t* src,unsigned sw,unsigned sh,unsigned cw,unsigned ch,const Rect& r,const GpuShade& p,std::string& why)=0;
  const std::string& device()const{return dev;}
  bool software()const{return soft;}
protected:
  std::string dev;bool soft{};
};

static const char* const kGpuShaderBody=R"FJGPU(@@FJ_BODY@@)FJGPU";
static const char* const kGpuGlVert=R"FJGPU(@@FJ_GL_VERT@@)FJGPU";
static const char* const kGpuGlFragPre=R"FJGPU(@@FJ_GL_FRAG_PRE@@)FJGPU";
static const char* const kGpuGlFragPost=R"FJGPU(@@FJ_GL_FRAG_POST@@)FJGPU";
static const char* const kGpuHlslPre=R"FJGPU(@@FJ_HLSL_PRE@@)FJGPU";
static const char* const kGpuHlslPost=R"FJGPU(@@FJ_HLSL_POST@@)FJGPU";
static const char* const kGpuHlslVs=R"FJGPU(@@FJ_HLSL_VS@@)FJGPU";
// SPIR-V (Vulkan) compilado de shaders/vk.vert e vk.frag (mesmo corpo) com glslangValidator; base64.
static const char* const kGpuVkVert64="@@FJ_VK_VERT64@@";
static const char* const kGpuVkFrag64="@@FJ_VK_FRAG64@@";
inline std::vector<std::uint32_t> gpuBase64Words(const char* s){
  std::vector<std::uint8_t> b;unsigned acc=0;int bits=0;
  for(;*s;++s){const char c=*s;int v=c>='A'&&c<='Z'?c-'A':c>='a'&&c<='z'?c-'a'+26:c>='0'&&c<='9'?c-'0'+52:c=='+'?62:c=='/'?63:-1;
    if(v<0)continue;acc=(acc<<6)|(unsigned)v;bits+=6;if(bits>=8){bits-=8;b.push_back((std::uint8_t)((acc>>bits)&255u));}}
  std::vector<std::uint32_t> w(b.size()/4);std::memcpy(w.data(),b.data(),w.size()*4);return w;
}

// ---------------------------------------------------------------- OpenGL 3.3 core
#ifdef _WIN32
#define FJ_GLAPI APIENTRY
#else
#define FJ_GLAPI
#endif
class GpuOpenGL : public GpuBackend {
  typedef unsigned GLenum;typedef unsigned GLuint;typedef int GLint;typedef int GLsizei;typedef unsigned GLbitfield;typedef float GLfloat;typedef char GLchar;
  struct Fn {
    const unsigned char*(FJ_GLAPI*GetString)(GLenum);
    void(FJ_GLAPI*Viewport)(GLint,GLint,GLsizei,GLsizei);
    void(FJ_GLAPI*ClearColor)(GLfloat,GLfloat,GLfloat,GLfloat);
    void(FJ_GLAPI*Clear)(GLbitfield);
    void(FJ_GLAPI*GenTextures)(GLsizei,GLuint*);
    void(FJ_GLAPI*DeleteTextures)(GLsizei,const GLuint*);
    void(FJ_GLAPI*BindTexture)(GLenum,GLuint);
    void(FJ_GLAPI*TexParameteri)(GLenum,GLenum,GLint);
    void(FJ_GLAPI*TexImage2D)(GLenum,GLint,GLint,GLsizei,GLsizei,GLint,GLenum,GLenum,const void*);
    void(FJ_GLAPI*TexSubImage2D)(GLenum,GLint,GLint,GLint,GLsizei,GLsizei,GLenum,GLenum,const void*);
    void(FJ_GLAPI*PixelStorei)(GLenum,GLint);
    void(FJ_GLAPI*Disable)(GLenum);
    GLenum(FJ_GLAPI*GetError)();
    GLuint(FJ_GLAPI*CreateShader)(GLenum);
    void(FJ_GLAPI*ShaderSource)(GLuint,GLsizei,const GLchar* const*,const GLint*);
    void(FJ_GLAPI*CompileShader)(GLuint);
    void(FJ_GLAPI*GetShaderiv)(GLuint,GLenum,GLint*);
    void(FJ_GLAPI*GetShaderInfoLog)(GLuint,GLsizei,GLsizei*,GLchar*);
    void(FJ_GLAPI*DeleteShader)(GLuint);
    GLuint(FJ_GLAPI*CreateProgram)();
    void(FJ_GLAPI*AttachShader)(GLuint,GLuint);
    void(FJ_GLAPI*LinkProgram)(GLuint);
    void(FJ_GLAPI*GetProgramiv)(GLuint,GLenum,GLint*);
    void(FJ_GLAPI*GetProgramInfoLog)(GLuint,GLsizei,GLsizei*,GLchar*);
    void(FJ_GLAPI*DeleteProgram)(GLuint);
    void(FJ_GLAPI*UseProgram)(GLuint);
    GLint(FJ_GLAPI*GetUniformLocation)(GLuint,const GLchar*);
    void(FJ_GLAPI*Uniform4fv)(GLint,GLsizei,const GLfloat*);
    void(FJ_GLAPI*Uniform1i)(GLint,GLint);
    void(FJ_GLAPI*ActiveTexture)(GLenum);
    void(FJ_GLAPI*GenVertexArrays)(GLsizei,GLuint*);
    void(FJ_GLAPI*DeleteVertexArrays)(GLsizei,const GLuint*);
    void(FJ_GLAPI*BindVertexArray)(GLuint);
    void(FJ_GLAPI*DrawArrays)(GLenum,GLint,GLsizei);
  } gl{};
  GLuint prog{},vao{},tex{};GLint locP{-1},locTex{-1};unsigned texW{},texH{};bool ready{};
  std::function<void*(const char*)> proc;std::function<void()> swap;
#ifdef _WIN32
  HMODULE lib{};HWND wnd{};HDC dc{};HGLRC ctx{};
  HGLRC(WINAPI*wCreate)(HDC){};BOOL(WINAPI*wMake)(HDC,HGLRC){};BOOL(WINAPI*wDelete)(HGLRC){};PROC(WINAPI*wProc)(LPCSTR){};
  bool createWgl(HWND h,bool vsync,std::string& why){
    wnd=h;lib=LoadLibraryA("opengl32.dll");if(!lib){why="opengl32.dll ausente";return false;}
    wCreate=reinterpret_cast<HGLRC(WINAPI*)(HDC)>(reinterpret_cast<void*>(GetProcAddress(lib,"wglCreateContext")));
    wMake=reinterpret_cast<BOOL(WINAPI*)(HDC,HGLRC)>(reinterpret_cast<void*>(GetProcAddress(lib,"wglMakeCurrent")));
    wDelete=reinterpret_cast<BOOL(WINAPI*)(HGLRC)>(reinterpret_cast<void*>(GetProcAddress(lib,"wglDeleteContext")));
    wProc=reinterpret_cast<PROC(WINAPI*)(LPCSTR)>(reinterpret_cast<void*>(GetProcAddress(lib,"wglGetProcAddress")));
    if(!wCreate||!wMake||!wDelete||!wProc){why="opengl32.dll incompleta";return false;}
    dc=GetDC(h);if(!dc){why="GetDC falhou";return false;}
    if(!GetPixelFormat(dc)){
      PIXELFORMATDESCRIPTOR pfd{};pfd.nSize=sizeof(pfd);pfd.nVersion=1;pfd.dwFlags=PFD_DRAW_TO_WINDOW|PFD_SUPPORT_OPENGL|PFD_DOUBLEBUFFER;
      pfd.iPixelType=PFD_TYPE_RGBA;pfd.cColorBits=32;pfd.cAlphaBits=8;pfd.iLayerType=PFD_MAIN_PLANE;
      const int pf=ChoosePixelFormat(dc,&pfd);
      if(!pf||!SetPixelFormat(dc,pf,&pfd)){why="formato de pixel OpenGL recusado";return false;}
    }
    HGLRC legacy=wCreate(dc);if(!legacy||!wMake(dc,legacy)){if(legacy)wDelete(legacy);why="wglCreateContext falhou";return false;}
    typedef HGLRC(WINAPI*CreateAttribs)(HDC,HGLRC,const int*);
    const auto attribs=reinterpret_cast<CreateAttribs>(reinterpret_cast<void*>(wProc("wglCreateContextAttribsARB")));
    if(!attribs){wMake(nullptr,nullptr);wDelete(legacy);why="driver sem wglCreateContextAttribsARB (OpenGL 3.3 indisponivel)";return false;}
    const int a[]={0x2091,3,0x2092,3,0x9126,1,0}; // versao 3.3, perfil core
    ctx=attribs(dc,nullptr,a);wMake(nullptr,nullptr);wDelete(legacy);
    if(!ctx||!wMake(dc,ctx)){if(ctx)wDelete(ctx);ctx=nullptr;why="o driver nao criou contexto OpenGL 3.3 core";return false;}
    typedef BOOL(WINAPI*SwapInterval)(int);
    if(const auto si=reinterpret_cast<SwapInterval>(reinterpret_cast<void*>(wProc("wglSwapIntervalEXT"))))si(vsync?1:0);
    proc=[this](const char* n)->void*{void* p=reinterpret_cast<void*>(wProc(n));const auto v=reinterpret_cast<std::intptr_t>(p);
      if(v==0||v==1||v==2||v==3||v==-1)p=reinterpret_cast<void*>(GetProcAddress(lib,n));return p;};
    swap=[this]{SwapBuffers(dc);};
    return true;
  }
#endif
  template<class T> bool load(T& fn,const char* n){fn=reinterpret_cast<T>(proc(n));return fn!=nullptr;}
  GLuint compile(GLenum type,const std::string& src,std::string& why){
    const GLuint s=gl.CreateShader(type);const char* p=src.c_str();gl.ShaderSource(s,1,&p,nullptr);gl.CompileShader(s);
    GLint ok=0;gl.GetShaderiv(s,0x8B81,&ok);
    if(!ok){char log[2048]{};gl.GetShaderInfoLog(s,sizeof(log)-1,nullptr,log);why=std::string("shader GLSL recusado: ")+log;gl.DeleteShader(s);return 0;}
    return s;
  }
public:
  GpuApi api()const override{return GpuApi::OpenGL;}
  ~GpuOpenGL() override{
    if(ready&&gl.DeleteProgram){if(tex)gl.DeleteTextures(1,&tex);if(vao)gl.DeleteVertexArrays(1,&vao);if(prog)gl.DeleteProgram(prog);}
#ifdef _WIN32
    if(ctx){wMake(nullptr,nullptr);wDelete(ctx);}
    if(dc)ReleaseDC(wnd,dc);
    if(lib)FreeLibrary(lib);
#endif
  }
  bool init(const GpuSurface& s,const Settings& st,std::string& why) override{
#ifdef _WIN32
    if(!createWgl(s.hwnd,st.vsync,why))return false;
#else
    if(!s.glProc||!s.glSwap){why="janela sem contexto OpenGL";return false;}
    proc=s.glProc;swap=s.glSwap;if(s.glSwapInterval)s.glSwapInterval(st.vsync?1:0);
#endif
#define FJ_GL(n) if(!load(gl.n,"gl" #n)){why="funcao OpenGL ausente: gl" #n;return false;}
    FJ_GL(GetString)FJ_GL(Viewport)FJ_GL(ClearColor)FJ_GL(Clear)FJ_GL(GenTextures)FJ_GL(DeleteTextures)FJ_GL(BindTexture)FJ_GL(TexParameteri)
    FJ_GL(TexImage2D)FJ_GL(TexSubImage2D)FJ_GL(PixelStorei)FJ_GL(Disable)FJ_GL(GetError)FJ_GL(CreateShader)FJ_GL(ShaderSource)FJ_GL(CompileShader)
    FJ_GL(GetShaderiv)FJ_GL(GetShaderInfoLog)FJ_GL(DeleteShader)FJ_GL(CreateProgram)FJ_GL(AttachShader)FJ_GL(LinkProgram)FJ_GL(GetProgramiv)
    FJ_GL(GetProgramInfoLog)FJ_GL(DeleteProgram)FJ_GL(UseProgram)FJ_GL(GetUniformLocation)FJ_GL(Uniform4fv)FJ_GL(Uniform1i)FJ_GL(ActiveTexture)
    FJ_GL(GenVertexArrays)FJ_GL(DeleteVertexArrays)FJ_GL(BindVertexArray)FJ_GL(DrawArrays)
#undef FJ_GL
    ready=true;
    const unsigned char* ren=gl.GetString(0x1F01);const unsigned char* ven=gl.GetString(0x1F00);const unsigned char* ver=gl.GetString(0x1F02);
    dev=std::string(ren?(const char*)ren:"?")+" / "+(ven?(const char*)ven:"?")+" / GL "+(ver?(const char*)ver:"?");
    soft=gpuSoftwareName(dev);
    if(soft&&!gpuAllowSoftware(st)){why="so ha renderizador por software ("+dev+")";return false;}
    const GLuint vs=compile(0x8B31,kGpuGlVert,why);if(!vs)return false;
    const GLuint fs=compile(0x8B30,std::string(kGpuGlFragPre)+kGpuShaderBody+kGpuGlFragPost,why);if(!fs){gl.DeleteShader(vs);return false;}
    prog=gl.CreateProgram();gl.AttachShader(prog,vs);gl.AttachShader(prog,fs);gl.LinkProgram(prog);gl.DeleteShader(vs);gl.DeleteShader(fs);
    GLint ok=0;gl.GetProgramiv(prog,0x8B82,&ok);
    if(!ok){char log[2048]{};gl.GetProgramInfoLog(prog,sizeof(log)-1,nullptr,log);why=std::string("programa GLSL recusado: ")+log;return false;}
    locP=gl.GetUniformLocation(prog,"uP");locTex=gl.GetUniformLocation(prog,"uTex");
    gl.GenVertexArrays(1,&vao);gl.GenTextures(1,&tex);
    gl.BindTexture(0x0DE1,tex);
    gl.TexParameteri(0x0DE1,0x2801,0x2601);gl.TexParameteri(0x0DE1,0x2800,0x2601); // linear
    gl.TexParameteri(0x0DE1,0x2802,0x812F);gl.TexParameteri(0x0DE1,0x2803,0x812F); // clamp to edge
    gl.TexParameteri(0x0DE1,0x813D,0);                                               // so o nivel 0
    if(gl.GetError()!=0){why="erro OpenGL ao preparar a textura";return false;}
    return true;
  }
  bool draw(const std::uint32_t* src,unsigned sw,unsigned sh,unsigned cw,unsigned ch,const Rect& r,const GpuShade& p,std::string& why) override{
    gl.Disable(0x0C11);gl.Disable(0x0BE2);
    gl.Viewport(0,0,(GLsizei)cw,(GLsizei)ch);gl.ClearColor(0,0,0,1);gl.Clear(0x4000);
    gl.ActiveTexture(0x84C0);gl.BindTexture(0x0DE1,tex);gl.PixelStorei(0x0CF5,4);gl.PixelStorei(0x0CF2,0);
    if(sw!=texW||sh!=texH){gl.TexImage2D(0x0DE1,0,0x8058,(GLsizei)sw,(GLsizei)sh,0,0x80E1,0x1401,src);texW=sw;texH=sh;}
    else gl.TexSubImage2D(0x0DE1,0,0,0,(GLsizei)sw,(GLsizei)sh,0x80E1,0x1401,src);
    gl.Viewport(r.x,(GLint)ch-r.y-r.h,r.w,r.h); // OpenGL conta y de baixo para cima
    gl.UseProgram(prog);gl.Uniform4fv(locP,4,p.p);gl.Uniform1i(locTex,0);
    gl.BindVertexArray(vao);gl.DrawArrays(0x0004,0,3);
    const GLenum e=gl.GetError();
    if(e==0x0505){why="OpenGL sem memoria";return false;}
    swap();
    return true;
  }
};
