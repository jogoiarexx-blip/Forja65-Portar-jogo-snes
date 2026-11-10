#include "runtime.hpp"
#include <memory>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <iostream>
#include <stdexcept>
static void check(bool okay,const char*label){if(!okay)throw std::runtime_error(label);}
int main(){try{
 auto h=std::make_unique<SnesRuntime>();auto&p=h->ppu;p.bgmode=0;p.brightness=15;p.tm=15;
 const unsigned colors[]={0x001f,0x03e0,0x7c00,0x03ff};
 for(unsigned b=0;b<4;++b){p.bgsc[b]=std::uint8_t((b+1)*4);p.bgnba[b]=std::uint8_t(4+b);p.vram[(4+b)*0x2000]=0x80;const auto ci=b*32+1;p.cgram[ci*2]=std::uint8_t(colors[b]);p.cgram[ci*2+1]=std::uint8_t(colors[b]>>8);}
 auto a=p.explainBackgroundLayers(0,0);for(unsigned b=0;b<4;++b)check(a.enabled[b]&&!a.windowed[b]&&a.candidate[b].valid&&a.candidate[b].source==b&&a.candidate[b].c15==colors[b],"four independent Mode0 BG candidates/colors");
 check(p.explainPixel(0,0).winner.source==0,"BG1 priority over remaining low-priority layers");
 p.tm=13;a=p.explainBackgroundLayers(0,0);check(!a.enabled[1]&&!a.candidate[1].valid&&a.candidate[0].valid&&a.candidate[2].valid,"TM disables only BG2");
 p.tm=15;p.tmw=1;p.w12sel=2;p.wh[0]=p.wh[1]=0;a=p.explainBackgroundLayers(0,0);check(a.windowed[0]&&!a.candidate[0].valid&&a.candidate[1].valid,"BG1 window preserves BG2 candidate");check(p.explainPixel(0,0).winner.source==1,"window exposes BG2 instead of BG1");
 p.tmw=0;p.w12sel=0;p.bgmode=1;a=p.explainBackgroundLayers(0,0);check(a.enabled[3]&&!a.candidate[3].valid,"BG4 is not a real Mode1 layer even if TM bit set");p.bgmode=0;
 for(unsigned i=1;i<128;i++)p.oam[512+i/4]|=std::uint8_t(1u<<((i%4)*2));
 p.oam[0]=0;p.oam[1]=0;p.oam[3]=0x30;p.vram[0]=0x80;p.cgram[258]=31;p.tm=31;
 auto q=p.explainPixel(0,0);check(q.obj.valid&&q.objEnabled&&q.winner.source==4,"high-priority OBJ wins");for(unsigned b=0;b<4;++b)check(q.bgLayers.candidate[b].valid,"OBJ winner does not erase BG evidence");
 p.tm=15;q=p.explainPixel(0,0);check(q.obj.valid&&!q.objEnabled&&q.winner.source==0,"disabled OBJ remains diagnostic candidate");
 p.tm=31;p.tmw=16;p.wobjsel=2;q=p.explainPixel(0,0);check(q.objWindowed&&q.winner.source==0&&q.bgLayers.candidate[0].valid,"OBJ window does not hide BG1");
 p.tmw=0;p.oam[3]=0x38;p.cgadsub=0x10;p.cgwsel=0;p.fixedR=6;p.cgram[386]=8;p.cgram[387]=0;q=p.explainPixel(0,0);check(q.winner.source==4&&q.colorChanged,"color math separate from layer ownership");
 h->fbWidth=256;h->fbHeight=224;h->framebuffer=p.renderFrame(256,224);const auto dir=std::filesystem::current_path();check(h->writePixelOwnership(dir),"ownership export");
 auto read=[](const auto&f){std::ifstream in(f);return std::string(std::istreambuf_iterator<char>(in),{});};auto csv=read(dir/"pixel-ownership.csv");
 for(unsigned b=1;b<=4;++b){const auto token="bg"+std::to_string(b)+"_visible,bg"+std::to_string(b)+"_priority,bg"+std::to_string(b)+"_windowed";check(csv.find(token)!=std::string::npos,"all four BG columns in export");}
 check(csv.find("0,0,0,16,4,16,0,obj_wins,1,1")!=std::string::npos,"export records OBJ winner and color math at tested pixel");check(read(dir/"pixel-ownership-summary.txt").find("snapshot_differs_frame=0")!=std::string::npos,"rendered framebuffer matches ownership snapshot");
 std::cout<<"BG_OBJ_PROVENANCE_V043618_PASS layers=4 windows=2 mode1=checked obj=3 color_math=1 export=verified\n";return 0;
}catch(const std::exception&e){std::cerr<<"BG_OBJ_PROVENANCE_FAIL "<<e.what()<<'\n';return 1;}}
