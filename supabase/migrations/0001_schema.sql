-- XARO Industries: core schema. Targets Supabase (Postgres 15+). Money is stored as numeric(12,2) in the row's own currency.
-- Review before running against production. Every table has RLS enabled in 0002_rls.sql.
create extension if not exists pgcrypto;

-- ---------- access control ----------
create table public.roles (key text primary key, label text not null);
create table public.permissions (key text primary key, label text not null);
create table public.role_permissions (role text references public.roles(key) on delete cascade, perm text references public.permissions(key) on delete cascade, primary key (role, perm));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, full_name text, phone text,
  country char(2), currency char(3),
  role text not null default 'customer' references public.roles(key),
  extra_perms text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(), last_seen timestamptz
);

-- ---------- catalogue ----------
create table public.categories (id uuid primary key default gen_random_uuid(), slug text unique not null, name text not null, sort int not null default 0);
create table public.products (
  id uuid primary key default gen_random_uuid(), sku text unique not null, name text not null,
  category_id uuid references public.categories(id), kind text not null default 'catalog' check (kind in ('catalog','custom')),
  status text not null default 'draft' check (status in ('draft','active','coming_soon','archived')),
  description text, specs jsonb not null default '{}', images jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.product_variants (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id) on delete cascade,
  sku text unique not null, label text not null, width_cm numeric(6,1), height_cm numeric(6,1), options jsonb not null default '{}', active boolean not null default true
);
-- one price per product per country, in that country's currency (set by the owner, not converted at runtime)
create table public.product_prices (
  product_id uuid not null references public.products(id) on delete cascade, country char(2) not null, currency char(3) not null,
  amount numeric(12,2) not null check (amount >= 0), updated_at timestamptz not null default now(), primary key (product_id, country)
);

-- ---------- materials and yarn ----------
create table public.materials (id uuid primary key default gen_random_uuid(), name text not null, unit text not null, cost_per_unit numeric(12,4), supplier text, note text);
create table public.yarn_colours (
  id text primary key, name text not null, hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'), material text, supplier text,
  availability text not null default 'unknown' check (availability in ('unknown','in-stock','low','out','discontinued')), active boolean not null default true
);
create table public.yarn_inventory (yarn_id text primary key references public.yarn_colours(id) on delete cascade, kg_on_hand numeric(10,2), reorder_kg numeric(10,2), cost_per_kg numeric(12,2), updated_at timestamptz not null default now());

-- ---------- studio ----------
create table public.design_templates (id text primary key, name text not null, category text not null, doc jsonb not null, active boolean not null default true);
create table public.custom_designs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, name text not null,
  doc jsonb not null, thumb_path text, status text not null default 'draft' check (status in ('draft','submitted','approved','archived')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.design_assets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade, design_id uuid references public.custom_designs(id) on delete set null,
  storage_path text not null, mime text not null check (mime in ('image/png','image/jpeg','image/webp','image/svg+xml')), bytes int not null check (bytes <= 8388608),
  sha256 text, sanitised boolean not null default false, created_at timestamptz not null default now()
);
create table public.quotations (
  id uuid primary key default gen_random_uuid(), ref text unique not null default ('Q-' || lpad((floor(random()*99999))::int::text, 5, '0')),
  owner_id uuid references public.profiles(id) on delete set null, name text not null, email text not null, phone text, country char(2), currency char(3), qty int not null default 1 check (qty > 0),
  design_id uuid references public.custom_designs(id) on delete set null, doc jsonb, estimate jsonb, message text,
  status text not null default 'New' check (status in ('New','Reviewing','Quoted','Accepted','Rejected','Converted to order')),
  confirmed_amount numeric(12,2), notes text, created_at timestamptz not null default now()
);

-- ---------- orders and payments (written by edge functions only; see 0002) ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(), ref text unique not null, customer_id uuid references public.profiles(id) on delete set null,
  name text not null, email text not null, phone text, country char(2) not null, currency char(3) not null,
  subtotal numeric(12,2) not null, shipping numeric(12,2) not null default 0, total numeric(12,2) not null,
  stage int not null default 0 check (stage between 0 and 12), cancelled boolean not null default false,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','deposit_paid','paid','refunded','failed')),
  tracking text, address jsonb, notes text, created_at timestamptz not null default now()
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, product_id uuid references public.products(id),
  sku text not null, name text not null, qty int not null check (qty > 0), unit_price numeric(12,2) not null, design_id uuid references public.custom_designs(id), meta jsonb not null default '{}'
);
create table public.payments (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, provider text not null, provider_ref text,
  amount numeric(12,2) not null, currency char(3) not null, status text not null, raw jsonb, created_at timestamptz not null default now(), unique (provider, provider_ref)
);
create table public.shipments (id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, courier text, tracking text, shipped_at timestamptz, delivered_at timestamptz);

-- ---------- production (13 stages, labels in business_settings) ----------
create table public.production_jobs (
  id uuid primary key default gen_random_uuid(), order_item_id uuid not null references public.order_items(id) on delete cascade, stage int not null default 0 check (stage between 0 and 12),
  assignee uuid references public.profiles(id), due_date date, notes text, updated_at timestamptz not null default now()
);
create table public.production_updates (
  id uuid primary key default gen_random_uuid(), job_id uuid not null references public.production_jobs(id) on delete cascade, stage int not null check (stage between 0 and 12),
  note text, photo_path text, customer_visible boolean not null default false, by_user uuid references public.profiles(id), created_at timestamptz not null default now()
);

-- ---------- engagement ----------
create table public.reviews (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade, author_id uuid not null references public.profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5), body text check (char_length(body) <= 2000), approved boolean not null default false, created_at timestamptz not null default now(), unique (order_id, author_id)
);
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, title text not null, body text, read boolean not null default false, created_at timestamptz not null default now());
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(), owner_id uuid references public.profiles(id) on delete set null, name text, email text not null, subject text not null, body text not null check (char_length(body) <= 4000),
  status text not null default 'open' check (status in ('open','pending','closed')), assignee uuid references public.profiles(id), created_at timestamptz not null default now()
);

-- ---------- settings and audit ----------
create table public.business_settings (key text primary key, value jsonb not null, is_public boolean not null default false, updated_at timestamptz not null default now());
create table public.audit_logs (
  id bigint generated always as identity primary key, at timestamptz not null default now(), actor uuid, actor_role text, action text not null, table_name text not null, row_id text, old_row jsonb, new_row jsonb
);

create index on public.orders (customer_id); create index on public.orders (created_at desc); create index on public.order_items (order_id);
create index on public.quotations (owner_id); create index on public.custom_designs (owner_id); create index on public.product_prices (country);
create index on public.audit_logs (table_name, at desc); create index on public.production_jobs (stage);
