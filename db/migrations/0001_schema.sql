-- Migración 0001: esquema del sistema de taquizas de D' Garden Tacos.
-- Postgres 15+ (Supabase, Neon o local). Generado por /replica-architect a partir de
-- replica/recon.md y ajustado en /replica-backend. Se aplica con `npm run db:migrate`.
--
-- Reglas:
--   * Todas las horas son timestamptz (UTC). La fecha local del evento (event_date) la
--     calcula el servidor con la zona horaria del negocio (America/Mexico_City).
--   * Dinero en centavos (integer) más una columna de moneda (MXN).
--   * Acceso: RLS activado en todas las tablas y SIN políticas. Un rol sin BYPASSRLS (como
--     `anon` en Supabase) no ve ninguna fila aunque tenga permisos de tabla. Todo pasa por el
--     servidor de Next.js, que se conecta con el rol dueño de las tablas y revisa permisos en
--     cada consulta (ver "Acceso" en architecture.md).
--   * Usuarios del panel: tabla propia (admin_users) con enlace mágico de un solo uso; no se
--     usa Supabase Auth ni el esquema auth.
--   * Nombres en inglés en el código. Equivalencias con el recon: Negocio = businesses,
--     Taquiza = bookings, Paquete = packages, Complemento = addons, Zona = service_zones,
--     Cliente = customers, Pago = payments, EventoHistorial = booking_events,
--     Mensaje = messages, Resena = reviews, UsuarioAdmin = admin_users,
--     ReglaDisponibilidad = availability_rules, FechaBloqueada = blocked_dates.

create extension if not exists pgcrypto;

create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Negocio y usuarios del panel
-- ---------------------------------------------------------------------------

create table businesses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null default '',
  whatsapp_e164 text check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  city text not null,
  timezone text not null default 'America/Mexico_City',
  currency char(3) not null default 'MXN',
  booking_code_prefix text not null default 'DGT' check (booking_code_prefix ~ '^[A-Z]{2,5}$'),
  photo_paths text[] not null default '{}',
  -- Anticipo: none = no se cobra, optional = el cliente elige, required = sin anticipo no se confirma
  deposit_mode text not null default 'optional' check (deposit_mode in ('none', 'optional', 'required')),
  deposit_type text not null default 'percent' check (deposit_type in ('percent', 'fixed')),
  deposit_value integer not null default 30 check (deposit_value >= 0), -- porcentaje 0-100, o centavos si es fijo
  confirmation_mode text not null default 'manual' check (confirmation_mode in ('auto', 'manual')),
  request_hold_hours integer not null default 24 check (request_hold_hours > 0),     -- cuánto aparta una solicitud sin pago
  payment_hold_minutes integer not null default 30 check (payment_hold_minutes > 0), -- cuánto aparta un pago en curso
  proposal_hold_hours integer not null default 48 check (proposal_hold_hours > 0),   -- cuánto aparta una fecha propuesta
  cancellation_policy text not null default '',
  refund_cutoff_days integer not null default 7 check (refund_cutoff_days >= 0),
  min_notice_days integer not null default 3 check (min_notice_days >= 0),
  max_advance_days integer not null default 180 check (max_advance_days > 0),
  teams integer not null default 1 check (teams between 1 and 10), -- equipos que pueden servir al mismo tiempo
  whatsapp_templates jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_percent_range check (deposit_type <> 'percent' or deposit_value <= 100),
  constraint advance_window check (max_advance_days > min_notice_days)
);

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+$'),
  role text not null default 'owner' check (role in ('owner', 'helper')),
  session_version integer not null default 1 check (session_version > 0), -- subirla cierra todas sus sesiones
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index admin_users_email on admin_users (email);
create index admin_users_business on admin_users (business_id);

-- ---------------------------------------------------------------------------
-- Disponibilidad
-- ---------------------------------------------------------------------------

create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  is_open boolean not null default true,
  first_start time not null default '12:00',
  last_start time not null default '20:00',
  slot_interval_min integer not null default 30 check (slot_interval_min in (15, 30, 60)),
  event_duration_min integer not null default 240 check (event_duration_min > 0),
  travel_buffer_min integer not null default 60 check (travel_buffer_min >= 0), -- traslado y montaje después de cada taquiza
  max_bookings_per_day integer not null default 2 check (max_bookings_per_day >= 0),
  max_guests_per_day integer check (max_guests_per_day > 0), -- null = sin límite
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, weekday),
  constraint start_window check (last_start >= first_start)
);

create table blocked_dates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  date date not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, date)
);

