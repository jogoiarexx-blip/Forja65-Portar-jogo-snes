# END without LOOP, v0.4.36.85

Primary source: ares commit `9408cb43d4948fc3ea6e152a307a34348df3fe04`, previously retrieved for the v66 audit and present locally as `dsp-private-v66/ares-voice.cpp`:
https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/dsp/voice.cpp

Cross-checked 2026-10-15 with primary Snes9x source, V3c and V4:
https://github.com/snes9xgit/snes9x/blob/master/apu/bapu/dsp/SPC_DSP.cpp

Two separate reference operations establish this behavior. voice3c / V3c forces release mode and clears ENV when the fetched BRR header low two bits equal 1 (END=1, LOOP=0). voice4 / V4 redirects to the directory next/loop address and sets the END event whenever END bit is set; the redirect does not require LOOP. No oscillator active/stop flag is involved. Therefore a first END-only KON block cannot build a direct GAIN envelope, and after any END-only block the silent oscillator continues through subsequent loop-pointer/BRR fetches. Changing GAIN/ADSR does not cancel release; a new KON can.

The implementation expresses only these demonstrated semantics. Under hardwareEnvelopeTiming it clears ENV and sets release at the existing whole-block header fetch, and follows the live DIR/SRCN pointer at all END boundaries. Explicit legacy envelope mode retains the previous stop behavior. No source code is imported from ares or Snes9x.

Baseline immutable v84: 1,224 checks, 528 failures. Candidate: 1,224 checks, zero failures (end-red.log and end-green.log). All 25 DSP-related regression scripts (23 existing plus the two new v85 regressions) pass with both v85 patches.

The new portable JS test compiles actual generated runtime.hpp and exercises direct DSP and real SnesRuntime through SPC $F2/$F3 and the fractional APU scheduler. Coverage includes all eight voices, both key timing modes, zero/half/unit/max pitch, initial END-only header silence, normal sounding block transitioning to END-only, DIR/SRCN wrap and retarget, silent non-END destination progression, ENDX delayed visibility and clear/reassertion, and KON restoring a normal sample. The legacy stop behavior is checked separately.

Old tests contained explicit assumptions that END without LOOP deactivated the voice and could build GAIN first. Their oracles are transparently migrated with patch-dsp-end-fixtures.py: key timing v024, live loop v043641, release/ENDX v043667. The latter retains its 50,000 randomized envelope transitions and its original KOFF, GAIN-to-ADSR and ENDX coverage. The live-loop JS assertion also tracks the updated explanatory comment. No production output is used as the source of the new expected values.

Limits: Forja65 still decodes and caches entire BRR blocks, while reference hardware fetches header/data over DSP phases and decodes four samples at a time. This fix applies silence at the existing block header fetch and does not claim cycle-exact time of last audible sample, BRR read, envelope/ENVX/OUTX pipeline, sample ENDX edge, KON setup or FLG reset semantics. The reference still has broader known pipeline differences. No score or full hardware equivalence is inferred.
