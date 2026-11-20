-- 0086 qaytarish: bir kishida yana bitta ishchi e'loni. DIQQAT: qo'shimcha e'lonlar (is_primary = false) bo'lsa, unique
-- (profile_id) qaytmaydi — avval ularni ko'rib chiqib o'chirish kerak (ularga bog'liq raqamlar, ko'rishlar ham o'chadi):
--   delete from public.worker_profiles where not is_primary;
-- Funksiyalar avvalgi ko'rinishga qaytariladi (save_simple_worker_listing va send_offer — 0086 qo'shgan qism olib tashlanadi).

create or replace function public.current_worker_id()
 returns uuid language sql stable security definer set search_path to 'public'
as $function$
  select id from public.worker_profiles where profile_id = auth.uid();
$function$;

do $rb$
declare
  def text;
begin
  def := replace(pg_get_functiondef('public.can_view_phone(uuid)'::regprocedure), E'\r', '');
  execute replace(def, ' and is_primary;', ';');

  def := replace(pg_get_functiondef('public.send_offer(uuid,uuid,text,text,integer,integer)'::regprocedure), E'\r', '');
  def := regexp_replace(def, E'  -- 0086:[^\\n]*\\n  select coalesce\\(\\(select pw\\.id from public\\.worker_profiles x\\n[^\\n]*\\n[^\\n]*\\n    into p_worker_id;\\n', '');
  execute def;

  def := replace(pg_get_functiondef('public.save_simple_worker_listing(jsonb)'::regprocedure), E'\r', '');
  def := replace(def, E'  v_target uuid := nullif(p->>''worker_id'', '''')::uuid;\n  v_new boolean := coalesce((p->>''new_listing'')::boolean, false);\n  v_count int;\n', '');
  def := regexp_replace(def, E'  -- 0086:.*?  if wid is null then\n', E'  select id into wid from public.worker_profiles where profile_id = me;\n  if wid is null then\n', 's');
  execute def;
end $rb$;

drop policy if exists "worker_preferences_write" on public.worker_preferences;
create policy "worker_preferences_write" on public.worker_preferences for all to authenticated
  using (worker_id = (select public.current_worker_id()))
  with check (worker_id = (select public.current_worker_id()) and (select public.is_active_user()));
drop policy if exists "worker_locations_write" on public.worker_locations;
create policy "worker_locations_write" on public.worker_locations for all to authenticated
  using (worker_id = (select public.current_worker_id()))
  with check (worker_id = (select public.current_worker_id()) and (select public.is_active_user()));

alter table public.worker_profiles add constraint worker_profiles_profile_id_key unique (profile_id);
drop index if exists public.worker_profiles_one_primary;
drop index if exists public.idx_worker_profiles_profile;
alter table public.worker_profiles drop column if exists is_primary;
