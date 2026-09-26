#!/usr/bin/env python3
# supabase/migrations/0012_seed_reference.sql faylini generatsiya qiladi.
import os

def q(s): return "'" + s.replace("'", "''") + "'"

CATS = [
 # slug, uz, ru, icon, portfolio_recommended, subs[(slug, uz, ru)]
 ("it","IT va dasturlash","IT и программирование","laptop",True,[
  ("frontend","Frontend dasturchi","Frontend-разработчик"),("backend","Backend dasturchi","Backend-разработчик"),
  ("fullstack","Full-stack dasturchi","Full-stack разработчик"),("flutter","Flutter dasturchi","Flutter-разработчик"),
  ("android","Android dasturchi","Android-разработчик"),("ios","iOS dasturchi","iOS-разработчик"),
  ("uiux","UI/UX dizayner","UI/UX дизайнер"),("qa","QA / Tester","QA / Тестировщик"),("devops","DevOps","DevOps"),
  ("support","IT support / tizim administratori","IT support / системный администратор"),("data","Data analitik","Дата-аналитик"),
  ("1c","1C dasturchi","1C-программист")]),
 ("sales","Savdo","Продажи","shopping-cart",False,[
  ("seller","Sotuvchi","Продавец"),("consultant","Sotuvchi-konsultant","Продавец-консультант"),("cashier","Kassir","Кассир"),
  ("agent","Savdo agenti","Торговый агент"),("merchandiser","Merchandayzer","Мерчандайзер"),("sales_manager","Sotuv menejeri","Менеджер по продажам"),
  ("supervisor","Supervayzer","Супервайзер")]),
 ("marketing","Marketing va SMM","Маркетинг и SMM","megaphone",True,[
  ("marketer","Marketolog","Маркетолог"),("smm","SMM mutaxassis","SMM-специалист"),("target","Targetolog","Таргетолог"),
  ("copywriter","Kopirayter","Копирайтер"),("content","Kontent-meyker","Контент-мейкер"),("mobilographer","Mobilograf","Мобилограф"),
  ("brand","Brend-menejer","Бренд-менеджер"),("pr","PR mutaxassis","PR-специалист")]),
 ("design","Dizayn va media","Дизайн и медиа","palette",True,[
  ("graphic","Grafik dizayner","Графический дизайнер"),("interior","Interyer dizayneri","Дизайнер интерьера"),
  ("video","Videomontajchi","Видеомонтажёр"),("motion","Motion dizayner","Моушн-дизайнер"),("3d","3D vizualizator","3D-визуализатор"),
  ("photographer","Fotograf","Фотограф"),("videographer","Videograf","Видеограф")]),
 ("finance","Buxgalteriya va moliya","Бухгалтерия и финансы","calculator",False,[
  ("accountant","Buxgalter","Бухгалтер"),("chief_accountant","Bosh buxgalter","Главный бухгалтер"),
  ("assistant_accountant","Buxgalter yordamchisi","Помощник бухгалтера"),("financier","Moliyachi","Финансист"),
  ("economist","Iqtisodchi","Экономист"),("auditor","Auditor","Аудитор"),("credit","Kredit mutaxassisi","Кредитный специалист")]),
 ("driver","Haydovchi","Водитель","car",False,[
  ("cat_b","Haydovchi (B toifa)","Водитель (категория B)"),("cat_c","Haydovchi (C toifa)","Водитель (категория C)"),
  ("cat_d","Haydovchi (D toifa)","Водитель (категория D)"),("truck","Yuk mashinasi haydovchisi","Водитель грузовика"),
  ("taxi","Taksi haydovchisi","Водитель такси"),("personal","Shaxsiy haydovchi","Личный водитель"),("tractor","Traktorchi","Тракторист")]),
 ("logistics","Logistika va ombor","Логистика и склад","truck",False,[
  ("logist","Logist","Логист"),("forwarder","Ekspeditor","Экспедитор"),("dispatcher","Dispetcher","Диспетчер"),
  ("warehouse","Omborchi","Кладовщик"),("loader","Yuk tashuvchi","Грузчик"),("picker","Komplektovchi","Комплектовщик")]),
 ("courier","Kuryer va yetkazib berish","Курьер и доставка","bike",False,[
  ("foot","Piyoda kuryer","Пеший курьер"),("scooter","Skuter/velosiped kuryer","Курьер на скутере/велосипеде"),
  ("auto","Avto kuryer","Автокурьер"),("food","Ovqat yetkazuvchi","Доставщик еды")]),
 ("construction","Qurilish","Строительство","hard-hat",True,[
  ("mason","G'isht teruvchi","Каменщик"),("plasterer","Suvoqchi","Штукатур"),("tiler","Kafelchi","Плиточник"),
  ("concrete","Betonchi","Бетонщик"),("carpenter","Duradgor","Плотник"),("engineer","Muhandis-quruvchi","Инженер-строитель"),
  ("foreman","Prorab","Прораб"),("crane","Kranchi","Крановщик"),("laborer","Qora ishchi","Разнорабочий"),("roofer","Tomchi","Кровельщик")]),
 ("craftsman","Usta va ta'mirlash","Мастер и ремонт","wrench",True,[
  ("universal","Universal usta","Мастер на все руки"),("furniture","Mebel ustasi","Мебельщик"),("welder","Payvandchi","Сварщик"),
  ("hvac","Konditsioner ustasi","Мастер по кондиционерам"),("painter","Bo'yoqchi","Маляр"),("drywall","Gipsokarton ustasi","Гипсокартонщик"),
  ("appliance","Maishiy texnika ustasi","Мастер по бытовой технике"),("locksmith","Chilangar","Слесарь")]),
 ("electrician","Elektrik","Электрик","zap",False,[
  ("electrician","Elektrik","Электрик"),("electromontage","Elektromontajchi","Электромонтажник"),
  ("electronics","Elektron texnik","Техник-электронщик"),("high_voltage","Yuqori kuchlanish elektrigi","Электрик высоковольтных сетей")]),
 ("plumber","Santexnik","Сантехник","droplet",False,[
  ("plumber","Santexnik","Сантехник"),("heating","Isitish tizimi ustasi","Мастер отопления"),("sewage","Kanalizatsiya ustasi","Мастер канализации")]),
 ("mechanic","Mexanik va texnik","Механик и техник","cog",False,[
  ("mechanic","Mexanik","Механик"),("technician","Texnik","Техник"),("machinist","Stanokchi","Станочник"),("maintenance","Ta'mirlash ustasi","Ремонтник оборудования")]),
 ("auto_service","Avtoservis","Автосервис","car-front",False,[
  ("motorist","Motorist","Моторист"),("auto_electric","Avtoelektrik","Автоэлектрик"),("chassis","Xodovik","Ходовик"),
  ("body","Kuzovchi","Кузовщик"),("paint","Avto bo'yoqchi","Автомаляр"),("diagnost","Diagnost","Диагност"),
  ("tire","Shina ustasi","Шиномонтажник"),("oil","Moy almashtiruvchi","Мастер по замене масла"),("detailing","Deteyling ustasi","Мастер детейлинга")]),
 ("restaurant","Restoran va kafe","Ресторан и кафе","utensils",False,[
  ("waiter","Ofitsiant","Официант"),("bartender","Barmen","Бармен"),("barista","Barista","Бариста"),("cook","Oshpaz","Повар"),
  ("cook_assistant","Oshpaz yordamchisi","Помощник повара"),("baker","Novvoy","Пекарь"),("confectioner","Qandolatchi","Кондитер"),
  ("sushi","Sushi oshpazi","Сушист"),("hostess","Xostes","Хостес"),("dishwasher","Idish yuvuvchi","Посудомойщик"),
  ("admin","Restoran administratori","Администратор ресторана"),("pizza","Pitsameyker","Пиццамейкер")]),
 ("call_center","Call-markaz va operator","Колл-центр и оператор","headset",False,[
  ("operator","Operator","Оператор"),("call_center","Call-markaz operatori","Оператор колл-центра"),
  ("online","Onlayn konsultant","Онлайн-консультант"),("telemarketing","Telemarketolog","Телемаркетолог")]),
 ("office","Ofis va boshqaruv","Офис и управление","briefcase",False,[
  ("administrator","Administrator","Администратор"),("office_manager","Ofis-menejer","Офис-менеджер"),("secretary","Kotib(a)","Секретарь"),
  ("manager","Menejer","Менеджер"),("hr","HR menejer","HR-менеджер"),("recruiter","Rekruter","Рекрутер"),("lawyer","Yurist","Юрист"),
  ("project_manager","Loyiha menejeri","Проектный менеджер"),("assistant","Rahbar yordamchisi","Помощник руководителя")]),
 ("education","Ta'lim","Образование","graduation-cap",False,[
  ("teacher","O'qituvchi","Учитель"),("tutor","Repetitor","Репетитор"),("kindergarten","Tarbiyachi","Воспитатель"),
  ("english","Ingliz tili o'qituvchisi","Учитель английского"),("russian","Rus tili o'qituvchisi","Учитель русского"),
  ("math","Matematika o'qituvchisi","Учитель математики"),("trainer","Trener","Тренер"),("methodist","Metodist","Методист")]),
 ("medicine","Tibbiyot","Медицина","stethoscope",False,[
  ("doctor","Shifokor","Врач"),("nurse","Hamshira","Медсестра"),("pharmacist","Farmatsevt","Фармацевт"),("dentist","Stomatolog","Стоматолог"),
  ("lab","Laborant","Лаборант"),("massage","Massajchi","Массажист"),("caregiver","Qarovchi / hamshira","Сиделка")]),
 ("cleaning","Tozalik va uy xizmatlari","Уборка и домашний персонал","sparkles",False,[
  ("cleaner","Farrosh","Уборщик(ца)"),("housekeeper","Uy xizmatchisi","Домработница"),("nanny","Enaga","Няня"),
  ("gardener","Bog'bon","Садовник"),("dry_cleaning","Kimyoviy tozalash xodimi","Работник химчистки")]),
 ("security","Xavfsizlik","Безопасность","shield",False,[
  ("guard","Qo'riqchi","Охранник"),("security_officer","Xavfsizlik xodimi","Сотрудник безопасности"),
  ("cctv","Videokuzatuv operatori","Оператор видеонаблюдения"),("bodyguard","Tansoqchi","Телохранитель")]),
 ("sewing","Tikuvchilik","Швейное дело","scissors",True,[
  ("seamstress","Tikuvchi","Швея"),("cutter","Bichuvchi","Закройщик"),("ironer","Dazmolchi","Утюжильщик"),
  ("knitter","Trikotajchi","Вязальщик"),("designer","Modelyer","Модельер")]),
 ("beauty","Go'zallik sohasi","Индустрия красоты","scissors-line-dashed",True,[
  ("hairdresser","Sartarosh","Парикмахер"),("barber","Barber","Барбер"),("manicure","Manikyur ustasi","Мастер маникюра"),
  ("cosmetologist","Kosmetolog","Косметолог"),("makeup","Vizajist","Визажист"),("lashes","Kiprik ustasi","Лэшмейкер"),
  ("brows","Qosh ustasi","Бровист"),("massage","Massajchi","Массажист")]),
 ("production","Ishlab chiqarish","Производство","factory",False,[
  ("operator","Stanok operatori","Оператор станка"),("technologist","Texnolog","Технолог"),("packer","Qadoqlovchi","Упаковщик"),
  ("qc","Sifat nazoratchisi","Контролёр качества"),("assembler","Yig'uvchi","Сборщик"),("shift_lead","Smena boshlig'i","Начальник смены")]),
 ("agriculture","Qishloq xo'jaligi","Сельское хозяйство","wheat",False,[
  ("farmer","Fermer xodimi","Работник фермы"),("agronomist","Agronom","Агроном"),("vet","Veterinar","Ветеринар"),
  ("livestock","Chorvador","Животновод"),("greenhouse","Issiqxona ishchisi","Работник теплицы")]),
 ("other","Boshqa","Другое","more-horizontal",False,[("other","Boshqa","Другое")]),
]

