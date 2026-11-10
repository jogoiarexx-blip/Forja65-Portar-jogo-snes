# Port integration

Run `python3 tools/spc-aot/generate.py --port /path/to/exported-project /path/to/observed-route.json`. The default empty profile contains no game pairs; it grants only immutable IPL instruction starts. This tool targets the exact legacy `preciseSpcTiming` runtime described in README.md, not this Forja revision's modern JavaScript/C++ runtime.

Copy `reference/spc700_profile.cpp` to the exported project's `src` for reference-only training, and the three test files to its `tests`. Link the profiling hook only into a separate reference executable; production links the generated `src/spc700_native.cpp` only. Call `forja65InstallSpcProfile(apu)` or `forja65InstallSpcNative(apu)` respectively. Declare the selected function in the integrating translation unit; the runtime ABI is unchanged.

Use `--port` for every invocation from this tool bundle, including tests. Run `python3 tools/spc-aot/test_generator.py --port /path/to/exported-project` against a project whose `src/runtime.hpp` has the expected semantic shape. No commercial game source, native backend, ROM or executable is included in this generic directory. Game-specific observed profiles belong under `profiles/super-bomberman-2/`, never in `default-profile.json`.
