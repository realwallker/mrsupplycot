-- Mr Supply · acceso directo mediante enlace, sin autenticación.
-- Advertencia: cualquier persona que conozca la URL podrá leer y modificar estos datos.

drop policy if exists "team products read" on public.products;
drop policy if exists "team products write" on public.products;
drop policy if exists "team quotes read" on public.quotes;
drop policy if exists "team quotes write" on public.quotes;
drop policy if exists "team items read" on public.quote_items;
drop policy if exists "team items write" on public.quote_items;
drop policy if exists "public link products access" on public.products;
drop policy if exists "public link quotes access" on public.quotes;
drop policy if exists "public link items access" on public.quote_items;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update, delete on public.quotes to anon, authenticated;
grant select, insert, update, delete on public.quote_items to anon, authenticated;

create policy "public link products access"
on public.products for all to anon, authenticated
using (true) with check (true);

create policy "public link quotes access"
on public.quotes for all to anon, authenticated
using (true) with check (true);

create policy "public link items access"
on public.quote_items for all to anon, authenticated
using (true) with check (true);
