#pragma once
// FORJA65_CHECKPOINT_V3 - complete scheduler/OBJ/timed-APU checkpoint at the *outer dispatch boundary*.
// Never serialize C++ call stacks, file streams, host audio devices or function pointers.
// The format is tied to the same ABI (compiler/platform/field layout); checksums/ROM/
// input replay/profile are verified BEFORE any runtime state is modified.
#include "generated.hpp"
#include <type_traits>
#include <cstring>
#include <limits>
#include <utility>
#include <filesystem>

namespace forja_checkpoint {
static constexpr std::uint32_t kVersion=3;
static constexpr std::size_t kMaxFile=16*1024*1024;
struct Codec {
  bool read{};std::vector<std::uint8_t> data;std::size_t pos{};
  void bytes(void*ptr,std::size_t len){
    if(len>kMaxFile||pos>kMaxFile-len)throw std::runtime_error("checkpoint section oversized");
    if(read){if(len>data.size()-pos)throw std::runtime_error("checkpoint truncated");
      if(len)std::memcpy(ptr,data.data()+pos,len);
    }else{const auto*p=reinterpret_cast<const std::uint8_t*>(ptr);data.insert(data.end(),p,p+len);}
    pos+=len;
  }
  template<class T>void value(T&v){static_assert(std::is_trivially_copyable_v<T>,"checkpoint POD required");bytes(&v,sizeof(v));}
  template<class T,std::size_t N>void value(T (&a)[N]){for(auto&x:a)value(x);}
  template<class T,std::size_t N>void value(std::array<T,N>&a){for(auto&x:a)value(x);}
  template<class T>void value(std::vector<T>&v){static_assert(std::is_trivially_copyable_v<T>);
    std::uint32_t n=(std::uint32_t)v.size();value(n);
    if(n>kMaxFile/sizeof(T))throw std::runtime_error("checkpoint vector length invalid");
    if(read){v.resize(n);}
    if(n){bytes(v.data(),std::size_t(n)*sizeof(T));}
  }
};
inline std::uint64_t fnv(const std::vector<std::uint8_t>&v){std::uint64_t h=14695981039346656037ULL;
  for(const auto b:v){h^=b;h*=1099511628211ULL;}return h;}
inline std::uint64_t replayHash(const SnesRuntime&hw){
  std::uint64_t h=14695981039346656037ULL;
  for(const auto&f:hw.inputReplay){for(std::uint64_t v:{f.frame,(std::uint64_t)f.joy1,(std::uint64_t)f.joy2})
    for(unsigned n=0;n<8;++n){h^=(std::uint8_t)(v>>(n*8));h*=1099511628211ULL;}}
  return h;
}
inline std::uint64_t abi(){
  // Runtime header changes and compiler/platform switches cannot silently load old files.
  std::uint64_t h=14695981039346656037ULL;
  for(auto v:{sizeof(CpuState),sizeof(PpuState),sizeof(SpcDsp),sizeof(SnesRuntime),
      sizeof(NativeReturnFrame),sizeof(ApuBridge),sizeof(bool),sizeof(void*),
      std::size_t(FORJA65_STACKLESS_CALLS)}){h^=v;h*=1099511628211ULL;}
#ifdef _MSC_VER
  h^=std::uint64_t(_MSC_VER)<<17;
#elif defined(__clang__)
  h^=std::uint64_t(__clang_major__)<<17;
#elif defined(__GNUC__)
  h^=std::uint64_t(__GNUC__)<<17;
#endif
  return h;
}
inline void stream(Codec&s,CpuState&cpu,SnesRuntime&hw,std::uint32_t version=kVersion){
#define F(x) s.value(x)
  F(cpu);
  F(hw.ram);F(hw.sram);
  F(hw.ppu.regs);F(hw.ppu.vram);F(hw.ppu.cgram);F(hw.ppu.oam);
  // All data members from inidisp through stat78Pal are scalars/arrays.
  // This excludes the std::vector memory pointers and all PPU methods.
  auto*first=reinterpret_cast<std::uint8_t*>(&hw.ppu.inidisp);
  auto*last=reinterpret_cast<std::uint8_t*>(&hw.ppu.stat78Pal)+sizeof(hw.ppu.stat78Pal);
  s.bytes(first,std::size_t(last-first));
  F(hw.io);F(hw.dma);
  // Preserve the scheduler's current phase, not only its visible counters.
  F(hw.hdmaSetupComplete);F(hw.hdmaSetupPosition);
  F(hw.nmiStatusHoldUntil);F(hw.irqStatusHoldUntil);
  F(hw.irqComparatorValid);F(hw.irqComparatorPollPending);
  F(hw.objEvalCursor);F(hw.objEvalInRange);F(hw.objEvalSelectedCount);
  F(hw.objEvalRotationBase);F(hw.objEvalSelected);F(hw.objTimeEvaluated);
  F(hw.objFetchedSlivers);F(hw.objFetchedSliverCount);
  F(hw.objDisplaySlivers);F(hw.objDisplaySliverCount);F(hw.objDisplaySliverLine);
  F(hw.objTimedRasterEnabled);F(hw.objTimedChrEnabled);F(hw.objLegacyHiresInterlace);
  F(hw.objDisplayInterlace);F(hw.objDisplayField);
  F(hw.objFetchSlots);F(hw.objFetchSlivers);F(hw.objFetchSpritePos);F(hw.objFetchTileOffset);
  F(hw.objFetchSpriteWidth);F(hw.objFetchSpriteHeight);F(hw.objFetchSpriteIndex);
  F(hw.objFetchSpriteTile);F(hw.objFetchSpriteY);F(hw.objFetchSpriteX);
  F(hw.objFetchSpriteAttributes);F(hw.objFetchSpriteObsel);
  F(hw.objFetchSpriteLoaded);F(hw.objFetchSpriteAttributesLoaded);
  F(hw.apu.spc.ram);F(hw.apu.spc.dsp);
  auto*spcFirst=reinterpret_cast<std::uint8_t*>(&hw.apu.spc.pc);
  auto*spcLast=reinterpret_cast<std::uint8_t*>(&hw.apu.spc.timersOn[2])+sizeof(hw.apu.spc.timersOn[2]);
  s.bytes(spcFirst,std::size_t(spcLast-spcFirst));
  static_assert(std::is_trivially_copyable_v<SpcDsp>,"SpcDsp must not contain host pointers");
  F(hw.apu.dsp);F(hw.apu.dirty);
  F(hw.apu.timedEchoEnabled);F(hw.apu.timedEchoCurrentProtection);
  F(hw.apu.autoSpcFlgEcho);F(hw.apu.spcInterleaveTickActive);
  F(hw.apu.spcFlgWritePending);F(hw.apu.spcFlgPendingProtected);
  std::uint32_t echoCount=(std::uint32_t)hw.apu.timedEchoProtection.size();F(echoCount);
  if(echoCount>65536u)throw std::runtime_error("checkpoint too many timed APU events");
  if(s.read)hw.apu.timedEchoProtection.resize(echoCount);
  for(auto&event:hw.apu.timedEchoProtection){F(event.master);F(event.protectedWrite);}
  F(hw.apu.accurateSpcTiming);F(hw.apu.strictSpcScheduler);F(hw.apu.correctedSpcSemantics);F(hw.apu.ntscSpcClock);
  F(hw.apu.transferStarted);F(hw.apu.nativeDspEnabled);F(hw.apu.uploadBase);F(hw.apu.lastPorts23);F(hw.apu.entryCandidate);
  F(hw.apu.uploadCount);F(hw.apu.lastCounter);F(hw.apu.keyOn);F(hw.apu.keyOff);
  F(hw.apu.spcMasterRemainder);F(hw.apu.nativeMasterCycles);F(hw.apu.fallbackMasterCycles);
  F(hw.apu.dspMasterRemainder);F(hw.apu.dspNativeSamples);F(hw.apu.dspFallbackSamples);
  F(hw.apu.legacyDspClock);F(hw.apu.interleaveSpcDsp);F(hw.apu.dspInterleaveSlices);
  F(hw.apu.masterClockHz);F(hw.apu.spcAotInstructions);F(hw.apu.spcAotMisses);F(hw.apu.spcAotExecutedCycles);F(hw.apu.spcInterpreterExecutedCycles);F(hw.apu.masterObserved);F(hw.apu.spcExecutedCycles);F(hw.apu.spcOpcodePc);F(hw.apu.ntscCycleCredit);
  F(hw.nativeReturns);F(hw.wramTailAuthorizations);
  // WramStoreContinuation contains dynamic byte vectors, unlike the other frames.
  std::uint32_t contCount=(std::uint32_t)hw.wramStoreContinuations.size();F(contCount);
  if(contCount>4096)throw std::runtime_error("checkpoint too many WRAM continuations");
  if(s.read)hw.wramStoreContinuations.resize(contCount);
  for(auto&x:hw.wramStoreContinuations){F(x.root);F(x.next);F(x.stack);F(x.bytes);F(x.m8);F(x.db);}
  F(hw.cpuTrace);F(hw.cpuTracePos);F(hw.cpuTraceCount);
  F(hw.dispatchPending);F(hw.dispatchTarget);F(hw.dispatchFrom);
  F(hw.hdmaActive);F(hw.hdmaEnded);F(hw.hdmaTransfer);F(hw.hdmaEveryLine);F(hw.hdmaInitialized);F(hw.hdmaLines);
  F(hw.stopped);F(hw.irqFiredThisLine);F(hw.frameTimingActive);F(hw.cpuNmiInterruptPending);F(hw.cpuIrqInterruptPending);
  F(hw.hdmaExecutedThisLine);F(hw.frameCounter);F(hw.cpuMasterClock);F(hw.cpuInstructionCount);F(hw.cpuInterpreterInstructions);
  F(hw.timingOverflowMasterCycles);F(hw.nmiServiceCount);F(hw.irqServiceCount);
  F(hw.currentScanline);F(hw.currentMasterCycle);F(hw.fbWidth);F(hw.fbHeight);F(hw.rasterCursorX);
  F(hw.lastInstructionMasterCycles);F(hw.lastInstructionPc);F(hw.interlaceField);F(hw.wramRefreshAppliedThisLine);
  F(hw.dmaStallMasterCycles);F(hw.hdmaStallMasterCycles);F(hw.wramRefreshStallMasterCycles);F(hw.interruptEntryMasterCycles);
  F(hw.framebuffer);F(hw.autoJoyNext);F(hw.autoJoyCapturePending);F(hw.inputReplayPos);F(hw.replayActive);
  F(hw.nativeCallSerial);F(hw.nativeReturnedCall);F(hw.nativeReturnedTarget);
  F(hw.cpuDataBus);F(hw.nativeCallPending);F(hw.nativeReference);F(hw.cpuInstructionTraced);
  F(hw.hwUsage);F(hw.hwFrameBase);
  F(hw.firstRomPc);F(hw.firstPpuPc);F(hw.firstApuPc);F(hw.firstDmaPc);F(hw.firstHdmaPc);
  F(hw.ppuAddressOnlyRasterSkips);F(hw.ppuCgramLatchRasterSkips);F(hw.dmaVramFastBytes);F(hw.vramBlockedWrites);
  F(hw.ppuRegisterReadCounts);F(hw.ppuRegisterWriteCounts);
  F(hw.nativeHookCalls);F(hw.nativeHookMasterCycles);
  F(hw.sramDirty);
  if(version>=3){F(hw.apu.dspSampleOrdinal);F(hw.apu.dspClockMasterObserved);F(hw.apu.spcHaltClockFraction);}
#undef F
}
inline std::vector<std::uint8_t> encode(CpuState&cpu,SnesRuntime&hw){
  Codec s;stream(s,cpu,hw);return std::move(s.data);
}
inline void decode(const std::vector<std::uint8_t>&b,CpuState&cpu,SnesRuntime&hw,std::uint32_t version=kVersion){
  Codec s;s.read=true;s.data=b;stream(s,cpu,hw,version);
  if(s.pos!=b.size())throw std::runtime_error("checkpoint trailing bytes");
}
struct Header {
  char magic[8]{'F','6','5','C','K','P','T','1'};
  std::uint32_t version{kVersion},reserved{};
  std::uint64_t abiSignature{},romHash{},inputsHash{},frame{},payloadHash{},payloadLength{};
  std::uint8_t profile{},romMode{},ppuMode{},nativeDma{},spcProfile{},reserved2[3]{};
};
static_assert(std::is_trivially_copyable_v<Header>);
inline std::uint64_t romSignature(const SnesRuntime&hw){const auto t=hw.cartHashHex();
 std::uint64_t h=14695981039346656037ULL;for(char c:t){h^=std::uint8_t(c);h*=1099511628211ULL;}return h;
}
inline Header makeHeader(const SnesRuntime&hw,const std::vector<std::uint8_t>&payload){
 Header h;h.abiSignature=abi();h.romHash=romSignature(hw);h.inputsHash=replayHash(hw);
 h.frame=hw.frameCounter;h.payloadHash=fnv(payload);h.payloadLength=payload.size();
 h.profile=hw.nativeReference?1:0;h.romMode=(std::uint8_t)hw.romMode;h.ppuMode=(std::uint8_t)hw.ppuMode;
 h.nativeDma=hw.nativeDmaEnabled?1:0;h.spcProfile=hw.apu.spcProfileName()==std::string("reference")?1:0;
 return h;
}
inline void validate(const Header&h,const SnesRuntime&hw){
 if(std::memcmp(h.magic,"F65CKPT1",8)||(h.version!=2&&h.version!=kVersion))throw std::runtime_error("checkpoint format mismatch");
 if(h.abiSignature!=abi())throw std::runtime_error("checkpoint runtime/compiler ABI mismatch");
 if(h.romHash!=romSignature(hw))throw std::runtime_error("checkpoint ROM fingerprint mismatch");
 if(h.inputsHash!=replayHash(hw))throw std::runtime_error("checkpoint input replay mismatch");
 if(h.profile!=(hw.nativeReference?1:0)||h.romMode!=(std::uint8_t)hw.romMode||
 h.ppuMode!=(std::uint8_t)hw.ppuMode||h.nativeDma!=(hw.nativeDmaEnabled?1:0)||
 h.spcProfile!=(hw.apu.spcProfileName()==std::string("reference")?1:0))
 throw std::runtime_error("checkpoint execution profile mismatch");
 if(h.payloadLength>kMaxFile)throw std::runtime_error("checkpoint too large");
}
inline Header save(const std::string&path,CpuState&cpu,SnesRuntime&hw){
  // Called only from main, outside forja65_dispatch, never from endVblank.
  if(hw.stopped)throw std::runtime_error("cannot checkpoint stopped runtime");
  if(hw.apu.nativeStepHook)throw std::runtime_error("checkpoint requires interpreter SPC700: linked native SPC step state is not serializable");
  auto payload=encode(cpu,hw);Header h=makeHeader(hw,payload);
  std::filesystem::path p(path),tmp(path+".tmp");
  if(!p.parent_path().empty())std::filesystem::create_directories(p.parent_path());
  {std::ofstream o(tmp,std::ios::binary|std::ios::trunc);if(!o)throw std::runtime_error("checkpoint file open failed");
    o.write((const char*)&h,sizeof(h));o.write((const char*)payload.data(),(std::streamsize)payload.size());
    o.flush();if(!o)throw std::runtime_error("checkpoint write failed");}
#ifdef _WIN32
  if(!MoveFileExW(tmp.c_str(),p.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH))
    throw std::runtime_error("checkpoint replacement failed: "+std::to_string(GetLastError()));
#else
  std::error_code ec;std::filesystem::rename(tmp,p,ec);
  if(ec)throw std::runtime_error("checkpoint rename failed: "+ec.message());
#endif
  return h;
}
inline Header load(const std::string&path,CpuState&cpu,SnesRuntime&hw,bool allowLegacy=true){
  if(hw.apu.nativeStepHook)throw std::runtime_error("checkpoint requires interpreter SPC700: linked native SPC step state is not serializable");
  std::ifstream i(path,std::ios::binary|std::ios::ate);if(!i)throw std::runtime_error("checkpoint file missing: "+path);
  const auto size=i.tellg();if(size<(std::streamoff)sizeof(Header)||size>(std::streamoff)(sizeof(Header)+kMaxFile))throw std::runtime_error("checkpoint file length invalid");
  i.seekg(0);Header h{};i.read((char*)&h,sizeof(h));validate(h,hw);
  if(!allowLegacy&&h.version!=kVersion)throw std::runtime_error("legacy checkpoint is for historical replay only; create a new state in this version");
  if(size!=(std::streamoff)(sizeof(Header)+h.payloadLength))throw std::runtime_error("checkpoint payload length invalid");
  std::vector<std::uint8_t>b((std::size_t)h.payloadLength);i.read((char*)b.data(),(std::streamsize)b.size());
  if(!i||fnv(b)!=h.payloadHash)throw std::runtime_error("checkpoint corrupt/checksum mismatch");
  // Decode into an independent temporary runtime so partial reads cannot mutate the live game.
  // The runtime is default-constructed: no host window / WAV handles are duplicated.
  CpuState testCpu=cpu;SnesRuntime testHw;
  decode(b,testCpu,testHw,h.version);
  if(testHw.frameCounter!=h.frame||testHw.inputReplayPos>hw.inputReplay.size())throw std::runtime_error("checkpoint frame/input position invalid");
  // Read again into the initialized runtime; its host handles/ROM/assets/hooks stay intact.
  decode(b,cpu,hw,h.version);
  hw.hostFrameReady=false; // host-only presentation latch; no SNES state mutated
  return h;
}
} // namespace forja_checkpoint
