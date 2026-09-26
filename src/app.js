'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');

const C = require('./constants');
const validate = require('./validate');
const { verifyInitData, newToken } = require('./auth');
const { matchScore } = require('./matching');
const { escapeHtml } = require('./bot');

const PAGE_SIZE = 20;
const JSON_FIELDS = ['languages', 'skills', 'portfolio_links', 'portfolio_images'];

function parseRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of JSON_FIELDS) if (typeof out[f] === 'string') out[f] = JSON.parse(out[f]);
  return out;
}
function toDbRow(obj) {
  const out = { ...obj };
  for (const f of JSON_FIELDS) if (Array.isArray(out[f])) out[f] = JSON.stringify(out[f]);
  return out;
}
const categoryName = (id) => (C.CATEGORIES.find((c) => c.id === id) || {}).name || id;

function createApp({ db, bot, botToken, uploadDir, publicDir }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '200kb' }));

  // ---------- statik fayllar ----------
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));
  if (publicDir) app.use(express.static(publicDir));

  // ---------- yordamchilar ----------
  const q = {
    userByToken: db.prepare('SELECT * FROM users WHERE token = ?'),
    userByTg: db.prepare('SELECT * FROM users WHERE tg_id = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    resume: db.prepare('SELECT * FROM resumes WHERE id = ?'),
    vacancy: db.prepare('SELECT * FROM vacancies WHERE id = ?'),
    acceptedBetween: db.prepare(
      `SELECT 1 FROM connections WHERE status = 'accepted'
       AND ((from_user = @a AND to_user = @b) OR (from_user = @b AND to_user = @a)) LIMIT 1`,
    ),
  };

  const fail = (res, status, error) => res.status(status).json({ error });

  function auth(req, res, next) {
    const m = /^Bearer\s+(\S+)$/.exec(req.get('authorization') || '');
    const user = m && q.userByToken.get(m[1]);
    if (!user) return fail(res, 401, 'Avval tizimga kiring');
    req.user = user;
    next();
  }

  // Kontaktlarni faqat egasi yoki bog'lanish qabul qilingan foydalanuvchi ko'radi
  function canSeeContacts(viewerId, ownerId) {
    return viewerId === ownerId || !!q.acceptedBetween.get({ a: viewerId, b: ownerId });
  }
  function publicResume(row, viewerId) {
    const r = parseRow(row);
    const owner = viewerId === r.user_id;
    r.is_mine = owner;
    r.contacts_visible = canSeeContacts(viewerId, r.user_id);
    if (!r.contacts_visible) {
      r.phone = null;
    } else {
      const u = q.userById.get(r.user_id);
      r.telegram = u && u.username ? u.username : null;
    }
    return r;
  }
  function publicVacancy(row, viewerId) {
    const v = parseRow(row);
    v.is_mine = viewerId === v.user_id;
    v.contacts_visible = canSeeContacts(viewerId, v.user_id);
    if (!v.contacts_visible) {
      v.phone = null;
    } else {
      const u = q.userById.get(v.user_id);
      v.telegram = u && u.username ? u.username : null;
    }
    return v;
  }

  // ---------- meta ----------
  app.get('/api/meta', (req, res) => {
    res.json({
      categories: C.CATEGORIES,
      regions: C.REGIONS,
      employment_types: C.EMPLOYMENT_TYPES,
      official_types: C.OFFICIAL_TYPES,
      education_levels: C.EDUCATION_LEVELS,
      experience_levels: C.EXPERIENCE_LEVELS,
      languages: C.LANGUAGES,
      genders: C.GENDERS,
      telegram_login: !!botToken,
    });
  });

  app.get('/api/stats', (req, res) => {
    const resumes = db.prepare('SELECT category, COUNT(*) n FROM resumes WHERE is_active = 1 GROUP BY category').all();
    const vacancies = db.prepare('SELECT category, COUNT(*) n FROM vacancies WHERE is_active = 1 GROUP BY category').all();
    const byCat = {};
    for (const r of resumes) (byCat[r.category] ||= { resumes: 0, vacancies: 0 }).resumes = r.n;
    for (const v of vacancies) (byCat[v.category] ||= { resumes: 0, vacancies: 0 }).vacancies = v.n;
    res.json({
      resumes: resumes.reduce((s, r) => s + r.n, 0),
      vacancies: vacancies.reduce((s, r) => s + r.n, 0),
      by_category: byCat,
    });
  });

  // ---------- autentifikatsiya ----------
  app.post('/api/auth/telegram', (req, res) => {
    if (!botToken) return fail(res, 503, 'Telegram orqali kirish sozlanmagan');
    const tgUser = verifyInitData(req.body && req.body.initData, botToken);
    if (!tgUser) return fail(res, 401, 'Telegram ma\'lumotlari tasdiqlanmadi');
    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || 'Foydalanuvchi';
    let user = q.userByTg.get(tgUser.id);
    if (user) {
      db.prepare('UPDATE users SET name = ?, username = ? WHERE id = ?').run(name, tgUser.username || null, user.id);
    } else {
      const info = db
        .prepare('INSERT INTO users (tg_id, name, username, token) VALUES (?, ?, ?, ?)')
        .run(tgUser.id, name, tgUser.username || null, newToken());
      user = { id: info.lastInsertRowid };
    }
    user = q.userById.get(user.id);
    res.json({ token: user.token, user: { id: user.id, name: user.name, username: user.username } });
  });

  // Telegramdan tashqarida (sayt / ilova) kirish: qurilmaga bog'langan mehmon hisobi
  app.post('/api/auth/web', (req, res) => {
    const name = validate.str(req.body && req.body.name, 60);
    if (name.length < 2) return fail(res, 400, 'Ismingizni kiriting');
    const token = newToken();
    const info = db.prepare('INSERT INTO users (name, token) VALUES (?, ?)').run(name, token);
    res.json({ token, user: { id: info.lastInsertRowid, name, username: null } });
  });

  app.get('/api/me', auth, (req, res) => {
    const u = req.user;
    const resumes = db.prepare('SELECT * FROM resumes WHERE user_id = ? ORDER BY id DESC').all(u.id).map(parseRow);
    const vacancies = db.prepare('SELECT * FROM vacancies WHERE user_id = ? ORDER BY id DESC').all(u.id).map(parseRow);
    const pending = db
      .prepare("SELECT COUNT(*) n FROM connections WHERE to_user = ? AND status = 'pending'")
      .get(u.id).n;
    res.json({
      user: { id: u.id, name: u.name, username: u.username, telegram: !!u.tg_id },
      resumes,
      vacancies,
      pending_requests: pending,
    });
  });

  // ---------- rasm yuklash (portfolio, foto) ----------
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => {
        const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
        cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 10 },
    fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  });
  app.post('/api/upload', auth, upload.array('files', 10), (req, res) => {
    const files = (req.files || []).map((f) => `/uploads/${f.filename}`);
    if (!files.length) return fail(res, 400, 'Faqat JPG, PNG yoki WEBP rasm (5 MB gacha) yuklang');
    res.json({ files });
  });

  // ---------- CRUD umumiy ----------
  function crud(table, validator, present) {
    const cols = (obj) => Object.keys(obj);
    const base = `/api/${table}`;
    const get = db.prepare(`SELECT * FROM ${table} WHERE id = ?`);

    app.post(base, auth, (req, res) => {
      const data = toDbRow(validator(req.body || {}));
      const c = cols(data);
      const info = db
        .prepare(`INSERT INTO ${table} (user_id, ${c.join(', ')}) VALUES (@user_id, ${c.map((k) => '@' + k).join(', ')})`)
        .run({ ...data, user_id: req.user.id });
      res.status(201).json(present(get.get(info.lastInsertRowid), req.user.id));
    });

    app.put(`${base}/:id`, auth, (req, res) => {
      const row = get.get(req.params.id);
      if (!row || row.user_id !== req.user.id) return fail(res, 404, 'Topilmadi');
      const data = toDbRow(validator(req.body || {}));
      const sets = cols(data).map((k) => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE ${table} SET ${sets}, updated_at = datetime('now') WHERE id = @id`).run({ ...data, id: row.id });
      res.json(present(get.get(row.id), req.user.id));
    });

    app.patch(`${base}/:id/active`, auth, (req, res) => {
      const row = get.get(req.params.id);
      if (!row || row.user_id !== req.user.id) return fail(res, 404, 'Topilmadi');
      const active = req.body && req.body.is_active ? 1 : 0;
      db.prepare(`UPDATE ${table} SET is_active = ?, updated_at = datetime('now') WHERE id = ?`).run(active, row.id);
      res.json(present(get.get(row.id), req.user.id));
    });

    app.delete(`${base}/:id`, auth, (req, res) => {
      const row = get.get(req.params.id);
      if (!row || row.user_id !== req.user.id) return fail(res, 404, 'Topilmadi');
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(row.id);
      res.json({ ok: true });
    });

    app.get(`${base}/:id`, auth, (req, res) => {
      const row = get.get(req.params.id);
      if (!row || (!row.is_active && row.user_id !== req.user.id)) return fail(res, 404, 'Topilmadi');
      res.json(present(row, req.user.id));
    });
  }
  crud('resumes', validate.resume, publicResume);
  crud('vacancies', validate.vacancy, publicVacancy);

  // ---------- qidiruv: ishchilar (rezyumelar) ----------
  app.get('/api/search/workers', auth, (req, res) => {
    const f = req.query;
    const where = ['r.is_active = 1', 'r.user_id != @me'];
    const p = { me: req.user.id };
    if (f.category) { where.push('r.category = @category'); p.category = String(f.category); }
    if (f.region) { where.push('r.region = @region'); p.region = String(f.region); }
    if (f.specialization) { where.push('r.specialization = @spec'); p.spec = String(f.specialization); }
    if (f.employment_type) { where.push('r.employment_type = @emp'); p.emp = String(f.employment_type); }
    if (f.official && f.official !== 'any') { where.push("(r.official = @off OR r.official = 'any')"); p.off = String(f.official); }
    if (f.gender) { where.push('r.gender = @gender'); p.gender = String(f.gender); }
    if (validate.int(f.experience_min) != null) { where.push('r.experience_years >= @exp'); p.exp = validate.int(f.experience_min); }
    if (validate.int(f.salary_max) != null) { where.push('(r.salary_min IS NULL OR r.salary_min <= @sal)'); p.sal = validate.int(f.salary_max); }
    if (f.education_min) {
      const ok = C.EDUCATION_LEVELS.filter((e) => e.rank >= C.educationRank(String(f.education_min))).map((e) => e.id);
      where.push(`r.education IN (${ok.map((_, i) => '@edu' + i).join(',') || "''"})`);
      ok.forEach((e, i) => (p['edu' + i] = e));
    }
    const year = new Date().getFullYear();
    if (validate.int(f.age_min) != null) { where.push('r.birth_year <= @bymax'); p.bymax = year - validate.int(f.age_min); }
    if (validate.int(f.age_max) != null) { where.push('r.birth_year >= @bymin'); p.bymin = year - validate.int(f.age_max); }
    if (f.language) { where.push('r.languages LIKE @lang'); p.lang = `%"${String(f.language).replace(/[%_"]/g, '')}"%`; }
    if (f.has_portfolio === '1') where.push("(r.portfolio_links != '[]' OR r.portfolio_images != '[]')");
    if (f.q) {
      where.push('(r.specialization LIKE @q OR r.skills LIKE @q OR r.about LIKE @q OR r.full_name LIKE @q)');
      p.q = `%${String(f.q).slice(0, 50).replace(/[%_]/g, '')}%`;
    }

    let vacancy = null;
    if (f.vacancy_id) {
      vacancy = q.vacancy.get(f.vacancy_id);
      if (!vacancy || vacancy.user_id !== req.user.id) vacancy = null;
    }
    const rows = db.prepare(`SELECT r.* FROM resumes r WHERE ${where.join(' AND ')} ORDER BY r.updated_at DESC LIMIT 500`).all(p);
    let items = rows.map((r) => {
      const out = publicResume(r, req.user.id);
      if (vacancy) out.match = matchScore(r, vacancy);
      return out;
    });
    if (vacancy) items.sort((a, b) => b.match - a.match);
    const page = Math.max(1, validate.int(f.page) || 1);
    res.json({ total: items.length, page, page_size: PAGE_SIZE, items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) });
  });

  // ---------- qidiruv: vakansiyalar ----------
  app.get('/api/search/vacancies', auth, (req, res) => {
    const f = req.query;
    const where = ['v.is_active = 1', 'v.user_id != @me'];
    const p = { me: req.user.id };
    if (f.category) { where.push('v.category = @category'); p.category = String(f.category); }
    if (f.region) { where.push("(v.region = @region OR v.employment_type = 'remote')"); p.region = String(f.region); }
    if (f.employment_type) { where.push('v.employment_type = @emp'); p.emp = String(f.employment_type); }
    if (f.official && f.official !== 'any') { where.push("(v.official = @off OR v.official = 'any')"); p.off = String(f.official); }
    if (validate.int(f.experience_max) != null) { where.push('v.experience_min <= @exp'); p.exp = validate.int(f.experience_max); }
    if (validate.int(f.salary_min) != null) {
      where.push('(COALESCE(v.salary_to, v.salary_from) IS NULL OR COALESCE(v.salary_to, v.salary_from) >= @sal)');
      p.sal = validate.int(f.salary_min);
    }
    if (f.q) {
      where.push('(v.position LIKE @q OR v.company LIKE @q OR v.description LIKE @q)');
      p.q = `%${String(f.q).slice(0, 50).replace(/[%_]/g, '')}%`;
    }

    let resume = null;
    if (f.resume_id) {
      resume = q.resume.get(f.resume_id);
      if (!resume || resume.user_id !== req.user.id) resume = null;
    }
    const rows = db.prepare(`SELECT v.* FROM vacancies v WHERE ${where.join(' AND ')} ORDER BY v.updated_at DESC LIMIT 500`).all(p);
    let items = rows.map((v) => {
      const out = publicVacancy(v, req.user.id);
      if (resume) out.match = matchScore(resume, v);
      return out;
    });
    if (resume) items.sort((a, b) => b.match - a.match);
    const page = Math.max(1, validate.int(f.page) || 1);
    res.json({ total: items.length, page, page_size: PAGE_SIZE, items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) });
  });

  // ---------- bog'lanish so'rovlari ----------
  app.post('/api/connections', auth, (req, res) => {
    const me = req.user;
    const body = req.body || {};
    const resume = body.resume_id ? q.resume.get(body.resume_id) : null;
    const vacancy = body.vacancy_id ? q.vacancy.get(body.vacancy_id) : null;
    const message = validate.str(body.message, 500) || null;
    let direction, toUser;

    if (resume && resume.user_id !== me.id) {
      // Ish beruvchi ishchiga taklif yuboryapti
      if (vacancy && vacancy.user_id !== me.id) return fail(res, 400, 'Vakansiya sizga tegishli emas');
      direction = 'to_worker';
      toUser = resume.user_id;
      if (!resume.is_active) return fail(res, 404, 'Rezyume topilmadi');
    } else if (vacancy && vacancy.user_id !== me.id) {
      // Ishchi vakansiyaga ariza yuboryapti
      if (!resume) return fail(res, 400, 'Ariza yuborish uchun avval rezyume to\'ldiring');
      direction = 'to_employer';
      toUser = vacancy.user_id;
      if (!vacancy.is_active) return fail(res, 404, 'Vakansiya topilmadi');
    } else {
      return fail(res, 400, 'Kimga so\'rov yuborilishini tanlang');
    }

    const dup = db
      .prepare(
        `SELECT id, status FROM connections WHERE from_user = ? AND to_user = ?
         AND IFNULL(resume_id, 0) = ? AND IFNULL(vacancy_id, 0) = ? AND status != 'rejected'`,
      )
      .get(me.id, toUser, resume ? resume.id : 0, vacancy ? vacancy.id : 0);
    if (dup) return fail(res, 409, 'Bu so\'rov allaqachon yuborilgan');

    const info = db
      .prepare(
        `INSERT INTO connections (from_user, to_user, resume_id, vacancy_id, direction, message)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(me.id, toUser, resume ? resume.id : null, vacancy ? vacancy.id : null, direction, message);

    const target = q.userById.get(toUser);
    if (target && target.tg_id) {
      const text =
        direction === 'to_worker'
          ? `🧑‍💼 <b>Sizga ish taklifi keldi!</b>\n${escapeHtml(vacancy ? `${vacancy.company} — ${vacancy.position}` : me.name)}\n` +
            `Rezyume: ${escapeHtml(resume.specialization)}`
          : `📩 <b>Vakansiyangizga yangi ariza!</b>\n${escapeHtml(resume.full_name)} — ${escapeHtml(resume.specialization)}\n` +
            `Vakansiya: ${escapeHtml(vacancy.position)}`;
      bot.notify(target.tg_id, text + (message ? `\n\n💬 ${escapeHtml(message)}` : ''), 'Ko\'rish');
    }
    res.status(201).json({ id: info.lastInsertRowid, status: 'pending' });
  });

  function presentConnection(c, meId) {
    const other = q.userById.get(c.from_user === meId ? c.to_user : c.from_user);
    const resume = c.resume_id ? q.resume.get(c.resume_id) : null;
    const vacancy = c.vacancy_id ? q.vacancy.get(c.vacancy_id) : null;
    const accepted = c.status === 'accepted';
    return {
      id: c.id,
      direction: c.direction,
      status: c.status,
      message: c.message,
      created_at: c.created_at,
      incoming: c.to_user === meId,
      other: {
        name: other ? other.name : '—',
        telegram: accepted && other ? other.username : null,
      },
      resume: resume && {
        id: resume.id,
        full_name: resume.full_name,
        specialization: resume.specialization,
        category: categoryName(resume.category),
        region: resume.region,
        experience_years: resume.experience_years,
        phone: accepted || resume.user_id === meId ? resume.phone : null,
      },
      vacancy: vacancy && {
        id: vacancy.id,
        company: vacancy.company,
        position: vacancy.position,
        region: vacancy.region,
        salary_from: vacancy.salary_from,
        salary_to: vacancy.salary_to,
        phone: accepted || vacancy.user_id === meId ? vacancy.phone : null,
      },
    };
  }

  app.get('/api/connections', auth, (req, res) => {
    const me = req.user.id;
    const rows = db.prepare('SELECT * FROM connections WHERE from_user = ? OR to_user = ? ORDER BY id DESC LIMIT 200').all(me, me);
    const items = rows.map((c) => presentConnection(c, me));
    res.json({ incoming: items.filter((x) => x.incoming), outgoing: items.filter((x) => !x.incoming) });
  });

  app.post('/api/connections/:id/respond', auth, (req, res) => {
    const c = db.prepare('SELECT * FROM connections WHERE id = ?').get(req.params.id);
    if (!c || c.to_user !== req.user.id) return fail(res, 404, 'So\'rov topilmadi');
    if (c.status !== 'pending') return fail(res, 409, 'So\'rovga allaqachon javob berilgan');
    const status = req.body && req.body.accept ? 'accepted' : 'rejected';
    db.prepare("UPDATE connections SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, c.id);

    const from = q.userById.get(c.from_user);
    if (from && from.tg_id) {
      const who = escapeHtml(req.user.name);
      const text =
        status === 'accepted'
          ? `✅ <b>${who}</b> so'rovingizni qabul qildi! Endi kontaktlar ochiq — bog'laning.` +
            (req.user.username ? `\nTelegram: @${escapeHtml(req.user.username)}` : '')
          : `❌ <b>${who}</b> so'rovingizni rad etdi. Boshqa mos variantlarni ko'rib chiqing.`;
      bot.notify(from.tg_id, text, 'Ochish');
    }
    const updated = db.prepare('SELECT * FROM connections WHERE id = ?').get(c.id);
    res.json(presentConnection(updated, req.user.id));
  });

  // ---------- xatolar ----------
  app.use('/api', (req, res) => fail(res, 404, 'Topilmadi'));
  if (publicDir) {
    // SPA: boshqa barcha GET so'rovlar index.html ga
    app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(publicDir, 'index.html')) : next()));
  }
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof validate.ValidationError) return fail(res, 400, err.message);
    if (err instanceof multer.MulterError) return fail(res, 400, 'Fayl juda katta yoki soni ko\'p');
    if (err.type === 'entity.parse.failed') return fail(res, 400, 'Noto\'g\'ri so\'rov');
    console.error(err);
    fail(res, 500, 'Serverda xatolik');
  });
  return app;
}

module.exports = { createApp };
