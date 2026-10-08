-- Ish topdim · to'lov o'chiq (joriy reliz): e'lon va TOP bepul, to'lov yaratilmaydi: aksiya davri, bepul vakansiya (24 soat), to'lov talabi, Payme/Click oqimlari, TOP profil
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, false);
  execute 'set role authenticated';
end $$;
create or replace function pg_temp.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, false);
  execute 'set role service_role';
end $$;
create or replace function pg_temp.superuser() returns void language plpgsql as $$
begin execute 'reset role'; perform set_config('request.jwt.claims', '', false); end $$;
create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
create or replace function pg_temp.fails(p_sql text, p_name text, p_expect text default null) returns void language plpgsql as $$
begin
  begin execute p_sql;
  exception when others then
    if p_expect is not null and sqlstate <> p_expect and position(p_expect in sqlerrm) = 0 then
      raise exception 'TEST FAILED: % — kutilgan %, olingan % (%)', p_name, p_expect, sqlstate, sqlerrm;
    end if;
    raise notice 'ok - % (% %)', p_name, sqlstate, left(sqlerrm, 60); return;
  end;
  raise exception 'TEST FAILED: % — xato kutilgan edi', p_name;
end $$;

begin;
-- 0049+: bu fayl eski oqimlarni sinaydi; majburiy moderatsiya va ish beruvchi darvozasi — moderation.test.sql da
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required');
-- 0043 dan oldingi qoidalar bilan sinaladi (yangi 10 kunlik pullik e'lonlar — paid_listings.test.sql)
update public.app_settings set value = 'false'::jsonb where key = 'listings_paid';
update public.app_settings set value = '30'::jsonb where key = 'vacancy_lifetime_days';
update public.app_settings set value = '50000'::jsonb where key = 'price_vacancy_publish';
update public.app_settings set value = 'true'::jsonb where key = 'listing_free_trial';
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'listing_discount_until';
-- sukut: billing_enabled=false; aksiya muddati ham o'tgan bo'lsin — baribir bepul
update public.app_settings set value = 'false'::jsonb where key = 'billing_enabled';
update public.app_settings set value = to_jsonb('2020-01-01T00:00:00Z'::text) where key = 'billing_free_until';

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e8000000-0000-0000-0000-000000000001', '+998903100001', now(), '{"first_name":"Do''kon","last_name":"Egasi"}');
select pg_temp.login('e8000000-0000-0000-0000-000000000001');
insert into public.employer_profiles (profile_id, employer_type) values (auth.uid(), 'person');
insert into public.vacancies (owner_profile_id, title, category_id, region_id)
select auth.uid(), t, c.id, r.id from unnest(array['F1', 'F2', 'F3', 'F4']) t, public.categories c, public.regions r where c.slug = 'sales' and r.slug = 'tashkent_city';

select pg_temp.ok(not public.billing_enabled(), 'to''lov sukut bo''yicha o''chiq');
select pg_temp.ok((select public.vacancy_publish_quote(id) ->> 'mode' from public.vacancies where title = 'F1') = 'free', 'rejim: free');
select public.publish_vacancy(id) from public.vacancies where title in ('F1', 'F2', 'F3');
select pg_temp.ok((select count(*) from public.vacancies where title in ('F1', 'F2', 'F3') and status = 'active' and expires_at > now() + interval '29 days') = 3, 'uchala vakansiya ham bepul 30 kunga faol');
select pg_temp.ok((select count(*) from public.billing_usage where profile_id = auth.uid()) = 0, 'bepul limit sarflanmaydi');
select pg_temp.fails($$select public.create_payment('vacancy_publish', (select id from public.vacancies where title = 'F4'))$$, 'to''lov yaratib bo''lmaydi', 'billing_disabled');

rollback;
\echo 'billing_off.test.sql: OK'
