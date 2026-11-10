# IRQ/NMI status read hold, v0.4.36.66

Reference: ares commit `9408cb43d4948fc3ea6e152a307a34348df3fe04`, retrieved 2026-10-15:

- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/cpu/irq.cpp — `nmiPoll` and `irqPoll` execute every four clocks, establish their holds, and `rdnmi` / `timeup` refrain from acknowledging during the hold. `nmitimenUpdate` disabling both IRQ modes clears IRQ independently of its hold. `nmiTest` consumes the NMI transition; `irqTest` permits a persistently asserted IRQ to retrigger.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/ares/sfc/cpu/io.cpp — reads `$4210` and `$4211` delegate to these functions while preserving the remaining open-bus bits.
- https://github.com/ares-emulator/ares/blob/9408cb43d4948fc3ea6e152a307a34348df3fe04/LICENSE — ares core ISC notice, copyright (c) 2004-2025 ares team, Near et al. No ares source files or runtime are imported; this is an independent implementation of the documented state behavior.

The runtime previously acknowledged both status registers immediately, even at the event timestamp. The candidate keeps the asserted status readable without acknowledgment for four master clocks after the runtime's **existing** IRQ/NMI trigger, then preserves its ordinary acknowledgment behavior. Every assertion path establishes the hold: cycle scheduler, `fireIrqAt`, and `beginVblank`. Already latched statuses set directly by older fixtures have a zero hold deadline and remain immediately acknowledgeable.

The regression tests 319 comparisons, including offsets zero through five, four I/O mirror banks, repeated reads, open-bus masks, post-hold acknowledgment, IRQ disable and CPU service. Baseline has 120 failed comparisons; the candidate has zero.

This does not correct absolute interrupt trigger positions, CPU bus-access timestamps, IRQ polling/lock latency, interrupt-entry cycle counts or the complete NMI/IRQ pipeline. The hold deadline uses elapsed master clocks exposed by the existing runtime scheduler. Several accesses in a translated instruction can share that timestamp. No subsystem-grade increase is inferred from this regression.