SKILLS = {
 "it":[("javascript","JavaScript","JavaScript"),("typescript","TypeScript","TypeScript"),("react","React","React"),("nextjs","Next.js","Next.js"),
   ("nodejs","Node.js","Node.js"),("python","Python","Python"),("java","Java","Java"),("php","PHP","PHP"),("laravel","Laravel","Laravel"),
   ("flutter","Flutter","Flutter"),("kotlin","Kotlin","Kotlin"),("swift","Swift","Swift"),("sql","SQL","SQL"),("postgresql","PostgreSQL","PostgreSQL"),
   ("docker","Docker","Docker"),("git","Git","Git"),("figma","Figma","Figma"),("linux","Linux","Linux"),("csharp","C#","C#"),("golang","Go","Go")],
 "sales":[("pos","POS terminal","POS-терминал"),("cash","Naqd pul bilan ishlash","Работа с наличными"),("click","Click","Click"),("payme","Payme","Payme"),
   ("1c","1C","1C"),("reporting","Hisobot tayyorlash","Подготовка отчётов"),("excel","Excel","Excel"),("crm","CRM","CRM"),
   ("sales","Sotuv ko'nikmasi","Навыки продаж"),("negotiation","Muzokara","Переговоры"),("customer_service","Mijozlarga xizmat","Обслуживание клиентов"),
   ("merchandising","Merchandayzing","Мерчандайзинг"),("cold_calls","Sovuq qo'ng'iroqlar","Холодные звонки")],
 "marketing":[("instagram","Instagram","Instagram"),("telegram","Telegram","Telegram"),("target_ads","Target reklama","Таргетированная реклама"),
   ("google_ads","Google Ads","Google Ads"),("canva","Canva","Canva"),("copywriting","Kopirayting","Копирайтинг"),("content_plan","Kontent-plan","Контент-план"),
   ("analytics","Analitika","Аналитика"),("seo","SEO","SEO"),("capcut","CapCut","CapCut"),("mobilography","Mobilografiya","Мобилография")],
 "design":[("photoshop","Photoshop","Photoshop"),("illustrator","Illustrator","Illustrator"),("figma_d","Figma","Figma"),("premiere","Premiere Pro","Premiere Pro"),
   ("after_effects","After Effects","After Effects"),("3dsmax","3ds Max","3ds Max"),("blender","Blender","Blender"),("autocad","AutoCAD","AutoCAD"),
   ("corel","CorelDRAW","CorelDRAW"),("lightroom","Lightroom","Lightroom")],
 "finance":[("1c_acc","1C Buxgalteriya","1C Бухгалтерия"),("excel_f","Excel (ilg'or)","Excel (продвинутый)"),("tax","Soliq hisoboti","Налоговая отчётность"),
   ("didox","Didox / E-faktura","Didox / Электронные счета-фактуры"),("payroll","Ish haqi hisoblash","Расчёт зарплаты"),("ifrs","IFRS / XMHS","МСФО"),
   ("audit","Audit","Аудит"),("budgeting","Byudjetlash","Бюджетирование")],
 "driver":[("license_b","B toifa guvohnoma","Права категории B"),("license_c","C toifa guvohnoma","Права категории C"),("license_d","D toifa guvohnoma","Права категории D"),
   ("license_e","E toifa guvohnoma","Права категории E"),("own_car","Shaxsiy avtomobil","Личный автомобиль"),("manual","Mexanika","Механика"),
   ("intercity","Shaharlararo","Междугородние рейсы"),("yandex_go","Yandex Go","Yandex Go")],
 "logistics":[("warehouse_acc","Ombor hisobi","Складской учёт"),("wms","WMS","WMS"),("forklift","Pogruzchik boshqarish","Управление погрузчиком"),
   ("routes","Marshrut rejalashtirish","Планирование маршрутов"),("customs","Bojxona rasmiylashtiruvi","Таможенное оформление"),("excel_l","Excel","Excel")],
 "courier":[("scooter","Skuter","Скутер"),("bicycle","Velosiped","Велосипед"),("own_car_c","Shaxsiy avtomobil","Личный автомобиль"),
   ("city_knowledge","Shaharni yaxshi bilish","Знание города"),("yandex_eats","Yandex Eats / Uzum Tezkor","Yandex Eats / Uzum Tezkor")],
 "construction":[("masonry","G'isht terish","Кладка кирпича"),("plastering","Suvoq","Штукатурка"),("tiling","Kafel yotqizish","Укладка плитки"),
   ("concrete_w","Beton ishlari","Бетонные работы"),("drawings","Chizma o'qish","Чтение чертежей"),("laminate","Laminat yotqizish","Укладка ламината"),
   ("facade","Fasad ishlari","Фасадные работы"),("scaffolding","Iskala","Строительные леса")],
 "craftsman":[("welding","Payvandlash","Сварка"),("argon","Argon payvandlash","Аргонная сварка"),("furniture_m","Mebel yig'ish","Сборка мебели"),
   ("drywall_s","Gipsokarton","Гипсокартон"),("painting","Bo'yash","Покраска"),("hvac_s","Konditsioner o'rnatish","Установка кондиционеров"),
   ("appliance_r","Maishiy texnika ta'miri","Ремонт бытовой техники")],
 "electrician":[("wiring","Elektr simlarini tortish","Электропроводка"),("panel","Elektr shchit yig'ish","Сборка электрощитов"),
   ("automation","Avtomatika","Автоматика"),("high_v","Yuqori kuchlanish","Высокое напряжение"),("plc","PLC","ПЛК"),("schematics","Sxema o'qish","Чтение схем")],
 "plumber":[("pipes","Quvur o'tkazish","Монтаж труб"),("heating_s","Isitish tizimi","Система отопления"),("boiler","Kotyol o'rnatish","Установка котлов"),
   ("sanitary","Santexnika o'rnatish","Установка сантехники"),("ppr","PPR payvandlash","Пайка PPR")],
 "mechanic":[("lathe","Tokarlik","Токарные работы"),("milling","Frezerlik","Фрезерные работы"),("hydraulics","Gidravlika","Гидравлика"),
   ("cnc","CNC","ЧПУ"),("maintenance_s","Uskunalar ta'miri","Ремонт оборудования")],
 "auto_service":[("engine","Dvigatel ta'miri","Ремонт двигателя"),("auto_el","Avtoelektrika","Автоэлектрика"),("suspension","Xodovoy ta'miri","Ремонт ходовой"),
   ("bodywork","Kuzov ishlari","Кузовные работы"),("auto_paint","Avto bo'yash","Автопокраска"),("diagnostics","Kompyuter diagnostikasi","Компьютерная диагностика"),
   ("tire_s","Shinamontaj","Шиномонтаж"),("chevrolet","Chevrolet","Chevrolet"),("mercedes","Mercedes","Mercedes"),("bmw","BMW","BMW"),("toyota","Toyota","Toyota"),
   ("kia_hyundai","Kia / Hyundai","Kia / Hyundai"),("electric_cars","Elektromobillar","Электромобили")],
 "restaurant":[("uzbek_cuisine","O'zbek taomlari","Узбекская кухня"),("european","Yevropa taomlari","Европейская кухня"),("asian","Osiyo taomlari","Азиатская кухня"),
   ("coffee","Kofe tayyorlash","Приготовление кофе"),("latte_art","Latte-art","Латте-арт"),("cocktails","Kokteyllar","Коктейли"),
   ("r_keeper","R-Keeper / iiko","R-Keeper / iiko"),("service","Xizmat ko'rsatish standarti","Стандарты сервиса"),("haccp","Sanitariya (HACCP)","Санитария (HACCP)"),
   ("baking","Non yopish","Выпечка")],
 "call_center":[("phone_etiquette","Telefon etikasi","Телефонный этикет"),("crm_c","CRM","CRM"),("typing","Tez yozish","Быстрая печать"),
   ("objections","E'tirozlar bilan ishlash","Работа с возражениями"),("bitrix","Bitrix24","Bitrix24"),("amocrm","amoCRM","amoCRM")],
 "office":[("ms_office","MS Office","MS Office"),("google_docs","Google Docs","Google Docs"),("document_flow","Hujjat aylanishi","Документооборот"),
   ("recruiting","Rekruting","Рекрутинг"),("labor_law","Mehnat qonunchiligi","Трудовое законодательство"),("planning","Rejalashtirish","Планирование"),
   ("presentations","Prezentatsiya","Презентации"),("business_correspondence","Ish yozishmalari","Деловая переписка")],
 "education":[("ielts","IELTS","IELTS"),("cefr","CEFR","CEFR"),("methodology","Metodika","Методика"),("online_teaching","Onlayn dars","Онлайн-обучение"),
   ("kids","Bolalar bilan ishlash","Работа с детьми"),("curriculum","Dastur tuzish","Составление программы")],
 "medicine":[("injections","In'yeksiya","Инъекции"),("first_aid","Birinchi yordam","Первая помощь"),("diploma","Tibbiy diplom","Медицинский диплом"),
   ("license","Litsenziya","Лицензия"),("patient_care","Bemor parvarishi","Уход за больными"),("pharmacy","Dorixona ishi","Аптечное дело")],
 "cleaning":[("cleaning_s","Professional tozalash","Профессиональная уборка"),("chemicals","Kimyoviy vositalar","Химические средства"),
   ("childcare","Bola parvarishi","Уход за детьми"),("cooking_h","Ovqat tayyorlash","Приготовление еды"),("elderly_care","Keksalar parvarishi","Уход за пожилыми")],
 "security":[("guard_license","Qo'riqlash guvohnomasi","Лицензия охранника"),("cctv_s","Videokuzatuv","Видеонаблюдение"),("martial_arts","Jismoniy tayyorgarlik","Физическая подготовка"),
   ("access_control","Kirish nazorati","Контроль доступа")],
 "sewing":[("industrial_machine","Sanoat mashinasi","Промышленная машина"),("overlock","Overlok","Оверлок"),("cutting","Bichish","Раскрой"),
   ("pattern","Andoza","Лекала"),("embroidery","Kashta","Вышивка")],
 "beauty":[("haircut","Soch olish","Стрижка"),("coloring","Soch bo'yash","Окрашивание"),("manicure_s","Manikyur","Маникюр"),("pedicure","Pedikyur","Педикюр"),
   ("gel","Gel-lak","Гель-лак"),("makeup_s","Makiyaj","Макияж"),("lash_ext","Kiprik uzaytirish","Наращивание ресниц"),("brow_s","Qosh shakllantirish","Оформление бровей")],
 "production":[("machine_op","Stanok boshqarish","Управление станком"),("quality","Sifat nazorati","Контроль качества"),("packing","Qadoqlash","Упаковка"),
   ("assembly","Yig'ish","Сборка"),("safety","Mehnat xavfsizligi","Техника безопасности")],
 "agriculture":[("tractor_s","Traktor","Трактор"),("irrigation","Sug'orish","Орошение"),("livestock_s","Chorva parvarishi","Уход за скотом"),
   ("greenhouse_s","Issiqxona","Теплица"),("harvest","Hosil yig'ish","Сбор урожая")],
 None:[("uzbek","O'zbek tili","Узбекский язык"),("russian","Rus tili","Русский язык"),("english","Ingliz tili","Английский язык"),
   ("teamwork","Jamoada ishlash","Работа в команде"),("communication","Muloqot","Коммуникабельность"),("responsibility","Mas'uliyat","Ответственность"),
   ("computer","Kompyuter savodxonligi","Компьютерная грамотность"),("smartphone","Smartfon bilan ishlash","Работа со смартфоном"),
   ("time_management","Vaqtni boshqarish","Тайм-менеджмент"),("leadership","Liderlik","Лидерство"),("stress","Stressga chidamlilik","Стрессоустойчивость")],
}

