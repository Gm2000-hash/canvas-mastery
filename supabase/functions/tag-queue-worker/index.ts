// Background worker for the question-tagging queue.
//
// Woken once a minute by pg_cron while a job is armed (see tag_worker_arm /
// tag_worker_disarm). Each run is bounded: at most MAX_TEACHERS jobs and
// MAX_ITEMS questions per job, guarded by a per-job lease. Progress is marked
// per question so re-runs never redo work. Hard AI errors (401/402/403) pause
// the job; repeated 429s end the run and the next tick retries.
//
// Auth: the caller must present a one-time token minted by the cron job into
// public.worker_ticks (readable only by the service role).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiProviderErrorMessage, getAiProviderConfig } from "../_shared/openrouter.ts";
import { TaggerConfigError, TaggerProviderError, tagQuestionsForAssignment } from "../_shared/questionTagger.ts";

const MAX_TEACHERS = 3;
const MAX_ITEMS = 30;
const LEASE_MINUTES = 4;
const MAX_429_PER_RUN = 2;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Item = { id: string; question_id: string; assignment_id: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // --- one-time token auth ---
  const token = req.headers.get("x-worker-token") ?? "";
  if (!token) return json({ error: "Unauthorized" }, 401);
  const { data: tick } = await admin.from("worker_ticks").select("token, created_at").eq("token", token).maybeSingle();
  if (!tick || Date.now() - new Date(tick.created_at).getTime() > 10 * 60 * 1000) {
    return json({ error: "Unauthorized" }, 401);
  }
  await admin.from("worker_ticks").delete().eq("token", token);

  let provider: "openrouter" | "lovable" = "lovable";
  try { provider = getAiProviderConfig().provider; } catch (e) {
    // No AI key at all — pause every runnable job so we don't spin.
    await admin.from("tag_jobs").update({ status: "paused", pause_reason: (e as Error).message })
      .in("status", ["queued", "running"]);
    await admin.rpc("tag_worker_disarm");
    return json({ ok: false, error: (e as Error).message });
  }

  const nowIso = new Date().toISOString();
  const { data: jobs, error: jErr } = await admin.from("tag_jobs")
    .select("id, teacher_id, status, consecutive_429, lease_until")
    .in("status", ["queued", "running"])
    .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(MAX_TEACHERS);
  if (jErr) return json({ error: jErr.message }, 500);

  const summary: Record<string, unknown>[] = [];

  for (const job of jobs ?? []) {
    // Acquire lease (single-flight): only succeeds if nobody else grabbed it meanwhile.
    const leaseUntil = new Date(Date.now() + LEASE_MINUTES * 60 * 1000).toISOString();
    const { data: leased } = await admin.from("tag_jobs")
      .update({ lease_until: leaseUntil, status: "running", last_run_at: nowIso })
      .eq("id", job.id).in("status", ["queued", "running"])
      .or(`lease_until.is.null,lease_until.lt.${nowIso}`)
      .select("id");
    if (!leased || leased.length === 0) continue;

    let consecutive429 = job.consecutive_429 ?? 0;
    let pausedReason: string | null = null;
    let processedCount = 0;

    try {
      const { data: items } = await admin.from("tag_job_items")
        .select("id, question_id, assignment_id")
        .eq("job_id", job.id).eq("status", "pending")
        .order("assignment_id").order("created_at")
        .limit(MAX_ITEMS);
      const pending = (items ?? []) as Item[];

      // Group by assignment so each AI call shares one standards list/prompt.
      const groups = new Map<string, Item[]>();
      for (const it of pending) {
        const arr = groups.get(it.assignment_id) ?? [];
        arr.push(it);
        groups.set(it.assignment_id, arr);
      }

      for (const [assignmentId, group] of groups) {
        const qIds = group.map((g) => g.question_id);
        try {
          const res = await tagQuestionsForAssignment(admin, job.teacher_id, assignmentId, {
            questionIds: qIds, clearPrior: false,
          });
          const done = new Set(res.processed_question_ids);
          const doneIds = group.filter((g) => done.has(g.question_id)).map((g) => g.id);
          if (doneIds.length) {
            await admin.from("tag_job_items")
              .update({ status: "done", processed_at: new Date().toISOString(), error: null })
              .in("id", doneIds);
          }
          processedCount += doneIds.length;
          consecutive429 = 0;
        } catch (e) {
          if (e instanceof TaggerConfigError) {
            // Not fixable by retrying — mark this assignment's items failed and move on.
            await admin.from("tag_job_items")
              .update({ status: "failed", processed_at: new Date().toISOString(), error: e.message.slice(0, 500) })
              .in("id", group.map((g) => g.id));
            continue;
          }
          if (e instanceof TaggerProviderError) {
            // Anything persisted before the error counts as done.
            const { data: tagged } = await admin.from("question_standards")
              .select("question_id").in("question_id", qIds);
            const taggedSet = new Set((tagged ?? []).map((r: any) => r.question_id));
            const doneIds = group.filter((g) => taggedSet.has(g.question_id)).map((g) => g.id);
            if (doneIds.length) {
              await admin.from("tag_job_items")
                .update({ status: "done", processed_at: new Date().toISOString() }).in("id", doneIds);
              processedCount += doneIds.length;
            }
            if (e.status === 429) {
              // The shared provider helper already retried with backoff before
              // surfacing this, so the limit is sustained: park until the next
              // tick instead of hammering the provider from this run.
              consecutive429 += 1;
              if (consecutive429 >= MAX_429_PER_RUN) break;
              await new Promise((r) => setTimeout(r, 8000 * consecutive429));
              continue;
            }
            // 401 / 402 / 403 — circuit breaker: pause the whole job.
            pausedReason = aiProviderErrorMessage(e.status, provider);
            break;
          }
          throw e;
        }
      }
    } catch (e) {
      console.error("tag-queue-worker job error", job.id, e);
      pausedReason = `Worker error: ${(e as Error).message}`.slice(0, 300);
    }

    // Recompute counters from item states (idempotent).
    const [{ count: done }, { count: failed }, { count: pendingLeft }] = await Promise.all([
      admin.from("tag_job_items").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("status", "done"),
      admin.from("tag_job_items").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("status", "failed"),
      admin.from("tag_job_items").select("id", { count: "exact", head: true }).eq("job_id", job.id).eq("status", "pending"),
    ]);

    const update: Record<string, unknown> = {
      done: done ?? 0,
      failed: failed ?? 0,
      lease_until: null,
      consecutive_429: consecutive429,
    };
    if (pausedReason) {
      update.status = "paused";
      update.pause_reason = pausedReason;
    } else if ((pendingLeft ?? 0) === 0) {
      update.status = "completed";
      update.pause_reason = null;
    } else {
      update.status = "queued";
    }
    await admin.from("tag_jobs").update(update).eq("id", job.id);
    summary.push({ job_id: job.id, processed: processedCount, pending_left: pendingLeft ?? 0, status: update.status });
  }

  // Drop the schedule when nothing runnable remains.
  await admin.rpc("tag_worker_disarm");

  return json({ ok: true, jobs: summary });
});
