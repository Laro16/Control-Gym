-- SOLO PARA UNA INSTALACIÓN NUEVA.
-- 1) Crea primero el usuario administrador en Supabase > Authentication > Users.
-- 2) Sustituye los tres valores CAMBIAR_*.
-- 3) Ejecuta este archivo una sola vez en SQL Editor.

do $$
declare
  v_admin_email text := lower('CAMBIAR_EMAIL_ADMIN');
  v_admin_name text := 'CAMBIAR_NOMBRE_ADMIN';
  v_gym_name text := 'CAMBIAR_NOMBRE_GIMNASIO';
  v_admin_id uuid;
  v_gym_id uuid;
begin
  if v_admin_email like 'cambiar_%' or v_admin_name like 'CAMBIAR_%' or v_gym_name like 'CAMBIAR_%' then
    raise exception 'Sustituye CAMBIAR_EMAIL_ADMIN, CAMBIAR_NOMBRE_ADMIN y CAMBIAR_NOMBRE_GIMNASIO';
  end if;

  select u.id into v_admin_id from auth.users u
  where lower(u.email) = v_admin_email
  limit 1;
  if v_admin_id is null then
    raise exception 'No existe un usuario Auth con el email %', v_admin_email;
  end if;

  if (select count(*) from public.gyms) > 1 then
    raise exception 'Esta distribución está configurada para un solo gimnasio';
  end if;

  select id into v_gym_id from public.gyms limit 1;
  if v_gym_id is null then
    insert into public.gyms(name, timezone)
    values (trim(v_gym_name), 'America/Guatemala')
    returning id into v_gym_id;
  end if;

  insert into public.profiles(
    id, role, full_name, email, gym_id, must_change_password
  ) values (
    v_admin_id, 'admin', trim(v_admin_name), v_admin_email, v_gym_id, false
  )
  on conflict (id) do update set
    role = 'admin', full_name = excluded.full_name, email = excluded.email,
    gym_id = excluded.gym_id, must_change_password = false;

  raise notice 'Gimnasio % configurado con admin %', v_gym_id, v_admin_id;
end;
$$;
