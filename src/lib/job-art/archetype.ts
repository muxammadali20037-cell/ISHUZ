import type { Archetype } from "./person";

/**
 * Kasb → kiyim turi (oq xalat, oshpaz, kaska…). Avval kasb nomidagi so'zlar (ingliz, rus, o'zbek; sarlavha ham),
 * topilmasa — kategoriya. Tartib muhim: aniqrog'i oldin ("hamshira" — "shifokor"dan, "forklift" — "haydovchi"dan oldin).
 * Sof funksiya: barcha ~1900 kasb uchun bir xil natija (testlar bilan).
 */
const RULES: [RegExp, Archetype][] = [
  [/\bnurse\b|\bnurses|\bnursing|медсестр|медбрат|hamshira/, "nurse"],
  [/cyber|кибер/, "it"],
  [/sound engineer|звукорежисс/, "creative"],
  [/furniture|мебел/, "artisan"],
  [/courier|deliver|postman|\bmail |курьер|доставк|почтал|kuryer|yetkazib|pochtachi/, "courier"],
  [/police|полиц|politsiya/, "security"],
  [/massag|piercing|henna|tattoo|gel polish|тату|хна|cosmetolog|manicur|pedicur|\bnail|make-?up|beaut|esthetic|\blash|\bbrow|waxing|\bspa\b|косметолог|маникюр|педикюр|визаж|массаж|бров|ресниц|kosmetolog|manikyur|pedikyur|vizaj|massaj/, "beauty"],
  [/barber|hairdress|hair stylist|парикмах|барбер|sartarosh/, "barber"],
  [/pharmac|laborat|\blab\b|chemist|scientist|research|veterin|фармацевт|провизор|лаборант|химик|ветеринар|научн|farmatsevt|laborant|kimyogar|veterinar/, "lab"],
  [/doctor|physician|surgeon|dentist|dental|pediatric|therapist|cardiolog|neurolog|gynec|ophthalm|radiolog|psychiatr|dermatolog|urolog|paramedic|\bvrach|врач|хирург|стоматолог|педиатр|терапевт|фельдшер|shifokor|jarroh|stomatolog|feldsher/, "doctor"],
  [/\bcook|\bchef|baker|pastry|confection|butcher|kitchen|grill|pizza|sushi|повар|пекар|кондитер|мясник|кухн|oshpaz|novvoy|qandolat|somsa|kabob|shashlik|qassob/, "chef"],
  [/waiter|waitress|bartender|sommelier|hostess|официант|бармен|сомелье|ofitsiant|barmen/, "waiter"],
  [/barista|бариста|coffee|кофе/, "barista"],
  [/cashier|teller|кассир|kassir/, "cashier"],
  [/forklift|loader|warehouse|storekeeper|\bstock|order picker|packer|погрузчик|грузчик|склад|кладовщ|комплектов|упаковщ|omborchi|ombor|yuk ortuv|yukchi|qadoqlov/, "warehouse"],
  [/reception|concierge|hotel|bellboy|flight attendant|steward|ресепшн|портье|стюард|mehmonxona/, "hotel"],
  [/weld|сварщ|payvand/, "welder"],
  [/electric|электрик|электромонт|электромех|elektrik|elektromont|cctv|intercom|домофон/, "electrician"],
  [/plumb|pipe ?fitter|сантехник|santexnik/, "plumber"],
  [/\bminer|mining|driller|drilling|oil (and|&) gas|oil field|oilfield|refinery|petroleum|шахт|горняк|бурил|нефтегаз|konchi|burg'ul/, "miner"],
  [/builder|construct|mason|brick|carpent|roofer|roofing|plaster|concrete|\btiler|tiling|facade|excavat|crane|bulldoz|grader|excavator|road roller|scaffold|house painter|строит|каменщ|плотник|кровел|штукатур|бетон|плиточ|маляр|экскават|крановщ|quruvchi|g'isht|duradgor|suvoq|bo'yoqchi|kafel|ekskavator|kranchi/, "builder"],
  [/driver|chauffeur|taxi|bus conductor|train conductor|\bpilot|(?<![а-яё])водител|таксист|шофер|пилот|haydovchi|taksi|uchuvchi/, "driver"],
  [/clean|janitor|\bmaid|housekeep|laundry|yard keeper|dishwash|уборщ|горничн|клининг|прачеч|дворник|посудомо|farrosh|tozalov|idish yuv/, "cleaner"],
  [/security|guard|watchman|охран|сторож|qo'riqchi|qorovul|xavfsizlik|soqchi/, "security"],
  [/nanny|babysit|caregiver|governess|kindergarten|preschool|nursery school|няня|сиделк|воспитат|гувернант|enaga|tarbiyachi|parvarish/, "nanny"],
  [/tailor|seamstress|sewing|dressmak|garment|embroider|knit|weav|швея|портн|закройщ|вышив|вязал|ткач|tikuvchi|bichuvchi|chevar|kashta|to'quvchi/, "tailor"],
  [/farm|garden|agronom|tractor|livestock|shepherd|grower|orchard|irrigat|forest|beekeep|poultry|фермер|садовн|агроном|тракторист|животнов|пастух|пчел|птицев|dehqon|bog'bon|traktor|chorva|cho'pon|asalari|parranda/, "farmer"],
  [/call cent|hotline|support agent|support specialist|chat support|telemarket|колл-центр|горячей линии|kol-markaz/, "callcenter"],
  [/developer|programm|software|devops|frontend|backend|full-?stack|data scien|data engineer|\bqa\b|tester|sysadmin|system admin|network admin|cyber|программист|разработчик|тестировщ|сисадмин|dasturchi/, "it"],
  [/mechanic|repair|technician|\btire|\btyre|car wash|vulcan|механик|ремонт|слесар|шиномонтаж|автомой|mexanik|ta'mirlov|vulkan/, "mechanic"],
  [/teacher|tutor|instructor|lecturer|professor|principal|\bcoach|trainer|pedagog|учител|преподав|репетитор|тренер|педагог|o'qituvchi|ustoz|murabbiy/, "teacher"],
  [/design|artist|photograph|video|animat|\beditor|journalist|reporter|musician|singer|\bactor|dancer|sculpt|calligraph|дизайнер|художник|фотограф|видео|журналист|музыкант|режисс|dizayner|rassom|fotograf|jurnalist|xonanda/, "creative"],
  [/seller|shop assistant|sales (assistant|consultant|associate|representative)|salesperson|merchandis|продав|мерчандайз|sotuvchi/, "seller"],
  [/craft|maker|carver|potter|ceramic|jewel|smith|glassblow|furniture|ремесл|гончар|ювелир|кузнец|мебел|hunarmand|kulol|zargar|temirchi/, "artisan"],
  [/engineer|surveyor|инженер|геодез|muhandis/, "engineer"],
  [/account|audit|econom|financ|\bbank|lawyer|attorney|legal|notary|manager|director|assistant|secretary|recruit|\bhr\b|analyst|consultant|clerk|administrator|бухгалт|аудит|экономист|финанс|банк|юрист|адвокат|нотариус|менеджер|директор|секретар|ассистент|рекрутер|аналитик|buxgalter|iqtisod|moliya|yurist|advokat|notarius|menejer|direktor|kotib/, "office"],
  [/machinist|assembler|factory|production line|turner|milling|\bcnc|станочн|токар|фрезер|stanok|tokar/, "factory"],
];

const CATEGORY: Record<string, Archetype> = {
  it: "it",
  sales: "seller",
  marketing: "office",
  design: "creative",
  finance: "office",
  driver: "driver",
  logistics: "warehouse",
  courier: "courier",
  construction: "builder",
  craftsman: "artisan",
  electrician: "electrician",
  plumber: "plumber",
  mechanic: "mechanic",
  auto_service: "mechanic",
  restaurant: "chef",
  call_center: "callcenter",
  office: "office",
  education: "teacher",
  medicine: "doctor",
  cleaning: "cleaner",
  security: "security",
  sewing: "tailor",
  beauty: "beauty",
  production: "factory",
  agriculture: "farmer",
  hotel: "hotel",
  legal: "office",
  science: "lab",
  management: "office",
  government: "office",
  engineering: "engineer",
  telecom: "engineer",
  energy: "engineer",
  mining: "miner",
  culture: "creative",
  real_estate: "office",
  crafts: "artisan",
};

export function jobArchetype(input: { names: (string | null | undefined)[]; categorySlug?: string | null }): Archetype {
  const text = input.names
    .filter((x): x is string => !!x)
    .join(" | ")
    .toLowerCase()
    .replace(/[ʻʼ’`‘]/g, "'");
  if (text) for (const [re, a] of RULES) if (re.test(text)) return a;
  return (input.categorySlug && CATEGORY[input.categorySlug]) || "generic";
}
