create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null unique,
    password_hash text not null,
    is_verified boolean not null default false,
    otp text,
    otp_expires_at timestamptz,
    created_at timestamptz not null default now()
);

create table if not exists public.resume_versions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    job_description text not null default '',
    file_name text not null default 'Resume',
    version_number integer not null check (version_number > 0),
    analysis_result jsonb not null,
    created_at timestamptz not null default now(),
    unique (user_id, version_number)
);

create index if not exists resume_versions_user_created_idx
on public.resume_versions (user_id, created_at desc);

alter table public.users enable row level security;
alter table public.resume_versions enable row level security;

-- The backend uses the Supabase service-role key, which bypasses RLS.
-- No public client policies are intentionally created.
