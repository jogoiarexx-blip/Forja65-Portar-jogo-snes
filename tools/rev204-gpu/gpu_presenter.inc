// ---------------------------------------------------------------- escolha do backend
inline std::unique_ptr<GpuBackend> makeGpuBackend(GpuApi a){
  switch(a){
#ifdef _WIN32
    case GpuApi::D3D11:return std::make_unique<GpuD3D11>();
#endif
    case GpuApi::Vulkan:return std::make_unique<GpuVulkan>();
    case GpuApi::OpenGL:return std::make_unique<GpuOpenGL>();
    default:return nullptr;
  }
}
class GpuPresenter {
public:
  bool open(GpuApi a,const GpuSurface& s,const Settings& st,std::string& why){
    close();
    auto b=makeGpuBackend(a);
    if(!b){why="nao disponivel neste sistema";return false;}
    try{if(!b->init(s,st,why))return false;}
    catch(const std::exception& e){why=e.what();return false;}
    be=std::move(b);return true;
  }
  void close(){be.reset();}
  bool active()const{return (bool)be;}
  GpuApi api()const{return be?be->api():GpuApi::Cpu;}
  std::string label()const{return be?std::string("GPU ")+gpuApiLabel(be->api())+(be->software()?" (software)":""):std::string("CPU");}
  std::string device()const{return be?be->device():std::string();}
  // cw x ch = area de desenho em pixels; o retangulo da imagem segue a mesma regra da CPU (imageRect).
  bool present(const std::uint32_t* fb,unsigned fbW,unsigned fbH,unsigned cw,unsigned ch,const Settings& st,std::string& why){
    if(!be)return false;
    if(!cw||!ch||!fb||!fbW||!fbH)return true;
    const Rect r=imageRect((int)cw,(int)ch,fbW,fbH,st);
    if(r.w<=0||r.h<=0)return true;
    prep.build(fb,fbW,fbH,(unsigned)r.w,(unsigned)r.h,st);
    try{return be->draw(prep.src,prep.sw,prep.sh,cw,ch,r,prep.sp,why);}
    catch(const std::exception& e){why=e.what();return false;}
  }
private:
  std::unique_ptr<GpuBackend> be;GpuPrep prep;
};
// Proxima opcao de F9: auto -> d3d11 (Windows) -> vulkan -> opengl -> cpu -> auto.
inline std::string nextGpuBackend(const std::string& cur){
#ifdef _WIN32
  static const GpuApi order[]={GpuApi::Auto,GpuApi::D3D11,GpuApi::Vulkan,GpuApi::OpenGL,GpuApi::Cpu};
#else
  static const GpuApi order[]={GpuApi::Auto,GpuApi::OpenGL,GpuApi::Vulkan,GpuApi::Cpu};
#endif
  const GpuApi a=parseGpuApi(cur);const std::size_t n=sizeof(order)/sizeof(order[0]);
  for(std::size_t i=0;i<n;++i)if(order[i]==a)return gpuApiKey(order[(i+1)%n]);
  return "auto";
}
