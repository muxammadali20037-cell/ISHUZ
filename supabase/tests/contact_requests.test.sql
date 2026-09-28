-- ISH.UZ · telefon so'rash: so'rov → ruxsat / rad, maxfiylik, cheklovlar
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.login(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
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

insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('e4000000-0000-0000-0000-000000000001', '+998905000001', now(), '{"first_name":"Ishchi","last_name":"Ali"}'),
  ('e4000000-0000-0000-0000-000000000002', '+998905000002', now(), '{"first_name":"HR","last_name":"Vali"}'),
  ('e4000000-0000-0000-0000-000000000003', '+998905000003', now(), '{"first_name":"Yashirin","last_name":"G"}');
update public.profile_contacts set phone_visibility = 'on_request' where profile_id = 'e4000000-0000-0000-0000-000000000001';
update public.profile_contacts set phone_visibility = 'nobody' where profile_id = 'e4000000-0000-0000-0000-000000000003';

select pg_temp.login('e4000000-0000-0000-0000-000000000002');
select pg_temp.ok(public.contact_status_for('e4000000-0000-0000-0000-000000000001') = 'none', 'boshida: so''rov yo''q');
select pg_temp.ok((select not allowed from public.get_contact('e4000000-0000-0000-0000-000000000001')), 'telefon yopiq');
select pg_temp.ok(public.request_contact('e4000000-0000-0000-0000-000000000001') = 'pending', 'so''rov yuborildi');
select pg_temp.ok(public.request_contact('e4000000-0000-0000-0000-000000000001') = 'pending', 'takroriy so''rov — o''sha holat, dublikat yo''q');
select pg_temp.fails($$select public.request_contact('e4000000-0000-0000-0000-000000000003')$$, 'hech kimga ko''rinmaydigan telefonni so''rab bo''lmaydi', 'contact_hidden');
select pg_temp.ok(public.contact_status_for('e4000000-0000-0000-0000-000000000003') = 'hidden', 'holat: hidden');
select pg_temp.fails($$insert into public.contact_requests (requester_profile_id, owner_profile_id) values (auth.uid(), 'e4000000-0000-0000-0000-000000000003')$$, 'jadvalga to''g''ridan-to''g''ri yozib bo''lmaydi', '42501');
select pg_temp.fails($$select public.respond_contact_request((select id from public.contact_requests limit 1), true)$$, 'so''rovchi o''zi ruxsat bera olmaydi', '42501');

-- egasi ko'radi va rad etadi
select pg_temp.login('e4000000-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.my_contact_requests()) = 1, 'egasi kutilayotgan so''rovni ko''radi');
select pg_temp.ok((select count(*) from public.notifications where payload->>'kind' = 'contact_request') = 1, 'egasiga bildirishnoma');
select pg_temp.ok(public.respond_contact_request((select id from public.my_contact_requests()), false) = 'declined', 'rad etdi');
select pg_temp.login('e4000000-0000-0000-0000-000000000002');
select pg_temp.ok(public.contact_status_for('e4000000-0000-0000-0000-000000000001') = 'declined', 'so''rovchi rad etilganini ko''radi');
select pg_temp.fails($$select public.request_contact('e4000000-0000-0000-0000-000000000001')$$, 'rad etilgandan keyin 7 kun qayta so''rab bo''lmaydi', 'declined_recently');

-- 8 kun o'tdi → qayta so'raydi → egasi ruxsat beradi → telefon ochiladi
select pg_temp.superuser();
update public.contact_requests set responded_at = now() - interval '8 days';
select pg_temp.login('e4000000-0000-0000-0000-000000000002');
select pg_temp.ok(public.request_contact('e4000000-0000-0000-0000-000000000001') = 'pending', '8 kundan keyin qayta so''radi');
select pg_temp.login('e4000000-0000-0000-0000-000000000001');
select pg_temp.ok(public.respond_contact_request((select id from public.my_contact_requests()), true) = 'approved', 'ruxsat berdi');
select pg_temp.login('e4000000-0000-0000-0000-000000000002');
select pg_temp.ok((select allowed and phone = '+998905000001' from public.get_contact('e4000000-0000-0000-0000-000000000001')), 'telefon ochildi');
select pg_temp.ok(public.contact_status_for('e4000000-0000-0000-0000-000000000001') = 'allowed', 'holat: allowed');
select pg_temp.ok((select count(*) from public.notifications where payload->>'kind' = 'contact_approved') = 1, 'so''rovchiga bildirishnoma');

-- egasi ruxsatni qaytarib oladi → yana yopiq
select pg_temp.login('e4000000-0000-0000-0000-000000000001');
delete from public.contact_grants where grantee_profile_id = 'e4000000-0000-0000-0000-000000000002';
select pg_temp.login('e4000000-0000-0000-0000-000000000002');
select pg_temp.ok((select not allowed from public.get_contact('e4000000-0000-0000-0000-000000000001')), 'ruxsat qaytarildi → yopiq');

select pg_temp.superuser();
rollback;
\echo '✓ telefon so''rash testlari o''tdi'
