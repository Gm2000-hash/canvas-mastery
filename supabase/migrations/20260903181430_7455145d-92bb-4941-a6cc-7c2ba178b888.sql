-- lovable-cron-fallback-reviewed: 1440 runs/day; worker schedule is armed on enqueue and unscheduled after the queue drains, so it only runs while a tagging job is active
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------- tag_jobs ----------
create table public.tag_jobs (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  status text not null default 'queued',
  pause_reason text,
  scope text not null default 'all_untagged',
  total integer not null default 0,
  done integer not null default 0,
  failed integer not null default 0,
  lease_until timestamptz,
  last_run_at timestamptz,
  consecutive_429 integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tag_jobs_status_chk check (status in ('queued','running','paused','completed','cancelled')),
  constraint tag_jobs_scope_chk check (scope in ('all_untagged','import'))
);
create unique index tag_jobs_one_active_per_teacher on public.tag_jobs(teacher_id) where status in ('queued','running','paused');
grant select, insert, update, delete on public.tag_jobs to authenticated;
grant all on public.tag_jobs to service_role;
alter table public.tag_jobs enable row level security;
create policy "tag_jobs_owner" on public.tag_jobs for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create trigger tag_jobs_updated_at before update on public.tag_jobs
  for each row execute function public.set_updated_at();

-- ---------- tag_job_items ----------
create table public.tag_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.tag_jobs(id) on delete cascade,
  teacher_id uuid not null,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  assignment_id uuid not null,
  status text not null default 'pending',
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint tag_job_items_status_chk check (status in ('pending','done','failed','skipped'))
);
create unique index tag_job_items_pending_uniq on public.tag_job_items(question_id) where status = 'pending';
create index tag_job_items_job_status_idx on public.tag_job_items(job_id, status);
grant select on public.tag_job_items to authenticated;
grant all on public.tag_job_items to service_role;
alter table public.tag_job_items enable row level security;
create policy "tag_job_items_owner_read" on public.tag_job_items for select to authenticated
  using (teacher_id = auth.uid());

-- ---------- worker_ticks (one-time tokens for the scheduled worker) ----------
create table public.worker_ticks (
  token text primary key,
  created_at timestamptz not null default now()
);
revoke all on public.worker_ticks from anon, authenticated;
grant all on public.worker_ticks to service_role;
alter table public.worker_ticks enable row level security;

-- ---------- settings flag ----------
alter table public.teacher_settings add column if not exists auto_tag_on_import boolean not null default true;

-- ---------- arm / disarm the worker schedule ----------
create or replace function public.tag_worker_arm()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from cron.job where jobname = 'tag-queue-worker') then
    return;
  end if;
  perform cron.schedule(
    'tag-queue-worker',
    '* * * * *',
    $cron$
    with t as (
      insert into public.worker_ticks(token) values (encode(gen_random_bytes(24), 'hex')) returning token
    )
    select net.http_post(
      url := 'https://kxdsormjkkgaeobovqag.supabase.co/functions/v1/tag-queue-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4ZHNvcm1qa2tnYWVvYm92cWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTUxOTMsImV4cCI6MjA5MjYzMTE5M30.Ci-jBGmfiIOY59Az4xEgdIOQ8LXBXQwFXq_XjgGtyQs',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4ZHNvcm1qa2tnYWVvYm92cWFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTUxOTMsImV4cCI6MjA5MjYzMTE5M30.Ci-jBGmfiIOY59Az4xEgdIOQ8LXBXQwFXq_XjgGtyQs',
        'x-worker-token', t.token
      ),
      body := '{}'::jsonb
    ) from t;
    $cron$
  );
end $$;
revoke all on function public.tag_worker_arm() from public, anon, authenticated;
grant execute on function public.tag_worker_arm() to service_role;

create or replace function public.tag_worker_disarm()
returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Only disarm when nothing is left to run.
  if exists (select 1 from public.tag_jobs where status in ('queued','running')) then
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'tag-queue-worker') then
    perform cron.unschedule('tag-queue-worker');
  end if;
  delete from public.worker_ticks where created_at < now() - interval '10 minutes';
end $$;
revoke all on function public.tag_worker_disarm() from public, anon, authenticated;
grant execute on function public.tag_worker_disarm() to service_role;

-- ---------- enqueue (internal) ----------
create or replace function public.enqueue_untagged_questions_for(
  _teacher_id uuid, _scope text, _assignment_ids uuid[] default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  _job_id uuid;
  _added integer := 0;
begin
  if _scope not in ('all_untagged','import') then
    raise exception 'invalid scope';
  end if;

  select id into _job_id from public.tag_jobs
   where teacher_id = _teacher_id and status in ('queued','running','paused') limit 1;

  if _job_id is null then
    insert into public.tag_jobs(teacher_id, status, scope) values (_teacher_id, 'queued', _scope)
    returning id into _job_id;
  end if;

  with cand as (
    select q.id as question_id, q.assignment_id
      from public.quiz_questions q
     where q.teacher_id = _teacher_id
       and (_assignment_ids is null or q.assignment_id = any(_assignment_ids))
       and not exists (select 1 from public.question_standards qs where qs.question_id = q.id)
       and not exists (select 1 from public.tag_job_items i where i.question_id = q.id and i.status = 'pending')
  ), ins as (
    insert into public.tag_job_items(job_id, teacher_id, question_id, assignment_id)
    select _job_id, _teacher_id, question_id, assignment_id from cand
    on conflict do nothing
    returning 1
  )
  select count(*) into _added from ins;

  update public.tag_jobs set total = total + _added where id = _job_id;

  if exists (select 1 from public.tag_jobs where id = _job_id and status in ('queued','running')) then
    perform public.tag_worker_arm();
  end if;

  return jsonb_build_object('job_id', _job_id, 'added', _added);
end $$;
revoke all on function public.enqueue_untagged_questions_for(uuid, text, uuid[]) from public, anon, authenticated;
grant execute on function public.enqueue_untagged_questions_for(uuid, text, uuid[]) to service_role;

-- ---------- enqueue (caller) ----------
create or replace function public.enqueue_untagged_questions(_scope text default 'all_untagged', _assignment_ids uuid[] default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return public.enqueue_untagged_questions_for(auth.uid(), _scope, _assignment_ids);
end $$;
grant execute on function public.enqueue_untagged_questions(text, uuid[]) to authenticated;

-- ---------- job control ----------
create or replace function public.tag_job_control(_job_id uuid, _action text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _action = 'pause' then
    update public.tag_jobs set status = 'paused', pause_reason = 'Paused by you'
     where id = _job_id and teacher_id = auth.uid() and status in ('queued','running');
  elsif _action = 'resume' then
    update public.tag_jobs set status = 'queued', pause_reason = null, consecutive_429 = 0
     where id = _job_id and teacher_id = auth.uid() and status = 'paused';
    perform public.tag_worker_arm();
  elsif _action = 'cancel' then
    update public.tag_jobs set status = 'cancelled', pause_reason = null
     where id = _job_id and teacher_id = auth.uid() and status in ('queued','running','paused');
    update public.tag_job_items set status = 'skipped' where job_id = _job_id and status = 'pending';
  else
    raise exception 'invalid action';
  end if;
end $$;
grant execute on function public.tag_job_control(uuid, text) to authenticated;

-- ---------- active job for the current user ----------
create or replace function public.tag_job_active()
returns setof public.tag_jobs
language sql stable security definer set search_path = public as $$
  select * from public.tag_jobs
   where teacher_id = auth.uid() and status in ('queued','running','paused')
   order by created_at desc limit 1;
$$;
grant execute on function public.tag_job_active() to authenticated;