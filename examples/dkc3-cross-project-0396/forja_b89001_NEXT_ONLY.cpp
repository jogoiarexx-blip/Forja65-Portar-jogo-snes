#include "generated.hpp"
void sub_B89001_E0M0X0C0(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {
  switch(entryPc&0xFFFFFFu){
    case 0xB89001u: goto L_B89001;
    case 0xB89004u: goto L_B89004;
    case 0xB89007u: goto L_B89007;
    case 0xB8900Au: goto L_B8900A;
    case 0xB8900Du: goto L_B8900D;
    case 0xB89011u: goto L_B89011;
    case 0xB89015u: goto L_B89015;
    case 0xB89018u: goto L_B89018;
    case 0xB8901Cu: goto L_B8901C;
    case 0xB89020u: goto L_B89020;
    case 0xB89023u: goto L_B89023;
    case 0xB89026u: goto L_B89026;
    case 0xB89028u: goto L_B89028;
    case 0xB8902Au: goto L_B8902A;
    case 0xB8902Cu: goto L_B8902C;
    case 0xB89030u: goto L_B89030;
    case 0xB89033u: goto L_B89033;
    case 0xB89037u: goto L_B89037;
    case 0xB8903Au: goto L_B8903A;
    case 0xB8903Cu: goto L_B8903C;
    case 0xB8903Du: goto L_B8903D;
    case 0xB89040u: goto L_B89040;
    case 0xB89044u: goto L_B89044;
    case 0xB89047u: goto L_B89047;
    case 0xB89049u: goto L_B89049;
    case 0xB8904Au: goto L_B8904A;
    case 0xB8904Eu: goto L_B8904E;
    case 0xB89051u: goto L_B89051;
    case 0xB89054u: goto L_B89054;
    case 0xB89056u: goto L_B89056;
    case 0xB89059u: goto L_B89059;
    case 0xB8905Du: goto L_B8905D;
    case 0xB8905Fu: goto L_B8905F;
    case 0xB89062u: goto L_B89062;
    case 0xB89065u: goto L_B89065;
    case 0xB89067u: goto L_B89067;
    case 0xB8906Au: goto L_B8906A;
    case 0xB8906Cu: goto L_B8906C;
    default: hw.unresolvedFlow(entryPc,entryPc,cpu); return;
  }
L_B89001:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9001u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9001u,cpu,0x9Cu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9001u, 5u, 3u, cpu.address("abs", 0x04AAu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89001 STZ
    hw.write(cpu.address("abs", 0x4AAu), 0, cpu.m8?8:16);
    goto L_B89004;
L_B89004:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9004u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9004u,cpu,0x9Cu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9004u, 5u, 3u, cpu.address("abs", 0x04AEu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89004 STZ
    hw.write(cpu.address("abs", 0x4AEu), 0, cpu.m8?8:16);
    goto L_B89007;
L_B89007:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9007u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9007u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9007u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89007 LDA
    cpu.setA(0x1Cu, 16);
    goto L_B8900A;
L_B8900A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x900Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x900Au,cpu,0xA0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x900Au, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8900A LDY
    cpu.setY(0x2u, 16);
    goto L_B8900D;
L_B8900D:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x900Du))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x900Du,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x900Du, 8u, 4u, 0xBB85D0u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8900D JSL -> $BB85D0 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x9010u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9011u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xBB85D0u, 0xB8900Du); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89011;
L_B89011:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9011u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false && cpu.c==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9011u,0xB89011u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9011u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9011u, 8u, 4u, 0xB89C4Cu, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89011 JSL -> $B89C4C stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x9014u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9015u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB89C4Cu, 0xB89011u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89015;
L_B89015:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9015u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false && cpu.c==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9015u,0xB89015u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9015u,cpu,0x20u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9015u, 6u, 3u, cpu.address("abs", 0x9071u), 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 2u);
    // $B89015 JSR -> $B89071 stack real
    { cpu.push16Value(hw,0x9017u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9018u,false,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, ((std::uint32_t(cpu.pb)<<16)|0x9071u), 0xB89015u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89018;
L_B89018:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9018u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false && cpu.c==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9018u,0xB89018u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9018u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9018u, 8u, 4u, 0xB8E179u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89018 JSL -> $B8E179 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x901Bu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x901Cu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB8E179u, 0xB89018u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B8901C;
L_B8901C:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x901Cu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false && cpu.c==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x901Cu,0xB8901Cu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x901Cu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x901Cu, 8u, 4u, 0xB8E198u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8901C JSL -> $B8E198 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x901Fu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9020u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB8E198u, 0xB8901Cu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89020;
L_B89020:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9020u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false && cpu.c==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9020u,0xB89020u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9020u,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9020u, 5u, 3u, cpu.address("abs", 0x186Bu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89020 LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x186Bu), cpu.m8?8:16), cpu.m8?8:16);
    goto L_B89023;
