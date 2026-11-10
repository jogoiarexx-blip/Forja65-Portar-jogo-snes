// ---------------------------------------------------------------- Vulkan (Windows e Linux)
// Carregado em tempo de execucao (vulkan-1.dll / libvulkan.so.1 ou o loader do SDL2); declaracoes em forja_vk_min.
class GpuVulkan : public GpuBackend {
#ifdef _WIN32
  HMODULE lib{};
#else
  void* lib{};
#endif
  PFN_vkGetInstanceProcAddr gipa{};
  VkInstance inst{};VkSurfaceKHR surf{};VkPhysicalDevice phys{};VkDevice device{};VkQueue queue{};std::uint32_t qfam{};
  VkSwapchainKHR chain{};VkFormat fmt{VK_FORMAT_UNDEFINED};VkExtent2D ext{};
  std::vector<VkImage> images;std::vector<VkImageView> views;std::vector<VkFramebuffer> fbs;std::vector<VkSemaphore> done;
  VkRenderPass rp{};VkPipelineLayout layout{};VkPipeline pipe{};VkDescriptorSetLayout dsl{};VkDescriptorPool dpool{};VkDescriptorSet dset{};VkSampler samp{};
  VkImage tex{};VkDeviceMemory texMem{};VkImageView texView{};unsigned texW{},texH{};bool texReady{};
  VkBuffer stage{};VkDeviceMemory stageMem{};void* stageMap{};
  VkCommandPool cpool{};VkCommandBuffer cmd{};VkSemaphore acquired{};VkFence fence{};
  VkPhysicalDeviceMemoryProperties mem{};bool vsync{},needRecreate{};unsigned wantW{},wantH{};
#define FJ_VK_INSTANCE_FNS(X) X(vkDestroyInstance) X(vkEnumeratePhysicalDevices) X(vkGetPhysicalDeviceProperties) \
  X(vkGetPhysicalDeviceQueueFamilyProperties) X(vkGetPhysicalDeviceMemoryProperties) X(vkEnumerateDeviceExtensionProperties) \
  X(vkCreateDevice) X(vkGetDeviceProcAddr) X(vkDestroySurfaceKHR) X(vkGetPhysicalDeviceSurfaceSupportKHR) \
  X(vkGetPhysicalDeviceSurfaceCapabilitiesKHR) X(vkGetPhysicalDeviceSurfaceFormatsKHR) X(vkGetPhysicalDeviceSurfacePresentModesKHR)
#define FJ_VK_DEVICE_FNS(X) X(vkDestroyDevice) X(vkGetDeviceQueue) X(vkDeviceWaitIdle) X(vkCreateSwapchainKHR) X(vkDestroySwapchainKHR) \
  X(vkGetSwapchainImagesKHR) X(vkAcquireNextImageKHR) X(vkQueuePresentKHR) X(vkQueueSubmit) X(vkCreateImageView) X(vkDestroyImageView) \
  X(vkCreateRenderPass) X(vkDestroyRenderPass) X(vkCreateFramebuffer) X(vkDestroyFramebuffer) X(vkCreateShaderModule) X(vkDestroyShaderModule) \
  X(vkCreatePipelineLayout) X(vkDestroyPipelineLayout) X(vkCreateGraphicsPipelines) X(vkDestroyPipeline) X(vkCreateDescriptorSetLayout) \
  X(vkDestroyDescriptorSetLayout) X(vkCreateDescriptorPool) X(vkDestroyDescriptorPool) X(vkAllocateDescriptorSets) X(vkUpdateDescriptorSets) \
  X(vkCreateSampler) X(vkDestroySampler) X(vkCreateImage) X(vkDestroyImage) X(vkGetImageMemoryRequirements) X(vkBindImageMemory) \
  X(vkCreateBuffer) X(vkDestroyBuffer) X(vkGetBufferMemoryRequirements) X(vkBindBufferMemory) X(vkAllocateMemory) X(vkFreeMemory) \
  X(vkMapMemory) X(vkUnmapMemory) X(vkCreateCommandPool) X(vkDestroyCommandPool) X(vkAllocateCommandBuffers) X(vkBeginCommandBuffer) \
  X(vkEndCommandBuffer) X(vkResetCommandBuffer) X(vkCmdPipelineBarrier) X(vkCmdCopyBufferToImage) X(vkCmdBeginRenderPass) \
  X(vkCmdEndRenderPass) X(vkCmdBindPipeline) X(vkCmdBindDescriptorSets) X(vkCmdPushConstants) X(vkCmdSetViewport) X(vkCmdSetScissor) \
  X(vkCmdDraw) X(vkCreateSemaphore) X(vkDestroySemaphore) X(vkCreateFence) X(vkDestroyFence) X(vkWaitForFences) X(vkResetFences)
#define FJ_VK_DECL(n) PFN_##n n{};
  struct Fn { PFN_vkCreateInstance vkCreateInstance{};FJ_VK_INSTANCE_FNS(FJ_VK_DECL) FJ_VK_DEVICE_FNS(FJ_VK_DECL) } f;
#undef FJ_VK_DECL
  static std::string res(VkResult r){return "VkResult "+std::to_string((int)r);}
  std::uint32_t memType(std::uint32_t bits,VkMemoryPropertyFlags want)const{
    for(std::uint32_t i=0;i<mem.memoryTypeCount;++i)if((bits&(1u<<i))&&(mem.memoryTypes[i].propertyFlags&want)==want)return i;
    return ~0u;
  }
  void destroyChain(){
    for(auto v:fbs)f.vkDestroyFramebuffer(device,v,nullptr);
    for(auto v:views)f.vkDestroyImageView(device,v,nullptr);
    for(auto v:done)f.vkDestroySemaphore(device,v,nullptr);
    fbs.clear();views.clear();done.clear();images.clear();
  }
  void destroyTexture(){
    if(texView)f.vkDestroyImageView(device,texView,nullptr);if(tex)f.vkDestroyImage(device,tex,nullptr);if(texMem)f.vkFreeMemory(device,texMem,nullptr);
    if(stage)f.vkDestroyBuffer(device,stage,nullptr);if(stageMem)f.vkFreeMemory(device,stageMem,nullptr);
    texView=VK_NULL_HANDLE;tex=VK_NULL_HANDLE;texMem=VK_NULL_HANDLE;stage=VK_NULL_HANDLE;stageMem=VK_NULL_HANDLE;stageMap=nullptr;texW=texH=0;texReady=false;
  }
  bool makePipeline(std::string& why){
    VkAttachmentDescription at{};at.format=fmt;at.samples=VK_SAMPLE_COUNT_1_BIT;at.loadOp=VK_ATTACHMENT_LOAD_OP_CLEAR;at.storeOp=VK_ATTACHMENT_STORE_OP_STORE;
    at.stencilLoadOp=VK_ATTACHMENT_LOAD_OP_DONT_CARE;at.stencilStoreOp=VK_ATTACHMENT_STORE_OP_DONT_CARE;at.initialLayout=VK_IMAGE_LAYOUT_UNDEFINED;at.finalLayout=VK_IMAGE_LAYOUT_PRESENT_SRC_KHR;
    VkAttachmentReference ref{0,VK_IMAGE_LAYOUT_COLOR_ATTACHMENT_OPTIMAL};
    VkSubpassDescription sub{};sub.pipelineBindPoint=VK_PIPELINE_BIND_POINT_GRAPHICS;sub.colorAttachmentCount=1;sub.pColorAttachments=&ref;
    VkSubpassDependency dep{};dep.srcSubpass=VK_SUBPASS_EXTERNAL;dep.dstSubpass=0;dep.srcStageMask=VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    dep.dstStageMask=VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;dep.dstAccessMask=VK_ACCESS_COLOR_ATTACHMENT_WRITE_BIT;
    VkRenderPassCreateInfo rpi{};rpi.sType=VK_STRUCTURE_TYPE_RENDER_PASS_CREATE_INFO;rpi.attachmentCount=1;rpi.pAttachments=&at;rpi.subpassCount=1;rpi.pSubpasses=&sub;rpi.dependencyCount=1;rpi.pDependencies=&dep;
    VkResult r=f.vkCreateRenderPass(device,&rpi,nullptr,&rp);if(r!=VK_SUCCESS){why="vkCreateRenderPass "+res(r);return false;}
    const auto vw=gpuBase64Words(kGpuVkVert64),fw=gpuBase64Words(kGpuVkFrag64);
    VkShaderModule mv{},mf{};
    VkShaderModuleCreateInfo smi{};smi.sType=VK_STRUCTURE_TYPE_SHADER_MODULE_CREATE_INFO;smi.codeSize=vw.size()*4;smi.pCode=vw.data();
    if((r=f.vkCreateShaderModule(device,&smi,nullptr,&mv))!=VK_SUCCESS){why="shader SPIR-V (vertice) "+res(r);return false;}
    smi.codeSize=fw.size()*4;smi.pCode=fw.data();
    if((r=f.vkCreateShaderModule(device,&smi,nullptr,&mf))!=VK_SUCCESS){f.vkDestroyShaderModule(device,mv,nullptr);why="shader SPIR-V (fragmento) "+res(r);return false;}
    VkPipelineShaderStageCreateInfo st[2]{};
    st[0].sType=st[1].sType=VK_STRUCTURE_TYPE_PIPELINE_SHADER_STAGE_CREATE_INFO;
    st[0].stage=VK_SHADER_STAGE_VERTEX_BIT;st[0].module=mv;st[0].pName="main";st[1].stage=VK_SHADER_STAGE_FRAGMENT_BIT;st[1].module=mf;st[1].pName="main";
    VkPipelineVertexInputStateCreateInfo vi{};vi.sType=VK_STRUCTURE_TYPE_PIPELINE_VERTEX_INPUT_STATE_CREATE_INFO;
    VkPipelineInputAssemblyStateCreateInfo ia{};ia.sType=VK_STRUCTURE_TYPE_PIPELINE_INPUT_ASSEMBLY_STATE_CREATE_INFO;ia.topology=VK_PRIMITIVE_TOPOLOGY_TRIANGLE_LIST;
    VkPipelineViewportStateCreateInfo vp{};vp.sType=VK_STRUCTURE_TYPE_PIPELINE_VIEWPORT_STATE_CREATE_INFO;vp.viewportCount=1;vp.scissorCount=1;
    VkPipelineRasterizationStateCreateInfo rs{};rs.sType=VK_STRUCTURE_TYPE_PIPELINE_RASTERIZATION_STATE_CREATE_INFO;rs.polygonMode=VK_POLYGON_MODE_FILL;
    rs.cullMode=VK_CULL_MODE_NONE;rs.frontFace=VK_FRONT_FACE_COUNTER_CLOCKWISE;rs.lineWidth=1.0f;
    VkPipelineMultisampleStateCreateInfo ms{};ms.sType=VK_STRUCTURE_TYPE_PIPELINE_MULTISAMPLE_STATE_CREATE_INFO;ms.rasterizationSamples=VK_SAMPLE_COUNT_1_BIT;
    VkPipelineColorBlendAttachmentState cba{};cba.colorWriteMask=VK_COLOR_COMPONENT_R_BIT|VK_COLOR_COMPONENT_G_BIT|VK_COLOR_COMPONENT_B_BIT|VK_COLOR_COMPONENT_A_BIT;
    VkPipelineColorBlendStateCreateInfo cb{};cb.sType=VK_STRUCTURE_TYPE_PIPELINE_COLOR_BLEND_STATE_CREATE_INFO;cb.attachmentCount=1;cb.pAttachments=&cba;
    const VkDynamicState dyn[2]={VK_DYNAMIC_STATE_VIEWPORT,VK_DYNAMIC_STATE_SCISSOR};
    VkPipelineDynamicStateCreateInfo ds{};ds.sType=VK_STRUCTURE_TYPE_PIPELINE_DYNAMIC_STATE_CREATE_INFO;ds.dynamicStateCount=2;ds.pDynamicStates=dyn;
    VkGraphicsPipelineCreateInfo pi{};pi.sType=VK_STRUCTURE_TYPE_GRAPHICS_PIPELINE_CREATE_INFO;pi.stageCount=2;pi.pStages=st;pi.pVertexInputState=&vi;
    pi.pInputAssemblyState=&ia;pi.pViewportState=&vp;pi.pRasterizationState=&rs;pi.pMultisampleState=&ms;pi.pColorBlendState=&cb;pi.pDynamicState=&ds;
    pi.layout=layout;pi.renderPass=rp;pi.subpass=0;
    r=f.vkCreateGraphicsPipelines(device,VK_NULL_HANDLE,1,&pi,nullptr,&pipe);
    f.vkDestroyShaderModule(device,mv,nullptr);f.vkDestroyShaderModule(device,mf,nullptr);
    if(r!=VK_SUCCESS){why="vkCreateGraphicsPipelines "+res(r);return false;}
    return true;
  }
  // Cria (ou recria) a swapchain para cw x ch. ext 0 = janela minimizada: nada a desenhar.
  bool makeChain(unsigned cw,unsigned ch,std::string& why){
    f.vkDeviceWaitIdle(device);
    VkSurfaceCapabilitiesKHR caps{};VkResult r=f.vkGetPhysicalDeviceSurfaceCapabilitiesKHR(phys,surf,&caps);
    if(r!=VK_SUCCESS){why="capacidades da superficie "+res(r);return false;}
    std::uint32_t n=0;f.vkGetPhysicalDeviceSurfaceFormatsKHR(phys,surf,&n,nullptr);std::vector<VkSurfaceFormatKHR> fm(n);
    if(n)f.vkGetPhysicalDeviceSurfaceFormatsKHR(phys,surf,&n,fm.data());
    if(fm.empty()){why="superficie sem formatos";return false;}
    VkSurfaceFormatKHR choice=fm[0];
    for(const auto& x:fm)if((x.format==VK_FORMAT_B8G8R8A8_UNORM||x.format==VK_FORMAT_R8G8B8A8_UNORM)&&x.colorSpace==VK_COLOR_SPACE_SRGB_NONLINEAR_KHR){choice=x;break;}
    std::uint32_t pm=0;f.vkGetPhysicalDeviceSurfacePresentModesKHR(phys,surf,&pm,nullptr);std::vector<VkPresentModeKHR> modes(pm);
    if(pm)f.vkGetPhysicalDeviceSurfacePresentModesKHR(phys,surf,&pm,modes.data());
    VkPresentModeKHR mode=VK_PRESENT_MODE_FIFO_KHR;
    if(!vsync){for(auto m:modes)if(m==VK_PRESENT_MODE_MAILBOX_KHR){mode=m;break;}
      if(mode==VK_PRESENT_MODE_FIFO_KHR)for(auto m:modes)if(m==VK_PRESENT_MODE_IMMEDIATE_KHR){mode=m;break;}}
    VkExtent2D e=caps.currentExtent;
    if(e.width==0xFFFFFFFFu){e.width=std::clamp(cw,caps.minImageExtent.width,caps.maxImageExtent.width);e.height=std::clamp(ch,caps.minImageExtent.height,caps.maxImageExtent.height);}
    wantW=cw;wantH=ch;
    if(!e.width||!e.height){ext=e;return true;}
    std::uint32_t count=caps.minImageCount+1;if(caps.maxImageCount&&count>caps.maxImageCount)count=caps.maxImageCount;
    VkCompositeAlphaFlagBitsKHR alpha=VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR;
    for(auto a:{VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR,VK_COMPOSITE_ALPHA_INHERIT_BIT_KHR,VK_COMPOSITE_ALPHA_PRE_MULTIPLIED_BIT_KHR,VK_COMPOSITE_ALPHA_POST_MULTIPLIED_BIT_KHR})
      if(caps.supportedCompositeAlpha&a){alpha=a;break;}
    VkSwapchainCreateInfoKHR ci{};ci.sType=VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR;ci.surface=surf;ci.minImageCount=count;ci.imageFormat=choice.format;
    ci.imageColorSpace=choice.colorSpace;ci.imageExtent=e;ci.imageArrayLayers=1;ci.imageUsage=VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT;
    ci.imageSharingMode=VK_SHARING_MODE_EXCLUSIVE;ci.preTransform=caps.currentTransform;ci.compositeAlpha=alpha;ci.presentMode=mode;ci.clipped=VK_TRUE;ci.oldSwapchain=chain;
    VkSwapchainKHR fresh{};r=f.vkCreateSwapchainKHR(device,&ci,nullptr,&fresh);
    destroyChain();if(chain)f.vkDestroySwapchainKHR(device,chain,nullptr);chain=fresh;
    if(r!=VK_SUCCESS){chain=VK_NULL_HANDLE;why="vkCreateSwapchainKHR "+res(r);return false;}
    ext=e;
    if(choice.format!=fmt){
      if(pipe)f.vkDestroyPipeline(device,pipe,nullptr);if(rp)f.vkDestroyRenderPass(device,rp,nullptr);pipe=VK_NULL_HANDLE;rp=VK_NULL_HANDLE;
      fmt=choice.format;if(!makePipeline(why))return false;
    }
    f.vkGetSwapchainImagesKHR(device,chain,&n,nullptr);images.resize(n);f.vkGetSwapchainImagesKHR(device,chain,&n,images.data());
    for(auto img:images){
      VkImageViewCreateInfo vi{};vi.sType=VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;vi.image=img;vi.viewType=VK_IMAGE_VIEW_TYPE_2D;vi.format=fmt;
      vi.subresourceRange.aspectMask=VK_IMAGE_ASPECT_COLOR_BIT;vi.subresourceRange.levelCount=1;vi.subresourceRange.layerCount=1;
      VkImageView v{};if((r=f.vkCreateImageView(device,&vi,nullptr,&v))!=VK_SUCCESS){why="vkCreateImageView "+res(r);return false;}views.push_back(v);
      VkFramebufferCreateInfo fi{};fi.sType=VK_STRUCTURE_TYPE_FRAMEBUFFER_CREATE_INFO;fi.renderPass=rp;fi.attachmentCount=1;fi.pAttachments=&v;fi.width=e.width;fi.height=e.height;fi.layers=1;
      VkFramebuffer fb{};if((r=f.vkCreateFramebuffer(device,&fi,nullptr,&fb))!=VK_SUCCESS){why="vkCreateFramebuffer "+res(r);return false;}fbs.push_back(fb);
      VkSemaphoreCreateInfo si{};si.sType=VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO;VkSemaphore s{};
      if((r=f.vkCreateSemaphore(device,&si,nullptr,&s))!=VK_SUCCESS){why="vkCreateSemaphore "+res(r);return false;}done.push_back(s);
    }
    needRecreate=false;return true;
  }
  bool makeTexture(unsigned w,unsigned h,std::string& why){
    f.vkDeviceWaitIdle(device);destroyTexture();
    VkImageCreateInfo ii{};ii.sType=VK_STRUCTURE_TYPE_IMAGE_CREATE_INFO;ii.imageType=VK_IMAGE_TYPE_2D;ii.format=VK_FORMAT_B8G8R8A8_UNORM;ii.extent={w,h,1};
    ii.mipLevels=1;ii.arrayLayers=1;ii.samples=VK_SAMPLE_COUNT_1_BIT;ii.tiling=VK_IMAGE_TILING_OPTIMAL;
    ii.usage=VK_IMAGE_USAGE_TRANSFER_DST_BIT|VK_IMAGE_USAGE_SAMPLED_BIT;ii.sharingMode=VK_SHARING_MODE_EXCLUSIVE;ii.initialLayout=VK_IMAGE_LAYOUT_UNDEFINED;
    VkResult r=f.vkCreateImage(device,&ii,nullptr,&tex);if(r!=VK_SUCCESS){why="vkCreateImage "+res(r);return false;}
    VkMemoryRequirements req{};f.vkGetImageMemoryRequirements(device,tex,&req);
    VkMemoryAllocateInfo ai{};ai.sType=VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;ai.allocationSize=req.size;ai.memoryTypeIndex=memType(req.memoryTypeBits,VK_MEMORY_PROPERTY_DEVICE_LOCAL_BIT);
    if(ai.memoryTypeIndex==~0u)ai.memoryTypeIndex=memType(req.memoryTypeBits,0);
    if((r=f.vkAllocateMemory(device,&ai,nullptr,&texMem))!=VK_SUCCESS){why="memoria da textura "+res(r);return false;}
    f.vkBindImageMemory(device,tex,texMem,0);
    VkImageViewCreateInfo vi{};vi.sType=VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;vi.image=tex;vi.viewType=VK_IMAGE_VIEW_TYPE_2D;vi.format=VK_FORMAT_B8G8R8A8_UNORM;
    vi.subresourceRange.aspectMask=VK_IMAGE_ASPECT_COLOR_BIT;vi.subresourceRange.levelCount=1;vi.subresourceRange.layerCount=1;
    if((r=f.vkCreateImageView(device,&vi,nullptr,&texView))!=VK_SUCCESS){why="vista da textura "+res(r);return false;}
    VkBufferCreateInfo bi{};bi.sType=VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;bi.size=(VkDeviceSize)w*h*4u;bi.usage=VK_BUFFER_USAGE_TRANSFER_SRC_BIT;bi.sharingMode=VK_SHARING_MODE_EXCLUSIVE;
    if((r=f.vkCreateBuffer(device,&bi,nullptr,&stage))!=VK_SUCCESS){why="vkCreateBuffer "+res(r);return false;}
    f.vkGetBufferMemoryRequirements(device,stage,&req);
    ai.allocationSize=req.size;ai.memoryTypeIndex=memType(req.memoryTypeBits,VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT|VK_MEMORY_PROPERTY_HOST_COHERENT_BIT);
    if(ai.memoryTypeIndex==~0u){why="sem memoria visivel pela CPU";return false;}
    if((r=f.vkAllocateMemory(device,&ai,nullptr,&stageMem))!=VK_SUCCESS){why="memoria de envio "+res(r);return false;}
    f.vkBindBufferMemory(device,stage,stageMem,0);
    if((r=f.vkMapMemory(device,stageMem,0,VK_WHOLE_SIZE,0,&stageMap))!=VK_SUCCESS){why="vkMapMemory "+res(r);return false;}
    VkDescriptorImageInfo di{};di.sampler=samp;di.imageView=texView;di.imageLayout=VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL;
    VkWriteDescriptorSet w2{};w2.sType=VK_STRUCTURE_TYPE_WRITE_DESCRIPTOR_SET;w2.dstSet=dset;w2.dstBinding=0;w2.descriptorCount=1;
    w2.descriptorType=VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;w2.pImageInfo=&di;
    f.vkUpdateDescriptorSets(device,1,&w2,0,nullptr);
    texW=w;texH=h;texReady=false;return true;
  }
  void barrier(VkImageLayout from,VkImageLayout to,VkAccessFlags srcA,VkAccessFlags dstA,VkPipelineStageFlags srcS,VkPipelineStageFlags dstS){
    VkImageMemoryBarrier b{};b.sType=VK_STRUCTURE_TYPE_IMAGE_MEMORY_BARRIER;b.srcAccessMask=srcA;b.dstAccessMask=dstA;b.oldLayout=from;b.newLayout=to;
    b.srcQueueFamilyIndex=VK_QUEUE_FAMILY_IGNORED;b.dstQueueFamilyIndex=VK_QUEUE_FAMILY_IGNORED;b.image=tex;
    b.subresourceRange.aspectMask=VK_IMAGE_ASPECT_COLOR_BIT;b.subresourceRange.levelCount=1;b.subresourceRange.layerCount=1;
    f.vkCmdPipelineBarrier(cmd,srcS,dstS,0,0,nullptr,0,nullptr,1,&b);
  }
public:
  GpuApi api()const override{return GpuApi::Vulkan;}
  ~GpuVulkan() override{
    if(device){
      f.vkDeviceWaitIdle(device);destroyTexture();destroyChain();
      if(chain)f.vkDestroySwapchainKHR(device,chain,nullptr);
      if(pipe)f.vkDestroyPipeline(device,pipe,nullptr);if(rp)f.vkDestroyRenderPass(device,rp,nullptr);
      if(layout)f.vkDestroyPipelineLayout(device,layout,nullptr);if(dpool)f.vkDestroyDescriptorPool(device,dpool,nullptr);
      if(dsl)f.vkDestroyDescriptorSetLayout(device,dsl,nullptr);if(samp)f.vkDestroySampler(device,samp,nullptr);
      if(acquired)f.vkDestroySemaphore(device,acquired,nullptr);if(fence)f.vkDestroyFence(device,fence,nullptr);
      if(cpool)f.vkDestroyCommandPool(device,cpool,nullptr);
      f.vkDestroyDevice(device,nullptr);
    }
    if(surf&&f.vkDestroySurfaceKHR)f.vkDestroySurfaceKHR(inst,surf,nullptr);
    if(inst&&f.vkDestroyInstance)f.vkDestroyInstance(inst,nullptr);
#ifdef _WIN32
    if(lib)FreeLibrary(lib);
#else
    if(lib)dlclose(lib);
#endif
  }
  bool init(const GpuSurface& s,const Settings& st,std::string& why) override{
    vsync=st.vsync;
    gipa=reinterpret_cast<PFN_vkGetInstanceProcAddr>(s.vkGetInstanceProcAddr);
    if(!gipa){
#ifdef _WIN32
      lib=LoadLibraryA("vulkan-1.dll");
      if(lib)gipa=reinterpret_cast<PFN_vkGetInstanceProcAddr>(reinterpret_cast<void*>(GetProcAddress(lib,"vkGetInstanceProcAddr")));
#else
      lib=dlopen("libvulkan.so.1",RTLD_NOW|RTLD_LOCAL);if(!lib)lib=dlopen("libvulkan.so",RTLD_NOW|RTLD_LOCAL);
      if(lib)gipa=reinterpret_cast<PFN_vkGetInstanceProcAddr>(dlsym(lib,"vkGetInstanceProcAddr"));
#endif
    }
    if(!gipa){why="driver Vulkan nao instalado (vulkan-1.dll / libvulkan.so.1)";return false;}
    f.vkCreateInstance=reinterpret_cast<PFN_vkCreateInstance>(gipa(VK_NULL_HANDLE,"vkCreateInstance"));
    if(!f.vkCreateInstance){why="loader Vulkan sem vkCreateInstance";return false;}
    std::vector<std::string> extNames;
#ifdef _WIN32
    extNames={"VK_KHR_surface","VK_KHR_win32_surface"};
#else
    if(s.vkExtensions)extNames=s.vkExtensions();
#endif
    if(extNames.empty()){why="janela sem extensoes Vulkan de superficie";return false;}
    std::vector<const char*> ext;for(auto& e:extNames)ext.push_back(e.c_str());
    VkApplicationInfo app{};app.sType=VK_STRUCTURE_TYPE_APPLICATION_INFO;app.pApplicationName="Forja65 Native Port";app.pEngineName="Forja65";app.apiVersion=VK_MAKE_API_VERSION(0,1,0,0);
    VkInstanceCreateInfo ic{};ic.sType=VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;ic.pApplicationInfo=&app;ic.enabledExtensionCount=(std::uint32_t)ext.size();ic.ppEnabledExtensionNames=ext.data();
    VkResult r=f.vkCreateInstance(&ic,nullptr,&inst);
    if(r!=VK_SUCCESS){why="vkCreateInstance "+res(r)+" (driver Vulkan ausente ou antigo)";return false;}
#define FJ_VK_LOADI(n) f.n=reinterpret_cast<PFN_##n>(gipa(inst,#n));if(!f.n){why="Vulkan sem " #n;return false;}
    FJ_VK_INSTANCE_FNS(FJ_VK_LOADI)
#undef FJ_VK_LOADI
#ifdef _WIN32
    const auto createWin32=reinterpret_cast<PFN_vkCreateWin32SurfaceKHR>(gipa(inst,"vkCreateWin32SurfaceKHR"));
    if(!createWin32){why="Vulkan sem VK_KHR_win32_surface";return false;}
    VkWin32SurfaceCreateInfoKHR wi{};wi.sType=VK_STRUCTURE_TYPE_WIN32_SURFACE_CREATE_INFO_KHR;wi.hinstance=s.hinst;wi.hwnd=s.hwnd;
    if((r=createWin32(inst,&wi,nullptr,&surf))!=VK_SUCCESS){why="vkCreateWin32SurfaceKHR "+res(r);return false;}
#else
    std::uint64_t raw=0;if(!s.vkSurface||!s.vkSurface(inst,&raw)||!raw){why="SDL_Vulkan_CreateSurface falhou";return false;}
    surf=(VkSurfaceKHR)raw;
#endif
    // Escolha da placa: dedicada > integrada > virtual (auto/dedicated) ou integrada primeiro (integrated); CPU so se permitido.
    std::uint32_t n=0;f.vkEnumeratePhysicalDevices(inst,&n,nullptr);std::vector<VkPhysicalDevice> devs(n);if(n)f.vkEnumeratePhysicalDevices(inst,&n,devs.data());
    const GpuPref pref=parseGpuPref(st.gpu);int best=-1;std::string skipped;
    for(auto d:devs){
      VkPhysicalDeviceProperties pr{};f.vkGetPhysicalDeviceProperties(d,&pr);
      const bool cpu=pr.deviceType==VK_PHYSICAL_DEVICE_TYPE_CPU;
      if(cpu&&!gpuAllowSoftware(st)){skipped=pr.deviceName;continue;}
      std::uint32_t qn=0;f.vkGetPhysicalDeviceQueueFamilyProperties(d,&qn,nullptr);std::vector<VkQueueFamilyProperties> qs(qn);f.vkGetPhysicalDeviceQueueFamilyProperties(d,&qn,qs.data());
      std::uint32_t fam=~0u;for(std::uint32_t i=0;i<qn;++i){VkBool32 ok=VK_FALSE;f.vkGetPhysicalDeviceSurfaceSupportKHR(d,i,surf,&ok);if((qs[i].queueFlags&VK_QUEUE_GRAPHICS_BIT)&&ok){fam=i;break;}}
      if(fam==~0u)continue;
      std::uint32_t en=0;f.vkEnumerateDeviceExtensionProperties(d,nullptr,&en,nullptr);std::vector<VkExtensionProperties> es(en);if(en)f.vkEnumerateDeviceExtensionProperties(d,nullptr,&en,es.data());
      bool hasSwap=false;for(auto& e:es)if(std::strcmp(e.extensionName,"VK_KHR_swapchain")==0)hasSwap=true;
      if(!hasSwap)continue;
      int score=pr.deviceType==VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU?40:pr.deviceType==VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU?30:pr.deviceType==VK_PHYSICAL_DEVICE_TYPE_VIRTUAL_GPU?20:cpu?1:10;
      if(pref==GpuPref::Integrated&&pr.deviceType==VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU)score=50;
      if(score>best){best=score;phys=d;qfam=fam;dev=pr.deviceName;soft=cpu;
        char v[48];std::snprintf(v,sizeof(v)," / Vulkan %u.%u",(pr.apiVersion>>22)&127u,(pr.apiVersion>>12)&1023u);dev+=v;}
    }
    if(!phys){why=skipped.empty()?"nenhuma placa Vulkan apresenta nesta janela":"so ha Vulkan por software ("+skipped+")";return false;}
    f.vkGetPhysicalDeviceMemoryProperties(phys,&mem);
    const float prio=1.0f;VkDeviceQueueCreateInfo qi{};qi.sType=VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;qi.queueFamilyIndex=qfam;qi.queueCount=1;qi.pQueuePriorities=&prio;
    const char* dext[]={"VK_KHR_swapchain"};
    VkDeviceCreateInfo dc{};dc.sType=VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO;dc.queueCreateInfoCount=1;dc.pQueueCreateInfos=&qi;dc.enabledExtensionCount=1;dc.ppEnabledExtensionNames=dext;
    if((r=f.vkCreateDevice(phys,&dc,nullptr,&device))!=VK_SUCCESS){why="vkCreateDevice "+res(r);return false;}
#define FJ_VK_LOADD(n) f.n=reinterpret_cast<PFN_##n>(f.vkGetDeviceProcAddr(device,#n));if(!f.n){why="Vulkan sem " #n;return false;}
    FJ_VK_DEVICE_FNS(FJ_VK_LOADD)
#undef FJ_VK_LOADD
    f.vkGetDeviceQueue(device,qfam,0,&queue);
    VkCommandPoolCreateInfo pc{};pc.sType=VK_STRUCTURE_TYPE_COMMAND_POOL_CREATE_INFO;pc.flags=VK_COMMAND_POOL_CREATE_RESET_COMMAND_BUFFER_BIT;pc.queueFamilyIndex=qfam;
    if((r=f.vkCreateCommandPool(device,&pc,nullptr,&cpool))!=VK_SUCCESS){why="vkCreateCommandPool "+res(r);return false;}
    VkCommandBufferAllocateInfo ca{};ca.sType=VK_STRUCTURE_TYPE_COMMAND_BUFFER_ALLOCATE_INFO;ca.commandPool=cpool;ca.level=VK_COMMAND_BUFFER_LEVEL_PRIMARY;ca.commandBufferCount=1;
    if((r=f.vkAllocateCommandBuffers(device,&ca,&cmd))!=VK_SUCCESS){why="vkAllocateCommandBuffers "+res(r);return false;}
    VkSemaphoreCreateInfo si{};si.sType=VK_STRUCTURE_TYPE_SEMAPHORE_CREATE_INFO;
    VkFenceCreateInfo fi{};fi.sType=VK_STRUCTURE_TYPE_FENCE_CREATE_INFO;fi.flags=VK_FENCE_CREATE_SIGNALED_BIT;
    if(f.vkCreateSemaphore(device,&si,nullptr,&acquired)!=VK_SUCCESS||f.vkCreateFence(device,&fi,nullptr,&fence)!=VK_SUCCESS){why="sincronizacao Vulkan";return false;}
    VkSamplerCreateInfo sc{};sc.sType=VK_STRUCTURE_TYPE_SAMPLER_CREATE_INFO;sc.magFilter=VK_FILTER_LINEAR;sc.minFilter=VK_FILTER_LINEAR;sc.mipmapMode=VK_SAMPLER_MIPMAP_MODE_NEAREST;
    sc.addressModeU=sc.addressModeV=sc.addressModeW=VK_SAMPLER_ADDRESS_MODE_CLAMP_TO_EDGE;sc.maxLod=0.0f;
    if((r=f.vkCreateSampler(device,&sc,nullptr,&samp))!=VK_SUCCESS){why="vkCreateSampler "+res(r);return false;}
    VkDescriptorSetLayoutBinding lb{};lb.binding=0;lb.descriptorType=VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER;lb.descriptorCount=1;lb.stageFlags=VK_SHADER_STAGE_FRAGMENT_BIT;
    VkDescriptorSetLayoutCreateInfo lc{};lc.sType=VK_STRUCTURE_TYPE_DESCRIPTOR_SET_LAYOUT_CREATE_INFO;lc.bindingCount=1;lc.pBindings=&lb;
    if((r=f.vkCreateDescriptorSetLayout(device,&lc,nullptr,&dsl))!=VK_SUCCESS){why="vkCreateDescriptorSetLayout "+res(r);return false;}
    VkPushConstantRange pr{};pr.stageFlags=VK_SHADER_STAGE_FRAGMENT_BIT;pr.size=64;
    VkPipelineLayoutCreateInfo plc{};plc.sType=VK_STRUCTURE_TYPE_PIPELINE_LAYOUT_CREATE_INFO;plc.setLayoutCount=1;plc.pSetLayouts=&dsl;plc.pushConstantRangeCount=1;plc.pPushConstantRanges=&pr;
    if((r=f.vkCreatePipelineLayout(device,&plc,nullptr,&layout))!=VK_SUCCESS){why="vkCreatePipelineLayout "+res(r);return false;}
    VkDescriptorPoolSize ps{VK_DESCRIPTOR_TYPE_COMBINED_IMAGE_SAMPLER,1};
    VkDescriptorPoolCreateInfo dp{};dp.sType=VK_STRUCTURE_TYPE_DESCRIPTOR_POOL_CREATE_INFO;dp.maxSets=1;dp.poolSizeCount=1;dp.pPoolSizes=&ps;
    if((r=f.vkCreateDescriptorPool(device,&dp,nullptr,&dpool))!=VK_SUCCESS){why="vkCreateDescriptorPool "+res(r);return false;}
    VkDescriptorSetAllocateInfo da{};da.sType=VK_STRUCTURE_TYPE_DESCRIPTOR_SET_ALLOCATE_INFO;da.descriptorPool=dpool;da.descriptorSetCount=1;da.pSetLayouts=&dsl;
    if((r=f.vkAllocateDescriptorSets(device,&da,&dset))!=VK_SUCCESS){why="vkAllocateDescriptorSets "+res(r);return false;}
    return true;
  }
  bool draw(const std::uint32_t* src,unsigned sw,unsigned sh,unsigned cw,unsigned ch,const Rect& rect,const GpuShade& p,std::string& why) override{
    if(!chain||needRecreate||cw!=wantW||ch!=wantH){if(!makeChain(cw,ch,why))return false;}
    if(!ext.width||!ext.height||!chain)return true; // minimizada
    if(sw!=texW||sh!=texH){if(!makeTexture(sw,sh,why))return false;}
    VkResult r=f.vkWaitForFences(device,1,&fence,VK_TRUE,~0ull);
    if(r!=VK_SUCCESS){why="vkWaitForFences "+res(r);return false;}
    std::uint32_t idx=0;r=f.vkAcquireNextImageKHR(device,chain,~0ull,acquired,VK_NULL_HANDLE,&idx);
    if(r==VK_ERROR_OUT_OF_DATE_KHR){needRecreate=true;return true;}
    if(r==VK_SUBOPTIMAL_KHR)needRecreate=true;else if(r!=VK_SUCCESS){why="vkAcquireNextImageKHR "+res(r);return false;}
    f.vkResetFences(device,1,&fence);
    std::memcpy(stageMap,src,(std::size_t)sw*sh*4u);
    f.vkResetCommandBuffer(cmd,0);
    VkCommandBufferBeginInfo bi{};bi.sType=VK_STRUCTURE_TYPE_COMMAND_BUFFER_BEGIN_INFO;bi.flags=VK_COMMAND_BUFFER_USAGE_ONE_TIME_SUBMIT_BIT;
    f.vkBeginCommandBuffer(cmd,&bi);
    barrier(texReady?VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL:VK_IMAGE_LAYOUT_UNDEFINED,VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,
      texReady?VK_ACCESS_SHADER_READ_BIT:0,VK_ACCESS_TRANSFER_WRITE_BIT,texReady?VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT:VK_PIPELINE_STAGE_TOP_OF_PIPE_BIT,VK_PIPELINE_STAGE_TRANSFER_BIT);
    VkBufferImageCopy cp{};cp.imageSubresource.aspectMask=VK_IMAGE_ASPECT_COLOR_BIT;cp.imageSubresource.layerCount=1;cp.imageExtent={sw,sh,1};
    f.vkCmdCopyBufferToImage(cmd,stage,tex,VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,1,&cp);
    barrier(VK_IMAGE_LAYOUT_TRANSFER_DST_OPTIMAL,VK_IMAGE_LAYOUT_SHADER_READ_ONLY_OPTIMAL,VK_ACCESS_TRANSFER_WRITE_BIT,VK_ACCESS_SHADER_READ_BIT,
      VK_PIPELINE_STAGE_TRANSFER_BIT,VK_PIPELINE_STAGE_FRAGMENT_SHADER_BIT);
    texReady=true;
    VkClearValue clear{};clear.color.float32[3]=1.0f;
    VkRenderPassBeginInfo rb{};rb.sType=VK_STRUCTURE_TYPE_RENDER_PASS_BEGIN_INFO;rb.renderPass=rp;rb.framebuffer=fbs[idx];rb.renderArea.extent=ext;rb.clearValueCount=1;rb.pClearValues=&clear;
    f.vkCmdBeginRenderPass(cmd,&rb,VK_SUBPASS_CONTENTS_INLINE);
    // O retangulo foi calculado para cw x ch; a swapchain pode ter outro tamanho (HiDPI): ajusta na proporcao.
    const double kx=double(ext.width)/std::max(1u,cw),ky=double(ext.height)/std::max(1u,ch);
    VkViewport vp{};vp.x=float(rect.x*kx);vp.y=float(rect.y*ky);vp.width=float(rect.w*kx);vp.height=float(rect.h*ky);vp.maxDepth=1.0f;
    VkRect2D sc{};sc.offset={(std::int32_t)vp.x,(std::int32_t)vp.y};sc.extent={(std::uint32_t)std::max(1.0f,vp.width),(std::uint32_t)std::max(1.0f,vp.height)};
    f.vkCmdSetViewport(cmd,0,1,&vp);f.vkCmdSetScissor(cmd,0,1,&sc);
    f.vkCmdBindPipeline(cmd,VK_PIPELINE_BIND_POINT_GRAPHICS,pipe);
    f.vkCmdBindDescriptorSets(cmd,VK_PIPELINE_BIND_POINT_GRAPHICS,layout,0,1,&dset,0,nullptr);
    f.vkCmdPushConstants(cmd,layout,VK_SHADER_STAGE_FRAGMENT_BIT,0,64,p.p);
    f.vkCmdDraw(cmd,3,1,0,0);
    f.vkCmdEndRenderPass(cmd);
    f.vkEndCommandBuffer(cmd);
    const VkPipelineStageFlags waitStage=VK_PIPELINE_STAGE_COLOR_ATTACHMENT_OUTPUT_BIT;
    VkSubmitInfo si{};si.sType=VK_STRUCTURE_TYPE_SUBMIT_INFO;si.waitSemaphoreCount=1;si.pWaitSemaphores=&acquired;si.pWaitDstStageMask=&waitStage;
    si.commandBufferCount=1;si.pCommandBuffers=&cmd;si.signalSemaphoreCount=1;si.pSignalSemaphores=&done[idx];
    if((r=f.vkQueueSubmit(queue,1,&si,fence))!=VK_SUCCESS){why="vkQueueSubmit "+res(r);return false;}
    VkPresentInfoKHR pi{};pi.sType=VK_STRUCTURE_TYPE_PRESENT_INFO_KHR;pi.waitSemaphoreCount=1;pi.pWaitSemaphores=&done[idx];pi.swapchainCount=1;pi.pSwapchains=&chain;pi.pImageIndices=&idx;
    r=f.vkQueuePresentKHR(queue,&pi);
    if(r==VK_ERROR_OUT_OF_DATE_KHR||r==VK_SUBOPTIMAL_KHR)needRecreate=true;
    else if(r!=VK_SUCCESS){why="vkQueuePresentKHR "+res(r);return false;}
    return true;
  }
};
