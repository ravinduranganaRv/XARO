#!/usr/bin/env bash
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres bash supabase/tests/run.sh   (needs a throwaway Postgres 15+; never point at production)
set -euo pipefail; cd "$(dirname "$0")/.."
DB=xaro_rls_test; P="psql -q -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB"
for f in tests/00_shim.sql migrations/0001_schema.sql migrations/0002_rls.sql migrations/0003_seed.sql tests/rls_test.sql; do $P -d $DB -f "$f"; done
