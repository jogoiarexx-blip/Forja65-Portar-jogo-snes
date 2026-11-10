#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
DIR="${1:-reports}"
args=(--input "$DIR" --json reports/cfg-v043689-user-audit.json --md reports/cfg-v043689-user-audit.md)
if [[ -n "${2:-}" ]]; then args+=(--rom "$2"); fi
node tools/cfg-evidence-audit-v043688.js "${args[@]}"
