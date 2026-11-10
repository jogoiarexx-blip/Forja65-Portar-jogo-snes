#pragma once
#include "forja_checkpoint.hpp"
#include "forja_desktop.hpp"
namespace forja148 {
inline bool applyState(CpuState& cpu,SnesRuntime& hw,Request request,const std::filesystem::path& dir="states"){
 if(request.slot<1||request.slot>5||(request.action!=Action::Save&&request.action!=Action::Load))throw std::runtime_error("Slot ou acao de estado invalido");
 const auto path=dir/("ff3-slot-"+std::to_string(request.slot)+".f65s");
 if(request.action==Action::Save){forja_checkpoint::save(path.string(),cpu,hw);return false;}
 forja_checkpoint::load(path.string(),cpu,hw,false);hw.checkpointCaptured=true;hw.checkpointYieldRequested=false;hw.hostFrameReady=false;hw.framePacingStarted=false;
 return true;
}
}
