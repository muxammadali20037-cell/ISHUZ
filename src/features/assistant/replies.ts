import type { AiFindResult } from "@/features/find/ai-find-types";
import type { AssistantLang, AssistantRole } from "./types";

/**
 * AI ulanmagan yoki ishlamagan paytdagi javoblar (lug'at va shablon) — foydalanuvchi baribir o'z tilida, tushunarli javob
 * oladi va bazadagi haqiqiy e'lonlarni ko'radi. Bir xil gap takrorlanmasin: har holat uchun bir nechta ko'rinish,
 * suhbatdagi navbat (`turn`) bo'yicha almashadi. Sonlar faqat bazadan (data.total).
 */
type Variants = readonly string[];
const pick = (list: Variants, turn: number) => list[turn % list.length]!;

const GREETING = /^(salom|assalomu alaykum|assalom|va alaykum|hello|hi|hey|привет|здравствуйте|добрый день|салом|ассалому алайкум)[\s!.,]*$/iu;
const THANKS = /^(rahmat|katta rahmat|raxmat|thanks|thank you|thx|спасибо|большое спасибо|раҳмат|рахмат|катта раҳмат)[\s!.,]*$/iu;
const WHO = /(sen kimsan|siz kimsiz|kimsan|robotmisan|odammisiz|are you (a )?(human|bot|ai|robot)|who are you|ты кто|вы кто|ты бот|вы бот|ты человек|сен кимсан|сиз кимсиз|роботмисан)/iu;

export type SmallTalk = "greeting" | "thanks" | "who" | null;

export function smallTalk(text: string): SmallTalk {
  const s = text.trim();
  if (s.length > 60) return null;
  if (WHO.test(s)) return "who";
  if (GREETING.test(s)) return "greeting";
  if (THANKS.test(s)) return "thanks";
  return null;
}

