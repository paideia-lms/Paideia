# Test Simplification - Remove Custom Test Runner

**Date:** March 10, 2026  
**Type:** Refactor  
**Impact:** Low - Simplifies test execution; no functional changes to tests

## Overview

Removed the custom test runner script (`process-test-log.ts`) and simplified test execution to use `bun test` directly. The custom script's false-alarm detection (re-running failed tests) is no longer needed.

## Changes

### 1. Deleted Files

- `packages/paideia-backend/scripts/process-test-log.ts` — Custom test log processor with false-alarm detection

### 2. Updated Files

- `packages/paideia-backend/package.json` — Removed `test:all` script
- `.github/workflows/release.yml` — Changed from `bun run test:all` to `bun test`
- `contribution.md` — Documentation already reflected `bun test`

## Why This Change

- **Simplicity** — `bun test` finds and runs all test files automatically
- **No false alarms** — Tests are stable enough that re-running failed tests is unnecessary
- **Less maintenance** — Fewer custom scripts to maintain

## References

- Historical context: `changelogs/0096-2026-03-03-vaults3-migration-and-ci-tests.md` (when `test:all` was added)
- Historical context: `changelogs/0074-2025-11-28-test-case-monitoring-and-stability-indicator.md` (when `process-test-log.ts` was added)
