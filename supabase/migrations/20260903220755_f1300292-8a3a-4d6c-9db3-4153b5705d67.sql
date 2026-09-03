alter table public.quiz_questions
  add column if not exists dok_level smallint check (dok_level between 1 and 4);
create index if not exists quiz_questions_dok_missing_idx on public.quiz_questions (teacher_id) where dok_level is null;

alter table public.library_items
  add column if not exists dok_levels smallint[] not null default '{}'::smallint[];

alter table public.tag_jobs drop constraint if exists tag_jobs_scope_chk;
alter table public.tag_jobs add constraint tag_jobs_scope_chk
  check (scope = any (array['all_untagged'::text, 'import'::text, 'dok_backfill'::text]));

create or replace function public.enqueue_untagged_questions_for(_teacher_id uuid, _scope text, _assignment_ids uuid[] default null::uuid[])
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  _job_id uuid;
  _added integer := 0;
begin
  if _scope not in ('all_untagged','import','dok_backfill') then
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
       and (
         case when _scope = 'dok_backfill'
              then q.dok_level is null
              else not exists (select 1 from public.question_standards qs where qs.question_id = q.id)
         end
       )
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
end $function$;