L_B89023:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9023u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9023u,cpu,0xCDu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9023u, 5u, 3u, cpu.address("abs", 0x04FDu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89023 CMP
    cpu.compareA(hw.readW(cpu.address("abs", 0x4FDu), cpu.m8?8:16));
    goto L_B89026;
L_B89026:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9026u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9026u,cpu,0xF0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9026u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89026 BEQ -> $B8903D
    if (cpu.z) { hw.addCpuInternalCycles(1u); goto L_B8903D; }
    goto L_B89028;
L_B89028:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9028u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9028u,cpu,0xA5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9028u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x7Eu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89028 LDA
    cpu.loadA(hw.readW(cpu.address("dp", 0x7Eu), cpu.m8?8:16), cpu.m8?8:16);
    goto L_B8902A;
L_B8902A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x902Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x902Au,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x902Au, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8902A BNE -> $B8904A
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_B8904A; }
    goto L_B8902C;
L_B8902C:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x902Cu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x902Cu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x902Cu, 8u, 4u, 0xB89C01u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8902C JSL -> $B89C01 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x902Fu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9030u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB89C01u, 0xB8902Cu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89030;
L_B89030:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9030u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9030u,0xB89030u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9030u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9030u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89030 LDA
    cpu.setA(0xDu, 16);
    goto L_B89033;
L_B89033:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9033u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9033u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9033u, 8u, 4u, 0xB9A009u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89033 JSL -> $B9A009 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x9036u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9037u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB9A009u, 0xB89033u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89037;
L_B89037:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9037u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9037u,0xB89037u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9037u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9037u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89037 LDA
    cpu.setA(0xFu, 16);
    goto L_B8903A;
L_B8903A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x903Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x903Au,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x903Au, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x38u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8903A STA
    hw.write(cpu.address("dpx", 0x38u), cpu.a, cpu.m8?8:16);
    goto L_B8903C;
L_B8903C:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x903Cu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x903Cu,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x903Cu, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8903C RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xB8903Cu);return;} hw.unresolvedReturn(0xB8903Cu,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
L_B8903D:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x903Du))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x903Du,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x903Du, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8903D LDA
    cpu.setA(0x31u, 16);
    goto L_B89040;
L_B89040:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9040u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9040u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9040u, 8u, 4u, 0xB9A009u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89040 JSL -> $B9A009 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x9043u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9044u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB9A009u, 0xB89040u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89044;
L_B89044:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9044u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9044u,0xB89044u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9044u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9044u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89044 LDA
    cpu.setA(0x44u, 16);
    goto L_B89047;
L_B89047:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9047u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9047u,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9047u, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x38u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89047 STA
    hw.write(cpu.address("dpx", 0x38u), cpu.a, cpu.m8?8:16);
    goto L_B89049;
L_B89049:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9049u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9049u,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9049u, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89049 RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xB89049u);return;} hw.unresolvedReturn(0xB89049u,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
L_B8904A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x904Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x904Au,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x904Au, 8u, 4u, 0xB89C01u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8904A JSL -> $B89C01 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x904Du); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x904Eu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB89C01u, 0xB8904Au); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B8904E;
L_B8904E:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x904Eu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x904Eu,0xB8904Eu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x904Eu,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x904Eu, 5u, 3u, cpu.address("abs", 0x1957u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8904E LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1957u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_B89051;
L_B89051:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9051u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9051u,cpu,0x29u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9051u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89051 AND
    cpu.logicAnd(0x4000u);
    goto L_B89054;
L_B89054:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9054u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9054u,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9054u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89054 BNE -> $B8906C
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_B8906C; }
    goto L_B89056;
L_B89056:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9056u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9056u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9056u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89056 LDA
    cpu.setA(0x5u, 16);
    goto L_B89059;
L_B89059:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9059u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9059u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9059u, 8u, 4u, 0xB9A015u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89059 JSL -> $B9A015 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x905Cu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x905Du,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB9A015u, 0xB89059u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B8905D;
L_B8905D:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x905Du))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x905Du,0xB8905Du); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x905Du,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x905Du, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x7Eu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8905D LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x7Eu), cpu.x8?8:16), cpu.x8?8:16);
    goto L_B8905F;