REGIONS = [
 ("tashkent_city","Toshkent shahri","Ташкент",[
  ("bektemir","Bektemir","Бектемир",41.2103,69.3369),("chilonzor","Chilonzor","Чиланзар",41.2753,69.2040),("mirobod","Mirobod","Мирабад",41.2870,69.2870),
  ("mirzo_ulugbek","Mirzo Ulug'bek","Мирзо-Улугбек",41.3350,69.3350),("olmazor","Olmazor","Алмазар",41.3490,69.2110),("sergeli","Sergeli","Сергели",41.2230,69.2220),
  ("shayxontohur","Shayxontohur","Шайхантахур",41.3220,69.2320),("uchtepa","Uchtepa","Учтепа",41.2930,69.1720),("yakkasaroy","Yakkasaroy","Яккасарай",41.2860,69.2470),
  ("yashnobod","Yashnobod","Яшнабад",41.2930,69.3230),("yunusobod","Yunusobod","Юнусабад",41.3640,69.2860),("yangihayot","Yangihayot","Янгихаёт",41.2080,69.2680)]),
 ("tashkent_region","Toshkent viloyati","Ташкентская область",[
  ("nurafshon","Nurafshon","Нурафшон",41.0440,69.3580),("angren","Angren","Ангрен",41.0170,70.1430),("bekobod","Bekobod","Бекабад",40.2210,69.2700),
  ("boka","Bo'ka","Бука",40.8100,69.1990),("bostonliq","Bo'stonliq","Бостанлык",41.5900,69.9900),("chinoz","Chinoz","Чиназ",40.9370,68.7620),
  ("chirchiq","Chirchiq","Чирчик",41.4690,69.5820),("ohangaron","Ohangaron","Ахангаран",40.9070,69.6410),("olmaliq","Olmaliq","Алмалык",40.8440,69.5980),
  ("oqqorgon","Oqqo'rg'on","Аккурган",40.8570,69.0450),("parkent","Parkent","Паркент",41.2940,69.6760),("piskent","Piskent","Пскент",40.9040,69.3490),
  ("qibray","Qibray","Кибрай",41.3900,69.4650),("quyichirchiq","Quyichirchiq","Куйичирчик",40.9900,69.0700),("ortachirchiq","O'rtachirchiq","Уртачирчик",41.1400,69.3400),
  ("yangiyol","Yangiyo'l","Янгиюль",41.1120,69.0470),("yuqorichirchiq","Yuqorichirchiq","Юкоричирчик",41.2400,69.4700),("zangiota","Zangiota","Зангиата",41.2000,69.1200)]),
 ("samarkand","Samarqand","Самарканд",[
  ("samarkand_city","Samarqand shahri","г. Самарканд",39.6540,66.9600),("bulungur","Bulung'ur","Булунгур",39.7600,67.2700),("ishtixon","Ishtixon","Иштыхан",39.9700,66.4900),
  ("jomboy","Jomboy","Джамбай",39.7000,67.0900),("kattaqorgon","Kattaqo'rg'on","Каттакурган",39.9000,66.2600),("narpay","Narpay","Нарпай",39.9600,66.0500),
  ("nurobod","Nurobod","Нурабад",39.7700,66.1500),("oqdaryo","Oqdaryo","Акдарья",39.8400,66.7500),("pastdargom","Pastdarg'om","Пастдаргом",39.5500,66.7000),
  ("paxtachi","Paxtachi","Пахтачи",40.0500,65.9000),("payariq","Payariq","Пайарык",39.9900,66.8500),("qoshrabot","Qo'shrabot","Кошрабад",40.2400,66.6700),
  ("toyloq","Toyloq","Тайлак",39.6000,67.0500),("urgut","Urgut","Ургут",39.4000,67.2400)]),
 ("bukhara","Buxoro","Бухара",[
  ("bukhara_city","Buxoro shahri","г. Бухара",39.7680,64.4210),("kogon","Kogon","Каган",39.7200,64.5500),("gijduvon","G'ijduvon","Гиждуван",40.1000,64.6800),
  ("jondor","Jondor","Жондор",39.7300,64.1900),("olot","Olot","Алат",39.4200,63.8000),("peshku","Peshku","Пешку",40.2400,64.1200),
  ("qorakol","Qorako'l","Каракуль",39.5000,63.8500),("qorovulbozor","Qorovulbozor","Караулбазар",39.5000,64.8000),("romitan","Romitan","Ромитан",39.9300,64.3800),
  ("shofirkon","Shofirkon","Шафиркан",40.1200,64.5000),("vobkent","Vobkent","Вабкент",40.0300,64.5100)]),
 ("andijan","Andijon","Андижан",[
  ("andijan_city","Andijon shahri","г. Андижан",40.7830,72.3440),("asaka","Asaka","Асака",40.6400,72.2400),("baliqchi","Baliqchi","Балыкчи",40.8800,71.8600),
  ("boz","Bo'z","Боз",40.7300,71.9200),("buloqboshi","Buloqboshi","Булакбаши",40.6300,72.4700),("izboskan","Izboskan","Избаскан",40.9100,72.1500),
  ("jalaquduq","Jalaquduq","Джалакудук",40.7300,72.6300),("marhamat","Marhamat","Мархамат",40.4800,72.3200),("oltinkol","Oltinko'l","Алтынкуль",40.7900,72.1500),
  ("paxtaobod","Paxtaobod","Пахтаабад",40.9400,72.4800),("qorgontepa","Qo'rg'ontepa","Кургантепа",40.7300,72.7600),("shahrixon","Shahrixon","Шахрихан",40.7100,72.0500),
  ("ulugnor","Ulug'nor","Улугнор",40.7900,71.6900),("xojaobod","Xo'jaobod","Ходжаабад",40.6700,72.5600),("xonobod","Xonobod","Ханабад",40.8000,72.9700)]),
 ("namangan","Namangan","Наманган",[
  ("namangan_city","Namangan shahri","г. Наманган",40.9980,71.6730),("chortoq","Chortoq","Чартак",41.0700,71.8200),("chust","Chust","Чуст",41.0000,71.2400),
  ("kosonsoy","Kosonsoy","Касансай",41.2500,71.5500),("mingbuloq","Mingbuloq","Мингбулак",40.8100,71.2100),("norin","Norin","Нарын",40.9200,71.7800),
  ("pop","Pop","Пап",40.8700,71.1100),("toraqorgon","To'raqo'rg'on","Туракурган",41.0000,71.5100),("uchqorgon","Uchqo'rg'on","Учкурган",41.1100,72.0800),
  ("uychi","Uychi","Уйчи",41.0800,71.9300),("yangiqorgon","Yangiqo'rg'on","Янгикурган",41.1900,71.7300)]),
 ("fergana","Farg'ona","Фергана",[
  ("fergana_city","Farg'ona shahri","г. Фергана",40.3860,71.7860),("margilan","Marg'ilon","Маргилан",40.4700,71.7200),("kokand","Qo'qon","Коканд",40.5300,70.9400),
  ("quvasoy","Quvasoy","Кувасай",40.3000,71.9800),("beshariq","Beshariq","Бешарык",40.4300,70.6100),("bagdod","Bag'dod","Багдад",40.4900,71.2200),
  ("buvayda","Buvayda","Бувайда",40.6300,71.0500),("dangara","Dang'ara","Дангара",40.5900,70.9000),("furqat","Furqat","Фуркат",40.5000,71.0800),
  ("oltiariq","Oltiariq","Алтыарык",40.3900,71.4800),("qoshtepa","Qo'shtepa","Куштепа",40.4900,71.6100),("rishton","Rishton","Риштан",40.3600,71.2800),
  ("sox","So'x","Сох",39.9600,71.1300),("toshloq","Toshloq","Ташлак",40.4900,71.7500),("uchkoprik","Uchko'prik","Учкуприк",40.5300,71.0700),
  ("yozyovon","Yozyovon","Язъяван",40.6600,71.7200),("ozbekiston","O'zbekiston","Узбекистан",40.4700,71.3600)]),
 ("kashkadarya","Qashqadaryo","Кашкадарья",[
  ("karshi","Qarshi","Карши",38.8600,65.7890),("shahrisabz","Shahrisabz","Шахрисабз",39.0500,66.8300),("guzor","G'uzor","Гузар",38.6200,66.2500),
  ("dehqonobod","Dehqonobod","Дехканабад",38.3400,66.5000),("kasbi","Kasbi","Касби",38.9500,65.5600),("kitob","Kitob","Китаб",39.1200,66.8800),
  ("koson","Koson","Касан",39.0400,65.5900),("mirishkor","Mirishkor","Миришкор",38.8000,65.3600),("muborak","Muborak","Мубарек",39.2600,65.1600),
  ("nishon","Nishon","Нишан",38.6300,65.6800),("qamashi","Qamashi","Камаши",38.8200,66.4700),("chiroqchi","Chiroqchi","Чиракчи",39.0300,66.5700),
  ("yakkabog","Yakkabog'","Яккабаг",38.9700,66.6600)]),
 ("surkhandarya","Surxondaryo","Сурхандарья",[
  ("termez","Termiz","Термез",37.2240,67.2780),("angor","Angor","Ангор",37.4900,67.1300),("boysun","Boysun","Байсун",38.2000,67.2000),
  ("denov","Denov","Денау",38.2700,67.9000),("jarqorgon","Jarqo'rg'on","Джаркурган",37.5100,67.4200),("muzrabot","Muzrabot","Музрабад",37.4500,67.0000),
  ("oltinsoy","Oltinsoy","Алтынсай",38.1200,67.6300),("qiziriq","Qiziriq","Кизирик",37.8000,67.4400),("qumqorgon","Qumqo'rg'on","Кумкурган",37.8300,67.5700),
  ("sariosiyo","Sariosiyo","Сариасия",38.4100,67.9500),("sherobod","Sherobod","Шерабад",37.6700,67.0000),("shorchi","Sho'rchi","Шурчи",37.9900,67.7900),
  ("uzun","Uzun","Узун",38.3000,68.0000),("bandixon","Bandixon","Бандихан",37.8800,67.7000)]),
 ("jizzakh","Jizzax","Джизак",[
  ("jizzakh_city","Jizzax shahri","г. Джизак",40.1160,67.8420),("arnasoy","Arnasoy","Арнасай",40.6700,67.9000),("baxmal","Baxmal","Бахмал",39.8300,67.9500),
  ("dostlik","Do'stlik","Дустлик",40.5200,68.0400),("forish","Forish","Фариш",40.5500,66.7400),("gallaorol","G'allaorol","Галляарал",40.0200,67.5900),
  ("mirzachol","Mirzacho'l","Мирзачуль",40.4600,68.4100),("paxtakor","Paxtakor","Пахтакор",40.3200,67.9600),("sharof_rashidov","Sharof Rashidov","Шараф Рашидов",40.2000,67.8000),
  ("yangiobod","Yangiobod","Янгиабад",40.0500,68.1200),("zafarobod","Zafarobod","Зафарабад",40.4400,68.3300),("zarbdor","Zarbdor","Зарбдар",40.4000,68.2000),
  ("zomin","Zomin","Заамин",39.9600,68.4000)]),
 ("syrdarya","Sirdaryo","Сырдарья",[
  ("guliston","Guliston","Гулистан",40.4900,68.7800),("yangiyer","Yangiyer","Янгиер",40.2700,68.8200),("shirin","Shirin","Ширин",40.2300,69.1000),
  ("boyovut","Boyovut","Баяут",40.3700,68.9300),("mirzaobod","Mirzaobod","Мирзаабад",40.5800,68.6200),("oqoltin","Oqoltin","Акалтын",40.5300,68.5200),
  ("sardoba","Sardoba","Сардоба",40.5200,68.3000),("sayxunobod","Sayxunobod","Сайхунабад",40.7400,68.7300),("sirdaryo","Sirdaryo","Сырдарья",40.8400,68.6600),
  ("xovos","Xovos","Хавас",40.2100,68.8200)]),
 ("navoi","Navoiy","Навои",[
  ("navoi_city","Navoiy shahri","г. Навои",40.0840,65.3790),("zarafshon","Zarafshon","Зарафшан",41.5800,64.2000),("gozgon","G'ozg'on","Газган",40.1200,65.5500),
  ("karmana","Karmana","Кармана",40.1300,65.3500),("konimex","Konimex","Канимех",40.2900,65.1300),("navbahor","Navbahor","Навбахор",40.2200,65.6300),
  ("nurota","Nurota","Нурата",40.5600,65.6900),("qiziltepa","Qiziltepa","Кызылтепа",40.0300,64.8500),("tomdi","Tomdi","Тамды",41.5800,64.9000),
  ("uchquduq","Uchquduq","Учкудук",42.1600,63.5600),("xatirchi","Xatirchi","Хатырчи",40.1600,65.8300)]),
 ("khorezm","Xorazm","Хорезм",[
  ("urgench","Urganch","Ургенч",41.5500,60.6300),("khiva","Xiva","Хива",41.3800,60.3600),("bogot","Bog'ot","Багат",41.3200,60.8600),
  ("gurlan","Gurlan","Гурлен",41.8400,60.3900),("hazorasp","Hazorasp","Хазарасп",41.3200,61.0700),("qoshkopir","Qo'shko'pir","Кошкупыр",41.5300,60.3500),
  ("shovot","Shovot","Шават",41.6700,60.3000),("tuproqqala","Tuproqqal'a","Тупроккала",41.6500,60.5000),("xonqa","Xonqa","Ханка",41.4700,60.8100),
  ("yangiariq","Yangiariq","Янгиарык",41.3600,60.5900),("yangibozor","Yangibozor","Янгибазар",41.7400,60.7100)]),
 ("karakalpakstan","Qoraqalpog'iston","Каракалпакстан",[
  ("nukus","Nukus","Нукус",42.4600,59.6100),("amudaryo","Amudaryo","Амударья",42.1300,60.0300),("beruniy","Beruniy","Беруни",41.6900,60.7500),
  ("chimboy","Chimboy","Чимбай",42.9400,59.7800),("ellikqala","Ellikqal'a","Элликкала",41.9000,60.8000),("kegeyli","Kegeyli","Кегейли",42.7700,59.6100),
  ("moynoq","Mo'ynoq","Муйнак",43.7700,59.0200),("qanlikol","Qanliko'l","Канлыкуль",42.8000,59.0200),("qongirot","Qo'ng'irot","Кунград",43.0500,58.8500),
  ("qoraozak","Qorao'zak","Караузяк",43.0100,60.0200),("shumanay","Shumanay","Шуманай",42.6200,58.9000),("taxtakopir","Taxtako'pir","Тахтакупыр",43.0200,60.6000),
  ("tortkol","To'rtko'l","Турткуль",41.5500,61.0000),("xojayli","Xo'jayli","Ходжейли",42.4000,59.4500),("bozatov","Bo'zatov","Бозатау",43.2000,59.5000),
  ("taxiatosh","Taxiatosh","Тахиаташ",42.3300,59.6000)]),
]

