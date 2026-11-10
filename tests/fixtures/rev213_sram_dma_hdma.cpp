#include "runtime.hpp"
#include <iostream>
#include <stdexcept>
#include <cstdint>

static int vectors = 0;
static void check(bool pass, const char* msg) {
  ++vectors;
  if (!pass) throw std::runtime_error(msg);
}
int main() {
  try {
    for (bool native : {false, true}) {
      // Non power-of-two SRAM exercises the address-line normalization rather
      // than a bitwise mask which aliases addresses into the wrong page.
      SnesRuntime hw;
      hw.headless = true;
      hw.ppu.forceBlank = true;
      hw.nativeDmaEnabled = native;
      hw.mapper = MapperKind::LoROM;
      hw.sram.assign(0x6000u, 0);
      check(hw.sramOffset(0x700000u) == 0, "LoROM base SRAM page");
      check(hw.sramOffset(0x710000u) == 0x2000u, "LoROM bank 71 SRAM modulo mirror");
      check(hw.sramOffset(0x720000u) == 0x4000u, "LoROM bank 72 SRAM modulo mirror");
      check(hw.sramOffset(0x730000u) == 0, "LoROM SRAM wrap");
      hw.write8(0x710000u, 0x31);
      hw.write8(0x710001u, 0x57);
      check(hw.sram[0x2000u] == 0x31 && hw.sram[0x2001u] == 0x57,
            "CPU SRAM write must use normalized offset");
      // DMA A bus (SRAM) -> B bus ($2180) exercises the same address map
      // used by ordinary translated CPU accesses.
      hw.io.wramPortAddr = 0x400;
      auto& d = hw.dma[0];
      d.a1b = 0x71; d.a1t = 0; d.bbad = 0x80; d.das = 2; d.dmap = 0;
      hw.executeDma(1);
      check(hw.ram[0x400] == 0x31 && hw.ram[0x401] == 0x57,
            "DMA from non-power-of-two SRAM to WRAM port");
      check(hw.io.wramPortAddr == 0x402, "DMA WMADD increment");
      hw.ram[0x500] = 0xa2;
      hw.io.wramPortAddr = 0x500;
      d.a1b = 0x72; d.a1t = 0; d.bbad = 0x80; d.das = 1; d.dmap = 0x80;
      hw.executeDma(1);
      check(hw.sram[0x4000] == 0xa2,
            "reverse DMA from WRAM port to normalized SRAM offset");
      // GSU & S-DD1 memory windows share the same SRAM normalization.
      hw.mapper = MapperKind::GSU;
      check(hw.sramOffset(0x711e00u) == 0x5e00u, "GSU SRAM bank mirror");
      hw.mapper = MapperKind::SDD1;
      check(hw.sramOffset(0x716000u) == 0x2000u, "S-DD1 SRAM bank mapping");
      // The SPC7110 board-specific SRAM path must not bypass the mapper.
      hw.mapper = MapperKind::SPC7110;
      hw.spc7110Reg[0] = 0x80;
      hw.boardWrite(0x016000u, 0x91);
      check(hw.sram[0x2000] == 0x91 && hw.boardRead(0x016000u) == 0x91,
            "SPC7110 window bank 01");
      hw.boardWrite(0x026000u, 0x92);
      check(hw.sram[0x4000] == 0x92 && hw.boardRead(0x026000u) == 0x92,
            "SPC7110 window bank 02");
      // Standard power-of-two mappings must remain bit-exact.
      hw.mapper = MapperKind::LoROM;
      hw.sram.assign(0x8000u, 0);
      check(hw.sramOffset(0x710000u) == 0 && hw.sramOffset(0x700123u) == 0x123u,
            "standard 32 KiB SRAM mapping regression");
      // HDMA table reads through cartridge SRAM, even for odd SRAM sizes.
      SnesRuntime hd;
      hd.headless = true;
      hd.nativeDmaEnabled = native;
      hd.ppu.forceBlank = true;
      hd.mapper = MapperKind::LoROM;
      hd.sram.assign(0x6000u, 0);
      hd.sram[0x2000] = 0x81;
      hd.sram[0x2001] = 0x5e;
      hd.sram[0x2002] = 0;
      hd.dma[0].a1b = 0x71;
      hd.dma[0].a1t = 0;
      hd.dma[0].bbad = 0x26;
      hd.io.hdmaen = 1;
      hd.beginFrame();
      hd.advanceCpuMasterCycles(12u + (unsigned)(hd.cpuMasterClock & 7u));
      check(hd.dma[0].ntrl == 0x81 && hd.dma[0].a2a == 1,
            "HDMA initial table from SRAM");
      hd.currentScanline = 10; hd.currentMasterCycle = SnesRuntime::HDMA_START_MC;
      hd.wramRefreshAppliedThisLine = true; hd.hdmaExecutedThisLine = true;
      hd.executeHdmaLine();
      check(hd.ppu.wh[0] == 0x5e && hd.hdmaActive == 0,
            "HDMA payload / terminator from non-power-of-two SRAM");
    }
    std::cout << "REV213_SRAM_DMA_HDMA_PASS vectors=" << vectors << '\n';
    return 0;
  } catch(const std::exception& e) {
    std::cerr << "REV213_SRAM_DMA_HDMA_FAIL " << e.what() << '\n';
    return 1;
  }
}
