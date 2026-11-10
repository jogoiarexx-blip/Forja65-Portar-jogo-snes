# SPC native generation evidence

The eleven profiles under `profiles/spc-v060` contain actual executed PC/opcode pairs collected by the reference-only interpreter hook. Ten stage/password routes ran 6,000 frames each; the original replay ran 24,000 frames. All eleven exited successfully and reported `runtime_started=PASS`. Their union contains **2,270 pairs / 121 opcode forms**; the original replay adds 12 pairs to the ten-route union of 2,258. Every immutable IPL instruction start was already observed, so generation added zero unobserved IPL pairs.

`training-provenance.json` preserves the exact reference executable hash, capture driver hash, runtime/profiler/generator hashes, each input replay/profile/result/QA hash, reconstructed capture environment, endpoint QA and audio hashes where captured. `routes/` preserves individual original QA, dependency reports, run logs, results and input replays. Reference APU native counters and dependency flags reflect use of the native hook ABI to invoke the **interpreter**; they are not production-native evidence.

Regenerate from the project root:

```sh
python3 tools/spc-aot/generate.py profiles/spc-v060/route-*.json
```

Both source and compiled-map output were independently regenerated in a temporary directory twice and compared byte-for-byte, with matching output. The source was not rewritten during verification, preserving concurrent production builds. Input profile order is sorted by the shell glob; the generated operations are set-unioned and sorted. `tools/spc-aot/compiled-pairs.json` includes the source and input provenance hashes.

`semantic-validation.json` records the separate all-256 semantic fixture test and independent hook/no-hook scheduler test. The all-opcode fixture grants no production coverage. Its profile-hook fixture JSON is explicitly marked fixture-only and is rejected as production input. The production every-site differential test is the CMake/CTest target `spc_aot_v060`; it checks 128 randomized states per opcode form plus one state per additional site, and is expected to report 121 forms / 2,270 sites / 17,637 states followed by 20,000 scheduler/DSP/non-silent PCM slices. Its fresh result is recorded separately by the final build verification.

These timed replay observations describe tested access paths. They do not establish complete-game reachability or future coverage of untested code; unknown PC/opcode combinations fail closed.
