CPU v0.60 generation inputs

The base analysis and baseline dispatch/CMake are immutable initial inputs. Executed instruction profiles supplement their decoded states; each actual profile row decodes exactly one instruction from the matching ROM. Strict hint files supply explicit target CPU states. Profiles require matching ROM identity and stable raw4 ROM bytes.

From the game source root, run:

    python tools/regenerate-cpu-v060.py
    python tests/test_cpu_generation_v060.py

The first command automatically ingests `analysis/cpu-executed-profiles/*.json` and `analysis/cpu-strict-hints/*.txt`. Extra files may be supplied with repeated `--cpu-profile PATH` or `--strict-hints PATH` arguments. Node and Python must be on PATH. The generator keeps 43 native CPU translation units, preserving baseline dispatch ownership and alias ordering. The final unit absorbs additional instructions. Stack return offsets preserve all original offsets and include newly compiled physical instruction offsets.

`src/forja_cpu_profile_reference_v060.cpp` is a reference-only copy of the canonical interpreter. Set `FORJA65_CPU_INSTRUCTION_PROFILE` to a JSON output path when running a reference executable that links this copy. It records only actual instruction invocations and performs no hardware reads or bus accesses. The canonical interpreter and all 1280 opcode bodies remain unchanged. Production CMake must not link the profile copy.
