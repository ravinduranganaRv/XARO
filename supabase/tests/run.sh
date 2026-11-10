#!/usr/bin/env bash
# Usage: PGHOST=/tmp PGPORT=5544 PGUSER=postgres bash supabase/tests/run.sh   (needs a throwaway Postgres 15+; never point at production)
set -euo pipefail; cd "$(dirname "$0")/.."
DB=xaro_rls_test; P="psql -q -v ON_ERROR_STOP=1"
$P -d postgres -c "drop database if exists $DB" -c "create database $DB"
for f in tests/00_shim.sql migrations/0001_schema.sql migrations/0002_rls.sql migrations/0003_seed.sql migrations/0004_tenancy.sql migrations/0005_storage.sql migrations/0006_performance_policies.sql migrations/0007_become_rugmaker_any_role.sql migrations/0008_quotation_email_log.sql tests/rls_test.sql; do $P -d $DB -f "$f"; done
# the tenancy test rolls itself back and reports success by raising TENANCY_TESTS_PASSED
out=$(psql -q -d $DB -f tests/tenancy_test.sql 2>&1 || true); echo "$out" | tail -3
echo "$out" | grep -q 'TENANCY_TESTS_PASSED' || { echo 'TENANCY TESTS FAILED'; exit 1; }
