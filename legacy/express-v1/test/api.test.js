'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');

const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const { verifyInitData } = require('../src/auth');
const { matchScore } = require('../src/matching');

const BOT_TOKEN = '123456:TEST';

function signInitData(user, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAA', user: JSON.stringify(user) });
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

async function startServer() {
  const notifications = [];
  const bot = { notify: async (chatId, text) => notifications.push({ chatId, text }) };
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ishuz-up-'));
  const app = createApp({ db: openDb(':memory:'), bot, botToken: BOT_TOKEN, uploadDir });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, url, body, token) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  return { server, call, notifications };
}

const RESUME = {
  full_name: 'Aziz Karimov', birth_year: 1996, gender: 'male', phone: '+998 90 111 22 33',
  region: 'Toshkent shahri', category: 'construction', specialization: 'Elektrik', experience_years: 5,
  education: 'vocational', languages: ['O\'zbek', 'Rus'], skills: ['Montaj', 'Shchit yig\'ish'],
  employment_type: 'full', official: 'official', salary_min: 6000000,
  portfolio_links: ['https://example.com/works', 'javascript:alert(1)'],
};
const VACANCY = {
  company: 'Qurilish Servis', contact_name: 'Bobur', phone: '+998 91 000 00 00', region: 'Toshkent shahri',
  category: 'construction', position: 'Elektrik', experience_min: 3, education_min: 'secondary',
  employment_type: 'full', official: 'official', salary_from: 5000000, salary_to: 8000000,
};

test('Telegram initData imzosi tekshiriladi', () => {
  const user = { id: 42, first_name: 'Ali' };
  assert.equal(verifyInitData(signInitData(user), BOT_TOKEN).id, 42);
  assert.equal(verifyInitData(signInitData(user), 'boshqa:token'), null);
  assert.equal(verifyInitData(signInitData(user).replace('Ali', 'Vali'), BOT_TOKEN), null);
  const old = Math.floor(Date.now() / 1000) - 3 * 24 * 3600;
  assert.equal(verifyInitData(signInitData(user, old), BOT_TOKEN), null);
});

test('moslik bahosi', () => {
  assert.equal(matchScore(RESUME, { ...VACANCY, category: 'it' }), 0);
  assert.equal(matchScore(RESUME, VACANCY), 100);
  assert.equal(matchScore({ ...RESUME, region: 'Buxoro', experience_years: 0 }, VACANCY), 70);
});

