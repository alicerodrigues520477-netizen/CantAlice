/* Acervo: lista, busca e filtros dos 1000 livros do catálogo (cópia estática em acervo.json,
   a mesma de supabase/catalog/livros.json). Só mostra a ficha do livro; o texto para ler vem
   pela estante (livros grátis) ou por "Adicionar livro". */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const PAGE = 40;

  const view = $('#acervo'), lib = $('#library');
  let books = null, loading = null, shown = PAGE, matches = [];
  const f = { q: '', lang: '', genre: '', level: '', text: false };

  function load() {
    if (books) return Promise.resolve(books);
    if (loading) return loading;
    loading = fetch('acervo.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(data => {
      books = data.map(b => Object.assign(b, { _s: norm([b.titulo, b.autor, b.genero, b.resumo, (b.tags || []).join(' ')].join(' ')) }));
      const genres = [...new Set(books.map(b => b.genero))].sort((a, b) => a.localeCompare(b, 'pt'));
      for (const g of genres) $('#ac-genre').append(new Option(`${g} (${books.filter(b => b.genero === g).length})`, g));
      $('#btn-acervo').textContent = `📖 Acervo · ${books.length} livros`;
      return books;
    }).catch(err => { loading = null; throw err; });
    return loading;
  }

  function apply() {
    const words = norm(f.q).split(/\s+/).filter(Boolean);
    matches = books.filter(b =>
      (!f.lang || b.idioma === f.lang) && (!f.genre || b.genero === f.genre) &&
      (!f.level || b.nivel_dificuldade === f.level) && (!f.text || b.texto) && words.every(w => b._s.includes(w)));
    shown = PAGE; render();
  }

  /* botão principal do cartão: livros com texto no app entram na estante sem sair daqui */
  function actions(b) {
    const row = el('div', 'ac-actions');
    const api = window.__lvLib;
    if (b.texto && api) {
      const id = 'txt-' + b.texto, btn = el('button', 'btn primary ac-add'); btn.type = 'button';
      const paint = () => { const on = api.has(id); btn.textContent = on ? '✓ Na estante · Abrir' : '＋ Adicionar à estante'; btn.classList.toggle('is-in', on); btn.disabled = false; };
      paint();
      btn.addEventListener('click', async () => {
        if (api.has(id)) { close(); api.open(id); return; }          // já está: abre no leitor do app
        btn.disabled = true; btn.textContent = 'Adicionando…';        // retorno visual imediato
        try { await api.addBundled(b.texto); paint(); btn.classList.add('just-added'); }
        catch (err) { console.error(err); btn.textContent = 'Não deu · tentar de novo'; btn.disabled = false; }
      });
      row.append(btn, el('span', 'ac-hint', 'Texto de domínio público dentro do app'));
    } else {
      row.append(el('span', 'ac-hint', 'Texto não incluído no app'));
      const a = el('a', 'ac-link', 'Procurar fora do app ↗');
      a.href = 'https://www.gutenberg.org/ebooks/search/?query=' + encodeURIComponent(b.titulo + ' ' + b.autor);
      a.target = '_blank'; a.rel = 'noopener'; row.append(a);
    }
    return row;
  }

  function card(b) {
    const c = el('article', 'ac-card');
    c.append(el('h3', null, b.titulo), el('p', 'ac-author', b.autor));
    const badges = el('div', 'ac-badges');
    badges.append(el('span', 'tchip', b.idioma === 'pt' ? 'Português' : 'Inglês'));
    if (b.nivel_dificuldade) badges.append(el('span', 'tchip lvl', b.nivel_dificuldade));
    badges.append(el('span', 'tchip alt', b.genero));
    if (b.texto) badges.append(el('span', 'tchip txt', '📖 com texto'));
    c.append(badges, el('p', 'ac-sum', b.resumo));
    if (b.tags && b.tags.length) c.append(el('p', 'ac-tags', b.tags.map(t => '#' + t.replace(/\s+/g, '-')).join('  ')));
    c.append(actions(b));
    return c;
  }

  /* destaca o que está filtrando; o nível só existe para livros em inglês */
  function syncUi(n) {
    const noLevel = f.lang === 'pt';
    $('#ac-level').disabled = noLevel;
    $('#ac-level').title = noLevel ? 'O nível vale só para livros em inglês' : '';
    $('#ac-level').classList.toggle('set', !!f.level);
    $('#ac-genre').classList.toggle('set', !!f.genre);
    $('#ac-clear').classList.toggle('set', n > 0);
    $('#ac-text').classList.toggle('on', f.text); $('#ac-text').setAttribute('aria-pressed', f.text);
  }

  function render() {
    const list = $('#ac-list'); list.replaceChildren();
    for (const b of matches.slice(0, shown)) list.append(card(b));
    const active = [f.q && `“${f.q.trim()}”`, f.lang && (f.lang === 'pt' ? 'Português' : 'Inglês'), f.genre, f.level, f.text && 'com texto no app'].filter(Boolean);
    const total = books.length;
    $('#ac-count').textContent = matches.length
      ? `${matches.length}${active.length ? ` de ${total} livros` : (matches.length === 1 ? ' livro' : ' livros')}${matches.length > shown ? ` · mostrando ${shown}` : ''}${active.length ? ` · filtrando por ${active.join(' + ')}` : ''}`
      : 'Nenhum livro encontrado. Tente outra palavra ou toque em Limpar.';
    syncUi(active.length);
    $('#ac-more').hidden = matches.length <= shown;
  }

  function open() {
    lib.hidden = true; view.hidden = false; view.scrollTop = 0;
    $('#ac-count').textContent = 'Carregando o acervo…';
    load().then(apply).catch(() => {
      $('#ac-count').textContent = 'Não consegui carregar o acervo agora. Verifique a conexão e toque aqui para tentar de novo.';
      $('#ac-count').onclick = () => { $('#ac-count').onclick = null; open(); };
    });
  }
  function close() { view.hidden = true; lib.hidden = false; }

  $('#btn-acervo').addEventListener('click', open);
  $('#ac-back').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !view.hidden && document.activeElement.id !== 'ac-q') close(); });

  let t;
  $('#ac-q').addEventListener('input', e => { f.q = e.target.value; clearTimeout(t); t = setTimeout(() => books && apply(), 150); });
  $('#ac-genre').addEventListener('change', e => { f.genre = e.target.value; books && apply(); });
  $('#ac-level').addEventListener('change', e => { f.level = e.target.value; books && apply(); });
  $$('#ac-lang button').forEach(b => b.addEventListener('click', () => {
    f.lang = b.dataset.v;
    if (f.lang === 'pt') { f.level = ''; $('#ac-level').value = ''; }   // livros em português não têm nível
    $$('#ac-lang button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); });
    books && apply();
  }));
  $('#ac-text').addEventListener('click', () => { f.text = !f.text; books && apply(); });
  $('#ac-more').addEventListener('click', () => { shown += PAGE; render(); });
  $('#ac-clear').addEventListener('click', () => {
    Object.assign(f, { q: '', lang: '', genre: '', level: '', text: false });
    $('#ac-q').value = ''; $('#ac-genre').value = ''; $('#ac-level').value = '';
    $$('#ac-lang button').forEach(x => { const on = x.dataset.v === ''; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    books && apply();
  });
})();
