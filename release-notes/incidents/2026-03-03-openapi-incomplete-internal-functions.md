# Incident Report: OpenAPI Does Not Yet Expose All Internal Functions

**Date**: March 3, 2026  
**Severity**: Low (feature incomplete)  
**Affected**: `packages/paideia-backend` OpenAPI surface  
**Status**: Open (significant progress)  
**Incident ID**: INC-2026-03-03-005

## Summary

oRPC OpenAPI integration is in place and working. A large subset of internal functions from `packages/paideia-backend/src/internal/` are now exposed as OpenAPI procedures. The goal is to have **all** internal functions listed on the OpenAPI spec.

## Current State (Updated)

**Exposed** (via `packages/paideia-backend/src/orpc/routers/`):
- `health` – health, ping
- `system-globals` – system globals
- `version-management` – version/latest
- `course-management` – create, update, findById, search, findPublished, delete, findByInstructor, findAll
- `user-management` – findById, findByEmail, findAll
- `enrollment-management` – full CRUD + groups, status, by-user, by-course, by-group
- `note-management` – full CRUD + search, findByUser, generateHeatmap
- `course-category-management` – full CRUD + tree, ancestors, depth, nested count, roots, subcategories
- `settings` – analytics, appearance, maintenance, registration, site-policies (get/update)
- `activity-module-access` – grant, revoke, findGrants, findInstructors, findAutoGranted
- `cron-jobs-management` – getCronJobs, getCronJobHistory
- `scheduled-tasks-management` – getScheduledTasks, getPendingScheduledTasks
- `search-management` – globalSearch
- `media-management` – getById, getByFilenames, getByIds, getAll, delete, getByMimeType, findByUser, rename, stats, orphaned, usages
- `gradebook-management` – create, update, getByCourseWithDetails, getAllRepresentations
- `course-section-management` – create, update, findById, delete, findByCourse, findRoots, findChildren, getTree, getAncestors, getDepth
- `course-activity-module-link-management` – create, findByCourse, findByActivityModule, search, delete, findById, getSettings, checkExists
- `discussion-management` – create, update, getById, getThreadsWithReplies, getThreadWithReplies, upvote, removeUpvote, list, grade, delete
- `assignment-submission-management` – create, getById, grade, removeGrade, list, delete
- `quiz-submission-management` – getQuizById, getById, list, startAttempt, startPreviewAttempt, getGradesReport, getStatisticsReport, getNextAttemptNumber, checkInProgress

**Not yet exposed** (internal modules without oRPC routers or partial coverage):

| Module | File | Notes |
|--------|------|-------|
| activity-module-management | `activity-module-management.ts` | Create/update/delete modules, getById, list |
| category-role-management | `category-role-management.ts` | Assign, revoke, get roles |
| email | `email.ts` | trySendEmail |
| gradebook-category-management | `gradebook-category-management.ts` | Category CRUD, hierarchy |
| gradebook-item-management | `gradebook-item-management.ts` | Item CRUD, reorder |
| quiz-module-management | `quiz-module-management.ts` | Quiz builder operations (~30 procedures) |
| quiz-submission-management | (partial) | answerQuestion, markComplete, grade, etc. |
| user-management | (partial) | create, update, delete, login, register |
| user-grade-management | `user-grade-management.ts` | Grade CRUD, release, adjustments |
| utils | `utils/*.ts` | tryParseMediaFromHtml, etc. |

## Resolution Path

1. For each internal module, create a corresponding router in `packages/paideia-backend/src/orpc/routers/`.
2. Export public `try*` functions as oRPC procedures using `os.route({ method, path })`.
3. Wire each procedure to the internal function with `overrideAccess: true`.
4. Merge each router into the main router in `packages/paideia-backend/src/orpc/router.ts`.

## Pattern to Follow

See existing routers (e.g. `course-management.ts`, `user-management.ts`):
- Use `os.$context<OrpcContext>()` for payload
- Use `os.route({ method: "GET", path: "/resource/:id" })` for REST-style paths
- Use Zod v4 via `@orpc/zod/zod4` for input validation
- Map internal function args from procedure input
- Return `ORPCError("INTERNAL_SERVER_ERROR", { message })` on failure

## References

- Changelog: `changelogs/0097-2026-03-03-orpc-openapi-integration.md`
- oRPC routers: `packages/paideia-backend/src/orpc/routers/`
- Internal modules: `packages/paideia-backend/src/internal/`

## Status

⏳ **OPEN** – Remaining work: add routers for all internal modules listed above.
