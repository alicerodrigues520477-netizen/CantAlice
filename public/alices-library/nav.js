/* Navegação principal (barra superior no tablet/desktop, abas embaixo no celular).
   Fica fora do leitor: o livro aberto usa só as barras do próprio leitor. */
(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const api = () => window.__lvLib, ac = () => window.__acervo;
  const view = () => document.body.dataset.view || 'library';

  const go = {
    shelf() { if (view() === 'acervo') ac().close(); $('#library').scrollTo({ top: 0, behavior: 'smooth' }); },
    acervo() { if (view() === 'acervo') $('#acervo').scrollTo({ top: 0, behavior: 'smooth' }); else ac().open(); },
    vocab() { api().openVocab(); },
    settings() { api().openSettings(); },
  };
  function $(s) { return document.querySelector(s); }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-nav]'); if (!b) return;
    e.preventDefault(); const f = go[b.dataset.nav]; if (f) f();
  });

  /* marca o destino atual (aria-current) conforme a tela visível */
  function sync() {
    const v = view();
    $$('[data-nav]').forEach(b => {
      const on = (b.dataset.nav === 'shelf' && v === 'library') || (b.dataset.nav === 'acervo' && v === 'acervo');
      if (b.classList.contains('brand')) return;
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-view'] });
  sync();
})();