const T: Record<AssistantLang, Record<AssistantRole, Record<"greeting" | "thanks" | "who" | "found" | "widened" | "none" | "unclear" | "failed", Variants>>> = {
  uz: {
    seeker: {
      greeting: ["Assalomu alaykum! Men Ish topdim AI yordamchisiman. Qanday ish qidiryapsiz — kasb va tumaningizni yozsangiz, bazadan qarab beraman."],
      thanks: ["Arzimaydi. Yana qaysi ish bo'yicha qarab beray?", "Marhamat. Boshqa hudud yoki kasb bo'yicha ham qidirib ko'raymi?"],
      who: ["Men sun'iy intellektman — Ish topdim platformasining AI yordamchisi. Bazadagi haqiqiy e'lonlardan sizga mos ishni topishga yordam beraman. Qanday ish kerak?"],
      found: ["So'rovingiz bo'yicha {n} ta e'lon topdim — pastda ko'rsatdim. Maosh yoki ish vaqti bo'yicha aniqlashtiraymi?", "Bazada {n} ta mos e'lon bor, eng yangilari pastda. Qaysi biri bo'yicha batafsil aytay?", "{n} ta e'lon chiqdi. Xohlasangiz, tuman yoki maosh bo'yicha toraytiraman."],
      widened: ["Aynan so'raganingiz bo'yicha hozircha e'lon yo'q edi, shuning uchun qidiruvni kengaytirdim: {n} ta yaqin e'lon topildi. Nimani o'zgartirganim yuqorida yozilgan.", "Aniq shu shartlar bilan topilmadi. Kengroq qidirib, {n} ta e'lon topdim — nimasi farq qilishini yuqorida ko'rsatdim."],
      none: ["Hozircha bazada bunday e'lon yo'q. Yangisi chiqqanda Telegram'da xabar olishingiz mumkin — tugma pastda. Yoki boshqa tuman yoki yaqin kasb bo'yicha qarab beraymi?", "Afsuski, hozir mos e'lon topilmadi. Pastdagi tugma bilan xabarnoma yoqib qo'ysangiz, chiqishi bilan bilib olasiz. Boshqa hududni ham ko'raymi?"],
      unclear: ["Qaysi kasb haqida gap ketayotganini aniq tushunmadim. Kasbni bitta so'z bilan yozing — masalan «oshpaz» yoki «haydovchi».", "Kasbni aniqlay olmadim. Qanday ish qidiryapsiz — bir-ikki so'z bilan ayting."],
      failed: ["Hozir bazaga ulanishda muammo bo'ldi. Bir ozdan keyin yana urinib ko'ring."],
    },
    employer: {
      greeting: ["Assalomu alaykum! Men Ish topdim AI yordamchisiman. Qanday xodim kerak — kasbi va hududini yozsangiz, bazadagi nomzodlardan qarab beraman."],
      thanks: ["Arzimaydi. Yana qaysi lavozim bo'yicha nomzod qidiray?", "Marhamat. Boshqa hudud bo'yicha ham qarab beraymi?"],
      who: ["Men sun'iy intellektman — Ish topdim platformasining AI yordamchisi. Bazadagi haqiqiy nomzodlarni topishga yordam beraman; kimni ishga olishni o'zingiz hal qilasiz. Qanday xodim kerak?"],
      found: ["So'rovingiz bo'yicha {n} ta nomzod topdim — pastda. Tajriba yoki hudud bo'yicha toraytiraymi?", "Bazada {n} ta mos nomzod bor. Tanlov o'zingizda — xohlasangiz, talablarni aniqlashtiramiz."],
      widened: ["Aynan shu talablar bilan nomzod topilmadi, shuning uchun qidiruvni kengaytirdim: {n} ta yaqin nomzod bor. Nimani o'zgartirganim yuqorida yozilgan."],
      none: ["Hozircha bunday nomzod yo'q. Vakansiya joylasangiz, mos ishchilar o'zlari ariza yuboradi — tugma pastda. Boshqa hududni ham ko'raymi?"],
      unclear: ["Qanday mutaxassis kerakligini aniq tushunmadim. Kasbni bitta so'z bilan yozing — masalan «sotuvchi» yoki «oshpaz»."],
      failed: ["Hozir bazaga ulanishda muammo bo'ldi. Bir ozdan keyin yana urinib ko'ring."],
    },
  },
  oz: {
    seeker: {
      greeting: ["Ассалому алайкум! Мен Ish topdim AI ёрдамчисиман. Қандай иш қидиряпсиз — касб ва туманингизни ёзсангиз, базадан қараб бераман."],
      thanks: ["Арзимайди. Яна қайси иш бўйича қараб берай?", "Марҳамат. Бошқа ҳудуд ёки касб бўйича ҳам қидириб кўрайми?"],
      who: ["Мен сунъий интеллектман — Ish topdim платформасининг AI ёрдамчиси. Базадаги ҳақиқий эълонлардан сизга мос ишни топишга ёрдам бераман. Қандай иш керак?"],
      found: ["Сўровингиз бўйича {n} та эълон топдим — пастда кўрсатдим. Маош ёки иш вақти бўйича аниқлаштирайми?", "Базада {n} та мос эълон бор, энг янгилари пастда. Қайси бири бўйича батафсил айтай?"],
      widened: ["Айнан сўраганингиз бўйича ҳозирча эълон йўқ эди, шунинг учун қидирувни кенгайтирдим: {n} та яқин эълон топилди. Нимани ўзгартирганим юқорида ёзилган."],
      none: ["Ҳозирча базада бундай эълон йўқ. Янгиси чиққанда Telegram'да хабар олишингиз мумкин — тугма пастда. Ёки бошқа туман ёки яқин касб бўйича қараб берайми?"],
      unclear: ["Қайси касб ҳақида гап кетаётганини аниқ тушунмадим. Касбни битта сўз билан ёзинг — масалан «ошпаз» ёки «ҳайдовчи»."],
      failed: ["Ҳозир базага уланишда муаммо бўлди. Бир оздан кейин яна уриниб кўринг."],
    },
    employer: {
      greeting: ["Ассалому алайкум! Мен Ish topdim AI ёрдамчисиман. Қандай ходим керак — касби ва ҳудудини ёзсангиз, базадаги номзодлардан қараб бераман."],
      thanks: ["Арзимайди. Яна қайси лавозим бўйича номзод қидирай?"],
      who: ["Мен сунъий интеллектман — Ish topdim платформасининг AI ёрдамчиси. Базадаги ҳақиқий номзодларни топишга ёрдам бераман; кимни ишга олишни ўзингиз ҳал қиласиз. Қандай ходим керак?"],
      found: ["Сўровингиз бўйича {n} та номзод топдим — пастда. Тажриба ёки ҳудуд бўйича торайтирайми?"],
      widened: ["Айнан шу талаблар билан номзод топилмади, шунинг учун қидирувни кенгайтирдим: {n} та яқин номзод бор. Нимани ўзгартирганим юқорида ёзилган."],
      none: ["Ҳозирча бундай номзод йўқ. Вакансия жойласангиз, мос ишчилар ўзлари ариза юборади — тугма пастда. Бошқа ҳудудни ҳам кўрайми?"],
      unclear: ["Қандай мутахассис кераклигини аниқ тушунмадим. Касбни битта сўз билан ёзинг — масалан «сотувчи» ёки «ошпаз»."],
      failed: ["Ҳозир базага уланишда муаммо бўлди. Бир оздан кейин яна уриниб кўринг."],
    },
  },
  ru: {
    seeker: {
      greeting: ["Здравствуйте! Я ИИ-помощник Ish topdim. Какую работу вы ищете? Напишите профессию и район — посмотрю в базе."],
      thanks: ["Пожалуйста. Посмотреть что-нибудь ещё?", "Рад помочь. Поискать в другом районе или по другой профессии?"],
      who: ["Я искусственный интеллект — помощник платформы Ish topdim. Помогаю найти подходящую работу среди настоящих объявлений в базе. Какая работа вам нужна?"],
      found: ["По вашему запросу нашлось объявлений: {n} — они ниже. Уточнить по зарплате или графику?", "В базе есть подходящие объявления: {n}. Самые новые показал ниже. О каком рассказать подробнее?"],
      widened: ["Точно по вашему запросу объявлений пока нет, поэтому я расширил поиск и нашёл близкие варианты: {n}. Что именно изменил — написано выше."],
      none: ["Пока в базе нет таких объявлений. Можно включить уведомление в Telegram — кнопка ниже, и вы узнаете, когда появится новое. Посмотреть другой район или близкую профессию?"],
      unclear: ["Не совсем понял, о какой профессии речь. Напишите её одним словом — например «повар» или «водитель»."],
      failed: ["Сейчас не получилось обратиться к базе. Попробуйте ещё раз чуть позже."],
    },
    employer: {
      greeting: ["Здравствуйте! Я ИИ-помощник Ish topdim. Какой сотрудник вам нужен? Напишите профессию и район — посмотрю кандидатов в базе."],
      thanks: ["Пожалуйста. Поискать кандидатов на другую должность?"],
      who: ["Я искусственный интеллект — помощник платформы Ish topdim. Помогаю находить настоящих кандидатов в базе; решение о найме принимаете вы. Какой сотрудник нужен?"],
      found: ["По вашему запросу нашлось кандидатов: {n} — они ниже. Сузить по опыту или району?"],
      widened: ["Точно по этим требованиям кандидатов нет, поэтому я расширил поиск: близких вариантов — {n}. Что изменил — написано выше."],
      none: ["Пока таких кандидатов нет. Разместите вакансию — подходящие соискатели откликнутся сами, кнопка ниже. Посмотреть другой район?"],
      unclear: ["Не совсем понял, какой специалист нужен. Напишите профессию одним словом — например «продавец» или «повар»."],
      failed: ["Сейчас не получилось обратиться к базе. Попробуйте ещё раз чуть позже."],
    },
  },
  en: {
    seeker: {
      greeting: ["Hello! I'm the Ish topdim AI assistant. What kind of work are you looking for? Tell me the job and the district and I'll check the database."],
      thanks: ["You're welcome. Shall I look for anything else?", "Glad to help. Want me to try another district or job?"],
      who: ["I'm an AI — the assistant of the Ish topdim platform. I help you find suitable work among the real ads in our database. What job do you need?"],
      found: ["I found {n} ads for your request — they are below. Should I narrow it down by salary or schedule?", "There are {n} matching ads in the database; the newest are below. Which one would you like to know more about?"],
      widened: ["There was nothing for your exact request yet, so I widened the search and found {n} close ads. What I changed is written above."],
      none: ["There are no such ads in the database yet. You can turn on a Telegram alert with the button below and hear as soon as one appears. Shall I check another district or a related job?"],
      unclear: ["I couldn't tell which job you mean. Please write it in one word — for example “cook” or “driver”."],
      failed: ["I couldn't reach the database just now. Please try again in a moment."],
    },
    employer: {
      greeting: ["Hello! I'm the Ish topdim AI assistant. What kind of employee do you need? Tell me the job and the district and I'll check the candidates in the database."],
      thanks: ["You're welcome. Shall I look for candidates for another role?"],
      who: ["I'm an AI — the assistant of the Ish topdim platform. I help you find real candidates in our database; the hiring decision is yours. What kind of employee do you need?"],
      found: ["I found {n} candidates for your request — they are below. Should I narrow it down by experience or district?"],
      widened: ["No candidates matched these exact requirements, so I widened the search: there are {n} close ones. What I changed is written above."],
      none: ["There are no such candidates yet. Post a vacancy and suitable people will apply themselves — the button is below. Shall I check another district?"],
      unclear: ["I couldn't tell which specialist you need. Please write the job in one word — for example “seller” or “cook”."],
      failed: ["I couldn't reach the database just now. Please try again in a moment."],
    },
  },
};

