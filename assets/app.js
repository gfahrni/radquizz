/* =========================================================
   Page d'un cas.
   - 1 page = 1 cas ; les onglets = les séries (axial, coronal, …)
   - pile d'images scrollable (scroll-snap natif)
   - formulaire Google intégré, prérempli (cas + id participant)
   ========================================================= */
(() => {
  'use strict';

  const { initTheme, store } = window.RQ;

  const BASE = document.body.dataset.base || '';
  const CASE_ID = document.body.dataset.case || '';
  const VERSION = document.body.dataset.version || '';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const url = (path) => BASE + path;

  const state = {
    data: null,
    form: { formId: '', entries: {} },
    serie: null,
    manifests: new Map(),
    positions: store.get('positions', {}),
    cineloop: null,
    pid: participantId(),
  };

  /* ---------------- Identité participant ---------------- */

  function participantId() {
    let pid = store.get('pid', null);
    if (!pid) {
      pid = (crypto.randomUUID && crypto.randomUUID()) ||
        'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
      store.set('pid', pid);
    }
    return pid;
  }

  /* ---------------- Données ---------------- */

  async function getJSON(path) {
    const res = await fetch(url(path), { cache: 'no-cache' });
    if (!res.ok) throw new Error(path + ' → HTTP ' + res.status);
    return res.json();
  }

  async function loadManifest(serie) {
    if (state.manifests.has(serie.id)) return state.manifests.get(serie.id);
    let files = [];
    try {
      files = await getJSON(String(serie.folder).replace(/\/+$/, '') + '/manifest.json');
      if (!Array.isArray(files)) files = [];
    } catch (err) {
      console.warn('[radquizz] manifest manquant pour', serie.id, err);
    }
    state.manifests.set(serie.id, files);
    return files;
  }

  const imageUrl = (serie, file) =>
    url(String(serie.folder).replace(/\/+$/, '') + '/' + encodeURIComponent(file));

  /* ---------------- Formulaire ---------------- */

  function buildFormSrc(data) {
    const { formId, entries = {} } = state.form;
    if (!formId) return null;

    const base = /^https?:/i.test(formId)
      ? formId
      : 'https://docs.google.com/forms/d/e/' + encodeURIComponent(formId) + '/viewform';

    let link;
    try { link = new URL(base); } catch { return null; }

    link.searchParams.set('embedded', 'true');

    const prefill = {
      cas: data.formLabel || data.title || data.id,
      participant: state.pid,
    };
    let used = false;
    for (const [key, value] of Object.entries(prefill)) {
      const entry = entries[key];
      if (entry && value) { link.searchParams.set(entry, value); used = true; }
    }
    if (used) link.searchParams.set('usp', 'pp_url');
    return link.toString();
  }

  function renderForm(data) {
    const shell = $('#form-shell');
    if (!shell) return;
    shell.replaceChildren();

    const src = buildFormSrc(data);
    if (!src) {
      const box = document.createElement('div');
      box.className = 'form-placeholder';
      box.innerHTML = `
        <p class="ph-title">Formulaire non branché (c'est normal au premier lancement)</p>
        <p>Créez votre Google Form, puis renseignez son identifiant dans
           <code>content/form.json</code> :</p>
        <p><code>{ "formId": "1FAIpQLS…", "entries": { "cas": "entry.111", "participant": "entry.222" } }</code></p>
        <p>Le mode d'emploi (récupérer les <code>entry.…</code>) est dans le
           <code>README.md</code>. Tant que ce n'est pas fait, le reste du site fonctionne.</p>`;
      shell.append(box);
      return;
    }

    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = 'Formulaire de réponse — ' + (data.title || 'cas');
    frame.loading = 'lazy';
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    shell.append(frame);
  }

  /* ---------------- En-tête du cas ---------------- */

  function renderHead(data) {
    document.title = data.title + ' · RadQuizz';
    $('#case-title').textContent = data.title;
    $('#case-stem').textContent = data.stem || '';

    const total = data.series.reduce((n, s) => n + (state.manifests.get(s.id) || []).length, 0);
    const parts = [
      data.exam,
      `${data.series.length} série${data.series.length > 1 ? 's' : ''}`,
      `${total} coupes`,
    ].filter(Boolean);
    $('#case-meta').textContent = parts.join('  ·  ');

    const tag = $('#answer-tag');
    if (tag) tag.textContent = data.formLabel || data.title;
  }

  /* ---------------- Onglets = séries du cas ---------------- */

  function renderTabs(data) {
    const nav = $('#tabs');
    if (data.series.length < 2) { nav.hidden = true; return; }
    nav.hidden = false;
    nav.replaceChildren();

    data.series.forEach((serie, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.id = 'tab-' + serie.id;
      btn.dataset.id = serie.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('aria-controls', 'stage');
      btn.tabIndex = -1;
      btn.innerHTML = `<span class="tab-index">${String(i + 1).padStart(2, '0')}</span>` +
        escapeHtml(serie.tab || serie.id);
      btn.addEventListener('click', () => selectSerie(serie.id));
      nav.append(btn);
    });

    nav.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const tabs = $$('.tab', nav);
      const i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      selectSerie(next.dataset.id);
    });
  }

  function syncTabs() {
    $$('.tab').forEach((btn) => {
      const on = btn.dataset.id === state.serie?.id;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
    });
  }

  /* ---------------- Pile d'images ---------------- */

  function renderStage(serie) {
    const stage = $('#stage');
    const files = state.manifests.get(serie.id) || [];
    const total = files.length;

    const viewer = document.createElement('div');
    viewer.className = 'viewer';

    const stack = document.createElement('div');
    stack.className = 'stack';
    stack.tabIndex = 0;
    stack.setAttribute('role', 'group');
    stack.setAttribute('aria-label', total
      ? `Pile de ${total} coupes, utilisez les flèches haut et bas`
      : 'Aucune image');

    if (!total) {
      stack.innerHTML = `<p class="notice" style="margin:24px;color:#c9d1d9">
        Aucune coupe pour cette série. Ajoutez des JPG dans
        <code>${escapeHtml(serie.folder)}</code> puis lancez
        <code>npm run build</code>.</p>`;
    } else {
      files.forEach((file, i) => {
        const img = document.createElement('img');
        img.className = 'slice';
        img.src = imageUrl(serie, file);
        img.alt = `Coupe ${i + 1} sur ${total}`;
        img.decoding = 'async';
        img.draggable = false;
        if (i > 1) img.loading = 'lazy';
        if (i === 0) img.fetchPriority = 'high';
        stack.append(img);
      });
    }

    const hud = document.createElement('div');
    hud.className = 'hud';
    hud.innerHTML = `
      <div class="counter"><span class="pos">1</span><span class="of"> / ${total || 0}</span></div>
      <div class="rationale">
        <button class="icon-btn cineloop" type="button" aria-pressed="false" title="Lecture automatique (ciné)">
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>
        </button>
      </div>`;

    viewer.append(stack, hud);
    if (!total) hud.remove();
    stage.replaceChildren(viewer);

    const meta = $('#serie-meta');
    if (meta) {
      meta.textContent = serie.note || '';
      meta.hidden = !serie.note;
    }

    if (total) wireStack(stack, total);
    restorePosition(stack);
  }

  function wireStack(stack, total) {
    const posEl = $('.pos', stack.parentElement);
    const countEl = $('.of', stack.parentElement);
    const key = CASE_ID + ':' + state.serie.id;

    let raf = 0;
    stack.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = stack.clientHeight || 1;
        const idx = Math.min(total - 1, Math.max(0, Math.round(stack.scrollTop / h)));
        if (posEl) posEl.textContent = String(idx + 1);
        if (countEl) countEl.textContent = ' / ' + total;
        state.positions[key] = stack.scrollTop;
      });
    }, { passive: true });

    const step = (dir) => stack.scrollBy({ top: dir * stack.clientHeight, behavior: 'smooth' });

    stack.addEventListener('keydown', (e) => {
      const dirs = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
      if (e.key in dirs) { e.preventDefault(); step(dirs[e.key]); return; }
      if (e.key === 'Home') { e.preventDefault(); stack.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (e.key === 'End') {
        e.preventDefault();
        stack.scrollTo({ top: stack.scrollHeight, behavior: 'smooth' });
      }
    });

    /* ciné : avance automatiquement, s'arrête à la fin */
    const btn = $('.cineloop', stack.parentElement);
    if (!btn) return;

    const iconPlay = '<path d="M4 2.5v11l9-5.5z" fill="currentColor"/>';
    const iconPause = '<path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor"/>';
    const svg = $('svg', btn);

    const stop = () => {
      clearInterval(state.cineloop);
      state.cineloop = null;
      btn.setAttribute('aria-pressed', 'false');
      if (svg) svg.innerHTML = iconPlay;
    };

    btn.addEventListener('click', () => {
      if (state.cineloop) { stop(); return; }
      const h = stack.clientHeight || 1;
      btn.setAttribute('aria-pressed', 'true');
      if (svg) svg.innerHTML = iconPause;
      state.cineloop = setInterval(() => {
        const next = Math.round(stack.scrollTop / h) + 1;
        if (next >= total) { stop(); return; }
        stack.scrollTo({ top: next * h, behavior: 'smooth' });
      }, 260);
    });

    stack.addEventListener('wheel', stop, { passive: true });
    stack.addEventListener('pointerdown', stop, { passive: true });
  }

  function restorePosition(stack) {
    const y = state.positions[CASE_ID + ':' + state.serie.id];
    if (!y) return;
    requestAnimationFrame(() => { stack.scrollTop = y; });
  }

  /* ---------------- Navigation entre séries ---------------- */

  async function selectSerie(id, { push = true } = {}) {
    const data = state.data;
    const serie = data.series.find((s) => s.id === id) || data.series[0];
    if (!serie) return;

    if (state.cineloop) { clearInterval(state.cineloop); state.cineloop = null; }

    state.serie = serie;
    if (push) history.pushState(null, '', '#/' + serie.id);

    syncTabs();
    await loadManifest(serie);
    renderStage(serie);
  }

  function idFromHash() {
    const m = /^#\/(.+)$/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  /* ---------------- Démarrage ---------------- */

  async function boot() {
    initTheme();

    if (location.protocol === 'file:') {
      $('#stage').innerHTML = `<div class="notice"><strong>Ouverture en file://</strong><br>
        Les navigateurs bloquent la lecture des fichiers JSON depuis un fichier local.
        Lancez <code>npm start</code> ou <code>python3 -m http.server 8000</code>, puis ouvrez
        <code>http://localhost:8000</code>.</div>`;
      return;
    }

    if (!CASE_ID) {
      $('#stage').innerHTML = `<div class="notice"><strong>Page générée sans identifiant de cas.</strong><br>
        Cette page doit être créée par <code>npm run build</code>.</div>`;
      return;
    }

    try {
      const [data, formCfg] = await Promise.all([
        getJSON(`content/cases/${CASE_ID}.json`),
        getJSON('content/form.json').catch(() => ({})),
      ]);

      state.data = data;
      state.form = { ...state.form, ...(formCfg || {}) };

      if (!Array.isArray(data.series) || !data.series.length) {
        throw new Error('Ce cas ne déclare aucune série.');
      }

      await Promise.all(data.series.map((s) => loadManifest(s)));

      if (VERSION) $('#version').textContent = 'v' + VERSION;
      store.set('lastCase', CASE_ID);

      renderHead(data);
      renderTabs(data);
      renderForm(data);

      const cta = $('#cta');
      if (cta) cta.addEventListener('click', (e) => {
        e.preventDefault();
        $('#reponse').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      await selectSerie(idFromHash() || data.series[0].id, { push: false });

      window.addEventListener('popstate', () => {
        const id = idFromHash();
        if (id && id !== state.serie?.id) selectSerie(id, { push: false });
      });

      window.addEventListener('pagehide', () => store.set('positions', state.positions));
    } catch (err) {
      console.error(err);
      $('#stage').innerHTML = `<div class="notice"><strong>Impossible de charger ce cas.</strong><br>
        ${escapeHtml(err.message)}<br>
        Vérifiez <code>content/cases/${escapeHtml(CASE_ID)}.json</code> et relancez
        <code>npm run build</code>.</div>`;
    }
  }

  boot();
})();
