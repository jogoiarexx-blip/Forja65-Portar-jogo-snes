# Observed SPC700 native generator

This Python generator specializes the supplied C++ port's SPC700 implementation at generation time. Each emitted operation is bound to a fixed PC and opcode. Opcode guards run before execution; operands are fetched from live SPC memory and retain its IO/read-clear semantics. Unknown PCs or changed opcodes throw a coverage error. Production output never calls the SPC interpreter or its cycle predictor.

## Reference collection

Link `src/spc700_profile.cpp` into the **reference executable only**, and call `forja65InstallSpcProfile(apu)`. Run with `FORJA65_SPC_PROFILE=/absolute/route.json`; normal process exit writes a sorted unique set of actually executed `[pc,opcode]` pairs. The hook observes immediately before an interpreter step, after the original scheduler has enough credits to execute it. A predictor-only lookup does not train an instruction. Use a separate file for each input route, and preserve the executable, replay, frame count and command with the resulting evidence.

Training uses the native hook ABI to reach the unchanged scheduler. Its `nativeMasterCycles` count is therefore **reference interpreter training**, not proof of native compiled execution. Production must exclude `spc700_profile.cpp` and install `forja65InstallSpcNative(apu)` instead.

## Production generation

```sh
python3 tools/spc-aot/generate.py profiles/route1.json profiles/route2.json
```

Defaults: `src/spc700_native.cpp` and `tools/spc-aot/compiled-pairs.json`. Input format is `forja65-spc-observed-pairs-v1`; only integer pairs within 16-bit PC and 8-bit opcode ranges are accepted. RAM dumps and guessed CFGs are unsupported. The 32 immutable IPL instruction starts are supplemented; `$FFFE/$FFFF` is a vector, not instruction coverage. An empty profile grants those IPL starts only.

The output map has the separate `forja65-spc-compiled-pairs-v1` format and contains profile names/hashes, observed and IPL supplement counts, runtime/generator hashes and the generated source hash. It is not accepted as training evidence. Inputs are set-unioned and sorted for byte-identical source/map regeneration from unchanged files.

For another project root, use `--port /path/to/project`. The generator requires this port's `preciseSpcTiming`, 42-master-clock legacy scheduler, 1.024 MHz precise scheduler and stationary EF/FF PC loops. It rejects a different semantic shape. A newer Forja runtime using `accurateSpcTiming`, halted-state fields or a different scheduler needs its own integration and validation; do not transplant this backend blindly.

## Isolated semantic fixture

All 256 opcode forms are tested without claiming game coverage. Both explicit output paths are mandatory, and neither may name either production default:

```sh
python3 tools/spc-aot/generate.py --test-all-opcodes \
  --output /tmp/spc-native-fixture.cpp --pairs-output /tmp/spc-fixture-pairs.json
g++ -std=c++17 -O1 -DNDEBUG -Isrc tests/spc_aot_v060.cpp \
  /tmp/spc-native-fixture.cpp -o /tmp/spc-aot-fixture
/tmp/spc-aot-fixture
python3 tools/spc-aot/test_generator.py
```

Fixture maps carry `fixture_only=true`; even if relabeled as observations they are rejected as production training. The differential test checks 128 randomized states for every opcode form and one extra state for each additional PC/opcode site, live operand bytes including IO, timer/DSP state, fail-closed guards, and 20,000 scheduler slices with non-silent PCM across both SPC and DSP clock choices. Run it separately against the final production source to check every compiled site. Assertions remain enabled with `-DNDEBUG`.

Reference hook parity is independently checked against the original no-hook scheduler:

```sh
g++ -std=c++17 -O1 -DNDEBUG -Isrc tests/spc_profile_v060.cpp \
  src/spc700_profile.cpp -o /tmp/spc-profile-check
FORJA65_SPC_PROFILE=/tmp/spc-profile-check.json /tmp/spc-profile-check
```

That test covers 20,000 scheduler slices with dynamic timer read-clear branches, DSP IO and ports, followed by 1,000 SLEEP/STOP slices. Its profile is fixture evidence only and must not be used as game training.
