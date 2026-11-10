# V-only IRQ late enable — v0.4.36.67

Reference: ares commit `9408cb43d4948fc3ea6e152a307a34348df3fe04`, retrieved 2026-10-15.

- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/cpu/irq.cpp — `irqPoll` retains the sampled comparator state (`irqValid`), raises the IRQ line only on a false-to-true match, and compares the vertical counter throughout the matching scanline in V-only mode. `timeup` clears the IRQ line/transition without clearing `irqValid`. `nmitimenUpdate` disables the line immediately when both modes are disabled; it does not itself run the comparator.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/cpu/timing.cpp — `CPU::step` polls at four-clock intervals when the horizontal counter has bit 1 set.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/cpu/io.cpp — `$4200` delegates mode changes to `nmitimenUpdate`; horizontal/vertical timer-register writes separately call `irqPoll` upstream.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/LICENSE — ISC notice, copyright (c) 2004-2025 ares team, Near et al. No upstream source file or runtime is imported.

## Bounded change

The old scheduler offered V-only IRQ only at its fixed scanline event. Enabling V-only later in a matching scanline missed that event entirely. The candidate retains a sampled comparator bit, separate from TIMEUP status, and samples at four-clock horizontal boundaries. A new V-only rising match asserts the existing IRQ status/CPU pending path and its existing four-clock read hold. Repeated mode writes or status reads cannot invent another comparator edge. A sampled disabled interval rearms the comparator; disabling/re-enabling without an intervening poll does not.

The runtime's existing H/HV event calculation and its vertical trigger-delay model are retained. Horizontal comparator level sampling uses the existing H event's four-clock window. The vertical comparator changes lines at the existing vertical trigger position. These are adaptations to the current timing model, not replacement with the full ares delayed-counter pipeline. The test deliberately stays away from raster/comparator boundaries and makes no new absolute trigger-timestamp assertion.

Polling is inactive in steady disabled mode. While enabled it splits scheduler/APU clock batches at poll boundaries; batch-versus-one-clock comparisons are included. This carries a possible performance cost and must be measured separately.

## Verification

`irq-vonly-enable-v043667-regression.js` compiles the generated runtime under C++20 at O0/O2 with warnings as errors. The 180 assertions cover the four previous IRQ modes, V-match/nonmatch, four system-bank mirrors, deferred mode writes, repeated acknowledgment/re-enable, low-poll rearming, and batch parity for H/V/HV modes. The v66 baseline fails 37 assertions at each optimization level. Candidate: zero failures. Existing `irq-status-hold-v043666` also passes 319 assertions.

## Limits

This does not establish absolute CPU bus timing, delayed V/H-counter equality near line/dot boundaries, IRQ lock/transition pipeline accuracy, CPU interrupt-entry duration, NMI timing, timer-register-write polling equivalence, or complete IRQ mode fidelity. No subsystem grade follows from these tests.
