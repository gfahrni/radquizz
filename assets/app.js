/* =========================================================
   RadQuizz — logique de page (vanilla, aucune dépendance)
   - charge content/series.json + content/form.json
   - une série = un onglet, adresse partageable (#/serie-01)
   - pile d'images scrollable (scroll-snap natif)
   - formulaire Google Forms intégré, prérempli (série + id participant)
   ========================================================= */
(() => {
  'use strict';

  const CFG_URL = 'content/series.json';
  const FORM_URL = 'content/form.json';
  const THEMES = ['classic', 'noel'];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('rq.' + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('rq.' + key, JSON.stringify(value)); } catch { /* mode privé */ }
    },
  };

  /* ---------------- Thème ---------------- */

  function applyTheme(theme, persist = true) {
    const next = THEMES.includes(theme) ? theme : 'classic';
    document.documentElement.dataset.theme = next;
    $$('[data-set-theme]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.setTheme === next));
    });
    const meta = $('#meta-theme-color');
    if (meta) meta.content = next === 'noel' ? '#0f1d16' : '#f4f5f7';
    if (persist) store.set('theme', next);
  }

  function initTheme() {
    const param = new URLSearchParams(location.search).get('theme');
    let theme = THEMES.includes(param) ? param : store.get('theme', null);
    if (!THEMES.includes(theme)) {
      // Saisonnalité : tout décembre en thème de Noël, sauf choix explicite.
      theme = new Date().getMonth() === 11 ? 'noel' : 'classic';
    }
    applyTheme(theme, THEMES.includes(param));
    $$('[data-set-theme]').forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.setTheme));
    });
  }

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

  /* ---------------- État ---------------- */

  const state = {
    quiz: { title: 'RadQuizz', subtitle: '', footer: '' },
    series: [],
    form: { formId: '', entries: {} },
    manifests: new Map(),
    activeId: null,
    pid: participantId(),
    cineloop: null,
    stackPositions: store.get('positions', {}),
  };

  /* ---------------- Données ---------------- */

  async function getJSON(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(url + ' → HTTP ' + res.status);
    return res.json();
  }

  async function loadManifest(serie) {
    if (state.manifests.has(serie.id)) return state.manifests.get(serie.id);
    let files = [];
    try {
      const base = String(serie.folder || '').replace(/\/+$/, '');
      files = await getJSON(base + '/manifest.json');
      if (!Array.isArray(files)) files = [];
    } catch (err) {
      console.warn('[radquizz] manifest manquant pour', serie.id, err);
    }
    state.manifests.set(serie.id, files);
    return files;
  }

  const imageUrl = (serie, file) => {
    const base = String(serie.folder || '').replace(/\/+$/, '');
    return base + '/' + encodeURIComponent(file);
  };

  /* ---------------- Formulaire ---------------- */

  function buildFormSrc(serie) {
    const { formId, entries = {} } = state.form;
    if (!formId) return null;

    const base = /^https?:/i.test(formId)
      ? formId
      : 'https://docs.google.com/forms/d/e/' + encodeURIComponent(formId) + '/viewform';

    let url;
    try { url = new URL(base); } catch { return null; }

    url.searchParams.set('embedded', 'true');
    const prefill = {
      serie: serie?.formLabel || serie?.title || serie?.id || '',
      participant: state.pid,
    };
    let used = false;
    for (const [key, value] of Object.entries(prefill)) {
      const entry = entries[key];
      if (entry && value) { url.searchParams.set(entry, value); used = true; }
    }
    if (used) url.searchParams.set('usp', 'pp_url');
    return url.toString();
  }

  function renderForm(serie) {
    const shell = $('.form-shell');
    if (!shell) return;
    shell.replaceChildren();

    const src = buildFormSrc(serie);
    if (!src) {
      const box = document.createElement('div');
      box.className = 'form-placeholder';
      box.innerHTML = `
        <p class="ph-title">Formulaire non branché (c'est normal au premier lancement)</p>
        <p>Créez votre Google Form avec vos questions, puis renseignez son identifiant
           dans <code>content/form.json</code> :</p>
        <p><code>{ "formId": "1FAIpQLS…", "entries": { "serie": "entry.111", "participant": "entry.222" } }</code></p>
        <p>Le mode d'emploi détaillé (récupérer les <code>entry.…</code>) est dans le
           <code>README.md</code>. Tant que ce n'est pas fait, le reste du site fonctionne.</p>`;
      shell.append(box);
      return;
    }

    const frame = document.createElement('iframe');
    frame.src = src;
    frame.title = 'Formulaire de réponse — ' + (serie?.title || 'cas');
    frame.loading = 'lazy';
    frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    shell.append(frame);
  }

  /* ---------------- Rendu d'une série ---------------- */

  function renderSerie(serie) {
    const panel = $('#panel');
    const files = state.manifests.get(serie.id) || [];
    const total = files.length;

    const section = document.createElement('section');
    section.className = 'serie';
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-labelledby', 'tab-' + serie.id);
    section.dataset.id = serie.id;

    const head = document.createElement('div');
    head.className = 'case-head';
    head.innerHTML = `
      <h2></h2>
      <p class="stem"></p>`;
    $('h2', head).textContent = serie.title || serie.id;
    const stemEl = $('.stem', head);
    if (serie.stem) stemEl.textContent = serie.stem; else stemEl.remove();

    /* --- la pile --- */
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
        <code>${serie.folder}</code> puis lancez <code>node tools/build.mjs</code>.</p>`;
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

    /* --- indice + bouton --- */
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" fill="none"
        stroke="currentColor" stroke-width="1.4"><path d="M8 2v12M4 10l4 4 4-4"/></svg>
        Molette ou flèches ↑ ↓ pour défiler les coupes`;

    const cta = document.createElement('a');
    cta.className = 'cta';
    cta.href = '#reponse';
    cta.innerHTML = `Donner mon diagnostic
      <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5"/></svg>`;

    /* --- zone de réponse --- */
    const answer = document.createElement('section');
    answer.className = 'answer';
    answer.id = 'reponse';
    answer.innerHTML = `
      <div class="answer-head"><h3>Votre diagnostic</h3></div>
      <p class="answer-sub">Un diagnostic en texte libre, puis vos coordonnées.
        Comptez deux minutes. L'envoi se fait depuis le formulaire ci-dessous.</p>
      <div class="form-shell"></div>`;

    section.append(head, viewer, hint, cta, answer);
    panel.replaceChildren(section);

    /* --- comportements --- */
    if (total) wireStack(stack, files.length);
    renderForm(serie);
    restorePosition(serie.id, stack);
  }

  function wireStack(stack, total) {
    const posEl = $('.pos');
    const countEl = $('.of');

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = stack.clientHeight || 1;
        const idx = Math.min(total - 1, Math.max(0, Math.round(stack.scrollTop / h)));
        if (posEl) posEl.textContent = String(idx + 1);
        if (countEl) countEl.textContent = ' / ' + total;
        state.stackPositions[state.activeId] = stack.scrollTop;
      });
    };
    stack.addEventListener('scroll', onScroll, { passive: true });

    const step = (dir) => stack.scrollBy({ top: dir * stack.clientHeight, behavior: 'smooth' });

    stack.addEventListener('keydown', (e) => {
      const keys = {
        ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1,
      };
      if (e.key in keys) { e.preventDefault(); step(keys[e.key]); return; }
      if (e.key === 'Home') { e.preventDefault(); stack.scrollTo({ top: 0, behavior: 'smooth' }); }
      if (e.key === 'End') {
        e.preventDefault();
        stack.scrollTo({ top: stack.scrollHeight, behavior: 'smooth' });
      }
    });

    /* ciné : avance automatiquement, s'arrête à la fin */
    const btn = $('.cineloop', stack.parentElement);
    if (btn) {
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
      // toute interaction manuelle coupe la lecture
      stack.addEventListener('wheel', stop, { passive: true });
      stack.addEventListener('pointerdown', stop, { passive: true });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.cineloop) {
        clearInterval(state.cineloop);
        state.cineloop = null;
        if (btn) btn.setAttribute('aria-pressed', 'false');
      }
    }, { once: true });
  }

  function restorePosition(id, stack) {
    const y = state.stackPositions[id];
    if (!y) return;
    requestAnimationFrame(() => { stack.scrollTop = y; });
  }

  /* ---------------- Onglets + routeur ---------------- */

  function renderTabs() {
    const nav = $('#tabs');
    if (state.series.length < 2) { nav.hidden = true; return; }
    nav.hidden = false;
    nav.replaceChildren();

    state.series.forEach((serie, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tab';
      btn.id = 'tab-' + serie.id;
      btn.dataset.id = serie.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      btn.setAttribute('aria-controls', 'panel');
      btn.tabIndex = -1;
      btn.innerHTML = `<span class="tab-index">${String(i + 1).padStart(2, '0')}</span>` +
        escapeHtml(serie.tab || serie.title || serie.id);
      btn.addEventListener('click', () => select(serie.id));
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
      select(next.dataset.id);
    });
  }

  function syncTabs() {
    $$('.tab').forEach((btn) => {
      const on = btn.dataset.id === state.activeId;
      btn.setAttribute('aria-selected', String(on));
      btn.tabIndex = on ? 0 : -1;
    });
  }

  async function select(id, { push = true } = {}) {
    const serie = state.series.find((s) => s.id === id) || state.series[0];
    if (!serie) return;
    state.activeId = serie.id;
    if (push) history.pushState(null, '', '#/' + serie.id);
    syncTabs();
    await loadManifest(serie);
    renderSerie(serie);
    if (push) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
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
      $('#panel').innerHTML = `<div class="notice"><strong>Ouverture en file://</strong><br>
        Les navigateurs bloquent la lecture des fichiers JSON depuis un fichier local.
        Lancez un petit serveur : <code>node tools/serve.mjs</code> ou
        <code>python3 -m http.server 8000</code>, puis ouvrez
        <code>http://localhost:8000</code>.</div>`;
      return;
    }

    try {
      const [cfg, formCfg] = await Promise.all([
        getJSON(CFG_URL),
        getJSON(FORM_URL).catch(() => ({})),
      ]);

      state.quiz = { ...state.quiz, ...(cfg.quiz || {}) };
      state.series = Array.isArray(cfg.series) ? cfg.series.filter((s) => s && s.id) : [];
      state.form = { ...state.form, ...(formCfg || {}) };

      if (!state.series.length) throw new Error('Aucune série dans content/series.json');

      document.title = state.quiz.title ? state.quiz.title + ' — cas radiologiques' : document.title;
      $('#quiz-title').textContent = state.quiz.title || 'RadQuizz';
      $('#quiz-sub').textContent = state.quiz.subtitle || '';
      if (state.quiz.footer) $('#foot-note').textContent = state.quiz.footer;

      renderTabs();
      await select(idFromHash() || state.series[0].id, { push: false });

      window.addEventListener('popstate', () => {
        const id = idFromHash();
        if (id && id !== state.activeId) select(id, { push: false });
      });

      // enregistre la position de lecture à la fermeture
      window.addEventListener('pagehide', () => store.set('positions', state.stackPositions));
    } catch (err) {
      console.error(err);
      $('#panel').innerHTML = `<div class="notice"><strong>Impossible de charger le quiz.</strong><br>
        ${escapeHtml(err.message)}<br>
        Vérifiez que <code>content/series.json</code> existe et que la page est servie
        en HTTP (pas en <code>file://</code>).</div>`;
    }
  }

  boot();
})();
