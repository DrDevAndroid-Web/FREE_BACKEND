-- ============================================================
-- VersaBold — Esquema Multi-Cliente Supabase
-- Un solo proyecto Supabase. Tablas compartidas con client_id.
-- PLAN FREE no lee de Supabase en runtime (datos en JSON estáticos).
-- Este esquema es para CRM del dueño y base de planes pagos futuros.
-- ============================================================

-- PLANES
create table if not exists public.vb_plans (
  id                          text primary key,
  name                        text not null,
  price_usd                   numeric not null default 0,
  products_limit              integer not null default 15,
  dashboard_enabled           boolean not null default false,
  custom_domain_enabled       boolean not null default false,
  versabold_branding_required boolean not null default true,
  advanced_seo_enabled        boolean not null default false,
  gallery_enabled             boolean not null default true,
  whatsapp_only               boolean not null default true,
  created_at                  timestamptz not null default now()
);

insert into public.vb_plans (id, name, price_usd, products_limit, dashboard_enabled,
  custom_domain_enabled, versabold_branding_required, advanced_seo_enabled, gallery_enabled, whatsapp_only)
values
  ('free',    'PLAN FREE',    0,  15,  false, false, true,  false, true, true),
  ('starter', 'PLAN EMPRENDE', 25, 30,  true,  false, true,  false, true, false),
  ('pro',     'PLAN NEGOCIO',  50, 100, true,  true,  false, true,  true, false)
on conflict (id) do nothing;

-- CLIENTES (un registro por negocio firmado)
create table if not exists public.vb_clients (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null unique,       -- slug corto usado en JSON config
  business_name text not null,
  slug          text not null unique,       -- prefijo del subdominio
  plan_id       text not null references public.vb_plans(id),
  business_type text,
  owner_name    text,
  owner_phone   text,
  owner_email   text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- SITIOS (metadata de despliegue por cliente)
create table if not exists public.vb_sites (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.vb_clients(id) on delete cascade,
  subdomain        text not null unique,
  custom_domain    text,
  hostinger_path   text,
  ssl_enabled      boolean not null default true,
  status           text not null default 'draft'
                   check (status in ('draft', 'live', 'suspended')),
  last_deployed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- CATEGORÍAS
create table if not exists public.vb_categories (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.vb_clients(id) on delete cascade,
  name        text not null,
  slug        text not null,
  image_url   text,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (client_id, slug)
);

-- PRODUCTOS (máx 15 para FREE — verificado por el backend, no por la DB)
create table if not exists public.vb_products (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.vb_clients(id) on delete cascade,
  category_id       uuid references public.vb_categories(id) on delete set null,
  name              text not null,
  description       text,
  price             numeric not null default 0,
  image_url         text,
  available         boolean not null default true,
  featured          boolean not null default false,
  whatsapp_message  text,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists vb_products_client_available_idx
  on public.vb_products(client_id, available);

-- GALERÍA
create table if not exists public.vb_gallery_images (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.vb_clients(id) on delete cascade,
  url         text not null,
  alt_text    text,
  caption     text,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- CANALES DE CONTACTO
create table if not exists public.vb_contact_channels (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.vb_clients(id) on delete cascade,
  type        text not null
              check (type in ('whatsapp','email','facebook','instagram','tiktok','phone')),
  value       text not null,
  label       text,
  is_primary  boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- HORARIOS
create table if not exists public.vb_business_hours (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.vb_clients(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6), -- 0=Domingo
  opens_at     time,
  closes_at    time,
  is_closed    boolean not null default false,
  label        text,
  unique (client_id, day_of_week)
);

-- SECCIONES ACTIVAS (reemplaza active_sections del JSON en planes futuros con dashboard)
create table if not exists public.vb_site_sections (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.vb_clients(id) on delete cascade,
  section_key      text not null,
  sort_order       integer not null default 0,
  active           boolean not null default true,
  config_overrides jsonb,
  unique (client_id, section_key)
);

-- ============================================================
-- Trigger updated_at
-- ============================================================
create or replace function public.vb_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger vb_clients_updated_at
  before update on public.vb_clients
  for each row execute function public.vb_set_updated_at();

create trigger vb_sites_updated_at
  before update on public.vb_sites
  for each row execute function public.vb_set_updated_at();

create trigger vb_products_updated_at
  before update on public.vb_products
  for each row execute function public.vb_set_updated_at();

-- ============================================================
-- Row Level Security — service_role escribe; anon no lee nada
-- PLAN FREE no usa Supabase en runtime del sitio del cliente
-- ============================================================
alter table public.vb_plans            enable row level security;
alter table public.vb_clients          enable row level security;
alter table public.vb_sites            enable row level security;
alter table public.vb_categories       enable row level security;
alter table public.vb_products         enable row level security;
alter table public.vb_gallery_images   enable row level security;
alter table public.vb_contact_channels enable row level security;
alter table public.vb_business_hours   enable row level security;
alter table public.vb_site_sections    enable row level security;

-- Sin políticas: solo service_role puede operar (bypass de RLS automático)
-- Cuando se implemente dashboard para planes pagos, añadir políticas por cliente aquí
