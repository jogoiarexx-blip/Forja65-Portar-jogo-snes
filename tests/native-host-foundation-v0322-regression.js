// Forward-version regression guard: validate legacy hardware/API behavior in the newer 0.4.x release.
const assert=require('assert');
const C=require('../forja65-core.js');
const rom=C.loadRom(C.makeSyntheticRom(),'host-foundation.sfc');
const a=C.analyze(rom,2048);
const p=C.generateProject(rom,a);
const rt=String(p['src/runtime.hpp']);
const cm=String(p['CMakeLists.txt']);
const vm=C.VERSION.match(/^0\.(3|4)\.(\d+)/); assert(vm&&(Number(vm[1])>3||Number(vm[2])>=22));
for(const f of ['BUILD-WINDOWS.cmd','RUN-WINDOWS.cmd','RUN-HEADLESS.cmd','tests/runtime_smoke.cpp','docs/HOST-RUNTIME.txt'])assert(p[f],`arquivo host ausente: ${f}`);
for(const q of ['#include <xinput.h>','XInputGetState','FORJA65_HEADLESS','FORJA65_UNCAPPED','paceHostFrame','sleep_until','hostRefreshHz'])assert(rt.includes(q),`runtime host sem ${q}`);
assert(!rt.includes('sleep_for(std::chrono::milliseconds(16))'),'Sleep(16) fixo voltou ao runtime');
for(const q of ['add_library(forja65_generated OBJECT','add_executable(runtime_smoke','enable_testing()','add_test(NAME runtime_smoke','xinput9_1_0','add_custom_command(TARGET game POST_BUILD','TARGET_FILE_DIR:game'])assert(cm.includes(q),`CMake host sem ${q}`);
assert(p['src/main.cpp'].includes('\"save.srm\",')&&/SnesRuntime hw\([^;]+u\);/.test(p['src/main.cpp']),'main nao repassa regiao ao runtime');
assert(p['src/main.cpp'].includes('forja65-last-error.txt')&&p['src/main.cpp'].includes('MessageBoxA'),'main nao preserva erro fatal');
assert(p['RUN-WINDOWS.cmd'].includes('forja65-last-error.txt'),'runner nao mantem diagnostico de erro');
const meta=JSON.parse(p['analysis.json']);
for(const q of ['native_host_foundation','xinput_gamepad','clock_frame_pacing','headless_no_window','cmake_runtime_smoke','windows_build_run_scripts','post_build_assets','fatal_error_log','fatal_error_messagebox'])assert(meta.hardware[q]===true,`metadata sem ${q}`);
console.log('native-host-foundation-v0322-regression: OK');
