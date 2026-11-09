#!/usr/bin/env bash
# Storefront visual regression: the page built from this checkout must look identical to the ORIGINAL approved storefront
# (commit 5acf7a5, before any Studio work), apart from the one sanctioned Studio entry button (hidden during capture).
# Baselines are rendered on the same machine from that commit, so font/GPU differences cannot cause false alarms.
set -euo pipefail
BASE_COMMIT=${BASE_COMMIT:-5acf7a5}
T=$(mktemp -d)
git show "$BASE_COMMIT:index.html" > "$T/orig.html"
python3 tests/e2e/visual_regression.py capture "$T/base" "$T/orig.html"
python3 tests/e2e/visual_regression.py capture "$T/new" index.html
python3 tests/e2e/visual_regression.py compare "$T/base" "$T/new" "${MAX_DIFF_PCT:-0.05}"
