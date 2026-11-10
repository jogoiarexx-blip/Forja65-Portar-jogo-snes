#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
PROJECT="$PWD"
FORJA="${FORJA65_HOME:-$(cd ../Forja65-v0.3.59 && pwd)}"
ROUNDS="${1:-5}"
JOBS="${FORJA65_BUILD_JOBS:-4}"
cmake -S . -B build-fast -G Ninja -DCMAKE_BUILD_TYPE=Debug -DCMAKE_CXX_FLAGS_DEBUG='-O0 -g0'
mkdir -p reports
for ((i=1; i<=ROUNDS; i++)); do
  echo "== Forja65 cycle $i/$ROUNDS =="
  cmake --build build-fast --target game -j "$JOBS"
  set +e
  FORJA65_HEADLESS=1 FORJA65_HEADLESS_FRAMES="${FORJA65_HEADLESS_FRAMES:-120}" FORJA65_WATCHDOG_INSTRUCTIONS=15000000 timeout 35s ./build-fast/game > "reports/cycle-${i}-execution.log" 2>&1
  rc=$?
  set -e
  cp -f forja65-runtime-hints.txt "reports/cycle-${i}-hints.txt" 2>/dev/null || true
  echo "run exit code: $rc" | tee -a "reports/cycle-${i}-execution.log"
  if [[ "$rc" == 0 ]]; then echo "Execution completed: $i"; exit 0; fi
  if [[ ! -f forja65-runtime-hints.txt ]]; then echo 'No hints available; stopping'; exit "$rc"; fi
  node "$FORJA/tools/forja65.js" learn-crash "$PROJECT" --from "$PROJECT" --max 4096 | tee "reports/cycle-${i}-learn.log"
  if ! grep -Eq 'Learned [1-9][0-9]* verified' "reports/cycle-${i}-learn.log"; then echo 'No validated new hint: stop to avoid infinite loop'; exit "$rc"; fi
done
