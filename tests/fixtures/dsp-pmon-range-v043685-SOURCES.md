# PMON pitch range / interpolation saturation, v0.4.36.85

Primary reference: ares commit `9408cb43d4948fc3ea6e152a307a34348df3fe04`:
https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/dsp/voice.cpp

The pinned source was already retrieved in the prior audit as `dsp-private-v66/ares-voice.cpp`. `voice3c` adds signed previous voice output modulation to the 14-bit programmed pitch without clipping to 14 bits. `voice4` adds this pitch to the low fourteen interpolation position bits, then saturates the resulting position at 0x7fff. Cross-checked 2026-10-15 against primary Snes9x SPC_DSP.cpp V3c / V4:
https://github.com/snes9xgit/snes9x/blob/master/apu/bapu/dsp/SPC_DSP.cpp

This patch independently expresses that arithmetic using Forja65's existing cursor representation: (blockPos modulo 4)*4096 + phase is the position inside the current four-sample decoding group. It removes the incorrect pitch clamp and caps the accumulated position instead. Ordinary unmodulated pitch cannot reach the new saturation threshold, and voice zero remains immune to PMON.

The portable JS test compiles the actual generated runtime.hpp. The C++ fixture tests 40,000 deterministic vectors across all voices, PMON on/off, all cursor group positions, fractional phases, signed prior voice output and programmed pitch. It separately checks renderSample feeding the unpanned, envelope-quantized previous voice to PMON. Its oracle uses explicit floor division rather than runtime signed shifts.

Baseline v84: 80,002 checks, 7,037 failures. Patched: 80,002 checks, zero failures. Logs: red.log, green.log. Existing BRR, Gaussian, key timing, envelope clock, enhanced DSP, FIR/noise, reference arithmetic, release/ENDX, output flag merge, live loop, voice saturation and final mix regressions all pass. BRR initially could not find its helper in the private test directory; helper was copied and rerun successfully (1,605,696 PCM samples).

Limits: This validates pitch arithmetic and cursor advancement within the existing sample-based implementation. It does not establish hardware-exact BRR fetching, subcycle register latches, interpolation/decode pipeline ordering, KON, envelope output ordering or END-without-LOOP behavior. No accuracy score or commercial-game compatibility gain is inferred. The separate END-continuation patch addresses the old stop behavior; its semantics and timing limits are documented in dsp-end-continuation-v043685-SOURCES.md.
