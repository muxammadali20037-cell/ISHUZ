-- 0085 · Telegram orqali kodsiz kirish: yaratish → ko'rish → tasdiqlash → bir marta ishlatish; boshqa brauzer olmaydi.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;
insert into auth.users (id, phone, phone_confirmed_at, raw_user_meta_data) values
  ('85000000-0000-0000-0000-000000000001', '+998908500001', now(), '{"first_name":"Telegramchi"}');

create temp table t as
select public.telegram_web_login_create(repeat('a', 64), repeat('b', 64), '  Chrome · Android  ') as id;

select pg_temp.ok((select status = 'ok' and user_agent = 'Chrome · Android' from public.telegram_web_login_preview(repeat('a', 64))), 'yangi so''rov: ok, brauzer nomi qisqartirilgan');
select pg_temp.ok((select status = 'invalid' and id is null from public.telegram_web_login_preview(repeat('c', 64))), 'noma''lum token: invalid');
select pg_temp.ok((select status = 'pending' from public.telegram_web_login_consume((select id from t), repeat('b', 64))), 'tasdiqlanmagan: pending');
select pg_temp.ok((select status = 'invalid' from public.telegram_web_login_consume((select id from t), repeat('d', 64))), 'boshqa brauzer kaliti: invalid');

select pg_temp.ok(public.telegram_web_login_confirm((select id from t), 777000111, '85000000-0000-0000-0000-000000000001') = 'ok', 'bot tasdiqladi');
select pg_temp.ok(public.telegram_web_login_confirm((select id from t), 777000222, '85000000-0000-0000-0000-000000000001') = 'used', 'ikkinchi tasdiq: used');
select pg_temp.ok((select status = 'used' from public.telegram_web_login_preview(repeat('a', 64))), 'tasdiqlangandan keyin preview: used');
select pg_temp.ok((select status = 'invalid' from public.telegram_web_login_consume((select id from t), repeat('d', 64))), 'tasdiqlangan, lekin boshqa brauzer: invalid');
select pg_temp.ok((select status = 'ok' and profile_id = '85000000-0000-0000-0000-000000000001' and telegram_user_id = 777000111
                    from public.telegram_web_login_consume((select id from t), repeat('b', 64))), 'o''sha brauzer: ok va profil');
select pg_temp.ok((select status = 'used' from public.telegram_web_login_consume((select id from t), repeat('b', 64))), 'qayta ishlatib bo''lmaydi: used');

-- muddati o'tgan
create temp table t2 as select public.telegram_web_login_create(repeat('e', 64), repeat('f', 64), null) as id;
update public.telegram_web_logins set expires_at = now() - interval '1 second' where id = (select id from t2);
select pg_temp.ok((select status = 'expired' from public.telegram_web_login_preview(repeat('e', 64))), 'muddati o''tgan: preview expired');
select pg_temp.ok(public.telegram_web_login_confirm((select id from t2), 1, '85000000-0000-0000-0000-000000000001') = 'expired', 'muddati o''tgan: tasdiqlanmaydi');
select pg_temp.ok((select status = 'expired' from public.telegram_web_login_consume((select id from t2), repeat('f', 64))), 'muddati o''tgan: brauzerga expired');

-- huquqlar va format
select pg_temp.ok(not has_table_privilege('anon', 'public.telegram_web_logins', 'select'), 'anon jadvalni o''qiy olmaydi');
select pg_temp.ok(not has_table_privilege('authenticated', 'public.telegram_web_logins', 'select'), 'authenticated jadvalni o''qiy olmaydi');
select pg_temp.ok(not has_function_privilege('anon', 'public.telegram_web_login_consume(uuid, text)', 'execute'), 'anon consume chaqira olmaydi');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.telegram_web_login_confirm(uuid, bigint, uuid)', 'execute'), 'authenticated confirm chaqira olmaydi');
do $$ begin
  perform public.telegram_web_login_create('ochiq-token', repeat('b', 64), null);
  raise exception 'TEST FAILED: xeshsiz token qabul qilindi';
exception when check_violation then raise notice 'ok - token faqat sha256 xesh ko''rinishida';
end $$;

rollback;
