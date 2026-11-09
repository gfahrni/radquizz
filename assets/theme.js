/* =========================================================
   Thème + petits utilitaires partagés (accueil et pages de cas)
   Chargé avant app.js / home.js.
   ========================================================= */
window.RQ = (() => {
  'use strict';

  const THEMES = ['classic', 'noel'];

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

  function applyTheme(theme, persist = true) {
    const next = THEMES.includes(theme) ? theme : 'classic';
    document.documentElement.dataset.theme = next;
    document.querySelectorAll('[data-set-theme]').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.dataset.setTheme === next));
    });
    const meta = document.getElementById('meta-theme-color');
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
    document.querySelectorAll('[data-set-theme]').forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.setTheme));
    });
  }

  return { THEMES, store, applyTheme, initTheme };
})();
