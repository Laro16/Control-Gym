-- Diagnóstico de solo lectura para ejecutar ANTES de la migración 20260808.

select 'gym_count' as check_name, count(*)::text as result from public.gyms;

select 'duplicate_dpi' as problem, gym_id::text, dpi, count(*)::text
from public.profiles
where dpi is not null
group by gym_id, dpi
having count(*) > 1;

select 'member_plan_other_gym' as problem, m.id::text, m.gym_id::text, p.gym_id::text
from public.members m
join public.plans p on p.id = m.plan_id
where m.gym_id is distinct from p.gym_id;

select 'missing_gym' as problem, id::text
from public.members where gym_id is null
union all
select 'plan_missing_gym', id::text from public.plans where gym_id is null
union all
select 'announcement_missing_gym', id::text from public.announcements where gym_id is null;

select 'duplicate_attendance' as problem, member_id::text, attended_date::text, count(*)::text
from public.attendance group by member_id, attended_date having count(*) > 1;

select 'duplicate_open_payment' as problem, member_id::text, due_date::text, count(*)::text
from public.payments where status <> 'rejected'
group by member_id, due_date having count(*) > 1;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('avatars','logos','progress','vouchers')
order by id;