L_B8905F:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x905Fu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x905Fu,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x905Fu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8905F LDA
    cpu.setA(0x24u, 16);
    goto L_B89062;
L_B89062:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9062u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9062u,cpu,0xC0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9062u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89062 CPY
    cpu.compareY(0x234u);
    goto L_B89065;
L_B89065:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9065u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9065u,cpu,0xF0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9065u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89065 BEQ -> $B8906A
    if (cpu.z) { hw.addCpuInternalCycles(1u); goto L_B8906A; }
    goto L_B89067;
L_B89067:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9067u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9067u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9067u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89067 LDA
    cpu.setA(0x68u, 16);
    goto L_B8906A;
L_B8906A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x906Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x906Au,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x906Au, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x38u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8906A STA
    hw.write(cpu.address("dpx", 0x38u), cpu.a, cpu.m8?8:16);
    goto L_B8906C;
L_B8906C:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x906Cu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x906Cu,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x906Cu, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8906C RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xB8906Cu);return;} hw.unresolvedReturn(0xB8906Cu,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
}

void sub_B89001_E0M0X0CQ(CpuState& cpu, SnesRuntime& hw, std::uint32_t entryPc) {
  switch(entryPc&0xFFFFFFu){
    case 0xB89001u: goto L_B89001;
    case 0xB89004u: goto L_B89004;
    case 0xB89007u: goto L_B89007;
    case 0xB8900Au: goto L_B8900A;
    case 0xB8900Du: goto L_B8900D;
    case 0xB89011u: goto L_B89011;
    case 0xB89015u: goto L_B89015;
    case 0xB89018u: goto L_B89018;
    case 0xB8901Cu: goto L_B8901C;
    case 0xB89020u: goto L_B89020;
    case 0xB89023u: goto L_B89023;
    case 0xB89026u: goto L_B89026;
    case 0xB89028u: goto L_B89028;
    case 0xB8902Au: goto L_B8902A;
    case 0xB8902Cu: goto L_B8902C;
    case 0xB89030u: goto L_B89030;
    case 0xB89033u: goto L_B89033;
    case 0xB89037u: goto L_B89037;
    case 0xB8903Au: goto L_B8903A;
    case 0xB8903Cu: goto L_B8903C;
    case 0xB8903Du: goto L_B8903D;
    case 0xB89040u: goto L_B89040;
    case 0xB89044u: goto L_B89044;
    case 0xB89047u: goto L_B89047;
    case 0xB89049u: goto L_B89049;
    case 0xB8904Au: goto L_B8904A;
    case 0xB8904Eu: goto L_B8904E;
    case 0xB89051u: goto L_B89051;
    case 0xB89054u: goto L_B89054;
    case 0xB89056u: goto L_B89056;
    case 0xB89059u: goto L_B89059;
    case 0xB8905Du: goto L_B8905D;
    case 0xB8905Fu: goto L_B8905F;
    case 0xB89062u: goto L_B89062;
    case 0xB89065u: goto L_B89065;
    case 0xB89067u: goto L_B89067;
    case 0xB8906Au: goto L_B8906A;
    case 0xB8906Cu: goto L_B8906C;
    default: hw.unresolvedFlow(entryPc,entryPc,cpu); return;
  }
L_B89001:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9001u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9001u,cpu,0x9Cu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9001u, 5u, 3u, cpu.address("abs", 0x04AAu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89001 STZ
    hw.write(cpu.address("abs", 0x4AAu), 0, cpu.m8?8:16);
    goto L_B89004;
L_B89004:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9004u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9004u,cpu,0x9Cu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9004u, 5u, 3u, cpu.address("abs", 0x04AEu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89004 STZ
    hw.write(cpu.address("abs", 0x4AEu), 0, cpu.m8?8:16);
    goto L_B89007;
L_B89007:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9007u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9007u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9007u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89007 LDA
    cpu.setA(0x1Cu, 16);
    goto L_B8900A;
L_B8900A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x900Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x900Au,cpu,0xA0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x900Au, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8900A LDY
    cpu.setY(0x2u, 16);
    goto L_B8900D;
L_B8900D:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x900Du))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x900Du,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x900Du, 8u, 4u, 0xBB85D0u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8900D JSL -> $BB85D0 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x9010u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9011u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xBB85D0u, 0xB8900Du); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89011;
L_B89011:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9011u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9011u,0xB89011u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9011u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9011u, 8u, 4u, 0xB89C4Cu, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89011 JSL -> $B89C4C stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x9014u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9015u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB89C4Cu, 0xB89011u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89015;
L_B89015:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9015u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9015u,0xB89015u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9015u,cpu,0x20u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9015u, 6u, 3u, cpu.address("abs", 0x9071u), 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 2u);
    // $B89015 JSR -> $B89071 stack real
    { cpu.push16Value(hw,0x9017u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9018u,false,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, ((std::uint32_t(cpu.pb)<<16)|0x9071u), 0xB89015u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89018;
L_B89018:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9018u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9018u,0xB89018u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9018u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9018u, 8u, 4u, 0xB8E179u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89018 JSL -> $B8E179 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x901Bu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x901Cu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB8E179u, 0xB89018u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B8901C;
L_B8901C:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x901Cu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x901Cu,0xB8901Cu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x901Cu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x901Cu, 8u, 4u, 0xB8E198u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8901C JSL -> $B8E198 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x901Fu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9020u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB8E198u, 0xB8901Cu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89020;
L_B89020:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9020u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9020u,0xB89020u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9020u,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9020u, 5u, 3u, cpu.address("abs", 0x186Bu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89020 LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x186Bu), cpu.m8?8:16), cpu.m8?8:16);
    goto L_B89023;
