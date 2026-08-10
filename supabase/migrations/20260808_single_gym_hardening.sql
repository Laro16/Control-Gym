-- Control Gym: endurecimiento final para una instalación de un solo gimnasio.
-- Ejecutar después de 20260802_security_integrity.sql y
-- 20260804_financial_integrity.sql en una instalación existente.

begin;

create extension if not exists pgcrypto with schema extensions;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;
alter table public.members
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_gym_id_fkey') then
    alter table public.profiles add constraint profiles_gym_id_fkey
      foreign key (gym_id) references public.gyms(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'members_archived_by_fkey') then
    alter table public.members add constraint members_archived_by_fkey
      foreign key (archived_by) references public.profiles(id) on delete set null not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'plans_id_gym_unique') then
    alter table public.plans add constraint plans_id_gym_unique unique (id, gym_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'members_plan_same_gym_fkey') then
    alter table public.members add constraint members_plan_same_gym_fkey
      foreign key (plan_id, gym_id) references public.plans(id, gym_id)
      on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'measurements_weight_valid') then
    alter table public.measurements add constraint measurements_weight_valid
      check (weight_kg is null or weight_kg between 20 and 500) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'measurements_height_valid') then
    alter table public.measurements add constraint measurements_height_valid
      check (height_cm is null or height_cm between 50 and 260) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'measurements_body_fat_valid') then
    alter table public.measurements add constraint measurements_body_fat_valid
      check (body_fat_pct is null or body_fat_pct between 1 and 75) not valid;
  end if;
end;
$$;

create unique index if not exists profiles_gym_dpi_uidx
  on public.profiles(gym_id, dpi) where dpi is not null;
create unique index if not exists single_gym_only_uidx on public.gyms ((true));

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  gym_id uuid not null references public.gyms(id) on delete restrict,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.checkin_tokens (
  id bigint generated always as identity primary key,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_gym_created_idx
  on public.audit_events(gym_id, created_at desc);
create index if not exists checkin_tokens_gym_expiry_idx
  on public.checkin_tokens(gym_id, expires_at desc);

alter table public.audit_events enable row level security;
alter table public.checkin_tokens enable row level security;

drop policy if exists audit_events_admin_read on public.audit_events;
create policy audit_events_admin_read on public.audit_events
  for select to authenticated
  using (public.is_admin() and gym_id = public.current_gym_id());

revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
revoke all on public.checkin_tokens from anon, authenticated;

-- Un administrador debe haber completado MFA (AAL2) para usar privilegios.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select p.role = 'admin' and coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    from public.profiles p
    where p.id = auth.uid()
    limit 1
  ), false);
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.write_audit_event(
  p_gym_id uuid,
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_events(
    gym_id, actor_profile_id, action, entity_type, entity_id, details
  ) values (
    p_gym_id, p_actor_id, left(p_action, 120), left(p_entity_type, 80),
    p_entity_id, coalesce(p_details, '{}'::jsonb)
  );
$$;

revoke all on function public.write_audit_event(uuid, uuid, text, text, uuid, jsonb) from public;

-- Los miembros nunca leen el secreto histórico del QR.
revoke select on public.gyms from authenticated;
grant select (
  id, name, logo_url, primary_color, whatsapp_number, address, created_at,
  closed_weekdays, holidays, timezone, allow_overdue_checkin
) on public.gyms to authenticated;

-- Planes y miembros se modifican únicamente mediante funciones validadas.
revoke insert, update, delete on public.plans from authenticated;
grant select on public.plans to authenticated;
drop policy if exists plans_admin_gym on public.plans;

revoke insert, update, delete on public.members from authenticated;
grant select on public.members to authenticated;
drop policy if exists members_admin_gym on public.members;
drop policy if exists members_admin_gym_select on public.members;
create policy members_admin_gym_select on public.members
  for select to authenticated
  using (public.is_admin() and gym_id = public.current_gym_id());

-- Límites reales de servidor para todas las imágenes.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']::text[]
where id in ('avatars','logos','progress','vouchers');

update storage.buckets set public = true where id in ('avatars','logos');
update storage.buckets set public = false where id in ('progress','vouchers');

-- Los vouchers son inmutables una vez que una fila de pagos referencia su ruta.
drop policy if exists vouchers_update_scoped on storage.objects;
drop policy if exists vouchers_delete_scoped on storage.objects;
create policy vouchers_delete_scoped on storage.objects
  for delete to authenticated using (
    bucket_id = 'vouchers' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (
          (public.is_admin() and m.gym_id = public.current_gym_id())
          or (
            m.profile_id = auth.uid()
            and not exists (
              select 1 from public.payments p where p.voucher_url = name
            )
          )
        )
    )
  );

