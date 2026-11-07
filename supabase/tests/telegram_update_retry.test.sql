-- 0075 · Telegram update: xato bo'lsa 3 urinishgacha qayta ishlanadi, keyin to'xtaydi; muvaffaqiyatlisi takrorlanmaydi.
\set ON_ERROR_STOP on
\set QUIET on

create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;

begin;
delete from public.telegram_updates where update_id in (975000001, 975000002);

-- muvaffaqiyatli update: bir marta
select pg_temp.ok(public.telegram_update_first_seen(975000001), 'yangi update — qayta ishlanadi');
select pg_temp.ok(not public.telegram_update_first_seen(975000001), 'muvaffaqiyatli update qayta kelsa — takror ishlanmaydi');

-- xato bilan tugagan update
select pg_temp.ok(public.telegram_update_first_seen(975000002), '1-urinish');
select pg_temp.ok(public.telegram_update_failed(975000002, 'boom 1'), '1-xato → Telegram qayta yuborsin (500)');
select pg_temp.ok(public.telegram_update_first_seen(975000002), '2-urinish qabul qilinadi');
select pg_temp.ok(public.telegram_update_failed(975000002, 'boom 2'), '2-xato → yana qayta');
select pg_temp.ok(public.telegram_update_first_seen(975000002), '3-urinish qabul qilinadi');
select pg_temp.ok(not public.telegram_update_failed(975000002, 'boom 3'), '3-xato → urinishlar tugadi (200, navbat to''xtamaydi)');
select pg_temp.ok(not public.telegram_update_first_seen(975000002), '4-marta kelsa — e''tiborsiz');
select pg_temp.ok((select attempts = 3 and last_error = 'boom 3' and failed_at is not null from public.telegram_updates where update_id = 975000002), 'urinishlar soni va oxirgi xato saqlandi');
select pg_temp.ok(not public.telegram_update_failed(975999999, 'yo''q'), 'noma''lum update — qayta urinish yo''q');

-- sessiyadan chaqirilmaydi
set role authenticated;
do $$ begin
  perform public.telegram_update_failed(1, 'x');
  raise exception 'TEST FAILED: authenticated telegram_update_failed chaqira oldi';
exception when insufficient_privilege then raise notice 'ok - sessiyadan chaqirilmaydi';
end $$;
reset role;

rollback;
\echo '✓ telegram_update_retry'