L_B89023:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9023u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9023u,cpu,0xCDu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9023u, 5u, 3u, cpu.address("abs", 0x04FDu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89023 CMP
    cpu.compareA(hw.readW(cpu.address("abs", 0x4FDu), cpu.m8?8:16));
    goto L_B89026;
L_B89026:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9026u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9026u,cpu,0xF0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9026u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89026 BEQ -> $B8903D
    if (cpu.z) { hw.addCpuInternalCycles(1u); goto L_B8903D; }
    goto L_B89028;
L_B89028:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9028u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9028u,cpu,0xA5u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9028u, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x7Eu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89028 LDA
    cpu.loadA(hw.readW(cpu.address("dp", 0x7Eu), cpu.m8?8:16), cpu.m8?8:16);
    goto L_B8902A;
L_B8902A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x902Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x902Au,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x902Au, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8902A BNE -> $B8904A
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_B8904A; }
    goto L_B8902C;
L_B8902C:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x902Cu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x902Cu,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x902Cu, 8u, 4u, 0xB89C01u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8902C JSL -> $B89C01 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x902Fu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9030u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB89C01u, 0xB8902Cu); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89030;
L_B89030:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9030u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9030u,0xB89030u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9030u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9030u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89030 LDA
    cpu.setA(0xDu, 16);
    goto L_B89033;
L_B89033:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9033u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9033u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9033u, 8u, 4u, 0xB9A009u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89033 JSL -> $B9A009 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x9036u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9037u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB9A009u, 0xB89033u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89037;
L_B89037:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9037u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9037u,0xB89037u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9037u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9037u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89037 LDA
    cpu.setA(0xFu, 16);
    goto L_B8903A;
L_B8903A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x903Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x903Au,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x903Au, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x38u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8903A STA
    hw.write(cpu.address("dpx", 0x38u), cpu.a, cpu.m8?8:16);
    goto L_B8903C;
L_B8903C:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x903Cu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x903Cu,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x903Cu, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8903C RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xB8903Cu);return;} hw.unresolvedReturn(0xB8903Cu,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
L_B8903D:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x903Du))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x903Du,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x903Du, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8903D LDA
    cpu.setA(0x31u, 16);
    goto L_B89040;
L_B89040:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9040u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9040u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9040u, 8u, 4u, 0xB9A009u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89040 JSL -> $B9A009 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x9043u); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x9044u,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB9A009u, 0xB89040u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B89044;
L_B89044:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9044u))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x9044u,0xB89044u); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9044u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9044u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89044 LDA
    cpu.setA(0x44u, 16);
    goto L_B89047;
L_B89047:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9047u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9047u,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9047u, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x38u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89047 STA
    hw.write(cpu.address("dpx", 0x38u), cpu.a, cpu.m8?8:16);
    goto L_B89049;