-- ---------------------------------------------------------------------------
-- Catálogo: paquetes, complementos, zonas
-- ---------------------------------------------------------------------------

create table packages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  description text not null default '',
  photo_path text,
  price_per_guest_cents integer not null check (price_per_guest_cents >= 0),
  currency char(3) not null default 'MXN',
  min_guests integer not null default 1 check (min_guests >= 1),
  max_guests integer,
  includes jsonb not null default '[]',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guest_range check (max_guests is null or max_guests >= min_guests)
);
create index packages_business_active_order on packages (business_id, is_active, sort_order);

create table addons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  currency char(3) not null default 'MXN',
  unit text not null default 'flat' check (unit in ('per_guest', 'flat')),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addons_business_active_order on addons (business_id, is_active, sort_order);

create table service_zones (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  travel_fee_cents integer not null default 0 check (travel_fee_cents >= 0),
  currency char(3) not null default 'MXN',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);
create index service_zones_business_active_order on service_zones (business_id, is_active, sort_order);

-- ---------------------------------------------------------------------------
-- Clientes y taquizas
-- ---------------------------------------------------------------------------

create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  whatsapp_e164 text check (whatsapp_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  notes text not null default '',
  anonymized_at timestamptz, -- el cliente pidió borrar sus datos: se quitan, se conservan los pagos
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, whatsapp_e164),
  constraint contact_unless_anonymized check (anonymized_at is not null or whatsapp_e164 is not null)
);
create index customers_business_name on customers (business_id, name);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z]{2,5}-[A-Z0-9]{4,8}$'), -- visible, no secreto
  manage_token_hash text not null check (manage_token_hash ~ '^[0-9a-f]{64}$'), -- sha256 (hex) del token; el token no se guarda
  manage_token_version smallint not null default 1 check (manage_token_version > 0),
                                          -- token = HMAC(APP_SECRET, id:versión); regenerar = versión + 1
  idempotency_key uuid unique,            -- evita duplicados por doble clic o reintento
  customer_id uuid not null references customers(id) on delete restrict,
  package_id uuid not null references packages(id) on delete restrict,
  zone_id uuid references service_zones(id) on delete set null,
  event_date date not null,               -- día del evento en la zona horaria del negocio
  start_at timestamptz not null,
  end_at timestamptz not null,
  travel_buffer_min integer not null default 0 check (travel_buffer_min >= 0),
  guests integer not null check (guests > 0),
  address text not null,
  neighborhood text not null default '',
  address_notes text not null default '',
  maps_url text,
  event_type text not null default '',
  customer_notes text not null default '',
  internal_notes text not null default '',
  currency char(3) not null default 'MXN',
  price_per_guest_cents integer not null check (price_per_guest_cents >= 0), -- copia del precio al agendar
  subtotal_cents integer not null check (subtotal_cents >= 0),
  travel_fee_cents integer not null default 0 check (travel_fee_cents >= 0),
  addons_cents integer not null default 0 check (addons_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  deposit_cents integer not null default 0 check (deposit_cents >= 0),
  status text not null default 'requested' check (status in (
    'requested',              -- solicitada, sin pago; espera que el negocio acepte
    'awaiting_payment',       -- el cliente está pagando el anticipo
    'confirmed',              -- confirmada
    'proposed',               -- el negocio propuso otra fecha; espera respuesta del cliente
    'declined',               -- rechazada por el negocio
    'cancelled_by_customer',
    'cancelled_by_business',
    'completed',
    'no_show',                -- no se realizó
    'expired'                 -- la solicitud o la propuesta venció sin respuesta
  )),
  hold_expires_at timestamptz,            -- hasta cuándo aparta lugar una solicitud o un pago en curso
  proposed_start_at timestamptz,
  proposed_end_at timestamptz,
  proposed_event_date date,
  proposal_expires_at timestamptz,
  source text not null default 'web' check (source in ('web', 'manual')),
  capacity_override boolean not null default false, -- el dueño forzó la fecha aunque estaba llena
  needs_attention boolean not null default false,   -- ej. pago aprobado después de perder el lugar
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint end_after_start check (end_at > start_at),
  constraint total_adds_up check (total_cents = subtotal_cents + travel_fee_cents + addons_cents),
  constraint deposit_within_total check (deposit_cents <= total_cents),
  constraint hold_when_pending check (
    status not in ('requested', 'awaiting_payment') or hold_expires_at is not null
  ),
  constraint proposal_complete check (
    status <> 'proposed' or (
      proposed_start_at is not null and proposed_end_at is not null
      and proposed_event_date is not null and proposal_expires_at is not null
    )
  ),
  constraint proposal_order check (proposed_end_at is null or proposed_end_at > proposed_start_at)
);
create index bookings_business_date on bookings (business_id, event_date);
create index bookings_business_status_date on bookings (business_id, status, event_date);
create index bookings_business_proposed_date on bookings (business_id, proposed_event_date)
  where status = 'proposed';
