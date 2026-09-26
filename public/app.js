/* Ish UZ — Telegram Mini App / sayt / PWA frontend (kutubxonasiz) */
(() => {
  'use strict';

  const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;
  if (tg) {
    tg.ready();
    tg.expand();
    document.documentElement.classList.add('tg');
  }
  if ('serviceWorker' in navigator && !tg) navigator.serviceWorker.register('/sw.js').catch(() => {});

  const $view = document.getElementById('view');

  // ------------------------------------------------------------------ utils
  const store = {
    get: (k) => { try { return JSON.parse(localStorage.getItem('ishuz:' + k)); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem('ishuz:' + k, JSON.stringify(v)); } catch { /* ignore */ } },
    del: (k) => { try { localStorage.removeItem('ishuz:' + k); } catch { /* ignore */ } },
  };
  const state = { token: store.get('token'), me: null, meta: null };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (n) => (n ? Number(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' so\'m' : '');
  const salaryRange = (a, b) => (a && b ? `${money(a).replace(' so\'m', '')} – ${money(b)}` : a ? `${money(a)} dan` : b ? `${money(b)} gacha` : 'Kelishiladi');
  const find = (list, id) => (list || []).find((x) => x.id === id) || {};
  const cat = (id) => find(state.meta.categories, id);
  const empName = (id) => find(state.meta.employment_types, id).name || '';
  const offName = (id) => find(state.meta.official_types, id).name || '';
  const eduName = (id) => find(state.meta.education_levels, id).name || '';
  const expName = (years) => {
    const lv = [...state.meta.experience_levels].reverse().find((e) => years >= e.id);
    return lv ? lv.name : 'Tajribasiz';
  };
  const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const haptic = (t = 'light') => tg && tg.HapticFeedback && tg.HapticFeedback.impactOccurred(t);

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast.t);
    toast.t = setTimeout(() => (el.hidden = true), 2800);
  }

  async function api(path, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (state.token) headers.authorization = 'Bearer ' + state.token;
    let body = opts.body;
    if (body && !(body instanceof FormData)) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(body);
    }
    const res = await fetch('/api' + path, { method: opts.method || 'GET', headers, body });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/auth/telegram') {
      state.token = null;
      store.del('token');
      go('/login');
    }
    if (!res.ok) throw new Error(data.error || 'Xatolik yuz berdi');
    return data;
  }

  const qs = (obj) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(obj)) if (v !== '' && v != null) p.set(k, v);
    const s = p.toString();
    return s ? '?' + s : '';
  };

  const html = (s) => { $view.innerHTML = s; window.scrollTo(0, 0); };
  const loading = () => html('<div class="spinner"></div>');

  // ------------------------------------------------------------------ router
  function go(path) { location.hash = '#' + path; }
  function parseHash() {
    const raw = location.hash.slice(1) || '/';
    const [path, query] = raw.split('?');
    return { path, params: Object.fromEntries(new URLSearchParams(query || '')) };
  }

  const routes = [
    [/^\/$/, viewHome],
    [/^\/login$/, viewLogin],
    [/^\/resume\/new$/, () => viewWizard('resume')],
    [/^\/resume\/(\d+)\/edit$/, (m) => viewWizard('resume', m[1])],
    [/^\/vacancy\/new$/, () => viewWizard('vacancy')],
    [/^\/vacancy\/(\d+)\/edit$/, (m) => viewWizard('vacancy', m[1])],
    [/^\/hire$/, (m, p) => viewCategoryPick('workers', p)],
    [/^\/workers$/, (m, p) => viewSearch('workers', p)],
    [/^\/worker\/(\d+)$/, (m) => viewWorker(m[1])],
    [/^\/jobs$/, (m, p) => (p.category || p.resume_id ? viewSearch('vacancies', p) : viewCategoryPick('vacancies', p))],
    [/^\/job\/(\d+)$/, (m) => viewJob(m[1])],
    [/^\/requests$/, viewRequests],
    [/^\/profile$/, viewProfile],
  ];

  async function render() {
    const { path, params } = parseHash();
    if (!state.token && path !== '/login') return go('/login');
    const tab = { '/': 'home', '/jobs': 'jobs', '/job': 'jobs', '/hire': 'hire', '/workers': 'hire', '/worker': 'hire', '/requests': 'requests', '/profile': 'profile' }['/' + path.split('/')[1]];
    document.querySelectorAll('#tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
    document.getElementById('tabbar').hidden = path === '/login';
    const isRoot = ['/', '/login', '/jobs', '/hire', '/requests', '/profile'].includes(path) && !params.category;
    setBack(!isRoot);
    for (const [re, fn] of routes) {
      const m = path.match(re);
      if (m) {
        try { await fn(m, params); } catch (e) { html(`<div class="card empty"><div class="ico">⚠️</div>${esc(e.message)}</div>`); }
        return;
      }
    }
    html('<div class="card empty"><div class="ico">🤷</div>Sahifa topilmadi</div>');
  }

  const backBtn = document.getElementById('backBtn');
  const onBack = () => history.back();
  function setBack(show) {
    if (tg) {
      tg.BackButton.offClick(onBack);
      if (show) { tg.BackButton.onClick(onBack); tg.BackButton.show(); } else tg.BackButton.hide();
    } else backBtn.hidden = !show;
  }
  backBtn.addEventListener('click', onBack);

  async function refreshMe() {
    state.me = await api('/me');
    document.getElementById('userName').textContent = state.me.user.name;
    const b = document.getElementById('reqBadge');
    b.hidden = !state.me.pending_requests;
    b.textContent = state.me.pending_requests;
  }

  // ------------------------------------------------------------------ views
  async function viewLogin() {
    html(`
      <div class="card hero">
        <div style="font-size:46px">💼</div>
        <h1>Ish UZ ga xush kelibsiz</h1>
        <p class="muted">Ish qidirayotganlarni ish bilan, ish beruvchilarni munosib xodim bilan bog'laymiz.</p>
      </div>
      <form class="card stack" id="loginForm">
        <label class="field"><span>Ismingiz</span><input name="name" required minlength="2" placeholder="Masalan: Aziz Karimov" autocomplete="name"></label>
        <button class="btn block">Davom etish</button>
        <p class="muted small">Telegram orqali ochsangiz, hisobingiz avtomatik bog'lanadi va yangi so'rovlar haqida botdan xabar olasiz.</p>
      </form>`);
    document.getElementById('loginForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const r = await api('/auth/web', { method: 'POST', body: { name: e.target.name.value } });
        state.token = r.token;
        store.set('token', r.token);
        await refreshMe();
        go('/');
      } catch (err) { toast(err.message); }
    };
  }

  async function viewHome() {
    const stats = await api('/stats').catch(() => ({ resumes: 0, vacancies: 0, by_category: {} }));
    const me = state.me;
    const myResume = me.resumes[0];
    const myVacancy = me.vacancies[0];
    html(`
      <div class="card hero">
        <h1>Salom, ${esc(me.user.name.split(' ')[0])}! 👋</h1>
        <p class="muted">Bugun nima qilamiz?</p>
        <div class="big-actions">
          <button class="big-action primary" data-go="${myResume ? '/jobs?resume_id=' + myResume.id + '&category=' + myResume.category : '/resume/new'}">
            <span class="ico">🔎</span><b>Ish qidiryapman</b>
            <span class="small muted">${myResume ? 'Menga mos vakansiyalar' : 'Rezyume to\'ldirish'}</span>
          </button>
          <button class="big-action" data-go="/hire">
            <span class="ico">🧑‍💼</span><b>Ishchi kerak</b>
            <span class="small muted">Kategoriya va filtr bo'yicha</span>
          </button>
        </div>
        <div class="row" style="justify-content:center">
          <span class="tag blue">${stats.resumes} ta ishchi</span>
          <span class="tag green">${stats.vacancies} ta vakansiya</span>
        </div>
      </div>
      ${!myVacancy ? `<div class="card row"><div style="flex:1"><b>Ish beruvchimisiz?</b><p class="muted small">Vakansiya joylang — ishchilar o'zlari ariza yuborishadi.</p></div><button class="btn sm" data-go="/vacancy/new">+ Vakansiya</button></div>` : ''}
      <h2 style="margin:18px 4px 10px">Kategoriyalar</h2>
      <div class="cats">
        ${state.meta.categories.map((c) => {
          const s = stats.by_category[c.id] || {};
          return `<button class="cat" data-go="/workers?category=${c.id}"><span class="ico">${c.icon}</span><span>${esc(c.name)}<span class="n">${s.resumes || 0} ishchi · ${s.vacancies || 0} ish</span></span></button>`;
        }).join('')}
      </div>`);
    bindGo();
  }

  function bindGo(root = $view) {
    root.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', () => { haptic(); go(el.dataset.go); }));
  }

  function viewCategoryPick(kind, params) {
    const isWorkers = kind === 'workers';
    html(`
      <h1>${isWorkers ? 'Qanday ishchi kerak?' : 'Qaysi sohada ish qidiryapsiz?'}</h1>
      <p class="muted">Kategoriyani tanlang, keyin filtr orqali saralang.</p>
      <div class="cats" style="margin-top:12px">
        ${state.meta.categories.map((c) => `<button class="cat" data-go="/${isWorkers ? 'workers' : 'jobs'}?${new URLSearchParams({ ...params, category: c.id })}"><span class="ico">${c.icon}</span><span>${esc(c.name)}</span></button>`).join('')}
      </div>
      ${isWorkers ? `<div class="card row" style="margin-top:14px"><div style="flex:1"><b>Vakansiya joylang</b><p class="muted small">Filtrlar vakansiyangizga qarab avtomatik moslik foizini hisoblaydi.</p></div><button class="btn sm" data-go="/vacancy/new">+ Joylash</button></div>` : ''}`);
    bindGo();
  }

  // ---- qidiruv + filtr
  const FILTERS = {
    workers: [
      { key: 'region', label: 'Viloyat', type: 'select', options: () => state.meta.regions.map((r) => [r, r]) },
      { key: 'specialization', label: 'Mutaxassislik', type: 'select', options: (p) => (cat(p.category).specs || []).map((s) => [s, s]) },
      { key: 'experience_min', label: 'Ish staji (kamida)', type: 'select', options: () => state.meta.experience_levels.map((e) => [e.id, e.name]) },
      { key: 'employment_type', label: 'Ish turi', type: 'select', options: () => state.meta.employment_types.map((e) => [e.id, e.name]) },
      { key: 'official', label: 'Rasmiylik', type: 'select', options: () => state.meta.official_types.filter((o) => o.id !== 'any').map((e) => [e.id, e.name]) },
      { key: 'education_min', label: 'Ma\'lumoti (kamida)', type: 'select', options: () => state.meta.education_levels.filter((e) => e.id !== 'none').map((e) => [e.id, e.name]) },
      { key: 'gender', label: 'Jinsi', type: 'select', options: () => state.meta.genders.map((g) => [g.id, g.name]) },
      { key: 'age_min', label: 'Yoshi (dan)', type: 'number' },
      { key: 'age_max', label: 'Yoshi (gacha)', type: 'number' },
      { key: 'salary_max', label: 'Maosh (gacha), so\'m', type: 'number' },
      { key: 'language', label: 'Til bilishi', type: 'select', options: () => state.meta.languages.map((l) => [l, l]) },
      { key: 'has_portfolio', label: 'Portfoliosi bor', type: 'select', options: () => [['1', 'Ha']] },
    ],
    vacancies: [
      { key: 'region', label: 'Viloyat', type: 'select', options: () => state.meta.regions.map((r) => [r, r]) },
      { key: 'employment_type', label: 'Ish turi', type: 'select', options: () => state.meta.employment_types.map((e) => [e.id, e.name]) },
      { key: 'official', label: 'Rasmiylik', type: 'select', options: () => state.meta.official_types.filter((o) => o.id !== 'any').map((e) => [e.id, e.name]) },
      { key: 'experience_max', label: 'Mening stajim', type: 'select', options: () => state.meta.experience_levels.map((e) => [e.id, e.name]) },
      { key: 'salary_min', label: 'Maosh (kamida), so\'m', type: 'number' },
    ],
  };

  async function viewSearch(kind, params) {
    const isWorkers = kind === 'workers';
    const c = cat(params.category);
    const activeFilters = FILTERS[kind].filter((f) => params[f.key]).length;
    const ctxKey = isWorkers ? 'vacancy_id' : 'resume_id';
    const ctxList = isWorkers ? state.me.vacancies : state.me.resumes;

    html(`
      <div class="row" style="margin-bottom:10px">
        <h1 style="margin:0;flex:1">${c.icon || ''} ${esc(c.name || (isWorkers ? 'Ishchilar' : 'Vakansiyalar'))}</h1>
        <button class="btn ghost sm" data-go="/${isWorkers ? 'hire' : 'jobs'}">Kategoriya</button>
      </div>
      ${ctxList.length ? `<label class="field" style="margin-bottom:10px"><span>${isWorkers ? 'Qaysi vakansiya uchun? (moslik foizi)' : 'Qaysi rezyume bo\'yicha? (moslik foizi)'}</span>
        <select id="ctxSel"><option value="">— tanlanmagan —</option>${ctxList.map((x) => `<option value="${x.id}" ${String(params[ctxKey]) === String(x.id) ? 'selected' : ''}>${esc(isWorkers ? x.position + ' · ' + x.company : x.specialization + ' · ' + x.full_name)}</option>`).join('')}</select></label>` : ''}
      <form class="filters-bar" id="qForm">
        <input name="q" placeholder="${isWorkers ? 'Kalit so\'z: ko\'nikma, ism…' : 'Lavozim, kompaniya…'}" value="${esc(params.q || '')}">
        <button type="button" class="btn ghost" id="filterBtn">⚙️ Filtr${activeFilters ? ` (${activeFilters})` : ''}</button>
      </form>
      <div id="results"><div class="spinner"></div></div>`);
    bindGo();

    const update = (patch) => go(`/${isWorkers ? 'workers' : 'jobs'}${qs({ ...params, ...patch, page: '' })}`);
    const ctxSel = document.getElementById('ctxSel');
    if (ctxSel) ctxSel.onchange = () => update({ [ctxKey]: ctxSel.value });
    document.getElementById('qForm').onsubmit = (e) => { e.preventDefault(); update({ q: e.target.q.value.trim() }); };
    document.getElementById('filterBtn').onclick = () => openFilters(kind, params, update);

    const data = await api(`/search/${kind}${qs(params)}`);
    const $r = document.getElementById('results');
    if (!data.items.length) {
      $r.innerHTML = `<div class="card empty"><div class="ico">🔍</div>Hozircha mos ${isWorkers ? 'ishchi' : 'vakansiya'} topilmadi.<br><span class="small">Filtrlarni yumshatib ko'ring.</span>
        ${activeFilters ? '<div style="margin-top:12px"><button class="btn ghost sm" id="clearF">Filtrlarni tozalash</button></div>' : ''}</div>`;
      const cf = document.getElementById('clearF');
      if (cf) cf.onclick = () => go(`/${isWorkers ? 'workers' : 'jobs'}${qs({ category: params.category, [ctxKey]: params[ctxKey] })}`);
      return;
    }
    const pages = Math.ceil(data.total / data.page_size);
    $r.innerHTML = `<p class="muted small" style="margin:0 4px 8px">${data.total} ta natija</p>` +
      data.items.map((x) => (isWorkers ? workerCard(x) : jobCard(x))).join('') +
      (pages > 1 ? `<div class="row" style="justify-content:center">${data.page > 1 ? `<button class="btn ghost sm" data-page="${data.page - 1}">← Oldingi</button>` : ''}<span class="muted small">${data.page} / ${pages}</span>${data.page < pages ? `<button class="btn ghost sm" data-page="${data.page + 1}">Keyingi →</button>` : ''}</div>` : '');
    bindGo($r);
    $r.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => go(`/${isWorkers ? 'workers' : 'jobs'}${qs({ ...params, page: b.dataset.page })}`)));
  }

  const matchBadge = (m) => (m == null ? '' : `<span class="match ${m >= 70 ? 'hi' : m >= 45 ? 'mid' : 'lo'}">${m}%</span>`);
  const age = (by) => (by ? `${new Date().getFullYear() - by} yosh` : '');

  function workerCard(r) {
    return `<div class="card item" data-go="/worker/${r.id}">
      <div class="avatar">${r.photo ? `<img src="${esc(r.photo)}" alt="">` : esc(initials(r.full_name))}</div>
      <div style="flex:1;min-width:0">
        <div class="title">${esc(r.full_name)}</div>
        <div>${esc(r.specialization)}</div>
        <div class="small muted">📍 ${esc(r.region)} · ${esc(expName(r.experience_years))}${r.birth_year ? ' · ' + age(r.birth_year) : ''}</div>
        <div style="margin-top:4px"><span class="tag">${esc(empName(r.employment_type))}</span>${r.official !== 'any' ? `<span class="tag">${esc(offName(r.official))}</span>` : ''}${r.salary_min ? `<span class="tag blue">${money(r.salary_min)} dan</span>` : ''}${r.portfolio_links.length || r.portfolio_images.length ? '<span class="tag green">Portfolio</span>' : ''}</div>
      </div>${matchBadge(r.match)}</div>`;
  }

  function jobCard(v) {
    return `<div class="card item" data-go="/job/${v.id}">
      <div class="avatar">${cat(v.category).icon || '💼'}</div>
      <div style="flex:1;min-width:0">
        <div class="title">${esc(v.position)}</div>
        <div>${esc(v.company)}</div>
        <div class="small muted">📍 ${esc(v.region)} · Staj: ${esc(expName(v.experience_min))}</div>
        <div style="margin-top:4px"><span class="tag blue">${esc(salaryRange(v.salary_from, v.salary_to))}</span><span class="tag">${esc(empName(v.employment_type))}</span>${v.official !== 'any' ? `<span class="tag">${esc(offName(v.official))}</span>` : ''}</div>
      </div>${matchBadge(v.match)}</div>`;
  }

  function openFilters(kind, params, update) {
    const fields = FILTERS[kind];
    const sheet = openSheet(`
      <h2>Filtr</h2>
      <form class="stack" id="fForm">
        <div class="grid2">
        ${fields.map((f) => {
          const val = params[f.key] || '';
          const input = f.type === 'select'
            ? `<select name="${f.key}"><option value="">Barchasi</option>${f.options(params).map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
            : `<input name="${f.key}" type="number" min="0" inputmode="numeric" value="${esc(val)}">`;
          return `<label class="field"><span>${esc(f.label)}</span>${input}</label>`;
        }).join('')}
        </div>
        <div class="row"><button type="button" class="btn ghost" id="fReset" style="flex:1">Tozalash</button><button class="btn" style="flex:2">Ko'rsatish</button></div>
      </form>`);
    sheet.querySelector('#fForm').onsubmit = (e) => {
      e.preventDefault();
      const patch = {};
      fields.forEach((f) => (patch[f.key] = e.target[f.key].value));
      sheet.close();
      update(patch);
    };
    sheet.querySelector('#fReset').onclick = () => {
      const patch = {};
      fields.forEach((f) => (patch[f.key] = ''));
      sheet.close();
      update(patch);
    };
  }

  function openSheet(inner) {
    const back = document.createElement('div');
    back.className = 'sheet-backdrop';
    back.innerHTML = `<div class="sheet">${inner}</div>`;
    back.close = () => back.remove();
    back.addEventListener('click', (e) => { if (e.target === back) back.close(); });
    document.body.appendChild(back);
    return back;
  }

  // ---- detal sahifalar
  async function viewWorker(id) {
    loading();
    const r = await api('/resumes/' + id);
    const c = cat(r.category);
    html(`
      <div class="card">
        <div class="item" style="cursor:default">
          <div class="avatar" style="width:64px;height:64px">${r.photo ? `<img src="${esc(r.photo)}" alt="">` : esc(initials(r.full_name))}</div>
          <div><h1 style="margin:0">${esc(r.full_name)}</h1><div>${esc(r.specialization)}</div><div class="muted small">${c.icon} ${esc(c.name)}</div></div>
        </div>
      </div>
      <div class="card">
        <dl class="review">
          <dt>Joylashuv</dt><dd>📍 ${esc(r.region)}${r.district ? ', ' + esc(r.district) : ''}</dd>
          <dt>Ish staji</dt><dd>${esc(expName(r.experience_years))} (${r.experience_years} yil)</dd>
          ${r.birth_year || r.gender ? `<dt>Yosh / jins</dt><dd>${esc([age(r.birth_year), find(state.meta.genders, r.gender).name].filter(Boolean).join(', '))}</dd>` : ''}
          <dt>Ma'lumoti</dt><dd>${esc(eduName(r.education))}</dd>
          <dt>Ish turi</dt><dd>${esc(empName(r.employment_type))} · ${esc(offName(r.official))}</dd>
          <dt>Kutilayotgan maosh</dt><dd>${r.salary_min ? money(r.salary_min) + ' dan' : 'Kelishiladi'}</dd>
          ${r.languages.length ? `<dt>Tillar</dt><dd>${r.languages.map((l) => `<span class="tag">${esc(l)}</span>`).join('')}</dd>` : ''}
          ${r.skills.length ? `<dt>Ko'nikmalar</dt><dd>${r.skills.map((l) => `<span class="tag blue">${esc(l)}</span>`).join('')}</dd>` : ''}
          ${r.about ? `<dt>O'zi haqida</dt><dd style="white-space:pre-wrap">${esc(r.about)}</dd>` : ''}
        </dl>
      </div>
      ${portfolioBlock(r)}
      ${contactBlock(r)}
      ${r.is_mine ? `<button class="btn ghost block" data-go="/resume/${r.id}/edit">✏️ Tahrirlash</button>` : r.contacts_visible ? '' : '<button class="btn block" id="connectBtn">🤝 Bog\'lanish</button>'}`);
    bindGo();
    const b = document.getElementById('connectBtn');
    if (b) b.onclick = () => connectDialog({ resume_id: r.id, kind: 'worker', category: r.category });
  }

  async function viewJob(id) {
    loading();
    const v = await api('/vacancies/' + id);
    const c = cat(v.category);
    html(`
      <div class="card">
        <h1>${esc(v.position)}</h1>
        <div>${esc(v.company)}</div>
        <div class="muted small">${c.icon} ${esc(c.name)}</div>
        <div style="margin-top:8px"><span class="tag blue">${esc(salaryRange(v.salary_from, v.salary_to))}</span></div>
      </div>
      <div class="card">
        <dl class="review">
          <dt>Joylashuv</dt><dd>📍 ${esc(v.region)}${v.district ? ', ' + esc(v.district) : ''}</dd>
          <dt>Ish turi</dt><dd>${esc(empName(v.employment_type))} · ${esc(offName(v.official))}</dd>
          <dt>Talab qilinadigan staj</dt><dd>${esc(expName(v.experience_min))}</dd>
          <dt>Ma'lumoti</dt><dd>${esc(eduName(v.education_min))}</dd>
          ${v.gender ? `<dt>Jinsi</dt><dd>${esc(find(state.meta.genders, v.gender).name)}</dd>` : ''}
          ${v.age_min || v.age_max ? `<dt>Yoshi</dt><dd>${v.age_min || '…'} – ${v.age_max || '…'}</dd>` : ''}
          ${v.languages.length ? `<dt>Tillar</dt><dd>${v.languages.map((l) => `<span class="tag">${esc(l)}</span>`).join('')}</dd>` : ''}
          ${v.description ? `<dt>Tavsif</dt><dd style="white-space:pre-wrap">${esc(v.description)}</dd>` : ''}
        </dl>
      </div>
      ${contactBlock(v, v.contact_name)}
      ${v.is_mine
        ? `<button class="btn block" data-go="/workers?category=${v.category}&vacancy_id=${v.id}">🎯 Mos ishchilarni ko'rish</button><div style="height:8px"></div><button class="btn ghost block" data-go="/vacancy/${v.id}/edit">✏️ Tahrirlash</button>`
        : v.contacts_visible ? '' : '<button class="btn block" id="connectBtn">📩 Ariza yuborish</button>'}`);
    bindGo();
    const b = document.getElementById('connectBtn');
    if (b) b.onclick = () => connectDialog({ vacancy_id: v.id, kind: 'job', category: v.category });
  }

  function portfolioBlock(r) {
    if (!r.portfolio_images.length && !r.portfolio_links.length) return '';
    return `<div class="card"><h3>Portfolio</h3>
      ${r.portfolio_images.length ? `<div class="gallery">${r.portfolio_images.map((src) => `<a href="${esc(src)}" target="_blank" rel="noopener"><img src="${esc(src)}" alt="" loading="lazy"></a>`).join('')}</div>` : ''}
      ${r.portfolio_links.map((l) => `<div style="margin-top:8px">🔗 <a href="${esc(l)}" target="_blank" rel="noopener noreferrer">${esc(l)}</a></div>`).join('')}
    </div>`;
  }

  function contactBlock(x, name) {
    if (!x.contacts_visible) {
      return '<div class="card muted small">🔒 Telefon raqam bog\'lanish so\'rovi qabul qilingandan keyin ko\'rinadi.</div>';
    }
    return `<div class="card contact"><h3>📞 Kontakt</h3>
      ${name ? `<div>${esc(name)}</div>` : ''}
      <div><a href="tel:${esc(x.phone)}">${esc(x.phone)}</a></div>
      ${x.telegram ? `<div>Telegram: <a href="https://t.me/${esc(x.telegram)}" target="_blank" rel="noopener">@${esc(x.telegram)}</a></div>` : ''}
    </div>`;
  }

  function connectDialog({ resume_id, vacancy_id, kind, category }) {
    const mine = kind === 'worker' ? state.me.vacancies.filter((v) => v.is_active) : state.me.resumes.filter((r) => r.is_active);
    if (kind === 'job' && !mine.length) {
      toast('Ariza yuborish uchun avval rezyume to\'ldiring');
      return go('/resume/new');
    }
    const best = mine.find((x) => x.category === category) || mine[0];
    const sheet = openSheet(`
      <h2>${kind === 'worker' ? 'Ishchiga taklif yuborish' : 'Vakansiyaga ariza'}</h2>
      <form class="stack" id="cForm">
        ${mine.length ? `<label class="field"><span>${kind === 'worker' ? 'Qaysi vakansiya bo\'yicha' : 'Qaysi rezyume bilan'}</span>
          <select name="ctx">${kind === 'worker' ? '<option value="">Vakansiyasiz (umumiy taklif)</option>' : ''}${mine.map((x) => `<option value="${x.id}" ${best && x.id === best.id ? 'selected' : ''}>${esc(kind === 'worker' ? x.position + ' · ' + x.company : x.specialization)}</option>`).join('')}</select></label>` : ''}
        <label class="field"><span>Xabar (ixtiyoriy)</span><textarea name="message" maxlength="500" placeholder="${kind === 'worker' ? 'Assalomu alaykum! Sizni ishga taklif qilmoqchimiz…' : 'Assalomu alaykum! Vakansiyangiz bilan qiziqdim…'}"></textarea></label>
        <p class="muted small">So'rov qabul qilinsa, ikkala tomon ham bir-birining telefon raqami va Telegramini ko'radi.</p>
        <button class="btn block">Yuborish</button>
      </form>`);
    sheet.querySelector('#cForm').onsubmit = async (e) => {
      e.preventDefault();
      const ctx = e.target.ctx ? e.target.ctx.value : '';
      const body = { message: e.target.message.value };
      if (kind === 'worker') { body.resume_id = resume_id; if (ctx) body.vacancy_id = Number(ctx); }
      else { body.vacancy_id = vacancy_id; body.resume_id = Number(ctx); }
      try {
        await api('/connections', { method: 'POST', body });
        sheet.close();
        haptic('medium');
        toast('✅ So\'rov yuborildi! Javob kelganda xabar beramiz.');
      } catch (err) { toast(err.message); }
    };
  }

  // ---- so'rovlar
  async function viewRequests() {
    loading();
    const tab = store.get('reqTab') || 'incoming';
    const data = await api('/connections');
    const list = data[tab];
    html(`
      <h1>Bog'lanish so'rovlari</h1>
      <div class="segmented">
        <button data-tab="incoming" class="${tab === 'incoming' ? 'on' : ''}">Kelganlar (${data.incoming.length})</button>
        <button data-tab="outgoing" class="${tab === 'outgoing' ? 'on' : ''}">Yuborilganlar (${data.outgoing.length})</button>
      </div>
      ${list.length ? list.map(requestCard).join('') : '<div class="card empty"><div class="ico">📭</div>Hozircha so\'rovlar yo\'q</div>'}`);
    $view.querySelectorAll('.segmented button').forEach((b) => (b.onclick = () => { store.set('reqTab', b.dataset.tab); viewRequests(); }));
    $view.querySelectorAll('[data-respond]').forEach((b) => (b.onclick = async () => {
      try {
        await api(`/connections/${b.dataset.id}/respond`, { method: 'POST', body: { accept: b.dataset.respond === '1' } });
        haptic('medium');
        toast(b.dataset.respond === '1' ? '✅ Qabul qilindi — kontaktlar ochildi' : 'Rad etildi');
        await refreshMe();
        viewRequests();
      } catch (err) { toast(err.message); }
    }));
    bindGo();
  }

  function requestCard(c) {
    const status = { pending: '<span class="tag">⏳ Kutilmoqda</span>', accepted: '<span class="tag green">✅ Qabul qilingan</span>', rejected: '<span class="tag red">❌ Rad etilgan</span>' }[c.status];
    const title = c.direction === 'to_worker'
      ? (c.incoming ? '🧑‍💼 Sizga ish taklifi' : '🧑‍💼 Ishchiga taklif')
      : (c.incoming ? '📩 Vakansiyangizga ariza' : '📩 Yuborilgan ariza');
    const contacts = c.status === 'accepted'
      ? `<div class="card contact" style="margin:10px 0 0;box-shadow:none">
          <b>${esc(c.other.name)}</b>
          ${[c.resume && !(c.direction === 'to_worker' && c.incoming) ? c.resume.phone : null, c.vacancy && !(c.direction === 'to_employer' && c.incoming) ? c.vacancy.phone : null]
            .filter(Boolean).filter((p, i, a) => a.indexOf(p) === i).map((p) => `<div>📞 <a href="tel:${esc(p)}">${esc(p)}</a></div>`).join('')}
          ${c.other.telegram ? `<div>✈️ <a href="https://t.me/${esc(c.other.telegram)}" target="_blank" rel="noopener">@${esc(c.other.telegram)}</a></div>` : ''}
        </div>`
      : '';
    return `<div class="card">
      <div class="row"><b style="flex:1">${title}</b>${status}</div>
      <div class="muted small">${esc(c.other.name)} · ${esc(c.created_at.slice(0, 16))}</div>
      ${c.resume ? `<div style="margin-top:6px" data-go="/worker/${c.resume.id}">👤 <a>${esc(c.resume.full_name)} — ${esc(c.resume.specialization)}</a> <span class="muted small">(${esc(c.resume.region)})</span></div>` : ''}
      ${c.vacancy ? `<div style="margin-top:4px" data-go="/job/${c.vacancy.id}">💼 <a>${esc(c.vacancy.position)} — ${esc(c.vacancy.company)}</a> <span class="muted small">${esc(salaryRange(c.vacancy.salary_from, c.vacancy.salary_to))}</span></div>` : ''}
      ${c.message ? `<div style="margin-top:8px;white-space:pre-wrap">💬 ${esc(c.message)}</div>` : ''}
      ${contacts}
      ${c.incoming && c.status === 'pending' ? `<div class="row" style="margin-top:10px"><button class="btn danger sm" data-respond="0" data-id="${c.id}" style="flex:1">Rad etish</button><button class="btn ok sm" data-respond="1" data-id="${c.id}" style="flex:2">Qabul qilish</button></div>` : ''}
    </div>`;
  }

  // ---- profil
  async function viewProfile() {
    await refreshMe();
    const me = state.me;
    const activeTag = (x) => (x.is_active ? '<span class="tag green">Faol</span>' : '<span class="tag">Yashirilgan</span>');
    html(`
      <div class="card row">
        <div class="avatar">${esc(initials(me.user.name))}</div>
        <div style="flex:1"><b>${esc(me.user.name)}</b><div class="muted small">${me.user.username ? '@' + esc(me.user.username) : me.user.telegram ? 'Telegram' : 'Sayt hisobi'}</div></div>
      </div>
      <div class="row" style="margin:16px 4px 8px"><h2 style="margin:0;flex:1">Rezyumelarim</h2><button class="btn sm" data-go="/resume/new">+ Qo'shish</button></div>
      ${me.resumes.length ? me.resumes.map((r) => `<div class="card">
        <div class="row"><b style="flex:1">${esc(r.specialization)}</b>${activeTag(r)}</div>
        <div class="muted small">${esc(cat(r.category).name)} · ${esc(r.region)}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn sm" data-go="/jobs?category=${r.category}&resume_id=${r.id}">🎯 Mos ishlar</button>
          <button class="btn ghost sm" data-go="/worker/${r.id}">Ko'rish</button>
          <button class="btn ghost sm" data-go="/resume/${r.id}/edit">Tahrirlash</button>
          <button class="btn ghost sm" data-toggle="resumes" data-id="${r.id}" data-active="${r.is_active}">${r.is_active ? 'Yashirish' : 'Faollashtirish'}</button>
          <button class="btn danger sm" data-del="resumes" data-id="${r.id}">O'chirish</button>
        </div></div>`).join('') : '<div class="card muted">Rezyume yo\'q. Ish topish uchun rezyume to\'ldiring.</div>'}
      <div class="row" style="margin:16px 4px 8px"><h2 style="margin:0;flex:1">Vakansiyalarim</h2><button class="btn sm" data-go="/vacancy/new">+ Qo'shish</button></div>
      ${me.vacancies.length ? me.vacancies.map((v) => `<div class="card">
        <div class="row"><b style="flex:1">${esc(v.position)}</b>${activeTag(v)}</div>
        <div class="muted small">${esc(v.company)} · ${esc(v.region)}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn sm" data-go="/workers?category=${v.category}&vacancy_id=${v.id}">🎯 Mos ishchilar</button>
          <button class="btn ghost sm" data-go="/job/${v.id}">Ko'rish</button>
          <button class="btn ghost sm" data-go="/vacancy/${v.id}/edit">Tahrirlash</button>
          <button class="btn ghost sm" data-toggle="vacancies" data-id="${v.id}" data-active="${v.is_active}">${v.is_active ? 'Yashirish' : 'Faollashtirish'}</button>
          <button class="btn danger sm" data-del="vacancies" data-id="${v.id}">O'chirish</button>
        </div></div>`).join('') : '<div class="card muted">Vakansiya yo\'q.</div>'}
      ${!tg ? '<button class="btn ghost block" id="logout" style="margin-top:16px">Chiqish</button>' : ''}`);
    bindGo();
    $view.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
      if (!confirm('Rostdan o\'chirmoqchimisiz?')) return;
      await api(`/${b.dataset.del}/${b.dataset.id}`, { method: 'DELETE' }).catch((e) => toast(e.message));
      viewProfile();
    }));
    $view.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = async () => {
      await api(`/${b.dataset.toggle}/${b.dataset.id}/active`, { method: 'PATCH', body: { is_active: b.dataset.active !== '1' } }).catch((e) => toast(e.message));
      viewProfile();
    }));
    const lo = document.getElementById('logout');
    if (lo) lo.onclick = () => {
      if (!confirm('Chiqsangiz, bu qurilmada hisobingizga qayta kira olmaysiz. Davom etasizmi?')) return;
      store.del('token');
      state.token = null;
      go('/login');
    };
  }

  // ------------------------------------------------------------------ wizard
  // Har bir qadam — bitta savol. Ma'lumotlar ketma-ket so'raladi.
  function resumeSteps() {
    const m = state.meta;
    return [
      { q: 'Ism-familiyangiz?', fields: [{ key: 'full_name', type: 'text', required: true, placeholder: 'Aziz Karimov', autocomplete: 'name' }] },
      { q: 'Tug\'ilgan yilingiz va jinsingiz', fields: [
        { key: 'birth_year', type: 'number', label: 'Tug\'ilgan yil', placeholder: '1998' },
        { key: 'gender', type: 'chips', label: 'Jins', options: m.genders.map((g) => [g.id, g.name]) },
      ] },
      { q: 'Telefon raqamingiz', hint: 'Faqat siz qabul qilgan ish beruvchilarga ko\'rinadi.', fields: [{ key: 'phone', type: 'tel', required: true, placeholder: '+998 90 123 45 67' }] },
      { q: 'Qayerda yashaysiz / ishlamoqchisiz?', fields: [
        { key: 'region', type: 'select', required: true, label: 'Viloyat', options: m.regions.map((r) => [r, r]) },
        { key: 'district', type: 'text', label: 'Tuman / shahar', placeholder: 'Masalan: Chilonzor' },
      ] },
      { q: 'Qaysi sohada ishlaysiz?', fields: [{ key: 'category', type: 'category', required: true }] },
      { q: 'Mutaxassisligingiz (kasbingiz)?', fields: [{ key: 'specialization', type: 'spec', required: true }] },
      { q: 'Ish stajingiz qancha?', fields: [
        { key: 'experience_years', type: 'number', required: true, label: 'Necha yil', placeholder: '0' },
      ], hint: 'Tajribangiz bo\'lmasa 0 kiriting.' },
      { q: 'Ma\'lumotingiz', fields: [{ key: 'education', type: 'chips', required: true, options: m.education_levels.map((e) => [e.id, e.id === 'none' ? 'Ma\'lumotsiz' : e.name]) }] },
      { q: 'Qaysi tillarni bilasiz?', fields: [{ key: 'languages', type: 'multi', options: m.languages.map((l) => [l, l]) }] },
      { q: 'Ko\'nikmalaringiz', hint: 'Vergul bilan ajrating: masalan Excel, 1C, haydovchilik guvohnomasi B', fields: [{ key: 'skills', type: 'tags', placeholder: 'Excel, 1C, …' }] },
      { q: 'Qanday ish turini xohlaysiz?', fields: [
        { key: 'employment_type', type: 'chips', required: true, label: 'Ish turi', options: m.employment_types.map((e) => [e.id, e.name]) },
        { key: 'official', type: 'chips', required: true, label: 'Rasmiylik', options: m.official_types.map((e) => [e.id, e.name]) },
      ] },
      { q: 'Kutilayotgan maosh (oyiga)', hint: 'So\'mda. Kelishiladi bo\'lsa bo\'sh qoldiring.', fields: [{ key: 'salary_min', type: 'number', placeholder: '5 000 000' }] },
      { q: 'Portfolio', hint: 'Ishlaringiz rasmlari va havolalar (Behance, GitHub, Instagram…). Ixtiyoriy.', fields: [
        { key: 'photo', type: 'photo', label: 'Profil rasmi' },
        { key: 'portfolio_images', type: 'images', label: 'Ish namunalari (rasmlar)' },
        { key: 'portfolio_links', type: 'links', label: 'Havolalar (har birini yangi qatorda)', placeholder: 'https://…' },
      ] },
      { q: 'O\'zingiz haqingizda qisqacha', fields: [{ key: 'about', type: 'textarea', placeholder: 'Qayerda ishlagansiz, nimalarni bilasiz, yutuqlaringiz…' }] },
    ];
  }

  function vacancySteps() {
    const m = state.meta;
    return [
      { q: 'Ish beruvchi haqida', fields: [
        { key: 'company', type: 'text', required: true, label: 'Kompaniya / tashkilot nomi', placeholder: 'Masalan: "Baraka Savdo" MChJ yoki shaxsiy' },
        { key: 'contact_name', type: 'text', required: true, label: 'Mas\'ul shaxs', placeholder: 'Ism' },
        { key: 'phone', type: 'tel', required: true, label: 'Telefon', placeholder: '+998 90 123 45 67' },
      ] },
      { q: 'Ish joyi qayerda?', fields: [
        { key: 'region', type: 'select', required: true, label: 'Viloyat', options: m.regions.map((r) => [r, r]) },
        { key: 'district', type: 'text', label: 'Tuman / manzil' },
      ] },
      { q: 'Qaysi soha uchun ishchi kerak?', fields: [{ key: 'category', type: 'category', required: true }] },
      { q: 'Qaysi lavozimga?', fields: [{ key: 'position', type: 'spec', required: true }] },
      { q: 'Nomzodga talablar', fields: [
        { key: 'experience_min', type: 'number', label: 'Minimal staj (yil)', placeholder: '0' },
        { key: 'education_min', type: 'chips', label: 'Minimal ma\'lumot', options: m.education_levels.map((e) => [e.id, e.name]) },
        { key: 'gender', type: 'chips', label: 'Jinsi', options: [['', 'Farqi yo\'q'], ...m.genders.map((g) => [g.id, g.name])] },
        { key: 'age_min', type: 'number', label: 'Yoshi (dan)' },
        { key: 'age_max', type: 'number', label: 'Yoshi (gacha)' },
        { key: 'languages', type: 'multi', label: 'Tillar', options: m.languages.map((l) => [l, l]) },
      ] },
      { q: 'Ish sharoiti', fields: [
        { key: 'employment_type', type: 'chips', required: true, label: 'Ish turi', options: m.employment_types.map((e) => [e.id, e.name]) },
        { key: 'official', type: 'chips', required: true, label: 'Rasmiylik', options: m.official_types.map((e) => [e.id, e.name]) },
      ] },
      { q: 'Maosh (oyiga, so\'m)', hint: 'Kelishiladi bo\'lsa bo\'sh qoldiring.', fields: [
        { key: 'salary_from', type: 'number', label: 'dan' },
        { key: 'salary_to', type: 'number', label: 'gacha' },
      ] },
      { q: 'Ish haqida batafsil', fields: [{ key: 'description', type: 'textarea', placeholder: 'Vazifalar, ish vaqti, sharoitlar…' }] },
    ];
  }

  async function viewWizard(kind, id) {
    const isResume = kind === 'resume';
    const steps = isResume ? resumeSteps() : vacancySteps();
    const draftKey = `draft:${kind}:${id || 'new'}`;
    let data;
    if (id) {
      const list = isResume ? state.me.resumes : state.me.vacancies;
      data = { ...(list.find((x) => String(x.id) === String(id)) || {}) };
      if (!data.id) throw new Error('Topilmadi');
    } else {
      data = store.get(draftKey) || (isResume
        ? { full_name: state.me.user.name, languages: ['O\'zbek'], education: 'secondary', official: 'any', skills: [], portfolio_links: [], portfolio_images: [] }
        : { contact_name: state.me.user.name, education_min: 'none', official: 'any', experience_min: 0, languages: [] });
    }
    let i = 0;

    const renderStep = () => {
      const step = steps[i];
      const last = i === steps.length;
      html(`
        <div class="muted small">${isResume ? 'Rezyume' : 'Vakansiya'} · ${last ? 'Tekshirish' : `${i + 1}-qadam / ${steps.length}`}</div>
        <div class="progress"><i style="width:${Math.round((i / steps.length) * 100)}%"></i></div>
        <form class="card" id="wForm" novalidate>
          ${last ? reviewHtml() : `
            <div class="wizard-q">${esc(step.q)}</div>
            ${step.hint ? `<p class="muted small">${esc(step.hint)}</p>` : ''}
            <div class="stack" style="margin-top:12px">${step.fields.map((f) => fieldHtml(f, data)).join('')}</div>`}
          <div class="error" id="wErr"></div>
          <div class="wizard-nav">
            ${i > 0 ? '<button type="button" class="btn ghost" id="wPrev">← Orqaga</button>' : ''}
            <button class="btn" id="wNext">${last ? (id ? '💾 Saqlash' : '✅ E\'lon qilish') : 'Keyingi →'}</button>
          </div>
        </form>`);
      if (!last) bindFields(step.fields, data, () => { store.set(draftKey, data); });
      const form = document.getElementById('wForm');
      const first = form.querySelector('input,select,textarea');
      if (first && !('ontouchstart' in window)) first.focus();
      const prev = document.getElementById('wPrev');
      if (prev) prev.onclick = () => { i--; renderStep(); };
      form.querySelectorAll('[data-jump]').forEach((a) => (a.onclick = () => { i = Number(a.dataset.jump); renderStep(); }));
      form.onsubmit = async (e) => {
        e.preventDefault();
        const err = document.getElementById('wErr');
        if (!last) {
          collect(step.fields, form, data);
          const missing = step.fields.find((f) => f.required && (data[f.key] === '' || data[f.key] == null || (Array.isArray(data[f.key]) && !data[f.key].length)));
          if (missing) { err.textContent = 'Iltimos, majburiy maydonni to\'ldiring'; haptic('rigid'); return; }
          if (!id) store.set(draftKey, data);
          i++;
          haptic();
          return renderStep();
        }
        const btn = document.getElementById('wNext');
        btn.disabled = true;
        try {
          const saved = await api(id ? `/${isResume ? 'resumes' : 'vacancies'}/${id}` : `/${isResume ? 'resumes' : 'vacancies'}`, { method: id ? 'PUT' : 'POST', body: data });
          store.del(draftKey);
          await refreshMe();
          haptic('heavy');
          toast(isResume ? '✅ Rezyume saqlandi! Mana sizga mos vakansiyalar.' : '✅ Vakansiya saqlandi! Mana mos ishchilar.');
          go(isResume ? `/jobs?category=${saved.category}&resume_id=${saved.id}` : `/workers?category=${saved.category}&vacancy_id=${saved.id}`);
        } catch (ex) {
          err.textContent = ex.message;
          btn.disabled = false;
        }
      };
    };
    renderStep();

    function reviewHtml() {
      const rows = [];
      steps.forEach((s, si) => s.fields.forEach((f) => {
        const v = data[f.key];
        if (v === '' || v == null || (Array.isArray(v) && !v.length)) return;
        let shown;
        if (f.type === 'category') shown = `${cat(v).icon} ${cat(v).name}`;
        else if (f.type === 'images') shown = `${v.length} ta rasm`;
        else if (f.type === 'photo') shown = 'Yuklangan';
        else if (Array.isArray(v)) shown = v.join(', ');
        else if (f.options) shown = (f.options.find(([o]) => String(o) === String(v)) || [, v])[1];
        else shown = v;
        rows.push(`<dt>${esc(f.label || s.q)} <a class="small" data-jump="${si}" style="cursor:pointer">✏️</a></dt><dd>${esc(shown)}</dd>`);
      }));
      return `<div class="wizard-q">Hammasi to'g'rimi?</div><p class="muted small">Tahrirlash uchun ✏️ ni bosing.</p><dl class="review">${rows.join('')}</dl>`;
    }
  }

  function fieldHtml(f, data) {
    const v = data[f.key];
    const label = f.label ? `<span>${esc(f.label)}${f.required ? ' *' : ''}</span>` : '';
    const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
    switch (f.type) {
      case 'text': case 'tel':
        return `<label class="field">${label}<input name="${f.key}" type="${f.type}" value="${esc(v || '')}" ${ph} ${f.autocomplete ? `autocomplete="${f.autocomplete}"` : ''} ${f.type === 'tel' ? 'inputmode="tel"' : ''}></label>`;
      case 'number':
        return `<label class="field">${label}<input name="${f.key}" type="number" min="0" inputmode="numeric" value="${v == null ? '' : esc(v)}" ${ph}></label>`;
      case 'textarea':
        return `<label class="field">${label}<textarea name="${f.key}" maxlength="2000" ${ph}>${esc(v || '')}</textarea></label>`;
      case 'select':
        return `<label class="field">${label}<select name="${f.key}"><option value="">Tanlang…</option>${f.options.map(([o, l]) => `<option value="${esc(o)}" ${String(o) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
      case 'chips':
        return `<div class="field">${label ? `<label class="field">${label}</label>` : ''}<div class="chips" data-chips="${f.key}">${f.options.map(([o, l]) => `<button type="button" class="chip ${String(o) === String(v == null ? '' : v) ? 'on' : ''}" data-v="${esc(o)}">${esc(l)}</button>`).join('')}</div></div>`;
      case 'multi':
        return `<div class="field">${label ? `<label class="field">${label}</label>` : ''}<div class="chips" data-multi="${f.key}">${f.options.map(([o, l]) => `<button type="button" class="chip ${(v || []).includes(o) ? 'on' : ''}" data-v="${esc(o)}">${esc(l)}</button>`).join('')}</div></div>`;
      case 'tags':
        return `<label class="field">${label}<input name="${f.key}" value="${esc((v || []).join(', '))}" ${ph}></label>`;
      case 'links':
        return `<label class="field">${label}<textarea name="${f.key}" style="min-height:80px" ${ph}>${esc((v || []).join('\n'))}</textarea></label>`;
      case 'category':
        return `<div class="cats" data-cat="${f.key}">${state.meta.categories.map((c) => `<button type="button" class="cat ${c.id === v ? 'selected' : ''}" data-v="${c.id}"><span class="ico">${c.icon}</span><span>${esc(c.name)}</span></button>`).join('')}</div>`;
      case 'spec': {
        const specs = cat(data.category).specs || [];
        return `<div class="chips" data-spec="${f.key}">${specs.map((s) => `<button type="button" class="chip ${s === v ? 'on' : ''}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
          <label class="field"><span>Yoki o'zingiz yozing</span><input name="${f.key}" value="${esc(v || '')}" placeholder="Masalan: Payvandchi (argon)"></label>`;
      }
      case 'photo':
        return `<div class="field">${label}<div class="thumbs" data-photo="${f.key}">${v ? `<div class="thumb"><img src="${esc(v)}" alt=""><button type="button" data-rm>×</button></div>` : ''}</div>
          <input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${f.key}" style="margin-top:6px"></div>`;
      case 'images':
        return `<div class="field">${label}<div class="thumbs" data-images="${f.key}">${(v || []).map((src, n) => `<div class="thumb"><img src="${esc(src)}" alt=""><button type="button" data-rm="${n}">×</button></div>`).join('')}</div>
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple data-upload="${f.key}" style="margin-top:6px"></div>`;
      default: return '';
    }
  }

  function bindFields(fields, data, onChange) {
    const form = document.getElementById('wForm');
    form.querySelectorAll('[data-chips]').forEach((box) => box.querySelectorAll('.chip').forEach((b) => (b.onclick = () => {
      box.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      data[box.dataset.chips] = b.dataset.v;
      haptic();
      onChange();
    })));
    form.querySelectorAll('[data-multi]').forEach((box) => box.querySelectorAll('.chip').forEach((b) => (b.onclick = () => {
      b.classList.toggle('on');
      data[box.dataset.multi] = [...box.querySelectorAll('.chip.on')].map((x) => x.dataset.v);
      haptic();
      onChange();
    })));
    form.querySelectorAll('[data-cat]').forEach((box) => box.querySelectorAll('.cat').forEach((b) => (b.onclick = () => {
      const key = box.dataset.cat;
      if (data[key] !== b.dataset.v) { data.specialization = ''; data.position = ''; }
      data[key] = b.dataset.v;
      haptic();
      onChange();
      form.requestSubmit();
    })));
    form.querySelectorAll('[data-spec]').forEach((box) => box.querySelectorAll('.chip').forEach((b) => (b.onclick = () => {
      const input = form.querySelector(`input[name="${box.dataset.spec}"]`);
      input.value = b.dataset.v;
      box.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b));
      haptic();
    })));
    form.querySelectorAll('[data-upload]').forEach((input) => (input.onchange = async () => {
      const key = input.dataset.upload;
      const fd = new FormData();
      [...input.files].slice(0, 10).forEach((f) => fd.append('files', f));
      input.disabled = true;
      try {
        const r = await api('/upload', { method: 'POST', body: fd });
        if (key === 'photo') data.photo = r.files[0];
        else data[key] = [...(data[key] || []), ...r.files].slice(0, 10);
        collect(fields, form, data);
        onChange();
        rerenderField(key);
      } catch (e) { toast(e.message); input.disabled = false; }
    }));
    form.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => {
      const box = b.closest('[data-images],[data-photo]');
      if (box.dataset.photo) data.photo = null;
      else data[box.dataset.images].splice(Number(b.dataset.rm), 1);
      collect(fields, form, data);
      onChange();
      rerenderField(box.dataset.photo || box.dataset.images);
    }));
    function rerenderField(key) {
      const f = fields.find((x) => x.key === key);
      const holder = form.querySelector(`[data-upload="${key}"]`).closest('.field');
      const tmp = document.createElement('div');
      tmp.innerHTML = fieldHtml(f, data);
      holder.replaceWith(tmp.firstElementChild);
      bindFields(fields, data, onChange);
    }
  }

  function collect(fields, form, data) {
    for (const f of fields) {
      const el = form.querySelector(`[name="${f.key}"]`);
      if (!el) continue;
      if (f.type === 'number') data[f.key] = el.value === '' ? null : Number(el.value);
      else if (f.type === 'tags') data[f.key] = el.value.split(',').map((s) => s.trim()).filter(Boolean);
      else if (f.type === 'links') data[f.key] = el.value.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//i.test(s));
      else data[f.key] = el.value.trim();
    }
  }

  // ------------------------------------------------------------------ boot
  async function boot() {
    try {
      state.meta = await api('/meta');
      if (tg && state.meta.telegram_login) {
        const r = await api('/auth/telegram', { method: 'POST', body: { initData: tg.initData } }).catch(() => null);
        if (r) { state.token = r.token; store.set('token', r.token); }
      }
      if (state.token) await refreshMe().catch(() => { state.token = null; store.del('token'); });
    } catch (e) {
      html(`<div class="card empty"><div class="ico">📡</div>Server bilan aloqa yo'q.<br>${esc(e.message)}</div>`);
      return;
    }
    window.addEventListener('hashchange', render);
    if (!state.token && parseHash().path !== '/login') go('/login');
    else render();
  }
  boot();
})();
