-- ISH.UZ · 0020 · aqlli qidiruv: kasb sinonimlari, chuqurroq kasblar ro'yxati, qidiruv jurnali,
-- maosh tahlili (haqiqiy e'lonlardan) va o'xshash (takroriy) vakansiyalarni topish.

-- =====================================================================
-- 1. Kasb sinonimlari — admin tahrirlaydi (kod o'zgarmasdan)
-- =====================================================================
alter table public.subcategories add column if not exists aliases text[] not null default '{}';
comment on column public.subcategories.aliases is 'Xalq tilidagi nomlar, qisqartmalar, xatoli yozilishlar (uz lotin/kirill, ru). Qidiruv shu ro''yxat bo''yicha kasbni taniydi.';

-- =====================================================================
-- 2. Yangi kasblar (mavjudlariga tegmaydi)
-- =====================================================================
insert into public.subcategories (category_id, slug, name_uz, name_ru, sort_order)
select c.id, s.slug, s.name_uz, s.name_ru, s.sort_order from (values
  ('it', 'cybersecurity', 'Kiberxavfsizlik mutaxassisi', 'Специалист по кибербезопасности', 120),
  ('it', 'ml_ai', 'AI / ML muhandis', 'AI / ML инженер', 130),
  ('it', 'data_engineer', 'Data engineer', 'Data engineer', 140),
  ('it', 'product_manager', 'Product manager', 'Продакт-менеджер', 150),
  ('it', 'it_project_manager', 'IT loyiha menejeri', 'IT проджект-менеджер', 160),
  ('it', 'business_analyst', 'Biznes-analitik', 'Бизнес-аналитик', 170),
  ('it', 'wordpress', 'WordPress dasturchi', 'WordPress-разработчик', 180),
  ('it', 'nocode', 'No-code dasturchi', 'No-code разработчик', 190),
  ('it', 'crm', 'CRM mutaxassisi', 'CRM-специалист', 200),
  ('it', 'sysadmin', 'Tizim administratori', 'Системный администратор', 210),
  ('construction', 'excavator', 'Ekskavatorchi', 'Экскаваторщик', 110),
  ('construction', 'facade', 'Fasad ustasi', 'Фасадчик', 120),
  ('construction', 'finishing', 'Pardozlash ustasi', 'Мастер отделки', 130),
  ('construction', 'estimator', 'Smetachi', 'Сметчик', 140),
  ('construction', 'architect', 'Arxitektor', 'Архитектор', 150),
  ('construction', 'surveyor', 'Geodezist', 'Геодезист', 160),
  ('construction', 'welder', 'Payvandchi (qurilish)', 'Сварщик (стройка)', 170),
  ('electrician', 'cctv', 'Videokuzatuv o''rnatuvchi', 'Монтажник видеонаблюдения', 40),
  ('electrician', 'fire_alarm', 'Yong''in signalizatsiyasi ustasi', 'Монтажник пожарной сигнализации', 50),
  ('electrician', 'low_voltage', 'Kam kuchlanish tizimlari ustasi', 'Специалист слаботочных систем', 60),
  ('electrician', 'panel', 'Elektr shit yig''uvchi', 'Сборщик электрощитов', 70),
  ('electrician', 'maintenance', 'Navbatchi elektrik', 'Дежурный электрик', 80),
  ('restaurant', 'chef', 'Bosh oshpaz', 'Шеф-повар', 5),
  ('restaurant', 'runner', 'Ranner', 'Раннер', 120),
  ('restaurant', 'kitchen_worker', 'Oshxona xodimi', 'Кухонный работник', 130),
  ('restaurant', 'restaurant_manager', 'Restoran menejeri', 'Менеджер ресторана', 140),
  ('restaurant', 'cashier', 'Kassir (kafe)', 'Кассир (кафе)', 150),
  ('restaurant', 'shashlik', 'Shashlikpaz', 'Шашлычник', 160),
  ('restaurant', 'samsa', 'Somsapaz / tandirchi', 'Самсаварщик / тандырщик', 170),
  ('driver', 'bus', 'Avtobus haydovchisi', 'Водитель автобуса', 70),
  ('driver', 'forklift', 'Pogruzchik haydovchisi', 'Водитель погрузчика', 80),
  ('driver', 'delivery', 'Yetkazib beruvchi haydovchi', 'Водитель-доставщик', 90),
  ('driver', 'damas', 'Damas / Labo haydovchisi', 'Водитель Дамас / Лабо', 100),
  ('sales', 'online_sales', 'Onlayn sotuvchi', 'Онлайн-продавец', 70),
  ('sales', 'marketplace', 'Marketpleys menejeri (Uzum, Wildberries)', 'Менеджер маркетплейсов (Uzum, Wildberries)', 80),
  ('sales', 'promoter', 'Promouter', 'Промоутер', 90),
  ('office', 'pc_operator', 'Kompyuter operatori', 'Оператор ПК', 100),
  ('office', 'translator', 'Tarjimon', 'Переводчик', 110),
  ('office', 'receptionist', 'Resepshn xodimi', 'Сотрудник ресепшн', 120),
  ('medicine', 'orderly', 'Sanitar / sanitarka', 'Санитар / санитарка', 80),
  ('medicine', 'physio', 'Fizioterapevt', 'Физиотерапевт', 90),
  ('cleaning', 'window_cleaner', 'Deraza yuvuvchi', 'Мойщик окон', 60),
  ('cleaning', 'laundry', 'Kir yuvuvchi', 'Прачка', 70),
  ('cleaning', 'cook_home', 'Uy oshpazi', 'Домашний повар', 80),
  ('production', 'machine_operator', 'Stanok operatori', 'Оператор станка', 70),
  ('production', 'textile', 'To''qimachilik ishchisi', 'Работник текстильного производства', 80),
  ('production', 'food_production', 'Oziq-ovqat ishlab chiqarish ishchisi', 'Работник пищевого производства', 90),
  ('logistics', 'storekeeper', 'Omborchi', 'Кладовщик', 70),
  ('other', 'daily_worker', 'Kunlik ishchi (mardikor)', 'Разнорабочий (подённо)', 10),
  ('other', 'animator', 'Animator', 'Аниматор', 20),
  ('other', 'student', 'Talabalar uchun ish', 'Работа для студентов', 30)
) as s(cat, slug, name_uz, name_ru, sort_order)
join public.categories c on c.slug = s.cat
on conflict (category_id, slug) do nothing;

-- =====================================================================
-- 3. Sinonimlar (uz lotin + kirill + ru + xalq tilidagi nomlar)
-- =====================================================================
update public.subcategories sc set aliases = a.aliases
from (values
  ('it', 'frontend', array['frontendchi','front-end','react','reactchi','vue','angular','верстальщик','фронтенд','фронтендер']),
  ('it', 'backend', array['backendchi','back-end','bekend','node','nodejs','python','django','laravel','php','java','golang','бэкенд','бекенд']),
  ('it', 'fullstack', array['fullstek','full stack','фулстек']),
  ('it', 'flutter', array['flutterchi','fluttersiz','dart','флаттер']),
  ('it', 'android', array['androidchi','kotlin','андроид']),
  ('it', 'ios', array['swift','iosчи','айос']),
  ('it', 'uiux', array['ui','ux','figma','dizayner ui','ui ux','юикс','ui/ux']),
  ('it', 'qa', array['tester','testirovshik','тестер','тестировщик','qa engineer']),
  ('it', 'support', array['it support','texnik yordam','техподдержка','айтишник']),
  ('it', 'data', array['analitik','data analyst','power bi','sql analitik','аналитик данных']),
  ('it', '1c', array['1s','1с','1c programmist','1с программист','1с разработчик']),
  ('it', 'sysadmin', array['sisadmin','sistemniy administrator','сисадмин','системщик']),
  ('it', 'ml_ai', array['ai','ml','sun''iy intellekt','нейросети','machine learning']),
  ('sales', 'seller', array['sotuvchi','sotuvchi qiz','prodavets','prodavets','продавец','продавщица','сотувчи']),
  ('sales', 'consultant', array['konsultant','консультант','prodavets-konsultant']),
  ('sales', 'cashier', array['kassir','kassirsha','кассир','кассирша','кассир-продавец']),
  ('sales', 'agent', array['torgoviy','торговый','торговый представитель','agent','savdo vakili']),
  ('sales', 'sales_manager', array['sotuv bo''yicha menejer','prodajnik','менеджер продаж','продажник']),
  ('marketing', 'smm', array['smmchi','smm menejer','смм','smm manager','инстаграм']),
  ('marketing', 'target', array['targetchi','targetolog','таргет','таргетолог']),
  ('marketing', 'mobilographer', array['mobilograf','reels','рилсмейкер','мобилограф']),
  ('design', 'graphic', array['dizayner','dizaynchi','designer','photoshop','дизайнер','графический']),
  ('design', 'video', array['montajchi','montaj','videomontaj','монтажёр','монтажер']),
  ('finance', 'accountant', array['buxgalter','bugalter','buhgalter','бухгалтер','бугалтер','бухгалтер 1с']),
  ('finance', 'chief_accountant', array['bosh bugalter','главбух','главный бухгалтер']),
  ('finance', 'economist', array['ekonomist','экономист']),
  ('driver', 'cat_b', array['haydovchi','shofyor','shopir','voditel','водитель','шофёр','b toifa','b kategoriya','легковой']),
  ('driver', 'cat_c', array['c toifa','c kategoriya','gruzovoy','грузовой','водитель c']),
  ('driver', 'cat_d', array['d toifa','avtobusga','водитель d']),
  ('driver', 'truck', array['fura','furachi','kamaz','kamazchi','isuzu','фура','дальнобойщик','камаз']),
  ('driver', 'taxi', array['taksi','taksist','yandex taksi','такси','таксист']),
  ('driver', 'personal', array['shaxsiy shofyor','личный водитель']),
  ('driver', 'tractor', array['traktor','tractorchi','тракторист']),
  ('driver', 'forklift', array['pogruzchik','pogruzchikchi','погрузчик','погрузчика','штабелёр']),
  ('driver', 'damas', array['damas','damaschi','labo','дамас','лабо']),
  ('driver', 'bus', array['avtobus','marshrutka','автобус','маршрутка']),
  ('logistics', 'loader', array['yukchi','gruzchik','грузчик','hammol']),
  ('logistics', 'warehouse', array['sklad','skladchi','склад','кладовщик','ombor']),
  ('logistics', 'storekeeper', array['omborchi','kladovshik','кладовщик']),
  ('logistics', 'picker', array['komplektovshik','комплектовщик','sborshik','сборщик заказов']),
  ('courier', 'foot', array['kuryer','kurer','dostavka','курьер','доставщик','пеший курьер']),
  ('courier', 'food', array['yandex eda','uzum tezkor','wolt','express24','доставка еды']),
  ('courier', 'auto', array['avtokuryer','авто курьер','курьер на авто']),
  ('construction', 'mason', array['g''isht teruvchi','gisht teruvchi','kladchik','каменщик','кладчик','usta']),
  ('construction', 'plasterer', array['suvoqchi','shtukatur','штукатур','suvoq']),
  ('construction', 'tiler', array['kafelchi','kafel','plitochnik','плиточник','кафельщик']),
  ('construction', 'concrete', array['betonchi','beton','бетонщик','арматурщик']),
  ('construction', 'carpenter', array['duradgor','plotnik','плотник','столяр']),
  ('construction', 'crane', array['kranchi','kranovshik','крановщик']),
  ('construction', 'laborer', array['podsobnik','qora ishchi','подсобник','разнорабочий','mardikor']),
  ('construction', 'roofer', array['tomchi','krovelshik','кровельщик','tom yopuvchi']),
  ('construction', 'excavator', array['ekskavator','ekskovatorchi','экскаваторщик','jcb']),
  ('construction', 'foreman', array['prorab','прораб','мастер участка']),
  ('construction', 'welder', array['svarshik','svarchik','сварщик']),
  ('craftsman', 'welder', array['svarchik','svarshik','svarka','svarkachi','payvandchi','сварщик','сварка']),
  ('craftsman', 'painter', array['bo''yoqchi','boyoqchi','malyar','маляр','маляр-штукатур']),
  ('craftsman', 'drywall', array['gipsokarton','gipsakarton','гипсокартонщик','potolok']),
  ('craftsman', 'hvac', array['konditsioner','konditsionerchi','кондиционер','кондиционерщик','вентиляция']),
  ('craftsman', 'furniture', array['mebelchi','mebel','мебельщик','сборщик мебели']),
  ('craftsman', 'universal', array['usta','master','муж на час','мастер на все руки','ремонтчи']),
  ('craftsman', 'appliance', array['maishiy texnika ustasi','ремонт техники','холодильщик']),
  ('electrician', 'electrician', array['elektrik','elektrikchi','электрик','электромонтёр','электромонтер']),
  ('electrician', 'cctv', array['kamera o''rnatish','videonablyudeniye','видеонаблюдение','камера']),
  ('electrician', 'electronics', array['elektronshik','электронщик','радиомеханик']),
  ('plumber', 'plumber', array['santexnik','santehnik','сантехник','сантехник-монтажник','truba']),
  ('plumber', 'heating', array['isitish','otopleniye','отопление','котёл','kotel']),
  ('auto_service', 'motorist', array['motorchi','motorist','motor ustasi','моторист','dvigatel']),
  ('auto_service', 'auto_electric', array['avtoelektrik','автоэлектрик']),
  ('auto_service', 'chassis', array['xodovoy','hodovoy','ходовик','ходовая']),
  ('auto_service', 'body', array['rixtovshik','kuzovchi','жестянщик','рихтовщик','кузовщик']),
  ('auto_service', 'paint', array['kraskachi','avto bo''yoqchi','маляр авто','покрасчик']),
  ('auto_service', 'tire', array['vulkanizatsiya','shinomontaj','шиномонтаж','вулканизация']),
  ('auto_service', 'detailing', array['moykachi','avtomoyka','мойщик','автомойка','polirovka']),
  ('auto_service', 'diagnost', array['diagnostika','диагност','komp diagnostika']),
  ('restaurant', 'waiter', array['ofitsiant','afitsant','ofitsiantka','официант','официантка']),
  ('restaurant', 'cook', array['oshpaz','povar','повар','ошпаз','oshpazlik']),
  ('restaurant', 'chef', array['shef','shef povar','шеф','шеф-повар','bosh povar']),
  ('restaurant', 'cook_assistant', array['oshpaz yordamchisi','povar yordamchi','помощник повара','подсобный повар']),
  ('restaurant', 'barista', array['baristа','kofe','бариста']),
  ('restaurant', 'bartender', array['barmen','бармен']),
  ('restaurant', 'baker', array['novvoy','nonvoy','пекарь','non yopuvchi']),
  ('restaurant', 'confectioner', array['qandolatchi','konditer','кондитер','tort']),
  ('restaurant', 'dishwasher', array['idish yuvuvchi','posudomoyka','посудомойщица','посудомойка','мойщица посуды']),
  ('restaurant', 'hostess', array['xostes','хостес']),
  ('restaurant', 'pizza', array['pitsachi','pizzamaker','пиццамейкер']),
  ('restaurant', 'sushi', array['sushichi','sushist','сушист','сушист-повар']),
  ('restaurant', 'shashlik', array['shashlik','shashlikchi','мангальщик','шашлычник']),
  ('restaurant', 'samsa', array['somsa','samsa','tandir','tandirchi','самса','тандыр']),
  ('restaurant', 'runner', array['ranner','раннер']),
  ('call_center', 'operator', array['operator','call center','kol-tsentr','оператор','колл-центр','оператор call-центра']),
  ('office', 'administrator', array['admin','administrator','администратор']),
  ('office', 'secretary', array['kotiba','sekretar','секретарь','ресепшн']),
  ('office', 'hr', array['kadrlar','kadrovik','кадровик','hr menejer','отдел кадров']),
  ('office', 'lawyer', array['yurist','huquqshunos','юрист','юрисконсульт']),
  ('office', 'pc_operator', array['kompyuterchi','оператор пк','nabor matn','набор текста']),
  ('office', 'translator', array['perevodchik','переводчик']),
  ('education', 'teacher', array['o''qituvchi','oqituvchi','ustoz','uchitel','учитель','преподаватель']),
  ('education', 'tutor', array['repetitor','репетитор']),
  ('education', 'kindergarten', array['tarbiyachi','vospitatel','воспитатель','bog''cha']),
  ('education', 'english', array['ingliz tili','english teacher','учитель английского']),
  ('medicine', 'doctor', array['vrach','shifokor','doktor','врач','доктор']),
  ('medicine', 'nurse', array['hamshira','medsestra','медсестра','медбрат']),
  ('medicine', 'pharmacist', array['farmatsevt','dorixona','aptekachi','фармацевт','провизор','аптека']),
  ('medicine', 'dentist', array['stomatolog','tish doktori','стоматолог']),
  ('cleaning', 'cleaner', array['farrosh','tozalovchi','uborshitsa','уборщица','уборщик','клининг']),
  ('cleaning', 'housekeeper', array['uy yordamchisi','domrabotnitsa','домработница']),
  ('cleaning', 'nanny', array['enaga','nyanya','няня']),
  ('cleaning', 'gardener', array['bog''bon','bogbon','sadovnik','садовник']),
  ('security', 'guard', array['qorovul','qo''riqchi','oxrana','ohrannik','охранник','сторож','storozh']),
  ('sewing', 'seamstress', array['tikuvchi','shveya','швея','tikuvchilik']),
  ('sewing', 'cutter', array['bichuvchi','raskroyshik','закройщик','bichish']),
  ('beauty', 'hairdresser', array['sartarosh','parikmaxer','парикмахер','soch turmaklovchi']),
  ('beauty', 'barber', array['barber','барбер','sartarosh erkaklar']),
  ('beauty', 'manicure', array['manikyur','nogot','маникюр','мастер маникюра','tirnoq']),
  ('beauty', 'cosmetologist', array['kosmetolog','косметолог']),
  ('beauty', 'massage', array['massajchi','massaj','массажист','массаж']),
  ('production', 'packer', array['qadoqlovchi','upakovshik','упаковщик','фасовщик']),
  ('production', 'operator', array['operator stanok','оператор производства','ishlab chiqarish operatori']),
  ('production', 'machine_operator', array['stanokchi','tokar','токарь','фрезеровщик','станочник']),
  ('mechanic', 'mechanic', array['mexanik','механик']),
  ('mechanic', 'machinist', array['tokar','токарь','frezerovshik']),
  ('agriculture', 'farmer', array['dehqon','fermer','фермер','fermer xo''jaligi']),
  ('agriculture', 'vet', array['veterinar','ветеринар']),
  ('other', 'daily_worker', array['mardikor','kunlik','kunlik ish','podyonniy','разнорабочий','подработка','qora ish'])
) as a(cat, slug, aliases)
join public.categories c on c.slug = a.cat
where sc.category_id = c.id and sc.slug = a.slug;

-- =====================================================================
-- 4. Qidiruv jurnali — nimalar topilmayotganini ko'rish (sinonim/kasb qo'shish uchun)
--    Faqat server (service role) yozadi; faqat analytics.view huquqli admin o'qiydi.
-- =====================================================================
create table if not exists public.search_logs (
  id            bigint generated always as identity primary key,
  scope         text not null check (scope in ('jobs', 'workers')),
  query         text not null check (length(query) between 1 and 200),
  query_norm    text not null,
  understood    jsonb not null default '{}'::jsonb,
  results_count int not null check (results_count >= 0),
  profile_id    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_search_logs_zero on public.search_logs (created_at desc) where results_count = 0;
create index if not exists idx_search_logs_created on public.search_logs (created_at desc);
alter table public.search_logs enable row level security;
drop policy if exists "search_logs_admin_read" on public.search_logs;
create policy "search_logs_admin_read" on public.search_logs for select using (public.has_admin_permission('analytics.view'));
revoke all on public.search_logs from anon, authenticated;
grant select on public.search_logs to authenticated;

-- Eng ko'p natijasiz qidiruvlar (admin)
create or replace function public.admin_search_insights(p_days int default 30, p_limit int default 50)
returns table (scope text, query_norm text, searches bigint, zero_results bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_admin_permission('analytics.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select l.scope, l.query_norm, count(*) as searches, count(*) filter (where l.results_count = 0) as zero_results, max(l.created_at) as last_at
    from public.search_logs l
    where l.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))
    group by l.scope, l.query_norm
    order by count(*) filter (where l.results_count = 0) desc, count(*) desc
    limit greatest(1, least(p_limit, 200));
end;
$$;

-- Eski yozuvlarni tozalash (90 kun)
create or replace function public.purge_search_logs()
returns void language sql security definer set search_path = public
as $$ delete from public.search_logs where created_at < now() - interval '90 days'; $$;

-- =====================================================================
-- 5. Maosh tahlili — faqat haqiqiy faol e'lonlardan; kam bo'lsa (n < 5) raqam bermaydi
-- =====================================================================
create or replace function public.salary_insight(p_subcategory_id uuid, p_region_id uuid default null, p_salary_type public.salary_type default 'monthly')
returns table (sample_size int, p25 int, p50 int, p75 int)
language sql stable security definer set search_path = public
as $$
  with s as (
    select coalesce((v.salary_from + v.salary_to) / 2, v.salary_from, v.salary_to) as mid
    from public.vacancies v
    where v.status = 'active'
      and v.subcategory_id = p_subcategory_id
      and (p_region_id is null or v.region_id = p_region_id)
      and v.salary_type = p_salary_type
      and not v.salary_negotiable
      and coalesce(v.salary_from, v.salary_to) is not null
      and v.published_at > now() - interval '180 days'
  )
  select count(*)::int,
         case when count(*) >= 5 then (percentile_cont(0.25) within group (order by mid))::int end,
         case when count(*) >= 5 then (percentile_cont(0.5) within group (order by mid))::int end,
         case when count(*) >= 5 then (percentile_cont(0.75) within group (order by mid))::int end
  from s;
$$;

-- =====================================================================
-- 6. O'xshash (ehtimoliy takroriy) vakansiyalar — faqat vakansiya boshqaruvchisi so'raydi.
--    Hech narsa o'chirilmaydi: faqat ogohlantirish uchun.
-- =====================================================================

create or replace function public.similar_vacancies(p_vacancy_id uuid)
returns table (id uuid, title text, status public.vacancy_status, similarity real, created_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions
as $$
declare
  v public.vacancies;
begin
  if not public.manages_vacancy(p_vacancy_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v from public.vacancies where vacancies.id = p_vacancy_id;
  if not found then return; end if;
  return query
    select o.id, o.title, o.status, extensions.similarity(lower(o.title), lower(v.title)) as sim, o.created_at
    from public.vacancies o
    where o.id <> v.id
      and o.status in ('active', 'pending_review', 'paused')
      and o.created_at > now() - interval '60 days'
      and ((v.company_id is not null and o.company_id = v.company_id) or (v.company_id is null and o.owner_profile_id = v.owner_profile_id))
      and o.district_id is not distinct from v.district_id
      and (o.subcategory_id = v.subcategory_id or extensions.similarity(lower(o.title), lower(v.title)) > 0.55)
      and extensions.similarity(lower(o.title), lower(v.title)) > 0.35
    order by sim desc
    limit 5;
end;
$$;

-- =====================================================================
-- 7. Huquqlar
-- =====================================================================
revoke execute on function public.admin_search_insights(int, int), public.purge_search_logs(), public.salary_insight(uuid, uuid, public.salary_type), public.similar_vacancies(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_search_insights(int, int) to authenticated;
grant execute on function public.similar_vacancies(uuid) to authenticated;
grant execute on function public.salary_insight(uuid, uuid, public.salary_type) to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'ishuz-purge-search-logs';
    perform cron.schedule('ishuz-purge-search-logs', '23 3 * * *', 'select public.purge_search_logs()');
  end if;
end $$;

-- =====================================================================
-- 8. Maosh filtri turlarga normallashtiriladi: kunlik ×22, soatlik ×176 (oylik ekvivalent).
--    Aks holda "kunlik 300 ming" vakansiya "oyiga 5 mln dan" filtrida yo'qolib ketardi.
-- =====================================================================
create or replace function public.salary_monthly_equivalent(p_amount int, p_type public.salary_type)
returns bigint language sql immutable set search_path = public
as $$ select case p_type when 'daily' then p_amount::bigint * 22 when 'hourly' then p_amount::bigint * 176 else p_amount::bigint end $$;
grant execute on function public.salary_monthly_equivalent(int, public.salary_type) to anon, authenticated, service_role;

create or replace function public.search_vacancies(
  p_query text default null,
  p_category_id uuid default null,
  p_subcategory_id uuid default null,
  p_region_id uuid default null,
  p_district_ids uuid[] default null,
  p_salary_min int default null,
  p_employment_types public.employment_type[] default null,
  p_schedules public.work_schedule[] default null,
  p_work_format public.work_format default null,
  p_experience_max_months int default null,
  p_is_remote boolean default null,
  p_benefits text[] default null,
  p_verified_only boolean default false,
  p_no_experience boolean default false,
  p_start_today boolean default false,
  p_company_id uuid default null,
  p_government_only boolean default false,
  p_sort text default 'relevant',
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid, slug text, title text, company_id uuid, company_name text, company_logo_url text, company_verified boolean,
  category_id uuid, category_slug text, region_id uuid, region_name_uz text, region_name_ru text,
  district_id uuid, district_name_uz text, district_name_ru text, is_remote boolean,
  salary_from int, salary_to int, salary_type public.salary_type, salary_negotiable boolean,
  employment_type public.employment_type, schedule public.work_schedule, work_time_from time, work_time_to time,
  experience_min_months int, work_format public.work_format, benefits text[],
  published_at timestamptz, expires_at timestamptz, views_count int, applications_count int, is_featured boolean, is_government boolean,
  match_score int, match_reasons jsonb, is_saved boolean, has_applied boolean, total_count bigint
)
language plpgsql stable security invoker set search_path = public as $$
declare
  wid uuid := public.current_worker_id();
  q tsquery := case when p_query is null or trim(p_query) = '' then null else plainto_tsquery('public.ishuz', p_query) end;
begin
  return query
  with base as (
    select v.*
    from public.vacancies v
    left join public.companies c on c.id = v.company_id
    where v.status = 'active'
      and (p_category_id is null or v.category_id = p_category_id)
      and (p_subcategory_id is null or v.subcategory_id = p_subcategory_id)
      and (p_region_id is null or v.region_id = p_region_id or v.is_remote)
      and (p_district_ids is null or cardinality(p_district_ids) = 0 or v.district_id = any(p_district_ids) or v.is_remote)
      and (p_salary_min is null or v.salary_negotiable or public.salary_monthly_equivalent(coalesce(v.salary_to, v.salary_from), v.salary_type) >= p_salary_min)
      and (p_employment_types is null or cardinality(p_employment_types) = 0 or v.employment_type = any(p_employment_types))
      and (p_schedules is null or cardinality(p_schedules) = 0 or v.schedule = any(p_schedules))
      and (p_work_format is null or p_work_format = 'any' or v.work_format = p_work_format or v.work_format = 'any')
      and (p_experience_max_months is null or v.experience_min_months <= p_experience_max_months)
      and (not p_no_experience or v.experience_min_months = 0)
      and (p_is_remote is null or v.is_remote = p_is_remote)
      and (not p_verified_only or c.verification_status = 'verified')
      and (p_company_id is null or v.company_id = p_company_id)
      and (not p_government_only or v.is_government)
      and (p_benefits is null or cardinality(p_benefits) = 0 or not exists (
            select 1 from unnest(p_benefits) b where not exists (
              select 1 from public.vacancy_benefits vb where vb.vacancy_id = v.id and vb.benefit_code = b)))
      and (q is null or v.search_vector @@ q or v.title ilike '%' || p_query || '%' or c.name ilike '%' || p_query || '%')
  ),
  counted as (
    select b.*,
      (b.is_featured and (b.featured_until is null or b.featured_until > now())) as featured_now
    from base b
    order by (b.is_featured and (b.featured_until is null or b.featured_until > now())) desc, b.published_at desc
    limit case when wid is not null and p_sort = 'relevant' then 300 else 100000 end  -- moslik faqat oxirgi 300 ta uchun hisoblanadi
  ),
  scored as (
    select b.*,
      case when wid is not null then m.score end as ms,
      case when wid is not null then m.reasons end as mr,
      case when q is not null then ts_rank(b.search_vector, q) else 0 end as rank,
      count(*) over () as total  -- total_count limitdan keyin: sahifalar soni real natijaga mos
    from counted b
    left join lateral (select * from public.compute_match(wid, b.id)) m on wid is not null
  )
  select
    s.id, s.slug, s.title, s.company_id, c.name, c.logo_url, c.verification_status = 'verified',
    s.category_id, cat.slug, s.region_id, rg.name_uz, rg.name_ru, s.district_id, d.name_uz, d.name_ru, s.is_remote,
    s.salary_from, s.salary_to, s.salary_type, s.salary_negotiable,
    s.employment_type, s.schedule, s.work_time_from, s.work_time_to, s.experience_min_months, s.work_format,
    coalesce((select array_agg(vb.benefit_code order by vb.benefit_code) from public.vacancy_benefits vb where vb.vacancy_id = s.id), '{}'),
    s.published_at, s.expires_at, s.views_count, s.applications_count, s.featured_now, s.is_government,
    s.ms, s.mr,
    (wid is not null and exists (select 1 from public.saved_vacancies sv where sv.worker_id = wid and sv.vacancy_id = s.id)),
    (wid is not null and exists (select 1 from public.applications a where a.worker_id = wid and a.vacancy_id = s.id)),
    s.total
  from scored s
  left join public.companies c on c.id = s.company_id
  left join public.categories cat on cat.id = s.category_id
  left join public.regions rg on rg.id = s.region_id
  left join public.districts d on d.id = s.district_id
  order by
    s.featured_now desc,
    case when p_sort = 'newest' then s.published_at end desc nulls last,
    case when p_sort = 'salary' then coalesce(s.salary_to, s.salary_from, 0) end desc nulls last,
    case when p_sort = 'relevant' then coalesce(s.ms, 0) + s.rank * 20 end desc nulls last,
    s.published_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
end $$;


-- =====================================================================
-- 9. Avtomatik xavf belgisi: oldindan pul so'rash (firibgarlikning eng keng tarqalgan turi).
--    Belgilangan e'lon o'chirilmaydi va bloklanmaydi — faqat moderatorga yuboriladi (pending_review).
-- =====================================================================
create or replace function public.vacancy_risk_flags(p_title text, p_description text)
returns text[] language sql immutable set search_path = public
as $$
  select array_remove(array[
    case when (coalesce(p_title, '') || ' ' || coalesce(p_description, '')) ~*
      '(oldindan\s+to.?lov|oldindan\s+pul|depozit|zalog|garov\s+pul|o.?qish\s+pullik|forma\s+uchun\s+pul|предоплат|залог|депозит|платное\s+обучение|оплатите\s+обучение|вступительный\s+взнос|олдиндан\s+тўлов)'
      then 'scam_words' end
  ], null);
$$;

create or replace function public.activate_vacancy_internal(p_vacancy_id uuid, p_window_end timestamptz)
returns public.vacancy_status language plpgsql security definer set search_path = public as $$
declare
  v public.vacancies;
  moderation boolean := coalesce((select (value)::boolean from public.app_settings where key = 'vacancy_moderation_enabled'), false);
  flags text[];
  new_status public.vacancy_status;
begin
  select * into v from public.vacancies where id = p_vacancy_id for update;
  if v.category_id is null or (v.region_id is null and not v.is_remote) then
    raise exception 'vacancy_incomplete' using errcode = '23514';
  end if;
  if v.status not in ('draft', 'paused', 'closed', 'expired', 'pending_review', 'rejected') then
    raise exception 'invalid_status' using errcode = '23514';
  end if;
  flags := public.vacancy_risk_flags(v.title, v.description);
  new_status := case when moderation or v.requires_review or cardinality(flags) > 0 then 'pending_review' else 'active' end;
  update public.vacancies
  set status = new_status,
      paid_until = p_window_end,
      published_at = case when new_status = 'active' then now() else published_at end,
      expires_at = case when new_status = 'active' then p_window_end else expires_at end,
      -- avtomatik izoh: moderator sababni ko'radi; matn tuzatilsa izoh olib tashlanadi (admin izohiga tegilmaydi)
      moderation_note = case
        when cardinality(flags) > 0 and (moderation_note is null or moderation_note like 'auto:%') then 'auto:' || array_to_string(flags, ',')
        when cardinality(flags) = 0 and moderation_note like 'auto:%' then null
        else moderation_note end
  where id = p_vacancy_id;
  if new_status = 'active' then
    perform public.refresh_matches_for_vacancy(p_vacancy_id);
    if v.published_at is null then perform public.notify_matching_workers(p_vacancy_id); end if;
  end if;
  return new_status;
end $$;

revoke execute on function public.activate_vacancy_internal(uuid, timestamptz), public.vacancy_risk_flags(text, text) from public, anon, authenticated;
grant execute on function public.vacancy_risk_flags(text, text) to service_role;