LANGS=[("uz","O'zbek tili","Узбекский"),("ru","Rus tili","Русский"),("en","Ingliz tili","Английский"),("tr","Turk tili","Турецкий"),
 ("kk","Qozoq tili","Казахский"),("tg","Tojik tili","Таджикский"),("ko","Koreys tili","Корейский"),("zh","Xitoy tili","Китайский"),
 ("de","Nemis tili","Немецкий"),("ar","Arab tili","Арабский"),("fr","Fransuz tili","Французский")]

BENEFITS=[
 ("benefit","food","Ovqat","Питание"),("benefit","transport","Transport","Транспорт"),("benefit","phone_expenses","Telefon xarajati","Оплата связи"),
 ("benefit","bonus","Bonus","Бонусы"),("benefit","kpi","KPI","KPI"),("benefit","dormitory","Yotoqxona","Общежитие"),("benefit","uniform","Forma","Форма"),
 ("benefit","training","O'qitish","Обучение"),("benefit","career_growth","Karyera o'sishi","Карьерный рост"),("benefit","flexible_hours","Moslashuvchan grafik","Гибкий график"),
 ("benefit","health_insurance","Tibbiy sug'urta","Медицинская страховка"),("benefit","fuel","Yoqilg'i","ГСМ"),
 ("official_term","labor_contract","Mehnat shartnomasi","Трудовой договор"),("official_term","tax_registration","Soliq rasmiylashtirish","Налоговое оформление"),
 ("official_term","card_salary","Oylik karta orqali","Зарплата на карту"),("official_term","social_package","Ijtimoiy paket","Социальный пакет"),
 ("official_term","paid_leave","Ta'til","Оплачиваемый отпуск"),("official_term","sick_leave","Kasallik varaqasi","Больничный"),
 ("official_term","official_bonus","Rasmiy bonus","Официальные премии"),
]

