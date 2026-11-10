// Reference-only training backend. Never link into the production native target.
// nativeMasterCycles identifies hook scheduling here, NOT compiled SPC execution.
#include "runtime.hpp"
#include <set>
#include <cstdlib>
namespace {
struct PairProfile {
    std::set<unsigned> pairs;
    ~PairProfile(){
        const char* path=std::getenv("FORJA65_SPC_PROFILE");
        if(!path||!*path)return;
        std::ofstream out(path);
        out<<"{\n  \"format\": \"forja65-spc-observed-pairs-v1\",\n  \"pairs\": [\n";
        bool first=true;
        for(unsigned p:pairs){if(!first)out<<",\n";first=false;out<<"    ["<<(p>>8)<<", "<<(p&255)<<"]";}
        out<<"\n  ]\n}\n";
    }
};
PairProfile profile;
void observe(ApuBridge& s){profile.pairs.insert((unsigned(s.spc.pc)<<8)|forja65SpcPeek(s,s.spc.pc));}
void profileTick(ApuBridge& s,unsigned masterCycles){
    if(!s.preciseSpcTiming){
        s.spcMasterRemainder+=masterCycles;
        while(s.spcMasterRemainder>=42u){s.spcMasterRemainder-=42u;observe(s);forja65SpcStep(s);}
    }else{
        s.spcMasterRemainder+=std::uint64_t(masterCycles)*1024000ull;
        while(true){
            const auto cost=std::uint64_t(forja65SpcPredictCycles(s))*ApuBridge::DSP_MASTER_HZ;
            if(s.spcMasterRemainder<cost)break;
            s.spcMasterRemainder-=cost;observe(s);forja65SpcStep(s);
        }
    }
}
}
void forja65InstallSpcProfile(ApuBridge& s){s.setNativeStepHook(profileTick);}
