'use strict';

const C = require('./constants');

class ValidationError extends Error {}

const str = (v, max = 200) => (v == null ? '' : String(v).trim().slice(0, max));
const int = (v) => {
  if (v === '' || v == null) return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const list = (v, maxItems = 20, maxLen = 300) =>
  (Array.isArray(v) ? v : [])
    .map((x) => str(x, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);

function required(obj, fields) {
  for (const [key, label] of fields) {
    if (obj[key] === '' || obj[key] == null) throw new ValidationError(`"${label}" maydoni to'ldirilishi shart`);
  }
}
function oneOf(value, allowed, label) {
  if (value && !allowed.includes(value)) throw new ValidationError(`"${label}" qiymati noto'g'ri`);
}
function phone(v) {
  const p = str(v, 30).replace(/[^\d+]/g, '');
  if (p.replace(/\D/g, '').length < 9) throw new ValidationError('Telefon raqam noto\'g\'ri');
  return p;
}
const safeUrl = (u) => /^https?:\/\//i.test(u) || u.startsWith('/uploads/');

function resume(body) {
  const r = {
    full_name: str(body.full_name, 100),
    birth_year: int(body.birth_year),
    gender: str(body.gender, 10) || null,
    phone: str(body.phone, 30),
    region: str(body.region, 60),
    district: str(body.district, 100) || null,
    category: str(body.category, 30),
    specialization: str(body.specialization, 100),
    experience_years: int(body.experience_years) ?? 0,
    education: str(body.education, 20) || 'none',
    languages: list(body.languages, 10, 30),
    skills: list(body.skills, 30, 50),
    employment_type: str(body.employment_type, 20),
    official: str(body.official, 20) || 'any',
    salary_min: int(body.salary_min),
    about: str(body.about, 2000) || null,
    portfolio_links: list(body.portfolio_links, 10, 300).filter(safeUrl),
    portfolio_images: list(body.portfolio_images, 10, 300).filter(safeUrl),
    photo: str(body.photo, 300) || null,
  };
  required(r, [
    ['full_name', 'F.I.Sh.'], ['phone', 'Telefon'], ['region', 'Viloyat'], ['category', 'Kategoriya'],
    ['specialization', 'Mutaxassislik'], ['employment_type', 'Ish turi'],
  ]);
  r.phone = phone(r.phone);
  oneOf(r.region, C.REGIONS, 'Viloyat');
  oneOf(r.category, C.CATEGORY_IDS, 'Kategoriya');
  oneOf(r.employment_type, C.EMPLOYMENT_IDS, 'Ish turi');
  oneOf(r.official, C.OFFICIAL_IDS, 'Rasmiylik');
  oneOf(r.education, C.EDUCATION_IDS, 'Ma\'lumot');
  oneOf(r.gender, C.GENDER_IDS, 'Jins');
  if (r.photo && !safeUrl(r.photo)) r.photo = null;
  const year = new Date().getFullYear();
  if (r.birth_year && (r.birth_year < year - 80 || r.birth_year > year - 14)) {
    throw new ValidationError('Tug\'ilgan yil noto\'g\'ri');
  }
  if (r.experience_years > 60) throw new ValidationError('Ish staji noto\'g\'ri');
  return r;
}

function vacancy(body) {
  const v = {
    company: str(body.company, 120),
    contact_name: str(body.contact_name, 100),
    phone: str(body.phone, 30),
    region: str(body.region, 60),
    district: str(body.district, 100) || null,
    category: str(body.category, 30),
    position: str(body.position, 100),
    experience_min: int(body.experience_min) ?? 0,
    education_min: str(body.education_min, 20) || 'none',
    gender: str(body.gender, 10) || null,
    age_min: int(body.age_min),
    age_max: int(body.age_max),
    languages: list(body.languages, 10, 30),
    employment_type: str(body.employment_type, 20),
    official: str(body.official, 20) || 'any',
    salary_from: int(body.salary_from),
    salary_to: int(body.salary_to),
    description: str(body.description, 3000) || null,
  };
  required(v, [
    ['company', 'Kompaniya / ish beruvchi'], ['contact_name', 'Mas\'ul shaxs'], ['phone', 'Telefon'],
    ['region', 'Viloyat'], ['category', 'Kategoriya'], ['position', 'Lavozim'], ['employment_type', 'Ish turi'],
  ]);
  v.phone = phone(v.phone);
  oneOf(v.region, C.REGIONS, 'Viloyat');
  oneOf(v.category, C.CATEGORY_IDS, 'Kategoriya');
  oneOf(v.employment_type, C.EMPLOYMENT_IDS, 'Ish turi');
  oneOf(v.official, C.OFFICIAL_IDS, 'Rasmiylik');
  oneOf(v.education_min, C.EDUCATION_IDS, 'Ma\'lumot');
  oneOf(v.gender, C.GENDER_IDS, 'Jins');
  if (v.salary_from && v.salary_to && v.salary_from > v.salary_to) {
    throw new ValidationError('Maosh oralig\'i noto\'g\'ri');
  }
  if (v.age_min && v.age_max && v.age_min > v.age_max) throw new ValidationError('Yosh oralig\'i noto\'g\'ri');
  return v;
}

module.exports = { resume, vacancy, ValidationError, str, int };
