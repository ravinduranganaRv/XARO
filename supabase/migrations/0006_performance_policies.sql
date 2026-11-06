-- Performance hygiene from the Supabase advisors. No access rules change: policies are only re-shaped.
-- 1) index every foreign key that has no covering index
do $$ declare r record; begin
  for r in
    select c.conrelid::regclass as tbl, replace(c.conname, '_fkey', '_idx') as idx,
           (select string_agg(quote_ident(a.attname), ',' order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols
    from pg_constraint c join pg_namespace n on n.oid = c.connamespace
    where c.contype = 'f' and n.nspname = 'public'
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indisvalid
                      and array_to_string((i.indkey::int2[])[0:array_length(c.conkey, 1) - 1], ',') = array_to_string(c.conkey, ','))
  loop execute format('create index if not exists %I on %s (%s)', r.idx, r.tbl, r.cols); end loop;
end $$;

-- 2) split every FOR ALL policy into per-command policies (same rules; SELECT included)
do $$ declare r record; begin
  for r in select * from pg_policies where schemaname = 'public' and cmd = 'ALL' loop
    execute format('create policy %I on public.%I for select using (%s)', r.policyname || '_s', r.tablename, r.qual);
    execute format('create policy %I on public.%I for insert with check (%s)', r.policyname || '_i', r.tablename, coalesce(r.with_check, r.qual));
    execute format('create policy %I on public.%I for update using (%s) with check (%s)', r.policyname || '_u', r.tablename, r.qual, coalesce(r.with_check, r.qual));
    execute format('create policy %I on public.%I for delete using (%s)', r.policyname || '_d', r.tablename, r.qual);
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 3) merge permissive policies that share a table and command into one (permissive policies are OR-ed, so this is equivalent)
do $$ declare r record; nm text; begin
  for r in
    select tablename, cmd, array_agg(policyname order by policyname) names,
           string_agg('(' || coalesce(qual, 'true') || ')', ' or ' order by policyname) q,
           string_agg('(' || coalesce(with_check, qual, 'true') || ')', ' or ' order by policyname) w
    from pg_policies where schemaname = 'public' and permissive = 'PERMISSIVE' group by tablename, cmd having count(*) > 1
  loop
    nm := left(r.tablename || '_' || lower(r.cmd) || '_all', 60);
    if r.cmd = 'SELECT' or r.cmd = 'DELETE' then execute format('create policy %I on public.%I for %s using (%s)', nm, r.tablename, lower(r.cmd), r.q);
    elsif r.cmd = 'INSERT' then execute format('create policy %I on public.%I for insert with check (%s)', nm, r.tablename, r.w);
    else execute format('create policy %I on public.%I for update using (%s) with check (%s)', nm, r.tablename, r.q, r.w); end if;
    for i in 1 .. array_length(r.names, 1) loop execute format('drop policy %I on public.%I', r.names[i], r.tablename); end loop;
  end loop;
end $$;

-- 4) evaluate auth.uid() once per statement instead of once per row
do $$ declare r record; q text; w text; begin
  for r in select * from pg_policies where schemaname = 'public' and (qual like '%auth.uid()%' or with_check like '%auth.uid()%') loop
    q := replace(r.qual, 'auth.uid()', '(select auth.uid())'); w := replace(r.with_check, 'auth.uid()', '(select auth.uid())');
    if r.cmd = 'INSERT' then execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, w);
    elsif r.cmd in ('SELECT', 'DELETE') then execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, q);
    else execute format('alter policy %I on public.%I using (%s) with check (%s)', r.policyname, r.tablename, q, coalesce(w, q)); end if;
  end loop;
end $$;

-- 5) storage: one policy per command covering the three private buckets
do $$ declare b text; c text; begin
  foreach b in array array['design-originals','design-exports','business-assets'] loop
    foreach c in array array['read','insert','update','delete'] loop execute format('drop policy %I on storage.objects', b || ' ' || c); end loop;
  end loop;
end $$;
create policy "xaro private read"   on storage.objects for select to authenticated using (bucket_id in ('design-originals','design-exports','business-assets') and private.storage_path_ok(name));
create policy "xaro private insert" on storage.objects for insert to authenticated with check (bucket_id in ('design-originals','design-exports','business-assets') and private.storage_path_ok(name));
create policy "xaro private update" on storage.objects for update to authenticated using (bucket_id in ('design-originals','design-exports','business-assets') and private.storage_path_ok(name)) with check (bucket_id in ('design-originals','design-exports','business-assets') and private.storage_path_ok(name));
create policy "xaro private delete" on storage.objects for delete to authenticated using (bucket_id in ('design-originals','design-exports','business-assets') and private.storage_path_ok(name));
