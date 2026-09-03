create or replace function public.analytics_dok_breakdown(_course_id uuid default null, _subject text default null, _framework text default null)
returns table(dok_level smallint, question_count integer, standards_covered integer, responses integer, students integer, avg_pct_correct numeric)
language sql stable security definer set search_path to 'public'
as $$
  with qs as (
    select q.id, q.dok_level, a.course_id
    from public.quiz_questions q
    join public.assignments a on a.id = q.assignment_id
    where q.teacher_id = auth.uid()
      and (_course_id is null or a.course_id = _course_id)
      and (
        (_subject is null and _framework is null)
        or exists (
          select 1 from public.question_standards qs2
          join public.standards s on s.id = qs2.standard_id
          where qs2.question_id = q.id
            and (_subject is null or s.subject = _subject)
            and (_framework is null or coalesce(s.framework,'STATE') = _framework)
        )
      )
  ),
  resp as (
    select r.question_id, r.student_id,
      case when r.points_possible > 0 then r.points / r.points_possible
           when r.correct is not null then (case when r.correct then 1 else 0 end) end as frac
    from public.question_responses r
    where r.teacher_id = auth.uid()
  )
  select qs.dok_level,
    count(distinct qs.id)::int,
    (select count(distinct qs2.standard_id) from public.question_standards qs2 where qs2.question_id in (select id from qs q2 where q2.dok_level is not distinct from qs.dok_level))::int,
    count(resp.question_id)::int,
    count(distinct resp.student_id)::int,
    round(avg(resp.frac)::numeric, 4)
  from qs
  left join resp on resp.question_id = qs.id
  group by qs.dok_level
  order by qs.dok_level nulls last;
$$;

create or replace function public.analytics_dok_standard_matrix(_course_id uuid default null, _subject text default null, _framework text default null)
returns table(standard_id uuid, code text, description text, subject text, framework text, dok_level smallint, question_count integer, responses integer, avg_pct_correct numeric)
language sql stable security definer set search_path to 'public'
as $$
  with resp as (
    select r.question_id, r.student_id,
      case when r.points_possible > 0 then r.points / r.points_possible
           when r.correct is not null then (case when r.correct then 1 else 0 end) end as frac
    from public.question_responses r
    where r.teacher_id = auth.uid()
  )
  select s.id, s.code, s.description, s.subject, coalesce(s.framework,'STATE'),
    q.dok_level,
    count(distinct q.id)::int,
    count(resp.question_id)::int,
    round(avg(resp.frac)::numeric, 4)
  from public.question_standards qs
  join public.quiz_questions q on q.id = qs.question_id
  join public.assignments a on a.id = q.assignment_id
  join public.standards s on s.id = qs.standard_id
  left join resp on resp.question_id = q.id
  where qs.teacher_id = auth.uid()
    and (_course_id is null or a.course_id = _course_id)
    and (_subject is null or s.subject = _subject)
    and (_framework is null or coalesce(s.framework,'STATE') = _framework)
  group by s.id, s.code, s.description, s.subject, s.framework, q.dok_level
  order by s.code, q.dok_level nulls last;
$$;

create or replace function public.analytics_dok_trends(_course_id uuid default null, _subject text default null, _granularity text default 'week')
returns table(bucket_label text, bucket_ts timestamptz, dok_level smallint, question_count integer, responses integer, avg_pct_correct numeric)
language sql stable security definer set search_path to 'public'
as $$
  with base as (
    select
      coalesce(sub.submitted_at, sub.graded_at, a.due_at, r.created_at) as ts,
      q.id as question_id, q.dok_level,
      case when r.points_possible > 0 then r.points / r.points_possible
           when r.correct is not null then (case when r.correct then 1 else 0 end) end as frac
    from public.question_responses r
    join public.quiz_questions q on q.id = r.question_id
    join public.assignments a on a.id = q.assignment_id
    left join public.submissions sub on sub.assignment_id = a.id and sub.student_id = r.student_id
    where r.teacher_id = auth.uid()
      and (_course_id is null or a.course_id = _course_id)
      and (_subject is null or exists (
        select 1 from public.question_standards qs join public.standards s on s.id = qs.standard_id
        where qs.question_id = q.id and s.subject = _subject))
  )
  select
    case when _granularity = 'month' then to_char(date_trunc('month', ts), 'YYYY-MM') else to_char(date_trunc('week', ts), 'IYYY-"W"IW') end,
    case when _granularity = 'month' then date_trunc('month', ts) else date_trunc('week', ts) end,
    dok_level,
    count(distinct question_id)::int,
    count(*)::int,
    round(avg(frac)::numeric, 4)
  from base
  where ts is not null
  group by 1, 2, 3
  order by 2, 3 nulls last;
$$;

revoke all on function public.analytics_dok_breakdown(uuid, text, text) from public, anon;
revoke all on function public.analytics_dok_standard_matrix(uuid, text, text) from public, anon;
revoke all on function public.analytics_dok_trends(uuid, text, text) from public, anon;
grant execute on function public.analytics_dok_breakdown(uuid, text, text) to authenticated;
grant execute on function public.analytics_dok_standard_matrix(uuid, text, text) to authenticated;
grant execute on function public.analytics_dok_trends(uuid, text, text) to authenticated;