# Automatic question tagging: "Tag all untagged" + auto-tag on Canvas import

## What you get

1. **Tag all untagged** button in the Question bank (next to "Untagged questions"). One click queues every untagged question; the backend works through them in small batches on a schedule. A progress card shows tagged / remaining, the current course, and Pause / Resume / Cancel controls.
2. **Auto-tag on Canvas import.** After every sync (manual or scheduled), any newly imported questions without a tag are added to the same queue automatically, so new quizzes get suggestions without you doing anything. A toggle in Settings ("Auto-tag imported questions", on by default) controls this.
3. **Safe stopping.** If OpenRouter runs out of credits or rejects the key, the job pauses itself, shows a clear message in the progress card ("Paused: OpenRouter credits exhausted"), and resumes only when you click Resume (or a single probe succeeds after credits are topped up). Rate limits just slow the queue down; they never kill it.
4. Suggestions still land in **Tag Review** for confirmation, exactly as today. Nothing is auto-confirmed.

## How it works

```text
[Tag all] / [canvas-sync]  -->  tag_jobs (one active job per teacher)
                                    |
      pg_cron every 2 min  -->  tag-queue-worker (edge function)
                                    |  lock job, take next ~30 untagged questions
                                    |  (grouped by assignment), call existing tagger logic
                                    |  mark progress, exit
                                    v
                    question_standards (ai_suggested) -> Tag Review
```

- Each worker run is bounded (about 30 questions, 3 AI calls), so it never times out and cost per run is small.
- Progress is stored per question, so a re-run never re-tags something already done.
- Only one worker runs at a time per job (database lease with expiry).
- The queue is skipped entirely while a job is paused or cancelled.

## Technical details

**Database (one migration)**
- Enable `pg_cron` and `pg_net` extensions (currently not installed).
- `public.tag_jobs`: `id`, `teacher_id`, `status` (`queued|running|paused|completed|cancelled`), `pause_reason`, `total`, `done`, `failed`, `scope` (`all_untagged|import`), `lease_until`, `last_run_at`, `consecutive_429`, timestamps. Owner-only RLS; GRANTs to `authenticated` and `service_role`; updated_at trigger.
- `public.tag_job_items`: `job_id`, `question_id`, `assignment_id`, `status` (`pending|done|failed|skipped`), `error`, `processed_at`. Unique on `(question_id)` where status = `pending` so a question is never queued twice across jobs. Owner-only RLS + GRANTs.
- `teacher_settings.auto_tag_on_import boolean not null default true`.
- RPC `enqueue_untagged_questions(_scope text, _assignment_ids uuid[] default null)` (security definer, `auth.uid()` scoped): inserts pending items for the caller's untagged questions (optionally limited to given assignments), creates or reuses the active job, returns job id + counts.
- RPC `tag_job_control(_job_id, _action)` for pause / resume / cancel.
- Cron: `select cron.schedule('tag-queue-worker', '*/2 * * * *', ...)` calling the worker via `net.http_post` with the anon key; the worker authenticates with a shared `TAG_WORKER_SECRET` header.

**Edge functions**
- Refactor the core of `tag-question-standards` (discipline resolution, standards fetch, prompt, AI call, writes) into `_shared/questionTagger.ts`; the existing function keeps its API and uses the shared module.
- New `tag-queue-worker`: verifies the worker secret; for each teacher with a `queued|running` job (skipping `paused`/`cancelled`), acquires the lease (`lease_until < now()`), pulls up to 30 pending items grouped by assignment, runs the shared tagger per assignment group, marks items `done|failed`, increments counters, releases the lease. Error handling per `ai-gateway-error-semantics`: 402/403 (or the equivalent OpenRouter credit/key errors) set `status=paused` with `pause_reason`; three consecutive 429s end the run and the next cron tick retries; 5xx retries once with backoff then marks the item failed. While paused on credits, at most one probe item per tick; success clears the pause.
- `canvas-sync`: after questions are upserted, if `auto_tag_on_import` is true, call `enqueue_untagged_questions('import', <assignment ids touched>)` using the admin client on behalf of the teacher. No AI call happens inside sync.
- Deploy all three; set `TAG_WORKER_SECRET` via the secrets tool.

**Frontend**
- `QuestionsTab.tsx`: "Tag all untagged" button; new `TagJobProgress.tsx` card (polls `tag_jobs` every 5s while active; shows progress bar, remaining count, pause reason banner, Pause/Resume/Cancel). Untagged count refreshes as the job progresses.
- `Settings.tsx`: "Auto-tag imported questions" switch bound to `teacher_settings.auto_tag_on_import`.
- Optional small status chip on the Dashboard when a tag job is running or paused.

**Verification**
- Enqueue a job on a test account, invoke the worker manually, confirm items flip to `done` and suggestions appear in Tag Review; simulate a 402 to confirm the job pauses and the UI shows the reason; run a sync and confirm new questions are enqueued.
