/* =========================================================
   Page d'accueil : liste des cas (content/cases.json, généré).
   ========================================================= */
(() => {
  'use strict';

  const { initTheme, store } = window.RQ;
  const $ = (sel, root = document) => root.querySelector(sel);

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  function card(item) {
    const a = document.createElement('a');
    a.className = 'case-card';
    a.href = item.href;
    a.dataset.id = item.id;
    a.innerHTML = `
      <div class="thumb">
        ${item.thumb
          ? `<img src="${esc(item.thumb)}" alt="" loading="lazy" decoding="async">`
          : '<span class="thumb-empty">—</span>'}
      </div>
      <div class="case-body">
        <p class="case-kicker">${esc(item.exam || 'Cas')}</p>
        <h2>${esc(item.title)}</h2>
        <p class="case-stem">${esc(item.stem || '')}</p>
        <p class="case-foot">
          <span>${item.seriesCount} série${item.seriesCount > 1 ? 's' : ''}</span>
          <span>${item.sliceCount} coupes</span>
        </p>
      </div>`;
    return a;
  }

  async function boot() {
    initTheme();
    const grid = $('#cases');

    try {
      const res = await fetch('content/cases.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();

      const version = data.version || '';
      if (version) $('#version').textContent = 'v' + version;

      const items = Array.isArray(data.cases) ? data.cases : [];
      if (!items.length) {
        grid.innerHTML = `<div class="notice">Aucun cas publié pour l'instant.
          Ajoutez un fichier dans <code>content/cases/</code> puis lancez
          <code>npm run build</code>.</div>`;
        return;
      }

      grid.replaceChildren(...items.map(card));

      // petit confort : dernier cas ouvert
      const last = store.get('lastCase', null);
      const el = last && grid.querySelector(`.case-card[data-id="${last}"]`);
      if (el) el.classList.add('is-last');
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<div class="notice"><strong>Impossible de charger la liste des cas.</strong><br>
        ${esc(err.message)}<br>Lancez <code>npm run build</code> pour générer
        <code>content/cases.json</code>.</div>`;
    }
  }

  boot();
})();
