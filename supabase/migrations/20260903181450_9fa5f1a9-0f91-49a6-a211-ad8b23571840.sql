revoke all on function public.enqueue_untagged_questions(text, uuid[]) from public, anon;
revoke all on function public.tag_job_control(uuid, text) from public, anon;
revoke all on function public.tag_job_active() from public, anon;
grant execute on function public.enqueue_untagged_questions(text, uuid[]) to authenticated, service_role;
grant execute on function public.tag_job_control(uuid, text) to authenticated, service_role;
grant execute on function public.tag_job_active() to authenticated, service_role;