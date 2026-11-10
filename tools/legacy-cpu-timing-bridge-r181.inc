  // FORJA65_CPU_TIMING_ABI_REV181: Adaptador ABI para rotinas AOT geradas pela REV180.
  // O DKC3 ainda conserva o modelo de entrada NMI/IRQ legado; declarar
  // explicitamente essa escolha evita gerar cobrança dupla de vetor.
  // A migração completa do timing e do MDR/ALU exige testes independentes.
  static constexpr bool legacyInterruptTiming(){return true;}
  void advanceCpuInstruction(std::uint32_t pc,unsigned cpuCycles,unsigned fetchBytes,
                             std::uint32_t dataAddr,unsigned dataAccesses,std::uint32_t auxAddr,
                             unsigned auxAccesses,unsigned stackAccesses,unsigned dataWidth,bool dataBank0){
    // A interface nova descreve largura e acesso ao banco zero. Preservamos
    // o modelo de ciclos do port e resolvemos apenas os endereços reais dos
    // acessos, inclusive quando um operando atravessa o limite de 64 KiB.
    if(!cpuInstructionTraced||lastInstructionPc!=pc){cpuInstructionCount++;}
    cpuInstructionTraced=false;lastInstructionPc=pc;lastInstructionMasterCycles=0;
    unsigned mc=cpuCycles*6u;
    for(unsigned i=0;i<fetchBytes;++i){
      const auto at=(pc&0xFF0000u)|((pc+i)&0xFFFFu);
      const unsigned q=busMasterCycles(at);if(q>6u)mc+=q-6u;
    }
    const unsigned width=dataWidth?dataWidth:std::max(1u,dataAccesses);
    if(dataAddr!=NO_TIMING_ADDR)for(unsigned i=0;i<dataAccesses;++i){
      const auto at=dataBank0?((dataAddr+(i%width))&0xFFFFu)
                             :((dataAddr+(i%width))&0xFFFFFFu);
      const unsigned q=busMasterCycles(at);if(q>6u)mc+=q-6u;
    }
    if(auxAddr!=NO_TIMING_ADDR)for(unsigned i=0;i<auxAccesses;++i){
      const auto at=(auxAddr&0xFF0000u)|((auxAddr+i)&0xFFFFu);
      const unsigned q=busMasterCycles(at);if(q>6u)mc+=q-6u;
    }
    if(stackAccesses){const unsigned q=busMasterCycles(0x000100u);
      if(q>6u)mc+=stackAccesses*(q-6u);}
    advanceCpuMasterCycles(mc);
  }
