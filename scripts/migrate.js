import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Ejecutar SQL en bloques via rpc exec_sql (función que crearemos primero)
async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { sql: query });
  if (error) throw new Error(`SQL Error: ${error.message}\nQuery: ${query.slice(0, 120)}`);
  return data;
}

const DROP_TABLES = `
-- Eliminar tablas existentes del proyecto anterior (Rosalba + otros)
DROP TABLE IF EXISTS public.movimientos_inventario CASCADE;
DROP TABLE IF EXISTS public.inventario_productos CASCADE;
DROP TABLE IF EXISTS public.pedido_productos CASCADE;
DROP TABLE IF EXISTS public.pedidos CASCADE;
DROP TABLE IF EXISTS public.servicios_impresion CASCADE;
DROP TABLE IF EXISTS public.servicio_materiales CASCADE;
DROP TABLE IF EXISTS public.productos_rosalba CASCADE;
DROP TABLE IF EXISTS public.community_manager_intakes CASCADE;
DROP TABLE IF EXISTS public.lead_magnet_registrations CASCADE;
DROP TABLE IF EXISTS public.usuarios_versabold_inventario CASCADE;
`;

const CREATE_EXEC_SQL = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;
`;

const CREATE_SCHEMA = `
-- ============================================================
-- VersaBold Multi-Cliente Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vb_plans (
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

INSERT INTO public.vb_plans (id, name, price_usd, products_limit, dashboard_enabled,
  custom_domain_enabled, versabold_branding_required, advanced_seo_enabled, gallery_enabled, whatsapp_only)
VALUES
  ('free',    'PLAN FREE',     0,  15,  false, false, true,  false, true, true),
  ('starter', 'PLAN EMPRENDE', 25, 30,  true,  false, true,  false, true, false),
  ('pro',     'PLAN NEGOCIO',  50, 100, true,  true,  false, true,  true, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.vb_clients (
  id            uuid primary key default gen_random_uuid(),
  client_id     text not null unique,
  business_name text not null,
  slug          text not null unique,
  plan_id       text not null references public.vb_plans(id),
  business_type text,
  owner_name    text,
  owner_phone   text,
  owner_email   text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.vb_sites (
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

CREATE TABLE IF NOT EXISTS public.vb_categories (
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

CREATE TABLE IF NOT EXISTS public.vb_products (
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

CREATE INDEX IF NOT EXISTS vb_products_client_available_idx
  ON public.vb_products(client_id, available);

CREATE TABLE IF NOT EXISTS public.vb_gallery_images (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.vb_clients(id) on delete cascade,
  url         text not null,
  alt_text    text,
  caption     text,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

CREATE TABLE IF NOT EXISTS public.vb_contact_channels (
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

CREATE TABLE IF NOT EXISTS public.vb_business_hours (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.vb_clients(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),
  opens_at     time,
  closes_at    time,
  is_closed    boolean not null default false,
  label        text,
  unique (client_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.vb_site_sections (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.vb_clients(id) on delete cascade,
  section_key      text not null,
  sort_order       integer not null default 0,
  active           boolean not null default true,
  config_overrides jsonb,
  unique (client_id, section_key)
);
`;

const CREATE_TRIGGERS = `
CREATE OR REPLACE FUNCTION public.vb_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END;
$$;

DROP TRIGGER IF EXISTS vb_clients_updated_at ON public.vb_clients;
CREATE TRIGGER vb_clients_updated_at
  BEFORE UPDATE ON public.vb_clients
  FOR EACH ROW EXECUTE FUNCTION public.vb_set_updated_at();

DROP TRIGGER IF EXISTS vb_sites_updated_at ON public.vb_sites;
CREATE TRIGGER vb_sites_updated_at
  BEFORE UPDATE ON public.vb_sites
  FOR EACH ROW EXECUTE FUNCTION public.vb_set_updated_at();

DROP TRIGGER IF EXISTS vb_products_updated_at ON public.vb_products;
CREATE TRIGGER vb_products_updated_at
  BEFORE UPDATE ON public.vb_products
  FOR EACH ROW EXECUTE FUNCTION public.vb_set_updated_at();
`;

const ENABLE_RLS = `
ALTER TABLE public.vb_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_sites            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_gallery_images   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_contact_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_business_hours   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vb_site_sections    ENABLE ROW LEVEL SECURITY;
`;

async function migrate() {
  console.log('🚀 Iniciando migración VersaBold...\n');

  // Paso 1: verificar que exec_sql existe (se crea manualmente en el SQL Editor)
  console.log('1/5 Verificando función exec_sql...');
  let execSqlOk = false;
  try {
    const { error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    execSqlOk = !error;
  } catch (_) {
    execSqlOk = false;
  }

  if (!execSqlOk) {
    console.log('\n❌ La función exec_sql no existe en Supabase.\n');
    console.log('   Ve al SQL Editor: https://supabase.com/dashboard/project/fuduzzsfaacdtqvsyaos/sql/new');
    console.log('   Ejecuta el archivo: backend/scripts/step1_create_exec_sql.sql');
    console.log('   Luego vuelve a correr: node scripts/migrate.js\n');
    process.exit(1);
  }
  console.log('   ✓ exec_sql disponible\n');

  // Paso 2: drop tablas viejas
  console.log('2/5 Eliminando tablas anteriores...');
  await sql(DROP_TABLES);
  console.log('   ✓ Tablas anteriores eliminadas\n');

  // Paso 3: crear esquema VersaBold
  console.log('3/5 Creando tablas VersaBold...');
  await sql(CREATE_SCHEMA);
  console.log('   ✓ 9 tablas creadas + 3 planes insertados\n');

  // Paso 4: triggers
  console.log('4/5 Creando triggers updated_at...');
  await sql(CREATE_TRIGGERS);
  console.log('   ✓ Triggers creados\n');

  // Paso 5: RLS
  console.log('5/5 Activando Row Level Security...');
  await sql(ENABLE_RLS);
  console.log('   ✓ RLS activado en todas las tablas\n');

  console.log('✅ Migración completada exitosamente.');
  console.log('   Tablas creadas: vb_plans, vb_clients, vb_sites, vb_categories,');
  console.log('   vb_products, vb_gallery_images, vb_contact_channels,');
  console.log('   vb_business_hours, vb_site_sections');
}

migrate().catch(err => {
  console.error('\n❌ Error en migración:', err.message);
  process.exit(1);
});
