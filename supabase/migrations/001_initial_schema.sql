-- Mr Supply · Cotizador colaborativo
create extension if not exists pgcrypto;

create table if not exists public.products (
  id text primary key,
  source_id integer,
  sku text unique,
  ean text,
  brand text not null default '',
  name text not null,
  search_name text not null default '',
  category text not null default '',
  subcategory text not null default '',
  presentation text not null default '',
  content text not null default '',
  unit text not null default '',
  flavor text not null default '',
  format text not null default '',
  cost numeric(12,2) not null default 0,
  pvp numeric(12,2) not null default 0,
  supplier text not null default '',
  status text not null default 'Activo',
  image_url text not null default '',
  stock text not null default '',
  delivery_days integer not null default 0,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id text primary key,
  number text not null unique,
  client_name text not null default '',
  client_id text not null default '',
  client_phone text not null default '',
  client_email text not null default '',
  issued_at date not null default current_date,
  valid_until date,
  status text not null default 'Borrador' check (status in ('Borrador','Enviada','Aprobada','Vencida','Anulada')),
  tax_rate numeric(6,2) not null default 0,
  global_discount numeric(6,2) not null default 0,
  notes text not null default '',
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_items (
  id text primary key,
  quote_id text not null references public.quotes(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  sku text not null default '',
  name text not null,
  presentation text not null default '',
  image_url text not null default '',
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  discount numeric(6,2) not null default 0 check (discount between 0 and 100),
  position integer not null default 0
);

create index if not exists products_search_idx on public.products (brand, name);
create index if not exists quote_items_quote_idx on public.quote_items (quote_id, position);
create index if not exists quotes_updated_idx on public.quotes (updated_at desc);

alter table public.products enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

drop policy if exists "team products read" on public.products;
drop policy if exists "team products write" on public.products;
drop policy if exists "team quotes read" on public.quotes;
drop policy if exists "team quotes write" on public.quotes;
drop policy if exists "team items read" on public.quote_items;
drop policy if exists "team items write" on public.quote_items;

create policy "team products read" on public.products for select to authenticated using (true);
create policy "team products write" on public.products for all to authenticated using (true) with check (true);
create policy "team quotes read" on public.quotes for select to authenticated using (true);
create policy "team quotes write" on public.quotes for all to authenticated using (true) with check (true);
create policy "team items read" on public.quote_items for select to authenticated using (true);
create policy "team items write" on public.quote_items for all to authenticated using (true) with check (true);

do $$
begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.quotes;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.quote_items;
exception when duplicate_object then null;
end $$;