create index bookings_business_attention on bookings (business_id) where needs_attention;
create index bookings_customer on bookings (customer_id);
create index bookings_package on bookings (package_id);
create index bookings_zone on bookings (zone_id);

create table booking_addons (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  addon_id uuid not null references addons(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit text not null check (unit in ('per_guest', 'flat')),
  unit_price_cents integer not null check (unit_price_cents >= 0), -- copia del precio al agendar
  currency char(3) not null default 'MXN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, addon_id)
);
create index booking_addons_addon on booking_addons (addon_id);
create index booking_addons_business on booking_addons (business_id);

-- ---------------------------------------------------------------------------
-- Pagos y webhooks
-- ---------------------------------------------------------------------------

create table payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete restrict, -- no se borran taquizas con pagos
  kind text not null check (kind in ('deposit', 'balance', 'refund')),
  method text not null check (method in ('card', 'mp_wallet', 'oxxo', 'spei', 'cash', 'transfer')),
  provider text not null check (provider in ('mercadopago', 'stripe', 'manual')),
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null default 'MXN',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  checkout_ref text,      -- id de la preferencia de Mercado Pago o de la sesión de Stripe
  provider_ref text,      -- id del pago en el proveedor
  refund_of uuid references payments(id) on delete restrict,
  recorded_by uuid references admin_users(id) on delete set null, -- quién registró un pago manual
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref),
  constraint manual_is_offline check (provider <> 'manual' or method in ('cash', 'transfer')),
  constraint refund_points_back check ((kind = 'refund') = (refund_of is not null))
);
create index payments_booking on payments (booking_id);
create index payments_business_created on payments (business_id, created_at);
create index payments_checkout_ref on payments (checkout_ref);
create index payments_refund_of on payments (refund_of);
create index payments_recorded_by on payments (recorded_by);

-- Sin business_id: al llegar no se sabe todavía de qué negocio es. Solo lo lee el servidor.
create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('mercadopago', 'stripe', 'whatsapp')),
  event_id text not null,
  topic text not null default '',
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, event_id)
);
create index webhook_events_unprocessed on webhook_events (created_at) where processed_at is null;

-- ---------------------------------------------------------------------------
-- Historial, mensajes y reseñas
-- ---------------------------------------------------------------------------

