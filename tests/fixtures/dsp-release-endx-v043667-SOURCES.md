# DSP release and retained envelope state, v0.4.36.67

Primary reference pinned at ares commit `9408cb43d4948fc3ea6e152a307a34348df3fe04`:

- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/dsp/envelope.cpp — release clamps the visible envelope without terminating voice processing. Its final overflow/underflow clipping changes Attack to Decay regardless of whether ADSR or GAIN is selected.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/dsp/voice.cpp — voice processing, BRR advancement and ENDX continue independently of a zero envelope. It runs the envelope after computing the voice output; this patch does not fix Forja65's different output/envelope ordering.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/dsp/counter.cpp — shared rate counter schedule. The fixture reexpresses its offset pattern arithmetically rather than calling the runtime helper.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/LICENSE — ares core ISC notice, reproduced below for reference attribution.

## Corrected behavior

1. Forja65 previously deactivated a released voice when ENV reached zero, preventing BRR traversal and later ENDX. Hardware envelope mode now preserves processing, silently. Existing non-loop END stopping remains an approximation; explicit legacy envelope mode retains the earlier zero-envelope stop.
2. Forja65 previously guarded Attack-to-Decay clipping transitions with ADSR enable. GAIN clipping now also updates this retained state. Switching GAIN back to ADSR therefore begins in the state established by earlier clipping.

## Evidence

The independent state oracle runs 50,000 deterministic randomized cases spanning ADSR/GAIN data, all three non-release stages, release, hidden envelopes and the 30,720-clock rate phase. It uses floor division and an arithmetically expressed offset pattern.

Integration coverage constructs real `SnesRuntime` instances using `FORJA65_AUDIO_MODE=native`, preserving their hardware DSP configuration. It uses the SPC `$F2/$F3` register interface and fractional `ApuBridge::tickMasterCycles`; SPC SLEEP keeps a concurrent driver idle while the DSP continues. There are 96 release/ENDX scenarios (eight voices, three direct GAIN levels, two pitches, END and END+LOOP) and 16 GAIN-to-ADSR switches. Visible ENDX and ENVX reads demonstrate both behavior changes. A separate check preserves explicit legacy stopping.

The final fixture makes 201,025 comparisons. Baseline has 325 failures; the candidate has zero. Logs are retained with the private investigation. Nine existing DSP regressions pass against the candidate. Two historical fixtures incorrectly expected zero hardware release to deactivate the voice; only those assertions were corrected, retaining zero ENV checks.

These are state and numeric tests, not evidence of full DSP pipeline timing, BRR fetch accuracy, register bus timing or game-level compatibility. The existing envelope-before-output ordering remains uncorrected. No grade increase is inferred.

## ares reference license

Copyright (c) 2004-2025 ares team, Near et al

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