create or replace function public.assert_voucher_path(
  p_member_id uuid,
  p_voucher_path text
)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_metadata jsonb;
begin
  if nullif(trim(p_voucher_path), '') is null
     or split_part(trim(p_voucher_path), '/', 1) <> p_member_id::text then
    raise exception 'El comprobante no pertenece al miembro autenticado';
  end if;

  select o.metadata into v_metadata
  from storage.objects o
  where o.bucket_id = 'vouchers' and o.name = trim(p_voucher_path);

  if v_metadata is null then raise exception 'El archivo del comprobante no existe'; end if;
  if coalesce(v_metadata ->> 'mimetype', '') not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Tipo de comprobante no permitido';
  end if;
  if coalesce((v_metadata ->> 'size')::bigint, 0) > 5242880 then
    raise exception 'El comprobante supera 5 MB';
  end if;
end;
$$;

revoke all on function public.assert_voucher_path(uuid, text) from public;

-- Token corto para el QR. Solo un admin con MFA puede emitirlo.
create or replace function public.issue_checkin_token(p_ttl_seconds integer default 90)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_gym_id uuid;
  v_token text;
  v_expiry timestamptz;
  v_ttl integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador con MFA puede emitir el QR';
  end if;
  v_gym_id := public.current_gym_id();
  if v_gym_id is null then raise exception 'Administrador sin gimnasio'; end if;

  v_ttl := greatest(30, least(coalesce(p_ttl_seconds, 90), 120));
  v_token := encode(gen_random_bytes(24), 'hex');
  v_expiry := now() + make_interval(secs => v_ttl);

  delete from public.checkin_tokens
  where gym_id = v_gym_id and expires_at < now() - interval '5 minutes';

  insert into public.checkin_tokens(gym_id, token_hash, expires_at, created_by)
  values (
    v_gym_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    v_expiry,
    auth.uid()
  );

  return jsonb_build_object('token', v_token, 'expires_at', v_expiry);
end;
$$;

revoke all on function public.issue_checkin_token(integer) from public;
grant execute on function public.issue_checkin_token(integer) to authenticated;

-- La fecha operativa siempre procede de la zona horaria del gimnasio.
create or replace function public.get_gym_business_date()
returns date
language sql
stable
security definer
set search_path = public
as $$
  select timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  from public.gyms g
  where g.id = public.current_gym_id();
$$;

revoke all on function public.get_gym_business_date() from public;
grant execute on function public.get_gym_business_date() to authenticated;

create or replace function public.complete_initial_password_change()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile_created timestamptz;
  v_auth_updated timestamptz;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select p.created_at, u.updated_at
  into v_profile_created, v_auth_updated
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = auth.uid();

  if v_auth_updated is null or v_auth_updated <= v_profile_created then
    raise exception 'La contraseña todavía no fue actualizada';
  end if;
  update public.profiles set must_change_password = false where id = auth.uid();
  return true;
end;
$$;

revoke all on function public.complete_initial_password_change() from public;
grant execute on function public.complete_initial_password_change() to authenticated;

-- Alta transaccional de perfil + ficha. Solo la Edge Function con service_role.
create or replace function public.provision_member_data(
  p_actor_id uuid,
  p_auth_user_id uuid,
  p_gym_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_dpi text,
  p_birth_date date,
  p_plan_id uuid,
  p_start_date date,
  p_emergency_contact text,
  p_notes text
)
returns public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_actor_id and p.role = 'admin' and p.gym_id = p_gym_id
  ) then raise exception 'Administrador no válido'; end if;
  if p_plan_id is not null and not exists (
    select 1 from public.plans p
    where p.id = p_plan_id and p.gym_id = p_gym_id and p.is_active
  ) then raise exception 'Plan no válido'; end if;
  if p_dpi is not null and p_dpi !~ '^\d{13}$' then raise exception 'DPI no válido'; end if;

  if exists (
    select 1 from public.profiles p
    where p.id = p_auth_user_id
      and (p.role = 'admin' or (p.gym_id is not null and p.gym_id <> p_gym_id))
  ) then raise exception 'La cuenta no puede convertirse en miembro'; end if;

  insert into public.profiles(
    id, role, full_name, email, phone, dpi, birth_date, gym_id, must_change_password
  ) values (
    p_auth_user_id, 'user', trim(p_full_name), lower(trim(p_email)), p_phone,
    p_dpi, p_birth_date, p_gym_id, true
  )
  on conflict (id) do update set
    role = 'user', full_name = excluded.full_name, email = excluded.email,
    phone = excluded.phone, dpi = excluded.dpi, birth_date = excluded.birth_date,
    gym_id = excluded.gym_id, must_change_password = true;

  insert into public.members(
    profile_id, gym_id, plan_id, start_date, status,
    emergency_contact, notes
  ) values (
    p_auth_user_id, p_gym_id, p_plan_id, p_start_date, 'active',
    p_emergency_contact, p_notes
  ) returning * into v_member;

  perform public.write_audit_event(
    p_gym_id, p_actor_id, 'member.created', 'member', v_member.id,
    jsonb_build_object('profile_id', p_auth_user_id, 'plan_id', p_plan_id)
  );
  return v_member;
