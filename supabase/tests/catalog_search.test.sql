-- Ish Beruvchi · kasblar katalogi: xato yozilgan so'zlar va sinonimlar bo'yicha qidiruv, noaniq "usta", qo'lda yozilgan kasb navbati
\set ON_ERROR_STOP on
\set QUIET on
begin;
-- 0049+: bu fayl eski oqimlarni sinaydi; majburiy moderatsiya va ish beruvchi darvozasi — moderation.test.sql da
update public.app_settings set value = 'false'::jsonb where key in ('moderation_enabled', 'employer_verification_required');

create or replace function pg_temp.ok(p_cond boolean, p_name text) returns void language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'TEST FAILED: %', p_name; end if;
  raise notice 'ok - %', p_name;
end $$;
-- q so'rovining birinchi 3 natijasida expected nomli kasb bormi
create or replace function pg_temp.finds(q text, expected text) returns void language plpgsql as $$
begin
  perform pg_temp.ok(exists (select 1 from (select * from public.search_profession_nodes(q, null, 3)) s where s.name_uz ilike expected), format('"%s" → %s', q, expected));
end $$;

select pg_temp.finds('bugalter', 'Buxgalter');
select pg_temp.finds('buhgalter', 'Buxgalter');
select pg_temp.finds('shafyor', 'Haydovchi');
select pg_temp.finds('voditel', 'Haydovchi');
select pg_temp.finds('prava oqituvchi', 'Avtoinstruktor');
select pg_temp.finds('medsestra', 'Hamshira');
select pg_temp.finds('povar', 'Oshpaz');
select pg_temp.finds('ofitsiant', 'Ofitsiant');
select pg_temp.finds('kassir', 'Kassir');
select pg_temp.finds('svarshik', '%payvand%');
select pg_temp.finds('elektrik', 'Elektrik%');
select pg_temp.finds('programmist', '%dasturchi%');

-- "usta" noaniq: bitta kasbga majburlanmaydi, bir nechta turli kasb chiqadi
select pg_temp.ok((select count(distinct name_uz) from public.search_profession_nodes('usta', null, 10)) >= 3, '"usta" noaniq — kamida 3 xil kasb');

-- katalog hajmi va har bir yo'nalishda kasb borligi
select pg_temp.ok((select count(*) from public.profession_nodes where is_active) >= 1000, 'katalogda 1000+ faol tugun');
select pg_temp.ok(not exists (
  select 1 from public.categories c where c.is_active and not exists (select 1 from public.profession_nodes n where n.category_id = c.id and n.is_active)
), 'har bir faol yo''nalishda kamida bitta kasb bor');

-- qo'lda yozilgan kasb: normallashtiriladi, bir egaga bitta yozuv
select pg_temp.ok((select public.normalize_search_text('  Dron   Operatori ')) = 'dron operatori', 'normalize_search_text bo''shliq va registrni tekislaydi');

rollback;