export function smallTalkReply(kind: Exclude<SmallTalk, null>, lang: AssistantLang, role: AssistantRole, turn: number): string {
  return pick(T[lang][role][kind], turn);
}

/** Qidiruv natijasi bo'yicha shablon javob (son — faqat bazadan) */
export function searchReply(data: AiFindResult | null, lang: AssistantLang, role: AssistantRole, turn: number): string {
  const set = T[lang][role];
  if (!data) return pick(set.failed, turn);
  if (data.total === 0) return pick(data.needProfession ? set.unclear : set.none, turn);
  return pick(data.relaxed.length ? set.widened : set.found, turn).replace("{n}", String(data.total));
}

const SUGGEST: Record<AssistantLang, Record<AssistantRole, { start: string[]; daily: string; noexp: string; remote: string; exp: string; extra: string[] }>> = {
  uz: {
    seeker: { start: ["Kunlik ish bormi?", "Tajribasiz ishlar", "Uydan ishlash"], daily: "Faqat kunlik ishlar", noexp: "Tajribasiz ham bo'ladiganlari", remote: "Masofaviy ishlar", exp: "", extra: ["Rezyume yozishga yordam bering"] },
    employer: { start: ["Sotuvchi kerak", "Kunlik ishchi kerak", "Vakansiya matnini yozib bering"], daily: "Kunlik ishga tayyorlar", noexp: "", remote: "Masofadan ishlaydiganlar", exp: "Tajribalilar", extra: ["Suhbat savollarini tuzib bering"] },
  },
  oz: {
    seeker: { start: ["Кунлик иш борми?", "Тажрибасиз ишлар", "Уйдан ишлаш"], daily: "Фақат кунлик ишлар", noexp: "Тажрибасиз ҳам бўладиганлари", remote: "Масофавий ишлар", exp: "", extra: ["Резюме ёзишга ёрдам беринг"] },
    employer: { start: ["Сотувчи керак", "Кунлик ишчи керак", "Вакансия матнини ёзиб беринг"], daily: "Кунлик ишга тайёрлар", noexp: "", remote: "Масофадан ишлайдиганлар", exp: "Тажрибалилар", extra: ["Суҳбат саволларини тузиб беринг"] },
  },
  ru: {
    seeker: { start: ["Есть работа на день?", "Работа без опыта", "Работа из дома"], daily: "Только с оплатой за день", noexp: "Где берут без опыта", remote: "Удалённая работа", exp: "", extra: ["Помогите составить резюме"] },
    employer: { start: ["Нужен продавец", "Нужен работник на день", "Составьте текст вакансии"], daily: "Готовые работать за день", noexp: "", remote: "Работающие удалённо", exp: "С опытом", extra: ["Составьте вопросы для собеседования"] },
  },
  en: {
    seeker: { start: ["Any daily-pay work?", "Jobs without experience", "Work from home"], daily: "Only daily-pay jobs", noexp: "Jobs that accept no experience", remote: "Remote jobs", exp: "", extra: ["Help me write a CV"] },
    employer: { start: ["I need a salesperson", "I need a worker for a day", "Write a vacancy text"], daily: "Ready for daily work", noexp: "", remote: "Remote workers", exp: "Experienced ones", extra: ["Write interview questions"] },
  },
};

/**
 * Bosiladigan keyingi savollar (ko'pi bilan 3 ta): natija bo'lsa — hali qo'llanmagan aniqlashtirishlar, bo'lmasa — boshlash
 * uchun misollar. Qat'iy ro'yxatdan (model o'ylab topmaydi) — har biri ishlaydigan so'rov.
 */
export function suggestionsFor(data: AiFindResult | null, lang: AssistantLang, role: AssistantRole): string[] {
  const s = SUGGEST[lang][role];
  if (!data || data.total === 0) return s.start.slice(0, 3);
  const out: string[] = [];
  if (!data.applied.daily && s.daily) out.push(s.daily);
  if (role === "seeker" && !data.applied.noexp && s.noexp) out.push(s.noexp);
  if (role === "employer" && !data.applied.exp && s.exp) out.push(s.exp);
  if (!data.applied.remote && s.remote) out.push(s.remote);
  return [...out, ...s.extra].slice(0, 3);
}