out=["-- ISH.UZ · 0012 · ma'lumotnoma seed (scripts/gen/seed_reference.py orqali yaratilgan)",""]
out.append("insert into public.languages (code, name_uz, name_ru, sort_order) values")
out.append(",\n".join(f"  ({q(c)}, {q(u)}, {q(r)}, {i*10})" for i,(c,u,r) in enumerate(LANGS))+"\non conflict (code) do update set name_uz = excluded.name_uz, name_ru = excluded.name_ru;\n")
out.append("insert into public.benefits (code, name_uz, name_ru, kind, sort_order) values")
out.append(",\n".join(f"  ({q(c)}, {q(u)}, {q(r)}, {q(k)}, {i*10})" for i,(k,c,u,r) in enumerate(BENEFITS))+"\non conflict (code) do update set name_uz = excluded.name_uz, name_ru = excluded.name_ru, kind = excluded.kind;\n")
out.append("insert into public.categories (slug, name_uz, name_ru, icon, sort_order, portfolio_recommended) values")
out.append(",\n".join(f"  ({q(s)}, {q(u)}, {q(r)}, {q(ic)}, {i*10}, {str(pf).lower()})" for i,(s,u,r,ic,pf,_) in enumerate(CATS))+"\non conflict (slug) do update set name_uz = excluded.name_uz, name_ru = excluded.name_ru, icon = excluded.icon, sort_order = excluded.sort_order, portfolio_recommended = excluded.portfolio_recommended;\n")
out.append("insert into public.subcategories (category_id, slug, name_uz, name_ru, sort_order)\nselect c.id, s.slug, s.name_uz, s.name_ru, s.sort_order from (values")
rows=[]
for cs,_,_,_,_,subs in CATS:
    for i,(s,u,r) in enumerate(subs): rows.append(f"  ({q(cs)}, {q(s)}, {q(u)}, {q(r)}, {i*10})")
