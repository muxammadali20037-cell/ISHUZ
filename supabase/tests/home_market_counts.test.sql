-- 0067 · bosh sahifa sonlari: soha bo'yicha faol vakansiyalar va faol ish beruvchilar — qidiruv bilan bir xil qoida
--        (faol, muddati o'tmagan; qoralama, yopilgan, muddati o'tgan hisoblanmaydi). Mehmon ham chaqira oladi (RLS bilan).
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, false);
  execute 'set role anon';
end $$;
create or replace function pg_temp.superuser() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', false); end $$;
create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'vacancy_moderation_enabled', 'employer_verification_required', 'listings_paid');

select pg_temp.anon();
create temp table before_c as select public.home_market_counts() as j;
select pg_temp.superuser();
grant select on before_c to anon;

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('67000000-0000-0000-0000-000000000001', '+998906700001', now(), '{"first_name":"Birinchi"}'),
  ('67000000-0000-0000-0000-000000000002', '+998906700002', now(), '{"first_name":"Ikkinchi"}');

-- IT: 2 ta faol (bitta egasidan) + muddati o'tgan + qoralama; Savdo: 1 ta faol (boshqa egasidan) + yopilgan
insert into public.vacancies (owner_profile_id, title, category_id, region_id, description, status, salary_from, salary_type, published_at, expires_at)
select t.owner::uuid, t.title, c.id, r.id, 'M sinov e''loni: ' || t.title || ', ish vaqti 9 dan 18 gacha', t.status::public.vacancy_status, 3000000, 'monthly', now(), t.expires
from (values
  ('67000000-0000-0000-0000-000000000001', 'M Dasturchi', 'it', 'active', now() + interval '5 days'),
  ('67000000-0000-0000-0000-000000000001', 'M Tester', 'it', 'active', null),
  ('67000000-0000-0000-0000-000000000001', 'M Muddati o''tgan', 'it', 'active', now() - interval '1 hour'),
  ('67000000-0000-0000-0000-000000000002', 'M Qoralama', 'it', 'draft', now() + interval '5 days'),
  ('67000000-0000-0000-0000-000000000002', 'M Sotuvchi', 'sales', 'active', now() + interval '5 days'),
  ('67000000-0000-0000-0000-000000000002', 'M Yopilgan', 'sales', 'closed', now() + interval '5 days')
) as t(owner, title, category, status, expires)
join public.categories c on c.slug = t.category
cross join (select id from public.regions where slug = 'tashkent_city') r;

select pg_temp.anon();
create temp table after_c as select public.home_market_counts() as j;
create or replace function pg_temp.cat(p_j jsonb, p_slug text) returns int language sql as $$
  select coalesce((p_j -> 'categories' ->> (select id::text from public.categories where slug = p_slug))::int, 0);
$$;
select pg_temp.ok((select pg_temp.cat(a.j, 'it') - pg_temp.cat(b.j, 'it') from after_c a, before_c b) = 2, 'IT: 2 ta faol (muddati o''tgan va qoralama yo''q)');
select pg_temp.ok((select pg_temp.cat(a.j, 'sales') - pg_temp.cat(b.j, 'sales') from after_c a, before_c b) = 1, 'Savdo: 1 ta (yopilgan yo''q)');
select pg_temp.ok((select (a.j ->> 'employers')::int - (b.j ->> 'employers')::int from after_c a, before_c b) = 2, 'faol ish beruvchilar: 2 ta (bitta egadagi 2 e''lon — bitta)');
-- /jobs?category= bilan bir xil son
select pg_temp.ok(
  (select count(*) from public.vacancies v join public.categories c on c.id = v.category_id
   where c.slug = 'it' and v.status = 'active' and (v.expires_at is null or v.expires_at > now()))
  = pg_temp.cat((select j from after_c), 'it'), 'IT soni qidiruv qoidasi bilan bir xil');
select pg_temp.ok((select prosecdef from pg_proc where proname = 'home_market_counts') = false, 'SECURITY INVOKER (yangi definer yuzasi yo''q)');

select pg_temp.superuser();
rollback;
\echo ✓ home_market_counts
