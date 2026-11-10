# DSP reference arithmetic, v0.4.36.66

The reference is ares commit `9408cb43d4948fc3ea6e152a307a34348df3fe04`, retrieved 2026-10-15:

- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/dsp/voice.cpp — `voice3c` envelope arithmetic and `voiceOutput` channel volume arithmetic.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/dsp/envelope.cpp — cross-check of existing ADSR/GAIN scheduling arithmetic; no envelope state-machine change proposed here.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/LICENSE — ares core ISC notice, copyright (c) 2004-2025 ares team, Near et al. The repository LICENSE also contains distinct notices for third-party components. This change implements arithmetic independently; it imports neither ares source files nor ares runtime code. Keep source provenance with the regression.

The independent fixture uses mathematical floor division (ordinary division plus explicit correction for negative remainder), whereas the runtime uses its existing signed-shift helpers. Tested operations:

1. Envelope product divides by 2048 with downward rounding, then clears bit zero. The old path divided by 2047 with truncation.
2. Signed voice panning divides by 128 with downward rounding before the dry and echo accumulators. The old hardware path truncated negative products toward zero.
3. OUTX reads the quantized envelope result and PMON uses it before panning.
4. NON enters before envelope quantization.
5. Explicit legacy volume mode retains its original envelope division.

The new fixture performs 38,422 comparisons. Baseline: 15,884 mismatches, failing exit status. Candidate: zero mismatches, passing exit status. The fixture explicitly selects direct GAIN to isolate multiplication from envelope timing. Existing mixing fixture oracles 642 and 645 previously reproduced the incorrect `/2047` and truncating `/128`; they must be corrected in conjunction with this implementation change, while preserving their saturation, final DAC, legacy and echo checks.

This provides numeric coverage only. It does not validate complete S-DSP pipeline timing, DSP/SPC interleaving, per-clock register latches, BRR fetch timing, KON scheduling, dynamic envelope ordering or end-to-end sound accuracy. No subsystem grade is inferred from these comparisons.
