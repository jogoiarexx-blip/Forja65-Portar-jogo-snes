#include "runtime.hpp"
#include <iostream>
#include <stdexcept>
#ifndef _WIN32
#include <sys/resource.h>
#include <csignal>
#endif

static void check(bool ok,const char* why){if(!ok)throw std::runtime_error(why);}
static std::string contents(const std::filesystem::path&p){std::ifstream f(p,std::ios::binary);return {std::istreambuf_iterator<char>(f),{}};}
int main(int argc,char**argv){try{
  namespace fs=std::filesystem;const std::string mode=argc>1?argv[1]:"success";
  SnesRuntime h;h.headless=true;h.sram.assign(32,0xab);h.sramDirty=true;h.sramPath="slot.srm";
  if(mode=="open-failure"){
    h.sramPath="missing/slot.srm";h.saveSram();
    check(h.sramDirty,"failed SRAM save lost dirty flag");
    fs::create_directory("missing");h.saveSram();
    check(!h.sramDirty&&contents(h.sramPath)==std::string(32,char(0xab)),"failed SRAM save could not be retried");
  }else if(mode=="preserve"){
    {std::ofstream f(h.sramPath,std::ios::binary);f<<"old-save";}
    fs::create_directory(h.sramPath+".forja65-tmp");h.saveSram();
    check(h.sramDirty,"save should fail when staging file cannot be opened");
    check(contents(h.sramPath)=="old-save","failed save overwrote old SRAM");
    fs::remove(h.sramPath+".forja65-tmp");h.saveSram();
    check(!h.sramDirty&&contents(h.sramPath)==std::string(32,char(0xab)),"save replacement retry");
  }else if(mode=="rename-failure"){
    fs::create_directory(h.sramPath);h.saveSram();
    check(h.sramDirty&&fs::is_directory(h.sramPath),"failed replacement lost pending save");
    check(!fs::exists(h.sramPath+".forja65-tmp"),"failed replacement left staging file");
    fs::remove(h.sramPath);h.saveSram();check(!h.sramDirty,"rename retry");
  }else if(mode=="write-failure"){
#ifndef _WIN32
    {std::ofstream f(h.sramPath,std::ios::binary);f<<"old-save";}
    // Real OS write failure, rather than a mocked stream or staging symlink.
    struct rlimit before{};check(getrlimit(RLIMIT_FSIZE,&before)==0,"getrlimit");
    auto limited=before;limited.rlim_cur=16;
    auto previous=std::signal(SIGXFSZ,SIG_IGN);
    check(setrlimit(RLIMIT_FSIZE,&limited)==0,"setrlimit");h.saveSram();
    check(setrlimit(RLIMIT_FSIZE,&before)==0,"restore rlimit");std::signal(SIGXFSZ,previous);
    check(h.sramDirty,"flush failure lost pending save");
    check(contents(h.sramPath)=="old-save","flush failure destroyed old SRAM");
    check(!fs::exists(h.sramPath+".forja65-tmp"),"failed flush left staging file");
    h.saveSram();check(!h.sramDirty,"flush retry");
#endif
  }else if(mode=="staging-link"||mode=="staging-hardlink"||mode=="staging-existing"){
    {std::ofstream f(h.sramPath,std::ios::binary);f<<"old-save";}
    const auto temp=h.sramPath+".forja65-tmp";
    if(mode=="staging-link")fs::create_symlink(h.sramPath,temp);
    else if(mode=="staging-hardlink")fs::create_hard_link(h.sramPath,temp);
    else {std::ofstream f(temp);f<<"unrelated-file";}
    h.saveSram();
    check(h.sramDirty,"pre-existing staging inode must not be reused");
    check(contents(h.sramPath)=="old-save","staging inode destroyed old save");
    check(fs::exists(temp),"unowned staging file was removed");
    fs::remove(temp);h.saveSram();check(!h.sramDirty,"staging retry");
  }else{
    {std::ofstream f(h.sramPath,std::ios::binary);f<<"longer-old-save-"<<std::string(64,'x');}
    h.saveSram();check(!h.sramDirty,"successful save kept dirty flag");
    check(contents(h.sramPath)==std::string(32,char(0xab)),"save bytes/length");
    check(!fs::exists(h.sramPath+".forja65-tmp"),"successful save left staging file");
    const auto time=fs::last_write_time(h.sramPath);h.saveSram();
    check(fs::last_write_time(h.sramPath)==time,"clean SRAM was rewritten");
    SnesRuntime reload;reload.headless=true;reload.sramPath=h.sramPath;reload.initSram(32);
    check(reload.sram==h.sram,"saved SRAM did not reload");
  }
  std::cout<<"SRAM_SAVE_V0436_PASS mode="<<mode<<'\n';return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}}
