---
name: payload-jobs-query
description: Query Payload jobs (payload_jobs table) for pending jobs, history, or by queue. Use when adding cron/job-queue features or debugging job state.
---

# Payload Jobs Query

## When to Use

- Adding features to list pending jobs in a queue
- Querying job history or job state
- Debugging cron/job-queue behavior

## Table: payload_jobs

Key columns: `id`, `taskSlug`, `queue`, `waitUntil`, `completedAt`, `processing`, `hasError`, `error`, `input`, `meta`, `createdAt`.

- **Pending jobs**: `completedAt` is null (job not yet finished)
- **Queue**: `queue` column (e.g. `"secondly"`, `"minute"`, `"default"` from `JobQueue` enum)

## Pattern: Pending Jobs by Queue

```typescript
import { and, desc, eq, isNull } from "@payloadcms/db-postgres/drizzle";
import { payload_jobs } from "src/payload-generated-schema";

// In a try* function:
const drizzle = payload.db.drizzle;
const pendingJobs = await drizzle
  .select({ id: payload_jobs.id, taskSlug: payload_jobs.taskSlug, queue: payload_jobs.queue, /* ... */ })
  .from(payload_jobs)
  .where(
    and(
      eq(payload_jobs.queue, queue),
      isNull(payload_jobs.completedAt),
    ),
  )
  .orderBy(desc(payload_jobs.createdAt))
  .limit(limit);
```

## Reference

- Service: `packages/paideia-backend/src/modules/infrastructure/services/cron-jobs-management.ts` (`tryGetPendingJobsByQueue`, `tryGetCronJobHistory`)
- Job queues: `packages/paideia-backend/src/job-queue.ts`
- Scheduled tasks (similar pattern): `packages/paideia-backend/src/internal/scheduled-tasks-management.ts`