create table booking_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  type text not null check (type in (
    'created', 'accepted', 'declined', 'proposed', 'proposal_accepted', 'proposal_rejected',
    'rescheduled', 'cancelled', 'payment', 'refund', 'message', 'completed', 'no_show',
    'expired', 'note'
  )),
  actor text not null check (actor in ('customer', 'business', 'system')),
  actor_user_id uuid references admin_users(id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booking_events_booking_created on booking_events (booking_id, created_at);
create index booking_events_business on booking_events (business_id);
create index booking_events_actor_user on booking_events (actor_user_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  booking_id uuid not null references bookings(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'email')),
  template text not null check (template in (
    'request_received', 'new_request_owner', 'confirmed', 'declined', 'proposal',
    'reminder', 'cancelled', 'review_request', 'payment_link'
  )),
  mode text not null check (mode in ('link', 'api')), -- link = wa.me abierto a mano; api = envío automático
  status text not null default 'prepared' check (status in ('prepared', 'sent', 'delivered', 'failed')),
  recipient text not null,
  provider_ref text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index messages_booking on messages (booking_id);
create index messages_business_created on messages (business_id, created_at);
-- Un solo recordatorio automático por taquiza, aunque el job corra dos veces.
create unique index messages_one_auto_reminder on messages (booking_id)
  where template = 'reminder' and mode = 'api';

create table reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  booking_id uuid not null unique references bookings(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  is_published boolean not null default false, -- el dueño la revisa antes de publicarla
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_business_published on reviews (business_id, is_published, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at automático y RLS sin políticas
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'businesses', 'admin_users', 'availability_rules', 'blocked_dates', 'packages', 'addons',
    'service_zones', 'customers', 'bookings', 'booking_addons', 'payments', 'webhook_events',
    'booking_events', 'messages', 'reviews'
  ] loop
    execute format('create trigger %I before update on %I for each row execute function set_updated_at()',
                   t || '_updated_at', t);
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Capacidad: la regla que impide agendar dos veces el mismo hueco
-- ---------------------------------------------------------------------------
--
-- Uso, siempre dentro de UNA transacción:
--   select lock_business_day(:business_id, :event_date);   -- si son dos días (cambio de fecha), en orden
--   select capacity_conflict(:business_id, :event_date, :start_at, :end_at, :guests, :buffer, :booking_id);
--   -- null = cabe -> insert/update de la taquiza -> commit
--
-- El candado serializa a todos los que agendan el mismo día del mismo negocio, así que dos
-- clientes no pueden tomar el último lugar a la vez. No es una restricción de exclusión
-- porque los apartados vencen con el tiempo (now()) y porque puede haber varios equipos.

create or replace function lock_business_day(p_business_id uuid, p_day date) returns void
language sql volatile as $$
  select pg_advisory_xact_lock(hashtextextended(p_business_id::text || ':' || p_day::text, 0));
$$;

create or replace function capacity_conflict(
  p_business_id uuid,
  p_event_date date,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_guests integer,
  p_travel_buffer_min integer,
  p_exclude_booking_id uuid default null
) returns text
language plpgsql stable as $$
declare
  b businesses;
  r availability_rules;
  local_today date;
  local_start time;
  n_bookings integer;
  n_guests integer;
  n_overlap integer;
begin
  select * into b from businesses where id = p_business_id;
  if not found then
    return 'business_not_found';
  end if;

  if (p_start_at at time zone b.timezone)::date <> p_event_date then
    return 'date_mismatch';
  end if;

  local_today := (now() at time zone b.timezone)::date;
  if p_event_date < local_today + b.min_notice_days then
    return 'too_soon';
  end if;
  if p_event_date > local_today + b.max_advance_days then
    return 'too_far';
  end if;

  if exists (select 1 from blocked_dates where business_id = p_business_id and date = p_event_date) then
    return 'blocked_date';
  end if;

  select * into r from availability_rules
   where business_id = p_business_id and weekday = extract(dow from p_event_date)::smallint;
  if not found or not r.is_open then
    return 'closed_day';
  end if;

  local_start := (p_start_at at time zone b.timezone)::time;
  if local_start < r.first_start or local_start > r.last_start then
    return 'outside_hours';
  end if;

  -- Taquizas que ocupan lugar ese día: confirmadas, solicitudes y pagos con apartado vigente,
  -- y propuestas vigentes (por su fecha propuesta, no la original).
  with active as (
    select case when bk.status = 'proposed' then bk.proposed_start_at else bk.start_at end as s,
           case when bk.status = 'proposed' then bk.proposed_end_at else bk.end_at end as e,
           bk.guests,
           bk.travel_buffer_min
      from bookings bk
     where bk.business_id = p_business_id
       and (p_exclude_booking_id is null or bk.id <> p_exclude_booking_id)
       and (
            (bk.status = 'confirmed' and bk.event_date = p_event_date)
         or (bk.status in ('requested', 'awaiting_payment')
             and bk.hold_expires_at > now() and bk.event_date = p_event_date)
         or (bk.status = 'proposed'
             and bk.proposal_expires_at > now() and bk.proposed_event_date = p_event_date)
       )
  ),
  -- Cada taquiza ocupa [inicio, fin + traslado). Las que se enciman con la nueva:
  overlapping as (
    select s, e + make_interval(mins => travel_buffer_min) as busy_until
      from active
     where tstzrange(s, e + make_interval(mins => travel_buffer_min))
        && tstzrange(p_start_at, p_end_at + make_interval(mins => p_travel_buffer_min))
  ),
  -- El máximo de taquizas simultáneas dentro del horario nuevo ocurre en el inicio de alguna.
  points as (
    select greatest(s, p_start_at) as p from overlapping
    union all
    select p_start_at
  )
  select (select count(*) from active),
         (select coalesce(sum(guests), 0) from active),
         (select coalesce(max((select count(*) from overlapping o
                                where o.s <= points.p and points.p < o.busy_until)), 0)
            from points)
    into n_bookings, n_guests, n_overlap;

  if n_bookings >= r.max_bookings_per_day then
    return 'day_full';
  end if;
  if r.max_guests_per_day is not null and n_guests + p_guests > r.max_guests_per_day then
    return 'guests_full';
  end if;
  if n_overlap >= b.teams then
    return 'time_taken';
  end if;
  return null;
end $$;