L_B89049:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9049u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9049u,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9049u, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89049 RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xB89049u);return;} hw.unresolvedReturn(0xB89049u,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
L_B8904A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x904Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x904Au,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x904Au, 8u, 4u, 0xB89C01u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8904A JSL -> $B89C01 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x904Du); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x904Eu,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB89C01u, 0xB8904Au); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B8904E;
L_B8904E:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x904Eu))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x904Eu,0xB8904Eu); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x904Eu,cpu,0xADu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x904Eu, 5u, 3u, cpu.address("abs", 0x1957u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8904E LDA
    cpu.loadA(hw.readW(cpu.address("abs", 0x1957u), cpu.m8?8:16), cpu.m8?8:16);
    goto L_B89051;
L_B89051:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9051u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9051u,cpu,0x29u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9051u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89051 AND
    cpu.logicAnd(0x4000u);
    goto L_B89054;
L_B89054:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9054u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9054u,cpu,0xD0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9054u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89054 BNE -> $B8906C
    if (!cpu.z) { hw.addCpuInternalCycles(1u); goto L_B8906C; }
    goto L_B89056;
L_B89056:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9056u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9056u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9056u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89056 LDA
    cpu.setA(0x5u, 16);
    goto L_B89059;
L_B89059:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9059u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9059u,cpu,0x22u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9059u, 8u, 4u, 0xB9A015u, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B89059 JSL -> $B9A015 stack real
    { cpu.push8Value(hw,cpu.pb); cpu.push16Value(hw,0x905Cu); const auto callFrame=hw.pushNativeReturn((std::uint32_t(cpu.pb)<<16)|0x905Du,true,cpu); hw.nativeCallPending=true; forja65_dispatch(cpu, hw, 0xB9A015u, 0xB89059u); if(hw.nativeReturnedCall!=callFrame)return; }
    goto L_B8905D;
L_B8905D:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x905Du))return;
  if (!(cpu.e==false && cpu.m8==false && cpu.x8==false)) { hw.requestDispatch((std::uint32_t(cpu.pb)<<16)|0x905Du,0xB8905Du); return; } // callee devolveu M/X/E diferente do previsto
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x905Du,cpu,0xA4u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x905Du, 4u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dp", 0x7Eu), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8905D LDY
    cpu.setY(hw.readW(cpu.address("dp", 0x7Eu), cpu.x8?8:16), cpu.x8?8:16);
    goto L_B8905F;
L_B8905F:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x905Fu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x905Fu,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x905Fu, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8905F LDA
    cpu.setA(0x24u, 16);
    goto L_B89062;
L_B89062:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9062u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9062u,cpu,0xC0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9062u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89062 CPY
    cpu.compareY(0x234u);
    goto L_B89065;
L_B89065:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9065u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9065u,cpu,0xF0u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9065u, 2u, 2u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89065 BEQ -> $B8906A
    if (cpu.z) { hw.addCpuInternalCycles(1u); goto L_B8906A; }
    goto L_B89067;
L_B89067:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x9067u))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x9067u,cpu,0xA9u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x9067u, 3u, 3u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B89067 LDA
    cpu.setA(0x68u, 16);
    goto L_B8906A;
L_B8906A:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x906Au))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x906Au,cpu,0x95u);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x906Au, 5u + ((cpu.d & 0xFFu)!=0u ? 1u : 0u), 2u, cpu.address("dpx", 0x38u), 2u, SnesRuntime::NO_TIMING_ADDR, 0u, 0u);
    // $B8906A STA
    hw.write(cpu.address("dpx", 0x38u), cpu.a, cpu.m8?8:16);
    goto L_B8906C;
L_B8906C:
  // PB e sincronizado na entrada do dispatcher; labels locais preservam o banco real, inclusive mirrors da ROM.
  if(hw.stopped)return;
  if(hw.serviceCpuEvents(cpu,(std::uint32_t(cpu.pb)<<16)|0x906Cu))return;
    hw.traceInstruction((std::uint32_t(cpu.pb)<<16)|0x906Cu,cpu,0x6Bu);
    hw.advanceCpuInstruction((std::uint32_t(cpu.pb)<<16)|0x906Cu, 6u, 1u, SnesRuntime::NO_TIMING_ADDR, 0u, SnesRuntime::NO_TIMING_ADDR, 0u, 3u);
    // $B8906C RTL stack real
    { auto raw=cpu.peekStack16(hw); auto bank=cpu.peekStack8(hw,3u); auto dst=(std::uint32_t(bank)<<16)|((raw+1u)&0xFFFFu); if(!hw.nativeReturnMatches(dst,true,cpu)){ if(forja65_is_stack_return_target(dst,hw)){hw.retireRedirectedNativeReturn(cpu,true);cpu.pop16Value(hw);cpu.pop8Value(hw);cpu.pb=bank;hw.requestDispatch(dst,0xB8906Cu);return;} hw.unresolvedReturn(0xB8906Cu,dst,cpu,"STACK-RTL"); } cpu.pop16Value(hw); cpu.pop8Value(hw); cpu.pb=bank; hw.popNativeReturn(); return; }
}

