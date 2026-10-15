/* Leitura bilíngue / paralela: inglês e português lado a lado (iPad paisagem e desktop) ou alternando com um toque (retrato e celular).
   Cada parágrafo em inglês é uma linha de grade com a sua tradução ao lado, então as duas colunas rolam juntas e ficam sempre alinhadas.
   As traduções ficam em livros/<livro>.pt.json: { paras: { chave-do-parágrafo: "tradução" }, titles: {...}, credit }.
   A chave vem do início e do fim do parágrafo em inglês (ver keyOf), por isso não depende de numeração de capítulos. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const R = () => window.__lvRd;
  const view = $('#bil'), scroller = $('#bil-scroll'), rowsEl = $('#bil-rows'), flipBtn = $('#bil-flip'), noteEl = $('#bil-note'), chSel = $('#bil-ch');
  if (!view) return;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } },
  };

  /* ----- chaves e arquivo de tradução ----- */
  const norm = t => t.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '');
  const keyOf = t => { const n = norm(t); return n.slice(0, 40) + '~' + n.slice(-24); };
  const SAMPLE_SLUG = { 'sample-alice': 'lewis-carroll_alices-adventures-in-wonderland' };
  const slugOf = id => SAMPLE_SLUG[id] || (/^txt-/.test(id) ? id.slice(4) : null);
  const memo = new Map();
  async function loadTranslation(id) {
    const slug = slugOf(id);
    if (!slug) return null;                                      // livro importado pelo usuário: não há tradução cadastrada
    if (memo.has(slug)) return memo.get(slug);
    const url = 'livros/' + encodeURIComponent(slug) + '.pt.json';
    let data = null, cache = null;
    try { cache = await caches.open('lv-trad-v1'); } catch { /* sem Cache API */ }
    try {
      const r = await fetch(url);
      if (r.ok) { data = await r.json(); if (cache) cache.put(url, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } })).catch(() => {}); }
    } catch { /* offline: tenta o que já foi baixado antes */ }
    if (!data && cache) { try { const m = await cache.match(url); if (m) data = await m.json(); } catch { /* ignora */ } }
    memo.set(slug, data);
    return data;
  }

  /* ----- capítulo → linhas (parágrafo em inglês + tradução) ----- */
  const plain = n => n.textContent.replace(/\s+/g, ' ').trim();
  const titleTail = t => norm(t.split(/\s*[:—–-]\s*/).slice(1).join(' ') || t);
  function chapterRows(c) {
    const tmp = el('div'); tmp.innerHTML = c.html;
    const titleKey = norm(c.title.replace(/^chapter\s+/i, '')), rows = [];
    const push = (n, quote) => { const text = plain(n); if (text) rows.push({ node: n, text, quote }); };
    for (const n of tmp.children) {
      if (n.tagName === 'H2') continue;
      if (!rows.length && n.tagName === 'P' && norm(plain(n)) === titleKey) continue;   // "I Down the Rabbit-Hole" repetido sob o título
      if (n.tagName === 'BLOCKQUOTE') { const ps = n.querySelectorAll('p'); if (ps.length) { ps.forEach(p => push(p, true)); continue; } }
      push(n, false);
    }
    return rows;
  }

  /* ----- estado ----- */
  let book = null, tr = null, ci = 0, rows = [], mode = 'narrow', lang = store.get('lv:bil-lang', 'en'), opened = false, forceTwo = store.get('lv:bil-two', false);
  const mq = window.matchMedia('(min-width: 720px) and (orientation: landscape), (min-width: 1000px)');
  const trCount = () => rows.filter(r => r.pt).length;
  const saveKey = () => 'lv:bil:' + (book && book.id);

  function setMode() {
    // paisagem/telas grandes: duas colunas; em retrato (iPad) o botão da barra permite forçar duas colunas
    const canForce = !mq.matches && innerWidth >= 700;
    mode = (mq.matches || (forceTwo && canForce)) ? 'wide' : 'narrow';
    view.dataset.mode = mode;
    const lb = $('#bil-layout'); lb.hidden = !canForce; lb.classList.toggle('on', mode === 'wide'); lb.setAttribute('aria-pressed', String(mode === 'wide'));
    flipBtn.hidden = mode === 'wide' || !tr;
    syncFlip();
  }
  function syncFlip() {
    view.dataset.lang = lang;
    flipBtn.textContent = lang === 'en' ? 'Ver tradução' : 'Ver inglês';
    flipBtn.setAttribute('aria-label', lang === 'en' ? 'Ver a tradução em português' : 'Voltar ao texto em inglês');
  }

  /** Primeira linha visível, para manter o lugar ao trocar de idioma ou girar o aparelho. */
  function anchorRow() {
    const top = scroller.getBoundingClientRect().top + 8;
    const all = rowsEl.children;
    for (let i = 0; i < all.length; i++) { if (all[i].getBoundingClientRect().bottom > top) return { i, off: top - all[i].getBoundingClientRect().top }; }
    return { i: 0, off: 0 };
  }
  function restoreRow(a) {
    const r = rowsEl.children[a.i]; if (!r) return;
    scroller.scrollTop += r.getBoundingClientRect().top - (scroller.getBoundingClientRect().top + 8) + a.off;
  }
  function flip(to) {
    const a = anchorRow(); lang = to || (lang === 'en' ? 'pt' : 'en'); store.set('lv:bil-lang', lang); syncFlip(); restoreRow(a);
  }

  function renderChapter(c, startFrac = 0) {
    ci = clamp(c, 0, book.chapters.length - 1);
    const ch = book.chapters[ci];
    rows = chapterRows(ch).map(r => ({ ...r, pt: tr && tr.paras[keyOf(r.text)] || '' }));
    const ptTitle = tr && tr.titles && tr.titles[titleTail(ch.title)];
    const h = $('#bil-h'), hEn = el('span', 'bil-en', ch.title), pre = ch.title.split(/\s*[:—–-]\s*/)[0].replace(/^chapter/i, 'Capítulo');
    const hPt = el('span', 'bil-pt', ptTitle ? pre + ': ' + ptTitle : '');
    hEn.lang = 'en'; hPt.lang = 'pt-BR'; h.replaceChildren(hEn, hPt);
    chSel.value = String(ci);
    $('#bil-prev').disabled = ci === 0; $('#bil-next').disabled = $('#bil-end-next').hidden = ci === book.chapters.length - 1;
    rowsEl.replaceChildren();
    const na = tr ? el('span', 'na', 'tradução ainda não disponível') : null;
    for (const r of rows) {
      const row = el('div', 'bil-row'), en = el('div', 'bil-en'), pt = el('div', 'bil-pt');
      en.lang = 'en'; pt.lang = 'pt-BR';
      en.innerHTML = r.node.innerHTML;
      if (r.node.className) en.className += ' ' + r.node.className;
      if (r.node.tagName === 'H3') row.classList.add('bil-h3'); else if (r.quote) row.classList.add('bil-blockquote');
      if (r.pt) r.pt.split('\n').forEach((line, i) => { if (i) pt.append(document.createElement('br')); pt.append(document.createTextNode(line)); });
      else { pt.classList.add('missing'); if (na && trCount() === 0) pt.append(na.cloneNode(true)); }
      row.append(en, pt); rowsEl.append(row);
    }
    // aviso elegante quando não há tradução
    noteEl.hidden = true; noteEl.replaceChildren();
    if (!tr) {
      noteEl.append(el('strong', null, 'Tradução não disponível para este título'), el('span', null, 'Por enquanto só o texto em inglês. Os livros com tradução mostram o português ao lado, parágrafo por parágrafo.'));
      noteEl.hidden = false;
    } else if (trCount() === 0) {
      noteEl.append(el('strong', null, 'Tradução ainda não disponível para este capítulo'), el('span', null, 'Este livro já tem capítulos traduzidos: escolha outro no seletor acima.'));
      noteEl.hidden = false;
    }
    $('#bil-credit').textContent = tr && trCount() ? 'English | Português' : 'Leitura bilíngue';
    view.classList.toggle('no-tr', !tr || trCount() === 0);
    flipBtn.hidden = mode === 'wide' || !tr || trCount() === 0;
    scroller.scrollTop = 0;
    requestAnimationFrame(() => { scroller.scrollTop = Math.round(startFrac * Math.max(0, scroller.scrollHeight - scroller.clientHeight)); });
    persist();
  }
  const fractionNow = () => { const m = Math.max(1, scroller.scrollHeight - scroller.clientHeight); return clamp(scroller.scrollTop / m, 0, 1); };
  const persist = () => { if (book) store.set(saveKey(), { c: ci, f: fractionNow() }); };

  /* ----- abrir / fechar ----- */
  async function open() {
    const rd = R(), b = rd && rd.book(); if (!b) return;
    rd.stop(); book = b;
    $('#bil-title').textContent = b.title;
    chSel.replaceChildren(...b.chapters.map((c, i) => { const o = el('option', null, c.title); o.value = String(i); return o; }));
    tr = await loadTranslation(b.id);
    const p = rd.pos();
    rd.showView('bil'); rd.showUI(false); opened = true; setMode(); view.classList.toggle('no-tr', !tr);
    renderChapter(p.c, rd.fraction());
    $('#bil-credit').title = tr && tr.credit ? tr.credit : '';
    scroller.focus({ preventScroll: true });
  }
  function close() {
    if (!opened) return;
    const rd = R(); persist(); opened = false;
    const c = ci, f = fractionNow();
    rd.showView('reader'); rd.go(c, f); rd.showUI(true);
  }

  /* ----- eventos ----- */
  $('#btn-bil').addEventListener('click', open);
  $('#bil-back').addEventListener('click', close);
  flipBtn.addEventListener('click', () => flip());
  $('#bil-layout').addEventListener('click', () => { const a = anchorRow(); forceTwo = !forceTwo; store.set('lv:bil-two', forceTwo); setMode(); requestAnimationFrame(() => restoreRow(a)); });
  chSel.addEventListener('change', () => renderChapter(+chSel.value, 0));
  $('#bil-prev').addEventListener('click', () => renderChapter(ci - 1, 0));
  $('#bil-next').addEventListener('click', () => renderChapter(ci + 1, 0));
  $('#bil-end-next').addEventListener('click', () => renderChapter(ci + 1, 0));
  $('#bil-minus').addEventListener('click', () => { const a = anchorRow(); R().setSize(R().S.size - 1); restoreRow(a); });
  $('#bil-plus').addEventListener('click', () => { const a = anchorRow(); R().setSize(R().S.size + 1); restoreRow(a); });
  let st; scroller.addEventListener('scroll', () => { clearTimeout(st); st = setTimeout(persist, 400); }, { passive: true });
  rowsEl.addEventListener('click', e => {                       // toque numa linha destaca o parágrafo nos dois idiomas
    const row = e.target.closest('.bil-row'); if (!row || window.getSelection().toString()) return;
    const on = row.classList.contains('sel');
    rowsEl.querySelectorAll('.bil-row.sel').forEach(r => r.classList.remove('sel'));
    if (!on) row.classList.add('sel');
  });
  document.addEventListener('keydown', e => {
    if (!opened || view.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 't' || e.key === 'T') { if (mode === 'narrow' && !flipBtn.hidden) { e.preventDefault(); flip(); } }
    else if (e.key === ']' || e.key === 'n') { if (ci + 1 < book.chapters.length) { e.preventDefault(); renderChapter(ci + 1, 0); } }
    else if (e.key === '[' || e.key === 'p') { if (ci > 0) { e.preventDefault(); renderChapter(ci - 1, 0); } }
  });
  const onMq = () => { if (!opened) { setMode(); return; } const a = anchorRow(); setMode(); requestAnimationFrame(() => restoreRow(a)); };
  (mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq));
  addEventListener('resize', () => { if (opened) { clearTimeout(st); st = setTimeout(onMq, 120); } });
  setMode();
  window.__bil = { open, close, keyOf, loadTranslation };
})();