out.append(",\n".join(rows)+"\n) as s(category_slug, slug, name_uz, name_ru, sort_order)\njoin public.categories c on c.slug = s.category_slug\non conflict (category_id, slug) do update set name_uz = excluded.name_uz, name_ru = excluded.name_ru, sort_order = excluded.sort_order;\n")
out.append("insert into public.skills (slug, name_uz, name_ru, category_id)\nselect s.slug, s.name_uz, s.name_ru, c.id from (values")
rows=[]
for cs,items in SKILLS.items():
    for s,u,r in items:
        slug = f"{cs}_{s}" if cs else f"general_{s}"
        rows.append(f"  ({q(slug)}, {q(u)}, {q(r)}, {q(cs) if cs else 'null'})")
out.append(",\n".join(rows)+"\n) as s(slug, name_uz, name_ru, category_slug)\nleft join public.categories c on c.slug = s.category_slug\non conflict (slug) do update set name_uz = excluded.name_uz, name_ru = excluded.name_ru, category_id = excluded.category_id;\n")
out.append("insert into public.regions (slug, name_uz, name_ru, sort_order) values")
out.append(",\n".join(f"  ({q(s)}, {q(u)}, {q(r)}, {i*10})" for i,(s,u,r,_) in enumerate(REGIONS))+"\non conflict (slug) do update set name_uz = excluded.name_uz, name_ru = excluded.name_ru, sort_order = excluded.sort_order;\n")
out.append("insert into public.districts (region_id, slug, name_uz, name_ru, lat, lng, sort_order)\nselect r.id, d.slug, d.name_uz, d.name_ru, d.lat, d.lng, d.sort_order from (values")
rows=[]
for rs,_,_,ds in REGIONS:
    for i,(s,u,r,lat,lng) in enumerate(ds): rows.append(f"  ({q(rs)}, {q(s)}, {q(u)}, {q(r)}, {lat}, {lng}, {i*10})")
out.append(",\n".join(rows)+"\n) as d(region_slug, slug, name_uz, name_ru, lat, lng, sort_order)\njoin public.regions r on r.slug = d.region_slug\non conflict (region_id, slug) do update set name_uz = excluded.name_uz, name_ru = excluded.name_ru, lat = excluded.lat, lng = excluded.lng, sort_order = excluded.sort_order;\n")
path=os.path.join(os.path.dirname(__file__),"..","..","supabase","migrations","0012_seed_reference.sql")
open(path,"w").write("\n".join(out))
print("written", path, sum(len(s) for _,_,_,_,_,s in CATS), "subcategories,", sum(len(v) for v in SKILLS.values()), "skills,", sum(len(d) for *_,d in REGIONS), "districts")
