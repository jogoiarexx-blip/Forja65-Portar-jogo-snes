#include "generated.hpp"
void sub_BEC774_E0M0X0C1(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {
  switch(entryPc&0xFFFFFFu){
    case 0xBEC774u: goto L_BEC774;
    case 0xBEC776u: goto L_BEC776;
    case 0xBEC779u: goto L_BEC779;
    case 0xBEC77Bu: goto L_BEC77B;
    case 0xBEC77Eu: goto L_BEC77E;
    case 0xBEC780u: goto L_BEC780;
    case 0xBEC783u: goto L_BEC783;
    case 0xBEC786u: goto L_BEC786;
    case 0xBEC789u: goto L_BEC789;
    case 0xBEC78Bu: goto L_BEC78B;
    case 0xBEC78Eu: goto L_BEC78E;
    case 0xBEC792u: goto L_BEC792;
    case 0xBEC795u: goto L_BEC795;
    case 0xBEC798u: goto L_BEC798;
    case 0xBEC79Au: goto L_BEC79A;
    case 0xBEC79Eu: goto L_BEC79E;
    case 0xBEC7A0u: goto L_BEC7A0;
    case 0xBEC7A2u: goto L_BEC7A2;
    case 0xBEC7A3u: goto L_BEC7A3;
    case 0xBEC7A6u: goto L_BEC7A6;
    case 0xBEC7A7u: goto L_BEC7A7;
    case 0xBEC7AAu: goto L_BEC7AA;
    case 0xBEC7ADu: goto L_BEC7AD;
    case 0xBEC7AFu: goto L_BEC7AF;
    case 0xBEC7B3u: goto L_BEC7B3;
    case 0xBEC7B6u: goto L_BEC7B6;
    case 0xBEC7BAu: goto L_BEC7BA;
    case 0xBEC7BCu: goto L_BEC7BC;
    case 0xBEC7BEu: goto L_BEC7BE;
    case 0xBEC7BFu: goto L_BEC7BF;
    case 0xBEC7C2u: goto L_BEC7C2;
    case 0xBEC7C3u: goto L_BEC7C3;
    case 0xBEC7C6u: goto L_BEC7C6;
    case 0xBEC7C9u: goto L_BEC7C9;
    case 0xBEC7CBu: goto L_BEC7CB;
    case 0xBEC7CFu: goto L_BEC7CF;
    case 0xBEC7D2u: goto L_BEC7D2;
    case 0xBEC7D4u: goto L_BEC7D4;
    case 0xBEC7D6u: goto L_BEC7D6;
    case 0xBEC7D8u: goto L_BEC7D8;
    case 0xBEC7DAu: goto L_BEC7DA;
    case 0xBEC7DDu: goto L_BEC7DD;
    case 0xBEC7DFu: goto L_BEC7DF;
    case 0xBEC7E1u: goto L_BEC7E1;
    case 0xBEC7E3u: goto L_BEC7E3;
    case 0xBEC7E6u: goto L_BEC7E6;
    case 0xBEC7E8u: goto L_BEC7E8;
    case 0xBEC7EBu: goto L_BEC7EB;
    case 0xBEC7EDu: goto L_BEC7ED;
    case 0xBEC7EFu: goto L_BEC7EF;
    case 0xBEC7F2u: goto L_BEC7F2;
    case 0xBEC7F4u: goto L_BEC7F4;
    case 0xBEC7F6u: goto L_BEC7F6;
    case 0xBEC7F8u: goto L_BEC7F8;
    case 0xBEC7F9u: goto L_BEC7F9;
    case 0xBEC7FCu: goto L_BEC7FC;
    default: hw.unresolvedFlow(entryPc,entryPc,cpu); return;
  }
L_BEC774:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC774u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC774u,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC774u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x78u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC774 LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x78u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC776;
L_BEC776:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC776u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC776u,cpu,0xCCu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC776u, 5u, 3u, cpu.address("abs", 0x04FDu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC776 CPY
    cpu.compareY(hw.readW(cpu.address("abs", 0x4FDu), cpu.x8?8:16));
    goto L_BEC779;
L_BEC779:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC779u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC779u,cpu,0xF0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC779u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC779 BEQ -> $BEC7A7
    if (cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC7A7; }
    goto L_BEC77B;
L_BEC77B:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC77Bu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC77Bu,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC77Bu, 5u, 3u, cpu.address("abs", 0x1B63u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC77B LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1B63u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC77E;
L_BEC77E:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC77Eu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC77Eu,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC77Eu, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC77E BNE -> $BEC7C3
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC7C3; }
    goto L_BEC780;
L_BEC780:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC780u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC780u,cpu,0xACu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC780u, 5u, 3u, cpu.address("abs", 0x185Eu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC780 LDY
    cpu.setY(hw.readW(cpu.address("abs", 0x185Eu), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC783;
L_BEC783:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC783u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC783u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC783u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC783 LDA
    cpu.setA(0x11u, 16);
    goto L_BEC786;
L_BEC786:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC786u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC786u,cpu,0xC0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC786u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC786 CPY
    cpu.compareY(0x2u);
    goto L_BEC789;
L_BEC789:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC789u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC789u,cpu,0xF0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC789u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC789 BEQ -> $BEC78E
    if (cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC78E; }
    goto L_BEC78B;
L_BEC78B:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC78Bu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC78Bu,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC78Bu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC78B LDA
    cpu.setA(0x12u, 16);
    goto L_BEC78E;
L_BEC78E:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC78Eu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC78Eu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC78Eu, 8u, 4u, 0xB88069u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC78E JSL -> $B88069 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC791u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC792u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB88069u, 0xBEC78Eu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC792;
L_BEC792:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC792u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC792u,0xBEC792u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC792u,cpu,0x20u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC792u, 6u, 3u, cpu.address("abs", 0xC1E4u), 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 2u);
    // $BEC792 JSR -> $BEC1E4 stack real
    { cpu.push16Value(hw,0xC794u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC795u,false,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, ((std::uint32_t(cpu.pb)<<16)|0xC1E4u), 0xBEC792u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC795;
L_BEC795:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC795u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC795u,0xBEC795u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC795u,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC795u, 5u, 3u, cpu.address("abs", 0x1862u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC795 LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1862u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC798;
L_BEC798:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC798u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC798u,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC798u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC798 BNE -> $BEC79E
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC79E; }
    goto L_BEC79A;
L_BEC79A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC79Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC79Au,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC79Au, 8u, 4u, 0xBB85ACu, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC79A JSL -> $BB85AC stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC79Du); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC79Eu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xBB85ACu, 0xBEC79Au); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC79E;
L_BEC79E:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC79Eu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC79Eu,0xBEC79Eu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC79Eu,cpu,0xA6u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC79Eu, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x70u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC79E LDX
    cpu.setX(hw.readW(cpu.address("dp", 0x70u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7A0;
L_BEC7A0:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A0u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A0u,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A0u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x78u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7A0 LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x78u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7A2;
L_BEC7A2:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A2u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A2u,cpu,0x38u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A2u, 2u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7A2 SEC
    cpu.setFlag('C', true);
    goto L_BEC7A3;
L_BEC7A3:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A3u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A3u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A3u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7A3 LDA
    cpu.setA(0x2u, 16);
    goto L_BEC7A6;
L_BEC7A6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A6u,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A6u, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7A6 RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xBEC7A6u);return;} hw.unresolvedReturn(0xBEC7A6u,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
L_BEC7A7:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A7u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A7u,cpu,0x20u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A7u, 6u, 3u, cpu.address("abs", 0xC1E4u), 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 2u);
    // $BEC7A7 JSR -> $BEC1E4 stack real
    { cpu.push16Value(hw,0xC7A9u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7AAu,false,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, ((std::uint32_t(cpu.pb)<<16)|0xC1E4u), 0xBEC7A7u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7AA;
L_BEC7AA:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7AAu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7AAu,0xBEC7AAu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7AAu,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7AAu, 5u, 3u, cpu.address("abs", 0x1862u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7AA LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1862u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7AD;
L_BEC7AD:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7ADu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7ADu,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7ADu, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7AD BNE -> $BEC7B3
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC7B3; }
    goto L_BEC7AF;
L_BEC7AF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7AFu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7AFu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7AFu, 8u, 4u, 0xBB85ACu, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7AF JSL -> $BB85AC stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC7B2u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7B3u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xBB85ACu, 0xBEC7AFu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7B3;
L_BEC7B3:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7B3u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7B3u,0xBEC7B3u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7B3u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7B3u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7B3 LDA
    cpu.setA(0x10u, 16);
    goto L_BEC7B6;
L_BEC7B6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7B6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7B6u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7B6u, 8u, 4u, 0xB88069u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7B6 JSL -> $B88069 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC7B9u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7BAu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB88069u, 0xBEC7B6u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7BA;
L_BEC7BA:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7BAu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7BAu,0xBEC7BAu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BAu,cpu,0xA6u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BAu, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x70u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7BA LDX
    cpu.setX(hw.readW(cpu.address("dp", 0x70u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7BC;
L_BEC7BC:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7BCu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BCu,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BCu, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x78u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7BC LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x78u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7BE;
L_BEC7BE:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7BEu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BEu,cpu,0x38u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BEu, 2u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7BE SEC
    cpu.setFlag('C', true);
    goto L_BEC7BF;
L_BEC7BF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7BFu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BFu,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BFu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7BF LDA
    cpu.setA(0x2u, 16);
    goto L_BEC7C2;
L_BEC7C2:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7C2u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C2u,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C2u, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7C2 RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xBEC7C2u);return;} hw.unresolvedReturn(0xBEC7C2u,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
L_BEC7C3:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7C3u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C3u,cpu,0x20u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C3u, 6u, 3u, cpu.address("abs", 0xC1E4u), 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 2u);
    // $BEC7C3 JSR -> $BEC1E4 stack real
    { cpu.push16Value(hw,0xC7C5u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7C6u,false,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, ((std::uint32_t(cpu.pb)<<16)|0xC1E4u), 0xBEC7C3u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7C6;
L_BEC7C6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7C6u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7C6u,0xBEC7C6u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C6u,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C6u, 5u, 3u, cpu.address("abs", 0x1862u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7C6 LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1862u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7C9;
L_BEC7C9:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7C9u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C9u,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C9u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7C9 BNE -> $BEC7CF
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC7CF; }
    goto L_BEC7CB;
L_BEC7CB:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7CBu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7CBu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7CBu, 8u, 4u, 0xBB85ACu, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7CB JSL -> $BB85AC stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC7CEu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7CFu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xBB85ACu, 0xBEC7CBu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7CF;
L_BEC7CF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7CFu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7CFu,0xBEC7CFu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7CFu,cpu,0xAEu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7CFu, 5u, 3u, cpu.address("abs", 0x1B63u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7CF LDX
    cpu.setX(hw.readW(cpu.address("abs", 0x1B63u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7D2;
L_BEC7D2:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7D2u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D2u,cpu,0xA5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D2u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x6Cu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7D2 LDA
    cpu.loadA(hw.readW(cpu.address("dp", 0x6Cu), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7D4;
L_BEC7D4:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7D4u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D4u,cpu,0x85u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D4u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x44u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7D4 STA
    hw.write(cpu.address("dp", 0x44u), cpu.a, cpu.m8?8:16);
    goto L_BEC7D6;
L_BEC7D6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7D6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D6u,cpu,0xB5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D6u, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x06u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7D6 LDA
    cpu.loadA(hw.readW(cpu.address("dpx", 0x6u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7D8;
L_BEC7D8:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7D8u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D8u,cpu,0x85u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D8u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x42u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7D8 STA
    hw.write(cpu.address("dp", 0x42u), cpu.a, cpu.m8?8:16);
    goto L_BEC7DA;
L_BEC7DA:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7DAu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DAu,cpu,0xA0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DAu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7DA LDY
    cpu.setY(0x8u, 16);
    goto L_BEC7DD;
L_BEC7DD:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7DDu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DDu,cpu,0xB7u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DDu, 7u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, ((cpu.d + 0x42u) & 0xFFFFu), 3u, 0u);
    // $BEC7DD LDA
    cpu.loadA(hw.readW(cpu.addressDpLongY(hw, 0x42u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7DF;
L_BEC7DF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7DFu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DFu,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DFu, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x2Eu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7DF STA
    hw.write(cpu.address("dpx", 0x2Eu), cpu.a, cpu.m8?8:16);
    goto L_BEC7E1;
L_BEC7E1:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7E1u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E1u,cpu,0xB5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E1u, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x4Au), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7E1 LDA
    cpu.loadA(hw.readW(cpu.address("dpx", 0x4Au), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7E3;
L_BEC7E3:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7E3u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E3u,cpu,0xC9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E3u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7E3 CMP
    cpu.compareA(0xAu);
    goto L_BEC7E6;
L_BEC7E6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7E6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E6u,cpu,0xB0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E6u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7E6 BCS -> $BEC7EB
    if (cpu.c) { hw.addCpuInternalCycles(1u); goto L_BEC7EB; }
    goto L_BEC7E8;
L_BEC7E8:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7E8u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E8u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E8u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7E8 LDA
    cpu.setA(0xAu, 16);
    goto L_BEC7EB;
L_BEC7EB:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7EBu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EBu,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EBu, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x4Au), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7EB STA
    hw.write(cpu.address("dpx", 0x4Au), cpu.a, cpu.m8?8:16);
    goto L_BEC7ED;
L_BEC7ED:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7EDu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EDu,cpu,0xB5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EDu, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x46u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7ED LDA
    cpu.loadA(hw.readW(cpu.address("dpx", 0x46u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7EF;
L_BEC7EF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7EFu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EFu,cpu,0x09u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EFu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7EF ORA
    cpu.logicOr(0x4u);
    goto L_BEC7F2;
L_BEC7F2:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F2u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F2u,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F2u, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x46u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F2 STA
    hw.write(cpu.address("dpx", 0x46u), cpu.a, cpu.m8?8:16);
    goto L_BEC7F4;
L_BEC7F4:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F4u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F4u,cpu,0xA6u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F4u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x70u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F4 LDX
    cpu.setX(hw.readW(cpu.address("dp", 0x70u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7F6;
L_BEC7F6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F6u,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F6u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x78u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F6 LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x78u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7F8;
L_BEC7F8:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F8u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F8u,cpu,0x38u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F8u, 2u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F8 SEC
    cpu.setFlag('C', true);
    goto L_BEC7F9;
L_BEC7F9:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F9u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F9u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F9u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F9 LDA
    cpu.setA(0x2u, 16);
    goto L_BEC7FC;
L_BEC7FC:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7FCu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7FCu,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7FCu, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7FC RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xBEC7FCu);return;} hw.unresolvedReturn(0xBEC7FCu,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
}

void sub_BEC774_E0M0X0CQ(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {
  switch(entryPc&0xFFFFFFu){
    case 0xBEC774u: goto L_BEC774;
    case 0xBEC776u: goto L_BEC776;
    case 0xBEC779u: goto L_BEC779;
    case 0xBEC77Bu: goto L_BEC77B;
    case 0xBEC77Eu: goto L_BEC77E;
    case 0xBEC780u: goto L_BEC780;
    case 0xBEC783u: goto L_BEC783;
    case 0xBEC786u: goto L_BEC786;
    case 0xBEC789u: goto L_BEC789;
    case 0xBEC78Bu: goto L_BEC78B;
    case 0xBEC78Eu: goto L_BEC78E;
    case 0xBEC792u: goto L_BEC792;
    case 0xBEC795u: goto L_BEC795;
    case 0xBEC798u: goto L_BEC798;
    case 0xBEC79Au: goto L_BEC79A;
    case 0xBEC79Eu: goto L_BEC79E;
    case 0xBEC7A0u: goto L_BEC7A0;
    case 0xBEC7A2u: goto L_BEC7A2;
    case 0xBEC7A3u: goto L_BEC7A3;
    case 0xBEC7A6u: goto L_BEC7A6;
    case 0xBEC7A7u: goto L_BEC7A7;
    case 0xBEC7AAu: goto L_BEC7AA;
    case 0xBEC7ADu: goto L_BEC7AD;
    case 0xBEC7AFu: goto L_BEC7AF;
    case 0xBEC7B3u: goto L_BEC7B3;
    case 0xBEC7B6u: goto L_BEC7B6;
    case 0xBEC7BAu: goto L_BEC7BA;
    case 0xBEC7BCu: goto L_BEC7BC;
    case 0xBEC7BEu: goto L_BEC7BE;
    case 0xBEC7BFu: goto L_BEC7BF;
    case 0xBEC7C2u: goto L_BEC7C2;
    case 0xBEC7C3u: goto L_BEC7C3;
    case 0xBEC7C6u: goto L_BEC7C6;
    case 0xBEC7C9u: goto L_BEC7C9;
    case 0xBEC7CBu: goto L_BEC7CB;
    case 0xBEC7CFu: goto L_BEC7CF;
    case 0xBEC7D2u: goto L_BEC7D2;
    case 0xBEC7D4u: goto L_BEC7D4;
    case 0xBEC7D6u: goto L_BEC7D6;
    case 0xBEC7D8u: goto L_BEC7D8;
    case 0xBEC7DAu: goto L_BEC7DA;
    case 0xBEC7DDu: goto L_BEC7DD;
    case 0xBEC7DFu: goto L_BEC7DF;
    case 0xBEC7E1u: goto L_BEC7E1;
    case 0xBEC7E3u: goto L_BEC7E3;
    case 0xBEC7E6u: goto L_BEC7E6;
    case 0xBEC7E8u: goto L_BEC7E8;
    case 0xBEC7EBu: goto L_BEC7EB;
    case 0xBEC7EDu: goto L_BEC7ED;
    case 0xBEC7EFu: goto L_BEC7EF;
    case 0xBEC7F2u: goto L_BEC7F2;
    case 0xBEC7F4u: goto L_BEC7F4;
    case 0xBEC7F6u: goto L_BEC7F6;
    case 0xBEC7F8u: goto L_BEC7F8;
    case 0xBEC7F9u: goto L_BEC7F9;
    case 0xBEC7FCu: goto L_BEC7FC;
    default: hw.unresolvedFlow(entryPc,entryPc,cpu); return;
  }
L_BEC774:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC774u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC774u,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC774u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x78u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC774 LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x78u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC776;
L_BEC776:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC776u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC776u,cpu,0xCCu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC776u, 5u, 3u, cpu.address("abs", 0x04FDu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC776 CPY
    cpu.compareY(hw.readW(cpu.address("abs", 0x4FDu), cpu.x8?8:16));
    goto L_BEC779;
L_BEC779:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC779u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC779u,cpu,0xF0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC779u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC779 BEQ -> $BEC7A7
    if (cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC7A7; }
    goto L_BEC77B;
L_BEC77B:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC77Bu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC77Bu,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC77Bu, 5u, 3u, cpu.address("abs", 0x1B63u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC77B LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1B63u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC77E;
L_BEC77E:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC77Eu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC77Eu,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC77Eu, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC77E BNE -> $BEC7C3
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC7C3; }
    goto L_BEC780;
L_BEC780:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC780u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC780u,cpu,0xACu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC780u, 5u, 3u, cpu.address("abs", 0x185Eu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC780 LDY
    cpu.setY(hw.readW(cpu.address("abs", 0x185Eu), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC783;
L_BEC783:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC783u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC783u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC783u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC783 LDA
    cpu.setA(0x11u, 16);
    goto L_BEC786;
L_BEC786:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC786u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC786u,cpu,0xC0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC786u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC786 CPY
    cpu.compareY(0x2u);
    goto L_BEC789;
L_BEC789:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC789u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC789u,cpu,0xF0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC789u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC789 BEQ -> $BEC78E
    if (cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC78E; }
    goto L_BEC78B;
L_BEC78B:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC78Bu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC78Bu,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC78Bu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC78B LDA
    cpu.setA(0x12u, 16);
    goto L_BEC78E;
L_BEC78E:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC78Eu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC78Eu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC78Eu, 8u, 4u, 0xB88069u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC78E JSL -> $B88069 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC791u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC792u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB88069u, 0xBEC78Eu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC792;
L_BEC792:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC792u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC792u,0xBEC792u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC792u,cpu,0x20u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC792u, 6u, 3u, cpu.address("abs", 0xC1E4u), 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 2u);
    // $BEC792 JSR -> $BEC1E4 stack real
    { cpu.push16Value(hw,0xC794u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC795u,false,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, ((std::uint32_t(cpu.pb)<<16)|0xC1E4u), 0xBEC792u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC795;
L_BEC795:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC795u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC795u,0xBEC795u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC795u,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC795u, 5u, 3u, cpu.address("abs", 0x1862u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC795 LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1862u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC798;
L_BEC798:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC798u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC798u,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC798u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC798 BNE -> $BEC79E
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC79E; }
    goto L_BEC79A;
L_BEC79A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC79Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC79Au,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC79Au, 8u, 4u, 0xBB85ACu, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC79A JSL -> $BB85AC stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC79Du); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC79Eu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xBB85ACu, 0xBEC79Au); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC79E;
L_BEC79E:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC79Eu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC79Eu,0xBEC79Eu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC79Eu,cpu,0xA6u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC79Eu, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x70u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC79E LDX
    cpu.setX(hw.readW(cpu.address("dp", 0x70u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7A0;
L_BEC7A0:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A0u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A0u,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A0u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x78u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7A0 LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x78u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7A2;
L_BEC7A2:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A2u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A2u,cpu,0x38u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A2u, 2u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7A2 SEC
    cpu.setFlag('C', true);
    goto L_BEC7A3;
L_BEC7A3:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A3u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A3u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A3u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7A3 LDA
    cpu.setA(0x2u, 16);
    goto L_BEC7A6;
L_BEC7A6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A6u,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A6u, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7A6 RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xBEC7A6u);return;} hw.unresolvedReturn(0xBEC7A6u,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
L_BEC7A7:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7A7u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A7u,cpu,0x20u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7A7u, 6u, 3u, cpu.address("abs", 0xC1E4u), 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 2u);
    // $BEC7A7 JSR -> $BEC1E4 stack real
    { cpu.push16Value(hw,0xC7A9u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7AAu,false,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, ((std::uint32_t(cpu.pb)<<16)|0xC1E4u), 0xBEC7A7u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7AA;
L_BEC7AA:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7AAu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7AAu,0xBEC7AAu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7AAu,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7AAu, 5u, 3u, cpu.address("abs", 0x1862u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7AA LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1862u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7AD;
L_BEC7AD:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7ADu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7ADu,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7ADu, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7AD BNE -> $BEC7B3
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC7B3; }
    goto L_BEC7AF;
L_BEC7AF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7AFu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7AFu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7AFu, 8u, 4u, 0xBB85ACu, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7AF JSL -> $BB85AC stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC7B2u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7B3u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xBB85ACu, 0xBEC7AFu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7B3;
L_BEC7B3:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7B3u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7B3u,0xBEC7B3u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7B3u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7B3u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7B3 LDA
    cpu.setA(0x10u, 16);
    goto L_BEC7B6;
L_BEC7B6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7B6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7B6u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7B6u, 8u, 4u, 0xB88069u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7B6 JSL -> $B88069 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC7B9u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7BAu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB88069u, 0xBEC7B6u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7BA;
L_BEC7BA:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7BAu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7BAu,0xBEC7BAu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BAu,cpu,0xA6u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BAu, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x70u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7BA LDX
    cpu.setX(hw.readW(cpu.address("dp", 0x70u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7BC;
L_BEC7BC:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7BCu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BCu,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BCu, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x78u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7BC LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x78u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7BE;
L_BEC7BE:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7BEu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BEu,cpu,0x38u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BEu, 2u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7BE SEC
    cpu.setFlag('C', true);
    goto L_BEC7BF;
L_BEC7BF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7BFu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BFu,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7BFu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7BF LDA
    cpu.setA(0x2u, 16);
    goto L_BEC7C2;
L_BEC7C2:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7C2u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C2u,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C2u, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7C2 RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xBEC7C2u);return;} hw.unresolvedReturn(0xBEC7C2u,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
L_BEC7C3:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7C3u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C3u,cpu,0x20u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C3u, 6u, 3u, cpu.address("abs", 0xC1E4u), 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 2u);
    // $BEC7C3 JSR -> $BEC1E4 stack real
    { cpu.push16Value(hw,0xC7C5u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7C6u,false,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, ((std::uint32_t(cpu.pb)<<16)|0xC1E4u), 0xBEC7C3u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7C6;
L_BEC7C6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7C6u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7C6u,0xBEC7C6u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C6u,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C6u, 5u, 3u, cpu.address("abs", 0x1862u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7C6 LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1862u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7C9;
L_BEC7C9:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7C9u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C9u,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7C9u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7C9 BNE -> $BEC7CF
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_BEC7CF; }
    goto L_BEC7CB;
L_BEC7CB:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7CBu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7CBu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7CBu, 8u, 4u, 0xBB85ACu, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7CB JSL -> $BB85AC stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0xC7CEu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0xC7CFu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xBB85ACu, 0xBEC7CBu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_BEC7CF;
L_BEC7CF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7CFu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0xC7CFu,0xBEC7CFu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7CFu,cpu,0xAEu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7CFu, 5u, 3u, cpu.address("abs", 0x1B63u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7CF LDX
    cpu.setX(hw.readW(cpu.address("abs", 0x1B63u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7D2;
L_BEC7D2:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7D2u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D2u,cpu,0xA5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D2u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x6Cu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7D2 LDA
    cpu.loadA(hw.readW(cpu.address("dp", 0x6Cu), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7D4;
L_BEC7D4:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7D4u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D4u,cpu,0x85u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D4u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x44u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7D4 STA
    hw.write(cpu.address("dp", 0x44u), cpu.a, cpu.m8?8:16);
    goto L_BEC7D6;
L_BEC7D6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7D6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D6u,cpu,0xB5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D6u, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x06u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7D6 LDA
    cpu.loadA(hw.readW(cpu.address("dpx", 0x6u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7D8;
L_BEC7D8:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7D8u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D8u,cpu,0x85u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7D8u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x42u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7D8 STA
    hw.write(cpu.address("dp", 0x42u), cpu.a, cpu.m8?8:16);
    goto L_BEC7DA;
L_BEC7DA:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7DAu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DAu,cpu,0xA0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DAu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7DA LDY
    cpu.setY(0x8u, 16);
    goto L_BEC7DD;
L_BEC7DD:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7DDu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DDu,cpu,0xB7u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DDu, 7u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, ((cpu.d + 0x42u) & 0xFFFFu), 3u, 0u);
    // $BEC7DD LDA
    cpu.loadA(hw.readW(cpu.addressDpLongY(hw, 0x42u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7DF;
L_BEC7DF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7DFu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DFu,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7DFu, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x2Eu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7DF STA
    hw.write(cpu.address("dpx", 0x2Eu), cpu.a, cpu.m8?8:16);
    goto L_BEC7E1;
L_BEC7E1:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7E1u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E1u,cpu,0xB5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E1u, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x4Au), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7E1 LDA
    cpu.loadA(hw.readW(cpu.address("dpx", 0x4Au), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7E3;
L_BEC7E3:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7E3u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E3u,cpu,0xC9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E3u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7E3 CMP
    cpu.compareA(0xAu);
    goto L_BEC7E6;
L_BEC7E6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7E6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E6u,cpu,0xB0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E6u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7E6 BCS -> $BEC7EB
    if (cpu.c) { hw.addCpuInternalCycles(1u); goto L_BEC7EB; }
    goto L_BEC7E8;
L_BEC7E8:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7E8u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E8u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7E8u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7E8 LDA
    cpu.setA(0xAu, 16);
    goto L_BEC7EB;
L_BEC7EB:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7EBu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EBu,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EBu, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x4Au), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7EB STA
    hw.write(cpu.address("dpx", 0x4Au), cpu.a, cpu.m8?8:16);
    goto L_BEC7ED;
L_BEC7ED:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7EDu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EDu,cpu,0xB5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EDu, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x46u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7ED LDA
    cpu.loadA(hw.readW(cpu.address("dpx", 0x46u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_BEC7EF;
L_BEC7EF:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7EFu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EFu,cpu,0x09u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7EFu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7EF ORA
    cpu.logicOr(0x4u);
    goto L_BEC7F2;
L_BEC7F2:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F2u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F2u,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F2u, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x46u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F2 STA
    hw.write(cpu.address("dpx", 0x46u), cpu.a, cpu.m8?8:16);
    goto L_BEC7F4;
L_BEC7F4:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F4u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F4u,cpu,0xA6u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F4u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x70u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F4 LDX
    cpu.setX(hw.readW(cpu.address("dp", 0x70u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7F6;
L_BEC7F6:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F6u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F6u,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F6u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x78u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F6 LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x78u), cpu.x8?8:16), cpu.x8?8:16);
    goto L_BEC7F8;
L_BEC7F8:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F8u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F8u,cpu,0x38u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F8u, 2u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F8 SEC
    cpu.setFlag('C', true);
    goto L_BEC7F9;
L_BEC7F9:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7F9u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F9u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7F9u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $BEC7F9 LDA
    cpu.setA(0x2u, 16);
    goto L_BEC7FC;
L_BEC7FC:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0xC7FCu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0xC7FCu,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0xC7FCu, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $BEC7FC RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xBEC7FCu);return;} hw.unresolvedReturn(0xBEC7FCu,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
}

