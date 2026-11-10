#include "forja_checkpoint.hpp"
#include <iostream>
#include <memory>
#include <stdexcept>
void forja65_dispatch(CpuState&,SnesRuntime&,std::uint32_t,std::uint32_t){}
static void must(bool v,const char*m){if(!v)throw std::runtime_error(m);}
static std::vector<std::uint8_t> ppuBytes(PpuState&p){
 forja_checkpoint::Codec c;c.value(p.regs);c.value(p.vram);c.value(p.cgram);c.value(p.oam);
 auto*a=reinterpret_cast<std::uint8_t*>(&p.inidisp);auto*b=reinterpret_cast<std::uint8_t*>(&p.stat78Pal)+sizeof(p.stat78Pal);c.bytes(a,std::size_t(b-a));return c.data;
}
int main(){try{
 auto slow=std::make_unique<SnesRuntime>(),fast=std::make_unique<SnesRuntime>();slow->headless=fast->headless=true;
 fast->ppu=slow->ppu;
 slow->ppuFastAddressEnabled=slow->ppuFastWindowEnabled=slow->ppuFastScrollEnabled=slow->ppuFastControlEnabled=false;
 fast->ppuFastAddressEnabled=fast->ppuFastWindowEnabled=fast->ppuFastScrollEnabled=fast->ppuFastControlEnabled=true;
 slow->ppuRegisterProfileEnabled=fast->ppuRegisterProfileEnabled=true;
 const unsigned regs[]={0x2100,0x2102,0x2103,0x2105,0x210d,0x210e,0x210f,0x2110,0x2111,0x2112,0x2113,0x2114,0x2115,0x2116,0x2117,0x2121,0x2123,0x2124,0x2125,0x2126,0x2127,0x2128,0x2129,0x2130,0x2131,0x2132,0x2104,0x2122};
 unsigned seed=193;
 for(unsigned i=0;i<12000;i++){
  seed=seed*1664525u+1013904223u;const auto reg=regs[i%(sizeof(regs)/sizeof(regs[0]))];const auto v=std::uint8_t(seed>>24);
  slow->write8(reg,v);fast->write8(reg,v);
  if(i%37u==0)must(ppuBytes(slow->ppu)==ppuBytes(fast->ppu),"PPU fast/generic state mismatch");
 }
 must(ppuBytes(slow->ppu)==ppuBytes(fast->ppu),"PPU final state mismatch");
 must(fast->ppuAddressFastWrites&&fast->ppuWindowFastWrites&&fast->ppuScrollFastWrites&&fast->ppuControlFastWrites,"all merged PPU paths exercised");
 must(slow->cpuMasterClock==fast->cpuMasterClock&&slow->ppuRegisterWriteCounts==fast->ppuRegisterWriteCounts,"fastpath preserves clocks/write census");
 std::vector<std::uint32_t>a,b;slow->ppu.renderOutputSegment(a,0,0,256);fast->ppu.renderOutputSegment(b,0,0,256);must(a==b,"PPU output mismatch");
 std::cout<<"PPU_REV193_AB_PASS mixed_writes=12000 state_and_pixels_equal\n";
 auto h=std::make_unique<SnesRuntime>();h->headless=true;h->apu.spc.pc=0x200;h->apu.spc.ram[0x200]=0xe8;
 h->apu.recordSpcAotMiss();h->apu.recordSpcAotMiss();h->apu.spc.ram[0x200]=0xbc;h->apu.recordSpcAotMiss();h->apu.spc.ram[0x200]=0xe8;h->apu.recordSpcAotMiss();
 must(h->apu.saveSpcAotLearn("spc-pairs"),"SPC pair export");
 std::ifstream sf("spc-pairs/spc-aot-misses.txt");std::string all((std::istreambuf_iterator<char>(sf)),{});
 must(all.find("pc=0x0200 opcode=0xE8 count=3")!=std::string::npos&&all.find("pc=0x0200 opcode=0xBC count=1")!=std::string::npos,"SPC pair history not preserved");
 std::cout<<"SPC_REV193_PAIRS_PASS E8=3 BC=1 same_pc=0200\n";
 auto plain=std::make_unique<SnesRuntime>(),observed=std::make_unique<SnesRuntime>();plain->headless=observed->headless=true;
 plain->ram[16]=observed->ram[16]=0x71;plain->lastInstructionPc=observed->lastInstructionPc=0x808000;
 plain->wramReadTraceInitialized=observed->wramReadTraceInitialized=true;
 observed->wramReadTraceMask.assign(131072,0);observed->wramReadTraceMask[16]=1;observed->wramReadTracePath="reads.csv";observed->wramReadTraceCap=2;
 for(auto addr:{0x7e0010u,0x000010u,0x802180u}){
  if((addr&0xffffu)==0x2180u)plain->io.wramPortAddr=observed->io.wramPortAddr=16;
  must(plain->read(addr)==observed->read(addr),"observer changed returned byte");
 }
 must(plain->ram==observed->ram&&plain->cpuMasterClock==observed->cpuMasterClock&&plain->hwUsage.wramReads==observed->hwUsage.wramReads&&plain->io.wramPortAddr==observed->io.wramPortAddr,"observer changed machine state or extra read");
 must(observed->wramReadTraceCount==2,"WRAM read cap not enforced");
 std::cout<<"WRAM_REV193_OBSERVER_PASS aliases_2180 cap=2 no_extra_read_or_clock\n";
 CpuState cpu;auto guard=std::make_unique<SnesRuntime>();guard->headless=true;guard->nativeReturns.push_back({});bool rejected=false;
 try{forja_checkpoint::save("unsafe.f65s",cpu,*guard);}catch(const std::runtime_error&){rejected=true;}must(rejected&&!std::filesystem::exists("unsafe.f65s"),"REV192 checkpoint guard lost");
 std::cout<<"CHECKPOINT_REV193_UNSAFE_REJECT_PASS\n";return 0;
}catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 2;}}
