-- Migración 0002: tablas de soporte del backend.
--   login_tokens  enlaces mágicos del panel (un solo uso, se guarda el hash)
--   rate_limits   contadores por ventana de tiempo (inicio de sesión, solicitudes)
--   outbox        correos por mandar, con reintentos y bandeja de "muertos"
--   job_runs      bitácora de cada corrida de un job programado

create table login_tokens (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references admin_users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index login_tokens_admin_created on login_tokens (admin_id, created_at);

create table rate_limits (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (key, window_start)
);
create index rate_limits_window on rate_limits (window_start);

create table outbox (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  kind text not null default 'email' check (kind in ('email')),
  payload jsonb not null,                -- { to, subject, html, text }
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  dead_at timestamptz,                   -- se rindió después de varios intentos (dead letter)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sent_or_dead check (sent_at is null or dead_at is null)
);
create index outbox_due on outbox (next_attempt_at) where sent_at is null and dead_at is null;
create index outbox_business on outbox (business_id);

create table job_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'running' check (status in ('running', 'ok', 'failed')),
  detail jsonb not null default '{}',
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_runs_name_started on job_runs (name, started_at desc);

do $$
declare t text;
begin
  foreach t in array array['login_tokens', 'rate_limits', 'outbox', 'job_runs'] loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
                   t || '_updated_at', t);
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
