'use strict';

// Ish kategoriyalari va ularning mutaxassisliklari
const CATEGORIES = [
  { id: 'it', name: 'IT va dasturlash', icon: '💻', specs: ['Frontend dasturchi', 'Backend dasturchi', 'Mobil dasturchi', 'Full-stack dasturchi', 'QA / Tester', 'DevOps', 'Tizim administratori', 'UI/UX dizayner', 'Data analitik'] },
  { id: 'construction', name: 'Qurilish va ta\'mirlash', icon: '🏗️', specs: ['Usta (universal)', 'G\'isht teruvchi', 'Elektrik', 'Santexnik', 'Payvandchi', 'Suvoqchi', 'Kafelchi', 'Duradgor', 'Muhandis-quruvchi'] },
  { id: 'sales', name: 'Savdo va sotuv', icon: '🛒', specs: ['Sotuvchi', 'Kassir', 'Sotuv menejeri', 'Savdo agenti', 'Merchandayzer', 'Omborchi'] },
  { id: 'education', name: 'Ta\'lim', icon: '📚', specs: ['O\'qituvchi', 'Repetitor', 'Tarbiyachi', 'Ingliz tili o\'qituvchisi', 'Rus tili o\'qituvchisi', 'Trener'] },
  { id: 'medicine', name: 'Tibbiyot', icon: '🩺', specs: ['Shifokor', 'Hamshira', 'Farmatsevt', 'Stomatolog', 'Laborant', 'Massajchi'] },
  { id: 'transport', name: 'Haydovchi va logistika', icon: '🚚', specs: ['Haydovchi (B)', 'Haydovchi (C/CE)', 'Taksi haydovchisi', 'Kuryer', 'Ekspeditor', 'Logist'] },
  { id: 'food', name: 'Ovqatlanish va xizmat', icon: '🍽️', specs: ['Oshpaz', 'Oshpaz yordamchisi', 'Ofitsiant', 'Barmen', 'Barista', 'Novvoy', 'Idish yuvuvchi'] },
  { id: 'production', name: 'Ishlab chiqarish', icon: '🏭', specs: ['Tikuvchi', 'Stanokchi', 'Operator', 'Texnolog', 'Qadoqlovchi', 'Mexanik'] },
  { id: 'finance', name: 'Moliya va buxgalteriya', icon: '💰', specs: ['Buxgalter', 'Bosh buxgalter', 'Moliyachi', 'Auditor', 'Iqtisodchi', 'Kassir-operator'] },
  { id: 'marketing', name: 'Marketing va dizayn', icon: '🎨', specs: ['SMM mutaxassis', 'Grafik dizayner', 'Marketolog', 'Kopirayter', 'Fotograf', 'Videomontajchi', 'Targetolog'] },
  { id: 'beauty', name: 'Go\'zallik xizmatlari', icon: '💇', specs: ['Sartarosh', 'Stilist', 'Manikyur ustasi', 'Kosmetolog', 'Vizajist'] },
  { id: 'home', name: 'Uy xizmatlari', icon: '🏠', specs: ['Enaga', 'Farrosh', 'Uy bekasi', 'Bog\'bon', 'Hamshira-qarovchi'] },
  { id: 'agro', name: 'Qishloq xo\'jaligi', icon: '🌾', specs: ['Fermer', 'Agronom', 'Veterinar', 'Traktorchi', 'Chorvador'] },
  { id: 'security', name: 'Xavfsizlik', icon: '🛡️', specs: ['Qo\'riqchi', 'Ko\'riqlash xizmati xodimi', 'Videokuzatuv operatori'] },
  { id: 'office', name: 'Ofis va ma\'muriyat', icon: '🗂️', specs: ['Ofis menejeri', 'Kotiba', 'HR menejer', 'Administrator', 'Operator (call-markaz)', 'Yurist'] },
  { id: 'other', name: 'Boshqa', icon: '✨', specs: ['Boshqa'] },
];

const REGIONS = [
  'Toshkent shahri', 'Toshkent viloyati', 'Andijon', 'Buxoro', 'Farg\'ona', 'Jizzax', 'Xorazm',
  'Namangan', 'Navoiy', 'Qashqadaryo', 'Qoraqalpog\'iston', 'Samarqand', 'Sirdaryo', 'Surxondaryo',
];

// Ish turi (bandlik)
const EMPLOYMENT_TYPES = [
  { id: 'full', name: 'To\'liq stavka' },
  { id: 'part', name: 'Yarim stavka' },
  { id: 'remote', name: 'Masofaviy (onlayn)' },
  { id: 'shift', name: 'Smenali / vaxta' },
  { id: 'project', name: 'Vaqtinchalik / loyiha' },
];

// Rasmiylik: rasmiy (shartnoma, mehnat daftarchasi) yoki norasmiy
const OFFICIAL_TYPES = [
  { id: 'official', name: 'Rasmiy (shartnoma bilan)' },
  { id: 'unofficial', name: 'Norasmiy' },
  { id: 'any', name: 'Farqi yo\'q' },
];

const EDUCATION_LEVELS = [
  { id: 'none', name: 'Ahamiyatsiz', rank: 0 },
  { id: 'secondary', name: 'O\'rta', rank: 1 },
  { id: 'vocational', name: 'O\'rta maxsus (kollej/texnikum)', rank: 2 },
  { id: 'bachelor', name: 'Oliy (bakalavr)', rank: 3 },
  { id: 'master', name: 'Magistr va yuqori', rank: 4 },
];

const EXPERIENCE_LEVELS = [
  { id: 0, name: 'Tajribasiz' },
  { id: 1, name: '1 yilgacha' },
  { id: 2, name: '1–3 yil' },
  { id: 4, name: '3–5 yil' },
  { id: 6, name: '5 yildan ortiq' },
];

const LANGUAGES = ['O\'zbek', 'Rus', 'Ingliz', 'Qozoq', 'Tojik', 'Turk', 'Koreys', 'Arab', 'Nemis', 'Xitoy'];

const GENDERS = [
  { id: 'male', name: 'Erkak' },
  { id: 'female', name: 'Ayol' },
];

const ids = (list) => list.map((x) => (typeof x === 'object' ? x.id : x));

module.exports = {
  CATEGORIES,
  REGIONS,
  EMPLOYMENT_TYPES,
  OFFICIAL_TYPES,
  EDUCATION_LEVELS,
  EXPERIENCE_LEVELS,
  LANGUAGES,
  GENDERS,
  CATEGORY_IDS: ids(CATEGORIES),
  EMPLOYMENT_IDS: ids(EMPLOYMENT_TYPES),
  OFFICIAL_IDS: ids(OFFICIAL_TYPES),
  EDUCATION_IDS: ids(EDUCATION_LEVELS),
  GENDER_IDS: ids(GENDERS),
  educationRank(id) {
    const e = EDUCATION_LEVELS.find((x) => x.id === id);
    return e ? e.rank : 0;
  },
};
