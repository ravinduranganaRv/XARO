-- Found in the first live test: the store owner (profiles.role = 'owner') pressed "I am a rug maker", the old function only
-- updated rows with role = 'customer', so nothing changed and create_business refused ("a rug maker account is required").
-- account_type is not a privilege (it only allows creating one's own business), so any active account may switch to it.
-- The role / permission columns are untouched and still guarded by the profile trigger.
create or replace function public.become_rugmaker() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'sign in required' using errcode = '28000'; end if;
  perform set_config('xaro.trusted', '1', true);
  update public.profiles set account_type = 'rugmaker' where id = auth.uid() and active;
  perform set_config('xaro.trusted', '', true);
end $$;