test('to\'liq oqim: rezyume → qidiruv/filtr → bog\'lanish → kontakt ochiladi', async (t) => {
  const { server, call, notifications } = await startServer();
  t.after(() => server.close());

  // Ishchi Telegram orqali, ish beruvchi sayt orqali kiradi
  const worker = await call('POST', '/auth/telegram', { initData: signInitData({ id: 777, first_name: 'Aziz', username: 'aziz_el' }) });
  assert.equal(worker.status, 200);
  const W = worker.body.token;
  const again = await call('POST', '/auth/telegram', { initData: signInitData({ id: 777, first_name: 'Aziz', username: 'aziz_el' }) });
  assert.equal(again.body.token, W, 'bir xil Telegram foydalanuvchisi — bir xil hisob');

  const employer = await call('POST', '/auth/web', { name: 'Bobur' });
  const E = employer.body.token;

  assert.equal((await call('GET', '/me')).status, 401);

  // Validatsiya
  const bad = await call('POST', '/resumes', { ...RESUME, category: 'yoq' }, W);
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /Kategoriya/);

  const r = await call('POST', '/resumes', RESUME, W);
  assert.equal(r.status, 201);
  assert.deepEqual(r.body.portfolio_links, ['https://example.com/works'], 'xavfli havola olib tashlanadi');
  await call('POST', '/resumes', { ...RESUME, full_name: 'Boshqa', region: 'Buxoro', experience_years: 1 }, W);

  const v = await call('POST', '/vacancies', VACANCY, E);
  assert.equal(v.status, 201);

  // Ish beruvchi kategoriya + filtr bo'yicha qidiradi
  let s = await call('GET', '/search/workers?category=construction', null, E);
  assert.equal(s.body.total, 2);
  s = await call('GET', '/search/workers?category=construction&region=Toshkent%20shahri&experience_min=3', null, E);
  assert.equal(s.body.total, 1);
  assert.equal(s.body.items[0].phone, null, 'telefon yashirin');
  s = await call('GET', '/search/workers?category=it', null, E);
  assert.equal(s.body.total, 0);
  s = await call('GET', `/search/workers?category=construction&vacancy_id=${v.body.id}`, null, E);
  assert.equal(s.body.items[0].full_name, 'Aziz Karimov', 'eng mos nomzod birinchi');
  assert.equal(s.body.items[0].match, 100);
  s = await call('GET', '/search/workers?category=construction&age_max=25', null, E);
  assert.equal(s.body.total, 0);
  s = await call('GET', '/search/workers?has_portfolio=1&language=Rus', null, E);
  assert.equal(s.body.total, 2);

  // Ishchi mos vakansiyalarni ko'radi
  const jobs = await call('GET', `/search/vacancies?category=construction&resume_id=${r.body.id}`, null, W);
  assert.equal(jobs.body.total, 1);
  assert.equal(jobs.body.items[0].match, 100);

  // Ish beruvchi bog'lanish so'rovini yuboradi
  const c = await call('POST', '/connections', { resume_id: r.body.id, vacancy_id: v.body.id, message: 'Salom!' }, E);
  assert.equal(c.status, 201);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].chatId, 777);
  const dup = await call('POST', '/connections', { resume_id: r.body.id, vacancy_id: v.body.id }, E);
  assert.equal(dup.status, 409);

  const inbox = await call('GET', '/connections', null, W);
  assert.equal(inbox.body.incoming.length, 1);
  assert.equal(inbox.body.incoming[0].vacancy.phone, null);

  // Boshqa odam javob bera olmaydi
  assert.equal((await call('POST', `/connections/${c.body.id}/respond`, { accept: true }, E)).status, 404);
  const acc = await call('POST', `/connections/${c.body.id}/respond`, { accept: true }, W);
  assert.equal(acc.body.status, 'accepted');
  assert.equal(acc.body.vacancy.phone, '+998910000000');

  // Endi kontaktlar ochiq
  const detail = await call('GET', `/resumes/${r.body.id}`, null, E);
  assert.equal(detail.body.phone, '+998901112233');
  assert.equal(detail.body.telegram, 'aziz_el');

  // Egasi bo'lmagan tahrirlay olmaydi
  assert.equal((await call('PUT', `/resumes/${r.body.id}`, RESUME, E)).status, 404);
  // Yashirilgan rezyume qidiruvda chiqmaydi
  await call('PATCH', `/resumes/${r.body.id}/active`, { is_active: false }, W);
  s = await call('GET', '/search/workers?category=construction', null, E);
  assert.equal(s.body.total, 1);
});

test('ishchi vakansiyaga ariza yuborishi uchun rezyume kerak', async (t) => {
  const { server, call } = await startServer();
  t.after(() => server.close());
  const W = (await call('POST', '/auth/web', { name: 'Ishchi' })).body.token;
  const E = (await call('POST', '/auth/web', { name: 'Boss' })).body.token;
  const v = await call('POST', '/vacancies', VACANCY, E);
  const noResume = await call('POST', '/connections', { vacancy_id: v.body.id }, W);
  assert.equal(noResume.status, 400);
  const r = await call('POST', '/resumes', RESUME, W);
  const ok = await call('POST', '/connections', { vacancy_id: v.body.id, resume_id: r.body.id }, W);
  assert.equal(ok.status, 201);
  const conns = await call('GET', '/connections', null, E);
  assert.equal(conns.body.incoming[0].direction, 'to_employer');
});
