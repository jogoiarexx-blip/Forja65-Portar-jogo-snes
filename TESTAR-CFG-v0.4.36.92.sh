#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node tests/bomberman-boss-transition-v043692-regression.js
bash TESTAR-CFG-v0.4.36.91.sh
