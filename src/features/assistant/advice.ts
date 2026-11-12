import { latinToCyrillic } from "@/lib/i18n/translit";
import type { AssistantLang, AssistantRole } from "./types";

/**
 * Maslahat (rezyume, suhbat, karyera, vakansiya matni, suhbat savollari) — sun'iy intellekt ulanmagan yoki band bo'lsa ham
 * foydalanuvchi "boshi berk" javob olmaydi: amaliy, bosqichma-bosqich yo'riqnoma va keyingi qadam. Matnlarda raqam, maosh yoki
 * "bazada bor" degan da'vo yo'q — faqat umumiy, tekshirilgan qoidalar. Bozor raqamlarini "… maoshi qancha" so'rovi bazadan beradi.
 * Kirill o'zbekcha matn lotinchadan transliteratsiya qilinadi (bitta manba).
 */
export type AdviceTopic = "cv" | "interview" | "career" | "vacancy" | "questions" | "hiring";

const CV = /(rezyume|резюме|resume|\bcv\b|o['‘’ʻ`]?zim haqimda|ўзим ҳақимда|about me)/iu;
const INTERVIEW = /(suhbat|суҳбат|собеседован|interview)/iu;
const VACANCY = /(vakansiya matn|e['‘’ʻ`]?lon matn|вакансия матн|эълон матн|текст(а|ы)? вакансии|описание вакансии|vacancy text|job description|job ad)/iu;
const QUESTIONS = /(savol|савол|вопрос|question)/iu;

export function adviceTopic(text: string, role: AssistantRole): AdviceTopic {
  if (role === "employer") {
    if (VACANCY.test(text)) return "vacancy";
    if (QUESTIONS.test(text) || INTERVIEW.test(text)) return "questions";
    return "hiring";
  }
  if (CV.test(text)) return "cv";
  if (INTERVIEW.test(text)) return "interview";
  return "career";
}

type Texts = Record<AdviceTopic, string>;

const UZ: Texts = {
  cv: [
    "Rezyumeni 5 qismdan tuzing:",
    "1. Kasb va maqsad — bir qatorda: «Oshpaz, Chilonzorda doimiy ish izlayman».",
    "2. Tajriba — qayerda, qancha vaqt va nima qildingiz (eng oxirgisidan boshlab). Tajriba bo'lmasa — o'qish, amaliyot yoki yordamchi bo'lib ishlaganingiz.",
    "3. Ko'nikmalar — 3–5 ta aniq narsa: «milliy taomlar», «kassa bilan ishlash», «B toifali guvohnoma».",
    "4. Qulay grafik, hudud va kutayotgan maoshingiz.",
    "5. Tillar va qo'shimcha: rus tili, sertifikatlar, kurslar.",
    "Qisqa va rost yozing — bo'lmagan tajribani qo'shmang. Tayyor bo'lsa, «O'zim haqimda e'lon berish» orqali joylang: ish beruvchilar sizni o'zi topadi.",
  ].join("\n"),
  interview: [
    "Suhbatga tayyorgarlik — 6 qadam:",
    "1. Vakansiyani qayta o'qing: vazifalar, grafik, maosh.",
    "2. O'zingiz haqingizda 1 daqiqalik qisqa hikoya tayyorlang: kasbingiz, tajribangiz, bu ish nega yoqadi.",
    "3. Odatdagi savollarga javob o'ylab qo'ying: «Oldingi ishdan nega ketdingiz?», «Qancha maosh kutasiz?», «Qachon boshlay olasiz?».",
    "4. O'zingiz ham 2–3 savol bering: rasmiy ishga olinadimi, maosh qachon beriladi, sinov muddati bormi.",
    "5. Hujjatlaringiz nusxasini oling va 10 daqiqa oldin boring.",
    "6. Ehtiyot bo'ling: ishga olish uchun oldindan pul so'rashsa yoki pasportingizni qoldirishni talab qilishsa — rozi bo'lmang.",
  ].join("\n"),
  career: [
    "Karyerani bosqichma-bosqich quramiz:",
    "1. Nimani yaxshi qilasiz va nima yoqadi — 2–3 yo'nalishni yozib chiqing.",
    "2. Har biri bo'yicha bozorni tekshiring: masalan, «oshpaz maoshi qancha» deb yozing — bazadagi faol vakansiyalar, ish izlovchilar soni va maosh oralig'ini ko'rsataman.",
    "3. Tajriba kam bo'lsa — «tajribasiz» ishlardan yoki yordamchi lavozimdan boshlang.",
    "4. O'zingiz haqingizda e'lon bering va mos ish chiqqanda xabar olish uchun kuzatuv qo'ying.",
    "5. Har 3–6 oyda bitta yangi ko'nikma qo'shing (kurs, sertifikat, til) — keyingi daraja va yuqoriroq maosh shundan keladi.",
    "Qaysi kasb haqida o'ylayapsiz? Yozing — bozor holatini ko'rsataman.",
  ].join("\n"),
  vacancy: [
    "Yaxshi vakansiya matni shu tartibda yoziladi:",
    "1. Lavozim — aniq nom: «Sotuvchi-kassir», «Yuk mashinasi haydovchisi».",
    "2. Vazifalar — 3–5 ta qisqa band.",
    "3. Talablar — faqat haqiqatan kerakli narsalar (tajriba, guvohnoma, til). Yosh, jins yoki millat bo'yicha talab qo'ymang.",
    "4. Sharoit — maosh (aniq son yoki oraliq), grafik, manzil, ovqat yoki yo'l puli, rasmiy ishga olish.",
    "5. Murojaat — «Ariza yuborish» tugmasi orqali.",
    "Maosh aniq yozilsa, nomzodlar tezroq qaror qiladi. Bozordagi maoshni bilish uchun «sotuvchi maoshi qancha» deb yozing. Matn tayyor bo'lsa — «Vakansiya joylash».",
  ].join("\n"),
  questions: [
    "Suhbat savollari (istalgan lavozim uchun):",
    "1. Oxirgi ish joyingizda aniq nima bilan shug'ullangansiz?",
    "2. Ishdagi qiyin vaziyatni va uni qanday hal qilganingizni aytib bering.",
    "3. Bu ishning qaysi qismi sizga yoqadi, qaysi biri qiyin?",
    "4. Grafik va ish joyi sizga qulaymi? Qachon boshlay olasiz?",
    "5. Qancha maosh kutyapsiz?",
    "6. Bizga qanday savollaringiz bor?",
    "Barcha nomzodlarga bir xil savol bering — solishtirish oson bo'ladi. Savollar tajriba va ko'nikma haqida bo'lsin: yosh, oila, din yoki sog'liq haqida so'ramang.",
  ].join("\n"),
  hiring: [
    "Xodimni tezroq topish uchun:",
    "1. Vakansiyada maosh, grafik va manzilni aniq yozing.",
    "2. Bozorni tekshiring: «haydovchi maoshi qancha» deb yozing — bazadagi vakansiyalar, nomzodlar soni va maosh oralig'ini ko'rsataman.",
    "3. Nomzodlar bazasidan o'zingiz qidiring: kasb va hududni yozing.",
    "4. Arizalarga 1–2 kun ichida javob bering — yaxshi nomzodlar tez band bo'ladi.",
    "5. Mos nomzod chiqqanda xabar olish uchun kuzatuv qo'ying.",
  ].join("\n"),
};

const RU: Texts = {
  cv: [
    "Составьте резюме из 5 частей:",
    "1. Профессия и цель — одной строкой: «Повар, ищу постоянную работу в Чиланзаре».",
    "2. Опыт — где, сколько и что делали (начиная с последнего места). Нет опыта — учёба, практика или работа помощником.",
    "3. Навыки — 3–5 конкретных пунктов: «национальная кухня», «работа с кассой», «права категории B».",
    "4. Удобный график, район и ожидаемая зарплата.",
    "5. Языки и дополнительно: узбекский/русский, сертификаты, курсы.",
    "Пишите коротко и честно — не добавляйте опыт, которого не было. Когда будет готово, разместите через «Разместить объявление о себе»: работодатели найдут вас сами.",
  ].join("\n"),
  interview: [
    "Подготовка к собеседованию — 6 шагов:",
    "1. Перечитайте вакансию: обязанности, график, зарплата.",
    "2. Подготовьте короткий рассказ о себе на 1 минуту: профессия, опыт, почему нравится эта работа.",
    "3. Продумайте ответы на частые вопросы: «Почему ушли с прошлой работы?», «Какую зарплату ожидаете?», «Когда можете выйти?».",
    "4. Задайте 2–3 своих вопроса: официальное ли оформление, когда выплачивается зарплата, есть ли испытательный срок.",
    "5. Возьмите копии документов и приходите за 10 минут.",
    "6. Будьте осторожны: если за трудоустройство просят деньги вперёд или требуют оставить паспорт — не соглашайтесь.",
  ].join("\n"),
  career: [
    "Строим карьеру по шагам:",
    "1. Что у вас хорошо получается и что нравится — выпишите 2–3 направления.",
    "2. Проверьте рынок по каждому: например, напишите «сколько получает повар» — покажу число активных вакансий, соискателей и диапазон зарплат в базе.",
    "3. Если опыта мало — начните с работы «без опыта» или с должности помощника.",
    "4. Подайте объявление о себе и включите уведомления о подходящих вакансиях.",
    "5. Каждые 3–6 месяцев добавляйте один навык (курс, сертификат, язык) — так растут уровень и зарплата.",
    "О какой профессии думаете? Напишите — покажу ситуацию на рынке.",
  ].join("\n"),
  vacancy: [
    "Хороший текст вакансии пишется в таком порядке:",
    "1. Должность — точное название: «Продавец-кассир», «Водитель грузовика».",
    "2. Обязанности — 3–5 коротких пунктов.",
    "3. Требования — только действительно нужное (опыт, права, язык). Не ставьте требований по возрасту, полу или национальности.",
    "4. Условия — зарплата (точная сумма или диапазон), график, адрес, питание или проезд, официальное оформление.",
    "5. Отклик — через кнопку «Откликнуться».",
    "Когда зарплата указана точно, кандидаты решаются быстрее. Чтобы узнать зарплаты на рынке, напишите «сколько получает продавец». Текст готов — «Разместить вакансию».",
  ].join("\n"),
  questions: [
    "Вопросы для собеседования (для любой должности):",
    "1. Чем именно вы занимались на последнем месте работы?",
    "2. Расскажите о сложной ситуации на работе и как вы её решили.",
    "3. Какая часть этой работы вам нравится, а какая даётся труднее?",
    "4. Подходят ли вам график и место работы? Когда можете выйти?",
    "5. Какую зарплату вы ожидаете?",
    "6. Какие у вас есть вопросы к нам?",
    "Задавайте всем кандидатам одинаковые вопросы — так их легче сравнить. Спрашивайте об опыте и навыках, а не о возрасте, семье, религии или здоровье.",
  ].join("\n"),
  hiring: [
    "Чтобы быстрее найти сотрудника:",
    "1. Укажите в вакансии точную зарплату, график и адрес.",
    "2. Проверьте рынок: напишите «сколько получает водитель» — покажу число вакансий, кандидатов и диапазон зарплат в базе.",
    "3. Ищите сами в базе кандидатов: напишите профессию и район.",
    "4. Отвечайте на отклики в течение 1–2 дней — хорошие кандидаты быстро находят работу.",
    "5. Включите уведомления о подходящих кандидатах.",
  ].join("\n"),
};

const EN: Texts = {
  cv: [
    "Build your CV from 5 parts:",
    "1. Job and goal — one line: “Cook, looking for a permanent job in Chilonzor”.",
    "2. Experience — where, how long and what you did (latest first). No experience yet — studies, internships or work as an assistant.",
    "3. Skills — 3–5 concrete points: “national cuisine”, “cash register”, “category B driving licence”.",
    "4. Preferred schedule, area and expected salary.",
    "5. Languages and extras: Uzbek/Russian, certificates, courses.",
    "Keep it short and true — never add experience you don't have. When it's ready, publish it with “Post an ad about myself”: employers will find you.",
  ].join("\n"),
  interview: [
    "Interview preparation — 6 steps:",
    "1. Re-read the vacancy: duties, schedule, salary.",
    "2. Prepare a 1-minute story about yourself: your job, experience and why you like this work.",
    "3. Think through common questions: “Why did you leave your last job?”, “What salary do you expect?”, “When can you start?”.",
    "4. Ask 2–3 questions yourself: is the job official, when is salary paid, is there a trial period.",
    "5. Bring copies of your documents and arrive 10 minutes early.",
    "6. Be careful: if someone asks for money upfront to get the job or wants to keep your passport — say no.",
  ].join("\n"),
  career: [
    "Let's build your career step by step:",
    "1. Write down 2–3 directions — what you are good at and what you enjoy.",
    "2. Check the market for each: for example, type “how much does a cook earn” — I'll show the number of active vacancies, job seekers and the salary range in our database.",
    "3. With little experience, start with “no experience” jobs or an assistant role.",
    "4. Post an ad about yourself and turn on alerts for matching jobs.",
    "5. Add one new skill every 3–6 months (a course, certificate, language) — that's how level and pay grow.",
    "Which job are you thinking about? Tell me and I'll show the market.",
  ].join("\n"),
  vacancy: [
    "A good vacancy text follows this order:",
    "1. Position — an exact title: “Sales assistant / cashier”, “Truck driver”.",
    "2. Duties — 3–5 short points.",
    "3. Requirements — only what is really needed (experience, licence, language). Do not set requirements by age, gender or nationality.",
    "4. Conditions — salary (exact sum or range), schedule, address, meals or transport, official employment.",
    "5. How to apply — the “Apply” button.",
    "A clearly stated salary helps candidates decide faster. To see market salaries, type “how much does a salesperson earn”. Text ready — “Post a vacancy”.",
  ].join("\n"),
  questions: [
    "Interview questions (for any position):",
    "1. What exactly did you do at your last job?",
    "2. Tell me about a difficult situation at work and how you handled it.",
    "3. Which part of this job do you like, and which is harder for you?",
    "4. Do the schedule and location suit you? When can you start?",
    "5. What salary do you expect?",
    "6. What questions do you have for us?",
    "Ask every candidate the same questions — it makes comparing easy. Ask about experience and skills, never about age, family, religion or health.",
  ].join("\n"),
  hiring: [
    "To find an employee faster:",
    "1. State the exact salary, schedule and address in the vacancy.",
    "2. Check the market: type “how much does a driver earn” — I'll show the number of vacancies, candidates and the salary range in our database.",
    "3. Search the candidate database yourself: type the job and the area.",
    "4. Reply to applications within 1–2 days — good candidates get hired quickly.",
    "5. Turn on alerts for matching candidates.",
  ].join("\n"),
};

const OZ: Texts = Object.fromEntries(Object.entries(UZ).map(([k, v]) => [k, latinToCyrillic(v)])) as Texts;

const ALL: Record<AssistantLang, Texts> = { uz: UZ, oz: OZ, ru: RU, en: EN };

export function adviceReply(text: string, lang: AssistantLang, role: AssistantRole): string {
  return ALL[lang][adviceTopic(text, role)];
}
