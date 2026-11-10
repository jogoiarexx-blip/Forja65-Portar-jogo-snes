#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
DIR="${1:-reports}"
args=(--input "$DIR" --json reports/cfg-v043688-user-audit.json --md reports/cfg-v043688-user-audit.md)
if [[ -n "${2:-}" ]]; then args+=(--rom "$2"); fi
node tools/cfg-evidence-audit-v043688.js "${args[@]}"
echo 'Auditoria escrita em reports/cfg-v043688-user-audit.{json,md}.'