end;
$$;

revoke all on function public.provision_member_data(
  uuid, uuid, uuid, text, text, text, text, date, uuid, date, text, text
) from public, anon, authenticated;
grant execute on function public.provision_member_data(
  uuid, uuid, uuid, text, text, text, text, date, uuid, date, text, text
) to service_role;

create or replace function public.admin_update_member_data(
  p_member_id uuid,
  p_full_name text,
  p_phone text,
  p_dpi text,
  p_birth_date date,
  p_status text,
  p_plan_id uuid,
  p_start_date date,
  p_emergency_contact text,
  p_notes text
)
returns public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_gym_id uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador con MFA puede editar miembros';
  end if;
  if p_status not in ('active','inactive','suspended') then raise exception 'Estado no válido'; end if;
  if nullif(trim(p_full_name), '') is null then raise exception 'Nombre obligatorio'; end if;
  if p_dpi is not null and p_dpi !~ '^\d{13}$' then raise exception 'DPI no válido'; end if;

  v_gym_id := public.current_gym_id();
  select * into v_member from public.members
  where id = p_member_id and gym_id = v_gym_id and archived_at is null
  for update;
  if v_member.id is null then raise exception 'Miembro no encontrado o archivado'; end if;
  if p_plan_id is not null and not exists (
    select 1 from public.plans p
    where p.id = p_plan_id and p.gym_id = v_gym_id and p.is_active
  ) then raise exception 'Plan no válido'; end if;

  update public.profiles set
    full_name = trim(p_full_name), phone = p_phone, dpi = p_dpi, birth_date = p_birth_date
  where id = v_member.profile_id and gym_id = v_gym_id;

  update public.members set
    status = p_status, plan_id = p_plan_id, start_date = p_start_date,
    emergency_contact = p_emergency_contact, notes = p_notes
  where id = p_member_id
  returning * into v_member;

  perform public.write_audit_event(
    v_gym_id, auth.uid(), 'member.updated', 'member', v_member.id,
    jsonb_build_object('status', p_status, 'plan_id', p_plan_id)
  );
  return v_member;
end;
$$;

revoke all on function public.admin_update_member_data(
  uuid, text, text, text, date, text, uuid, date, text, text
) from public;
grant execute on function public.admin_update_member_data(
  uuid, text, text, text, date, text, uuid, date, text, text
) to authenticated;

