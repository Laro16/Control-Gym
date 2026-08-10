-- Control Gym: esquema inicial reproducible para una instalación nueva.
-- En una base existente NO ejecutes este archivo manualmente; usa
-- 20260808_single_gym_hardening.sql según PASOS_PARA_SUBIR.md.

begin;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 160),
  logo_url text,
  primary_color text not null default '#F97316'
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  whatsapp_number text,
  address text,
  created_at timestamptz not null default now(),
  checkin_code text,
  closed_weekdays integer[] not null default array[0,6],
  holidays jsonb not null default '[]'::jsonb,
  timezone text not null default 'America/Guatemala',
  allow_overdue_checkin boolean not null default true
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role text not null default 'user' check (role in ('admin','user')),
  full_name text not null check (char_length(trim(full_name)) between 1 and 160),
  email text not null,
  phone text,
  birth_date date,
  avatar_url text,
  gym_id uuid references public.gyms(id) on delete restrict,
  created_at timestamptz not null default now(),
  gender text not null default 'male' check (gender in ('male','female','other')),
  dpi text check (dpi is null or dpi ~ '^\d{13}$'),
  must_change_password boolean not null default false
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  price numeric(12,2) not null,
  duration_days integer not null default 30,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint plans_duration_valid check (duration_days between 1 and 730),
  constraint plans_price_valid check (price >= 0),
  constraint plans_id_gym_unique unique (id, gym_id)
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete restrict,
  gym_id uuid not null references public.gyms(id) on delete restrict,
  plan_id uuid,
  start_date date not null,
  status text not null default 'active' check (status in ('active','inactive','suspended')),
  emergency_contact text check (emergency_contact is null or char_length(emergency_contact) <= 250),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  best_streak integer not null default 0 check (best_streak >= 0),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete set null,
  constraint members_plan_same_gym_fkey
    foreign key (plan_id, gym_id) references public.plans(id, gym_id) on delete restrict
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  amount numeric(12,2) not null,
  payment_date date,
  due_date date not null,
  payment_method text not null default 'cash' check (payment_method in ('cash','transfer','deposit')),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  voucher_url text,
  notes text check (notes is null or char_length(notes) <= 2000),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_amount_valid check (amount >= 0)
);

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  measured_at date not null default current_date,
  weight_kg numeric,
  height_cm numeric,
  waist_cm numeric,
  chest_cm numeric,
  hips_cm numeric,
  left_arm_cm numeric,
  right_arm_cm numeric,
  left_leg_cm numeric,
  right_leg_cm numeric,
  body_fat_pct numeric,
  notes text check (notes is null or char_length(notes) <= 2000),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint measurements_weight_valid check (weight_kg is null or weight_kg between 20 and 500),
  constraint measurements_height_valid check (height_cm is null or height_cm between 50 and 260),
  constraint measurements_body_fat_valid check (body_fat_pct is null or body_fat_pct between 1 and 75)
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  photo_url text not null,
  photo_date date not null default current_date,
  angle text not null default 'front' check (angle in ('front','back','side_left','side_right')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  attended_date date not null default current_date,
  created_at timestamptz not null default now(),
  constraint attendance_member_day_unique unique (member_id, attended_date)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'payment_due','payment_overdue','payment_approved','payment_rejected',
    'plan_assigned','measurements_updated','progress_photo','custom'
  )),
  title text not null check (char_length(title) between 1 and 160),
  message text not null check (char_length(message) between 1 and 2000),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 4000),
  emoji text not null default '📢',
  pinned boolean not null default false,
  visible boolean not null default true,
  expires_at date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  gym_id uuid not null references public.gyms(id) on delete restrict
);

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

create unique index if not exists profiles_gym_dpi_uidx
  on public.profiles(gym_id, dpi) where dpi is not null;
create unique index if not exists single_gym_only_uidx on public.gyms ((true));
create index if not exists profiles_gym_idx on public.profiles(gym_id);
create index if not exists members_gym_idx on public.members(gym_id);
create index if not exists members_plan_idx on public.members(plan_id);
create index if not exists payments_member_due_idx on public.payments(member_id, due_date desc);
create unique index if not exists payments_member_due_open_uidx
  on public.payments(member_id, due_date) where status <> 'rejected';
create index if not exists measurements_member_date_idx on public.measurements(member_id, measured_at desc);
create index if not exists progress_photos_member_date_idx on public.progress_photos(member_id, photo_date desc);
create index if not exists notifications_profile_created_idx on public.notifications(profile_id, created_at desc);
create index if not exists audit_events_gym_created_idx on public.audit_events(gym_id, created_at desc);
create index if not exists checkin_tokens_gym_expiry_idx on public.checkin_tokens(gym_id, expires_at desc);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']::text[]),
  ('logos', 'logos', true, 5242880, array['image/jpeg','image/png','image/webp']::text[]),
  ('progress', 'progress', false, 5242880, array['image/jpeg','image/png','image/webp']::text[]),
  ('vouchers', 'vouchers', false, 5242880, array['image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;
