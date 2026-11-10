#include "runtime.hpp"
#include <filesystem>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
static void check(bool v,const char*why){if(!v)throw std::runtime_error(why);}
static bool fails(const std::filesystem::path&path,const std::string&trace){
  {std::ofstream o(path,std::ios::trunc);o<<trace;}
  try{SnesRuntime hw;hw.loadInputReplay(path.string());return false;}
  catch(const std::runtime_error&){return true;}
}
int main(){
 try{
  namespace fs=std::filesystem;
  const auto path=fs::temp_directory_path()/"forja65-input-strict-v0414.trace";
  fs::remove(path);
  {SnesRuntime hw;try{hw.loadInputReplay(path.string());return 2;}catch(const std::runtime_error&){}}
  check(fails(path,"# trace with no input\n"),"empty trace accepted");
  check(fails(path,"frame=0 joy1=0000\n"),"missing joy2 accepted");
  check(fails(path,"frame=0 joy1=GGGG joy2=0000\n"),"bad hex accepted");
  check(fails(path,"frame=0 joy1=10000 joy2=0000\n"),"overflow accepted");
  check(fails(path,"frame=0 joy1=0000 joy2=0000\nframe=0 joy1=0100 joy2=0000\n"),"duplicate frame accepted");
  check(fails(path,"frame=12 joy1=0000 joy2=0000\nframe=11 joy1=0000 joy2=0000\n"),"out-of-order input accepted");
  check(fails(path,"frame=0 joy1=0000 joy2=0000 nonsense=1234\n"),"unknown field accepted");
  {std::ofstream out(path);out<<"# valid game controls\nframe=0 joy1=0000 joy2=0000\nframe=360 joy1=1000 joy2=0000\nframe=364 joy1=0000 joy2=0000\n";}
  SnesRuntime hw;check(hw.loadInputReplay(path.string()),"valid trace refused");
  check(hw.inputReplay.size()==3,"lost commands");
  hw.frameCounter=0;check(hw.applyReplayInput()&&hw.io.joy[0]==0,"frame 0 wrong");
  hw.frameCounter=359;check(hw.applyReplayInput()&&hw.io.joy[0]==0,"pre-input changed");
  hw.frameCounter=360;check(hw.applyReplayInput()&&hw.io.joy[0]==0x1000,"START missing");
  hw.frameCounter=363;check(hw.applyReplayInput()&&hw.io.joy[0]==0x1000,"button prematurely released");
  hw.frameCounter=364;check(hw.applyReplayInput()&&hw.io.joy[0]==0,"START not released");
  fs::remove(path);
  std::cout<<"TETRIS_GAMEPLAY_INPUT_V0414_PASS\n";
  return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 1;}
}