create or replace function public.deactivate_member(p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_gym_id uuid := public.current_gym_id();
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administrador'; end if;
  update public.members set status = 'inactive'
  where id = p_member_id and gym_id = v_gym_id and archived_at is null;
  if not found then raise exception 'Miembro no encontrado'; end if;
  perform public.write_audit_event(v_gym_id, auth.uid(), 'member.deactivated', 'member', p_member_id, '{}');
  return true;
end;
$$;

create or replace function public.archive_member(p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_gym_id uuid := public.current_gym_id();
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administrador'; end if;
  update public.members set
    status = 'inactive', archived_at = now(), archived_by = auth.uid()
  where id = p_member_id and gym_id = v_gym_id and archived_at is null;
  if not found then raise exception 'Miembro no encontrado o ya archivado'; end if;
  perform public.write_audit_event(v_gym_id, auth.uid(), 'member.archived', 'member', p_member_id, '{}');
  return true;
end;
$$;

create or replace function public.restore_member(p_member_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_gym_id uuid := public.current_gym_id();
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Solo administrador'; end if;
  update public.members set
    status = 'active', archived_at = null, archived_by = null
  where id = p_member_id and gym_id = v_gym_id;
  if not found then raise exception 'Miembro no encontrado'; end if;
  perform public.write_audit_event(v_gym_id, auth.uid(), 'member.restored', 'member', p_member_id, '{}');
  return true;
end;
$$;

revoke all on function public.deactivate_member(uuid) from public;
revoke all on function public.archive_member(uuid) from public;
revoke all on function public.restore_member(uuid) from public;
grant execute on function public.deactivate_member(uuid) to authenticated;
grant execute on function public.archive_member(uuid) to authenticated;
grant execute on function public.restore_member(uuid) to authenticated;

create or replace function public.save_plan(
  p_plan_id uuid,
  p_name text,
  p_description text,
  p_price numeric,
  p_duration_days integer,
  p_features jsonb
)
returns public.plans
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.plans%rowtype;
  v_gym_id uuid := public.current_gym_id();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador con MFA puede guardar planes';
  end if;
  if nullif(trim(p_name), '') is null then raise exception 'Nombre obligatorio'; end if;
  if p_price is null or p_price < 0 then raise exception 'Precio no válido'; end if;
  if p_duration_days not between 1 and 730 then raise exception 'Duración no válida'; end if;
  if jsonb_typeof(coalesce(p_features, '[]'::jsonb)) <> 'array' then
    raise exception 'Características no válidas';
  end if;

  if p_plan_id is null then
    insert into public.plans(gym_id, name, description, price, duration_days, features, is_active)
    values (v_gym_id, trim(p_name), nullif(trim(p_description), ''), p_price,
            p_duration_days, coalesce(p_features, '[]'::jsonb), true)
    returning * into v_plan;
    perform public.write_audit_event(v_gym_id, auth.uid(), 'plan.created', 'plan', v_plan.id, '{}');
  else
    update public.plans set
      name = trim(p_name), description = nullif(trim(p_description), ''),
      price = p_price, duration_days = p_duration_days,
      features = coalesce(p_features, '[]'::jsonb)
    where id = p_plan_id and gym_id = v_gym_id and is_active
    returning * into v_plan;
    if v_plan.id is null then raise exception 'Plan no encontrado o archivado'; end if;
    perform public.write_audit_event(v_gym_id, auth.uid(), 'plan.updated', 'plan', v_plan.id, '{}');
  end if;
  return v_plan;
end;
$$;

revoke all on function public.save_plan(uuid, text, text, numeric, integer, jsonb) from public;
grant execute on function public.save_plan(uuid, text, text, numeric, integer, jsonb) to authenticated;

create or replace function public.archive_plan(p_plan_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_gym_id uuid := public.current_gym_id();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador con MFA puede archivar planes';
  end if;
  if not exists (
    select 1 from public.plans p where p.id = p_plan_id and p.gym_id = v_gym_id and p.is_active
  ) then raise exception 'Plan no encontrado'; end if;
  if exists (
    select 1 from public.members m
    where m.plan_id = p_plan_id and m.status <> 'inactive' and m.archived_at is null
  ) then raise exception 'No puedes archivar un plan que todavía tiene miembros asignados'; end if;

  update public.plans set is_active = false where id = p_plan_id and gym_id = v_gym_id;
  perform public.write_audit_event(v_gym_id, auth.uid(), 'plan.archived', 'plan', p_plan_id, '{}');
  return true;
end;
$$;

revoke all on function public.archive_plan(uuid) from public;
grant execute on function public.archive_plan(uuid) to authenticated;

-- Toda escritura financiera sigue pasando por RPC.
revoke insert, update, delete on public.payments from authenticated;
grant select on public.payments to authenticated;

create or replace function public.submit_member_payments(
  p_due_dates date[],
  p_payment_method text,
  p_voucher_path text
)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_plan public.plans%rowtype;
  v_due date;
  v_today date;
  v_anchor date;
  v_expected date;
  v_payment public.payments%rowtype;
  v_count integer := 0;
  v_total numeric := 0;
  v_member_name text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if coalesce(array_length(p_due_dates, 1), 0) < 1 or array_length(p_due_dates, 1) > 24 then
    raise exception 'Selecciona entre 1 y 24 ciclos';
  end if;
  if p_payment_method not in ('transfer', 'deposit') then
    raise exception 'Método de pago no permitido';
  end if;

  select m, pr.full_name into v_member, v_member_name
  from public.members m
  join public.profiles pr on pr.id = m.profile_id
  where m.profile_id = auth.uid() and m.archived_at is null
  limit 1;
  if v_member.id is null then raise exception 'No existe la ficha de miembro'; end if;
  if v_member.status <> 'active' then raise exception 'La membresía no está activa'; end if;

  perform public.assert_voucher_path(v_member.id, p_voucher_path);
  if exists (
    select 1 from public.payments p where p.voucher_url = trim(p_voucher_path)
  ) then raise exception 'Este comprobante ya fue utilizado'; end if;

  select p.* into v_plan from public.plans p
  where p.id = v_member.plan_id and p.gym_id = v_member.gym_id and p.is_active;
  if v_plan.id is null then raise exception 'El miembro no tiene un plan activo'; end if;

  select timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_today from public.gyms g where g.id = v_member.gym_id;

  select coalesce(max(p.due_date), v_member.start_date) into v_anchor
  from public.payments p
  where p.member_id = v_member.id and p.status <> 'rejected';

  v_expected := v_anchor + v_plan.duration_days;
  foreach v_due in array p_due_dates loop
    if v_due <> v_expected then
      raise exception 'Los ciclos deben ser consecutivos. El próximo vencimiento es %', v_expected;
    end if;
    if v_due > v_today + interval '18 months' then
      raise exception 'No se permiten pagos con más de 18 meses de anticipación';
    end if;

    insert into public.payments(
      member_id, amount, payment_method, payment_date, due_date,
      status, voucher_url, notes
    ) values (
      v_member.id, v_plan.price, p_payment_method, v_today, v_due,
      'pending', trim(p_voucher_path), 'Ciclo con vencimiento ' || v_due::text
    ) returning * into v_payment;
    v_count := v_count + 1;
    v_total := v_total + v_plan.price;
    v_expected := v_expected + v_plan.duration_days;
    return next v_payment;
  end loop;

  perform public.notify_gym_admins(
    v_member.gym_id, 'custom', 'Nuevo pago pendiente',
    v_member_name || ' registró ' || v_count ||
      case when v_count = 1 then ' ciclo por ' else ' ciclos por ' end ||
      'Q ' || to_char(v_total, 'FM999999990.00') || '.'
  );
  perform public.write_audit_event(
    v_member.gym_id, auth.uid(), 'payment.submitted', 'member', v_member.id,
    jsonb_build_object('cycles', v_count, 'total', v_total)
  );
end;
$$;

revoke all on function public.submit_member_payments(date[], text, text) from public;
grant execute on function public.submit_member_payments(date[], text, text) to authenticated;

create or replace function public.attach_payment_voucher(
  p_payment_id uuid,
  p_voucher_path text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_member public.members%rowtype;
  v_today date;
  v_member_name text;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;

  select m, pr.full_name,
         timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_member, v_member_name, v_today
  from public.members m
  join public.profiles pr on pr.id = m.profile_id
  join public.gyms g on g.id = m.gym_id
  where m.profile_id = auth.uid() and m.status = 'active' and m.archived_at is null
  limit 1;
  if v_member.id is null then raise exception 'No existe una membresía activa'; end if;

  perform public.assert_voucher_path(v_member.id, p_voucher_path);
  if exists (
    select 1 from public.payments p
    where p.voucher_url = trim(p_voucher_path) and p.id <> p_payment_id
  ) then raise exception 'Este comprobante ya fue utilizado'; end if;

  update public.payments p set
    voucher_url = trim(p_voucher_path),
    payment_date = coalesce(p.payment_date, v_today),
    status = 'pending'
  where p.id = p_payment_id and p.member_id = v_member.id and p.status = 'pending'
  returning p.* into v_payment;
  if v_payment.id is null then raise exception 'Pago no encontrado o no modificable'; end if;

  perform public.notify_gym_admins(
    v_member.gym_id, 'custom', 'Nuevo comprobante',
    v_member_name || ' envió un comprobante por Q ' ||
      to_char(v_payment.amount, 'FM999999990.00') || '.'
  );
  perform public.write_audit_event(
    v_member.gym_id, auth.uid(), 'payment.voucher_attached', 'payment', v_payment.id, '{}'
  );
  return v_payment;
end;
$$;

revoke all on function public.attach_payment_voucher(uuid, text) from public;
grant execute on function public.attach_payment_voucher(uuid, text) to authenticated;

create or replace function public.review_payment(p_payment_id uuid, p_status text)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_profile_id uuid;
  v_voucher text;
  v_reviewed_count bigint;
  v_reviewed_total numeric;
  v_today date;
  v_gym_id uuid := public.current_gym_id();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador con MFA puede revisar pagos';
  end if;
  if p_status not in ('approved', 'rejected') then raise exception 'Estado de revisión inválido'; end if;

  select timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_today from public.gyms g where g.id = v_gym_id;

  select p.* into v_payment
  from public.payments p
  join public.members m on m.id = p.member_id
  where p.id = p_payment_id and m.gym_id = v_gym_id and p.status = 'pending'
  for update of p;
  if v_payment.id is null then raise exception 'Pago no encontrado o ya revisado'; end if;

  v_voucher := v_payment.voucher_url;
  with reviewed as (
    update public.payments p set
      status = p_status,
      approved_by = case when p_status = 'approved' then auth.uid() else null end,
      approved_at = case when p_status = 'approved' then now() else null end,
      payment_date = case when p_status = 'approved' then coalesce(p.payment_date, v_today) else p.payment_date end
    where p.member_id = v_payment.member_id and p.status = 'pending'
      and ((v_voucher is not null and p.voucher_url = v_voucher) or (v_voucher is null and p.id = v_payment.id))
    returning p.amount
  )
  select count(*), coalesce(sum(amount), 0)
  into v_reviewed_count, v_reviewed_total from reviewed;
  if v_reviewed_count = 0 then raise exception 'El pago ya fue revisado'; end if;

  select p.* into v_payment from public.payments p where p.id = p_payment_id;
  select m.profile_id into v_profile_id from public.members m where m.id = v_payment.member_id;

  insert into public.notifications(profile_id, type, title, message, is_read)
  values (
    v_profile_id,
    case when p_status = 'approved' then 'payment_approved' else 'payment_rejected' end,
    case when p_status = 'approved' then 'Pago aprobado ✅' else 'Pago rechazado' end,
    case when p_status = 'approved'
      then case when v_reviewed_count = 1
        then 'Tu pago de Q ' || to_char(v_reviewed_total, 'FM999999990.00') || ' fue aprobado.'
        else 'Tus ' || v_reviewed_count || ' cuotas por Q ' || to_char(v_reviewed_total, 'FM999999990.00') || ' fueron aprobadas.' end
      else case when v_reviewed_count = 1
        then 'Tu pago de Q ' || to_char(v_reviewed_total, 'FM999999990.00') || ' fue rechazado. Consulta con recepción.'
        else 'Tus ' || v_reviewed_count || ' cuotas por Q ' || to_char(v_reviewed_total, 'FM999999990.00') || ' fueron rechazadas. Consulta con recepción.' end
    end,
    false
  );

  perform public.write_audit_event(
    v_gym_id, auth.uid(), 'payment.' || p_status, 'payment', p_payment_id,
    jsonb_build_object('cycles', v_reviewed_count, 'total', v_reviewed_total)
  );
  return v_payment;
end;
$$;

revoke all on function public.review_payment(uuid, text) from public;
grant execute on function public.review_payment(uuid, text) to authenticated;

create or replace function public.register_admin_payment(
  p_member_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_payment_date date,
  p_notes text
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_plan public.plans%rowtype;
  v_payment public.payments%rowtype;
  v_anchor date;
  v_due date;
  v_today date;
  v_gym_id uuid := public.current_gym_id();
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo un administrador con MFA puede registrar pagos';
  end if;
  if p_amount is null or p_amount < 0 then raise exception 'Monto inválido'; end if;
  if p_payment_method not in ('cash', 'transfer', 'deposit') then raise exception 'Método de pago inválido'; end if;

  select m.* into v_member from public.members m
  where m.id = p_member_id and m.gym_id = v_gym_id and m.archived_at is null;
  if v_member.id is null then raise exception 'Miembro no encontrado'; end if;
  if v_member.status <> 'active' then raise exception 'La membresía no está activa'; end if;
  if exists (select 1 from public.payments p where p.member_id = v_member.id and p.status = 'pending') then
    raise exception 'Este miembro tiene un pago pendiente de revisión';
  end if;

  select p.* into v_plan from public.plans p
  where p.id = v_member.plan_id and p.gym_id = v_member.gym_id and p.is_active;
  if v_plan.id is null or v_plan.duration_days not between 1 and 730 then
    raise exception 'El miembro no tiene un plan válido y activo';
  end if;

  select timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date
  into v_today from public.gyms g where g.id = v_member.gym_id;
  if p_payment_date is not null and p_payment_date > v_today then raise exception 'La fecha de pago no puede estar en el futuro'; end if;

  select coalesce(max(p.due_date), v_member.start_date) into v_anchor
  from public.payments p where p.member_id = v_member.id and p.status <> 'rejected';
  v_due := v_anchor + v_plan.duration_days;

  insert into public.payments(
    member_id, amount, payment_date, due_date, payment_method,
    status, notes, approved_by, approved_at
  ) values (
    v_member.id, p_amount, coalesce(p_payment_date, v_today), v_due, p_payment_method,
    'approved', nullif(trim(p_notes), ''), auth.uid(), now()
  ) returning * into v_payment;

  insert into public.notifications(profile_id, type, title, message, is_read)
  values (
    v_member.profile_id, 'payment_approved', 'Pago registrado ✅',
    'Recepción registró tu pago de Q ' || to_char(v_payment.amount, 'FM999999990.00') ||
      '. Tu nuevo vencimiento es ' || to_char(v_due, 'DD/MM/YYYY') || '.', false
  );
  perform public.write_audit_event(
    v_gym_id, auth.uid(), 'payment.cash_registered', 'payment', v_payment.id,
    jsonb_build_object('amount', p_amount, 'method', p_payment_method)
  );
  return v_payment;
end;
$$;

revoke all on function public.register_admin_payment(uuid, numeric, text, date, text) from public;
grant execute on function public.register_admin_payment(uuid, numeric, text, date, text) to authenticated;

-- El check-in solo acepta tokens no vencidos y pagos aprobados.
create or replace function public.register_checkin(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_member public.members%rowtype;
  v_gym public.gyms%rowtype;
  v_today date;
  v_check date;
  v_due date;
  v_plan_days integer;
  v_streak integer := 0;
  v_inserted boolean := false;
  v_row_count integer := 0;
  v_rest boolean;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if nullif(trim(p_code), '') is null or char_length(p_code) > 128 then
    raise exception 'Código de check-in inválido';
  end if;

  select m.* into v_member from public.members m
  where m.profile_id = auth.uid() and m.archived_at is null limit 1;
  if v_member.id is null then raise exception 'No existe la ficha de miembro'; end if;
  if v_member.status <> 'active' then raise exception 'La membresía no está activa'; end if;

  select g.* into v_gym from public.gyms g where g.id = v_member.gym_id;
  if v_gym.id is null then raise exception 'Gimnasio no encontrado'; end if;
  if not exists (
    select 1 from public.checkin_tokens t
    where t.gym_id = v_member.gym_id
      and t.token_hash = encode(digest(trim(p_code), 'sha256'), 'hex')
      and t.expires_at >= now()
  ) then raise exception 'Código de check-in inválido o vencido'; end if;

  v_today := timezone(coalesce(nullif(v_gym.timezone, ''), 'America/Guatemala'), now())::date;

  if not coalesce(v_gym.allow_overdue_checkin, true) then
    select p.duration_days into v_plan_days from public.plans p
    where p.id = v_member.plan_id and p.gym_id = v_member.gym_id and p.is_active;
    if v_plan_days is null then raise exception 'No tienes un plan activo'; end if;

    select coalesce(max(p.due_date), v_member.start_date + v_plan_days) into v_due
    from public.payments p
    where p.member_id = v_member.id and p.status = 'approved';
    if v_due < v_today then raise exception 'Cuota vencida. Regulariza tu pago en recepción'; end if;
  end if;

  insert into public.attendance(member_id, attended_date)
  values (v_member.id, v_today)
  on conflict (member_id, attended_date) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_row_count > 0;

  v_check := v_today;
  for i in 0..365 loop
    if exists (
      select 1 from public.attendance a
      where a.member_id = v_member.id and a.attended_date = v_check
    ) then v_streak := v_streak + 1;
    else
      v_rest := extract(dow from v_check)::integer = any(coalesce(v_gym.closed_weekdays, array[0,6]))
        or exists (
          select 1 from jsonb_array_elements(coalesce(v_gym.holidays, '[]'::jsonb)) h
          where case when jsonb_typeof(h) = 'object' then h ->> 'date'
            else trim(both '"' from h::text) end = v_check::text
        );
      if not v_rest then exit; end if;
    end if;
    v_check := v_check - 1;
  end loop;

  update public.members set best_streak = greatest(coalesce(best_streak, 0), v_streak)
  where id = v_member.id;
  if v_inserted then
    perform public.write_audit_event(
      v_member.gym_id, auth.uid(), 'attendance.checked_in', 'member', v_member.id,
      jsonb_build_object('date', v_today)
    );
  end if;

  return jsonb_build_object(
    'already', not v_inserted, 'streak', v_streak,
    'attended_date', v_today, 'gym_name', v_gym.name
  );
end;
$$;

revoke all on function public.register_checkin(text) from public;
grant execute on function public.register_checkin(text) to authenticated;

-- Los usuarios solo pueden marcar sus notificaciones como leídas.
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Fotos privadas: el miembro solo borra subidas huérfanas, no registros activos.
drop policy if exists progress_update_scoped on storage.objects;
drop policy if exists progress_delete_scoped on storage.objects;
create policy progress_delete_scoped on storage.objects
  for delete to authenticated using (
    bucket_id = 'progress' and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and (
          (public.is_admin() and m.gym_id = public.current_gym_id())
          or (
            m.profile_id = auth.uid()
            and not exists (
              select 1 from public.progress_photos ph where ph.photo_url = name
            )
          )
        )
    )
  );

-- Validar en servidor que cada foto corporal existe y pertenece al miembro.
create or replace function public.validate_progress_photo()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_metadata jsonb;
begin
  if split_part(trim(new.photo_url), '/', 1) <> new.member_id::text then
    raise exception 'La foto no pertenece al miembro';
  end if;
  select o.metadata into v_metadata from storage.objects o
  where o.bucket_id = 'progress' and o.name = trim(new.photo_url);
  if v_metadata is null then raise exception 'El archivo de progreso no existe'; end if;
  if coalesce(v_metadata ->> 'mimetype', '') not in ('image/jpeg','image/png','image/webp') then
    raise exception 'Tipo de foto no permitido';
  end if;
  if coalesce((v_metadata ->> 'size')::bigint, 0) > 5242880 then
    raise exception 'La foto supera 5 MB';
  end if;
  if (select count(*) from public.progress_photos p where p.member_id = new.member_id) >= 200 then
    raise exception 'Se alcanzó el límite de 200 fotos de progreso';
  end if;
  return new;
end;
$$;

drop trigger if exists progress_photos_validate_file on public.progress_photos;
create trigger progress_photos_validate_file
  before insert or update of photo_url, member_id on public.progress_photos
  for each row execute function public.validate_progress_photo();
revoke all on function public.validate_progress_photo() from public;

-- Alertas de vencimiento idempotentes. Se ejecutan cada hora para respetar
-- la zona horaria configurada, pero cada vencimiento genera una sola alerta.
create or replace function public.generate_payment_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_type text;
  v_title text;
  v_message text;
  v_inserted integer := 0;
begin
  for v_row in
    select
      m.id as member_id,
      m.profile_id,
      g.id as gym_id,
      timezone(coalesce(nullif(g.timezone, ''), 'America/Guatemala'), now())::date as today,
      coalesce(
        (select max(pay.due_date) from public.payments pay
         where pay.member_id = m.id and pay.status = 'approved'),
        m.start_date + p.duration_days
      ) as due_date
    from public.members m
    join public.plans p on p.id = m.plan_id and p.gym_id = m.gym_id and p.is_active
    join public.gyms g on g.id = m.gym_id
    where m.status = 'active' and m.archived_at is null
  loop
    v_type := null;
    if v_row.due_date < v_row.today then
      v_type := 'payment_overdue';
      v_title := 'Cuota vencida';
      v_message := 'Tu cuota venció el ' || to_char(v_row.due_date, 'DD/MM/YYYY') || '. Consulta con recepción.';
    elsif v_row.due_date between v_row.today and v_row.today + 5 then
      v_type := 'payment_due';
      v_title := 'Cuota próxima a vencer';
      v_message := 'Tu cuota vence el ' || to_char(v_row.due_date, 'DD/MM/YYYY') || '.';
    end if;

    if v_type is not null and not exists (
      select 1 from public.notifications n
      where n.profile_id = v_row.profile_id and n.type = v_type and n.message = v_message
    ) then
      insert into public.notifications(profile_id, type, title, message, is_read)
      values (v_row.profile_id, v_type, v_title, v_message, false);
      v_inserted := v_inserted + 1;
    end if;
  end loop;
  return v_inserted;
end;
$$;

revoke all on function public.generate_payment_notifications() from public, anon, authenticated;
grant execute on function public.generate_payment_notifications() to service_role;

do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
    if exists (select 1 from cron.job where jobname = 'control-gym-payment-notifications') then
      perform cron.unschedule('control-gym-payment-notifications');
    end if;
    perform cron.schedule(
      'control-gym-payment-notifications',
      '15 * * * *',
      'select public.generate_payment_notifications();'
    );
  exception when others then
    raise notice 'No se pudo configurar pg_cron automáticamente: %', sqlerrm;
  end;
end;
$$;

commit;
