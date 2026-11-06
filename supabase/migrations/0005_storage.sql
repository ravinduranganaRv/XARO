-- Private storage. Paths:  <user_id>/...  for personal files,  b/<business_id>/...  for a rug maker business.
-- Nothing is public: the app reads files through short-lived signed URLs.
-- SVG is deliberately NOT accepted as a raw upload (an SVG opened from storage could run script). The app sanitises SVG in the browser and keeps the cleaned markup inside the design document.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
 ('design-originals', 'design-originals', false, 8388608,  array['image/png','image/jpeg','image/webp']),
 ('design-exports',   'design-exports',   false, 20971520, array['image/png','image/jpeg','application/pdf']),
 ('business-assets',  'business-assets',  false, 2097152,  array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.storage_path_ok(p text) returns boolean language plpgsql stable security definer set search_path = public as $$
declare a text := split_part(p, '/', 1); b text := split_part(p, '/', 2);
begin
  if auth.uid() is null then return false; end if;
  if a = auth.uid()::text then return true; end if;
  if a = 'b' and b ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return private.is_member(b::uuid); end if;
  return false;
end $$;
revoke all on function private.storage_path_ok(text) from public; grant execute on function private.storage_path_ok(text) to anon, authenticated;

do $$ declare b text; begin
  foreach b in array array['design-originals','design-exports','business-assets'] loop
    execute format($f$create policy "%1$s read" on storage.objects for select to authenticated using (bucket_id = %2$L and private.storage_path_ok(name))$f$, b, b);
    execute format($f$create policy "%1$s insert" on storage.objects for insert to authenticated with check (bucket_id = %2$L and private.storage_path_ok(name))$f$, b, b);
    execute format($f$create policy "%1$s update" on storage.objects for update to authenticated using (bucket_id = %2$L and private.storage_path_ok(name)) with check (bucket_id = %2$L and private.storage_path_ok(name))$f$, b, b);
    execute format($f$create policy "%1$s delete" on storage.objects for delete to authenticated using (bucket_id = %2$L and private.storage_path_ok(name))$f$, b, b);
  end loop;
end $$;
