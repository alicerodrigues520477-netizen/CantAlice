/* Alice's Library — leitor de livros em inglês com virada de página, leitura em voz alta e player de audiolivro.
   Tudo roda no próprio aparelho (sem servidor, sem conta, sem anúncios). */
(() => {
'use strict';

/* ================= utilidades ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem espaço / modo privado */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const fmtTime = s => { if (!isFinite(s)) return '0:00'; s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(ss).padStart(2, '0'); };

let toastTimer;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

/* ================= ajustes ================= */
const S = Object.assign({ theme: 'paper', size: 21, font: 'serif', sound: true, rate: 1, voice: '', dict: true, dictOnline: true }, store.get('lv:settings', {}));
const saveSettings = () => store.set('lv:settings', S);

/* ================= IndexedDB ================= */
const DB = (() => {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open('livro-em-voz', 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const name of ['books', 'audio', 'covers']) if (!d.objectStoreNames.contains(name)) d.createObjectStore(name, { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (store, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const rq = fn(t.objectStore(store));
      t.oncomplete = () => res(rq && rq.result);
      t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  };
  return {
    get: (s, k) => run(s, 'readonly', o => o.get(k)),
    put: (s, v) => run(s, 'readwrite', o => o.put(v)),
    del: (s, k) => run(s, 'readwrite', o => o.delete(k)),
  };
})();

/* ================= biblioteca (metadados leves em localStorage) ================= */
let lib = store.get('lv:lib', []);
const saveLib = () => store.set('lv:lib', lib);

const SAMPLE = {
  id: 'sample-alice',
  title: 'Alice’s Adventures in Wonderland',
  author: 'Lewis Carroll (trecho)',
  chapters: [
    { title: 'Chapter I — Down the Rabbit-Hole', paras: [
      'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”',
      'So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.',
      'There was nothing so very remarkable in that; nor did Alice think it so very much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually took a watch out of its waistcoat-pocket, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.',
      'In another moment down went Alice after it, never once considering how in the world she was to get out again.',
      'The rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.',
      'Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs. She took down a jar from one of the shelves as she passed; it was labelled “ORANGE MARMALADE”, but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody underneath, so managed to put it into one of the cupboards as she fell past it.',
      'Down, down, down. There was nothing else to do, so Alice soon began talking again. “Dinah’ll miss me very much to-night, I should think!” (Dinah was the cat.) “I hope they’ll remember her saucer of milk at tea-time. Dinah my dear! I wish you were down here with me! There are no mice in the air, I’m afraid, but you might catch a bat, and that’s very like a mouse, you know. But do cats eat bats, I wonder?” And here Alice began to get rather sleepy, and went on saying to herself, in a dreamy sort of way, “Do cats eat bats? Do cats eat bats?” and sometimes, “Do bats eat cats?” for, as she couldn’t answer either question, it didn’t much matter which way she put it. She felt that she was dozing off, and had just begun to dream that she was walking hand in hand with Dinah, and saying to her very earnestly, “Now, Dinah, tell me the truth: did you ever eat a bat?” when suddenly, thump! thump! down she came upon a heap of sticks and dry leaves, and the fall was over.',
    ] },
    { title: 'Chapter II — The Pool of Tears', paras: [
      '“Curiouser and curiouser!” cried Alice (she was so much surprised, that for the moment she quite forgot how to speak good English); “now I’m opening out like the largest telescope that ever was! Good-bye, feet!” (for when she looked down at her feet, they seemed to be almost out of sight, they were getting so far off). “Oh, my poor little feet, I wonder who will put on your shoes and stockings for you now, dears? I’m sure I shan’t be able! I shall be a great deal too far off to trouble myself about you: you must manage the best way you can—but I must be kind to them,” thought Alice, “or perhaps they won’t walk the way I want to go! Let me see: I’ll give them a new pair of boots every Christmas.”',
    ] },
  ],
};

/* ================= importação: EPUB e TXT ================= */
const SKIP_TAGS = new Set(['script', 'style', 'head', 'svg', 'img', 'image', 'audio', 'video', 'iframe', 'object', 'canvas', 'noscript', 'math', 'table']);
const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const BLOCKS = new Set(['p', 'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'figure', 'figcaption', 'hr', 'body', 'address', 'center', 'tr', 'td', 'th', 'caption', 'fieldset', 'form']);

/** Converte HTML arbitrário de EPUB num HTML limpo e seguro (h1-h6, p, blockquote, hr, em, strong, br). */
function sanitize(root) {
  const out = el('div');
  const inlineInto = (target, node) => {
    for (const c of node.childNodes) {
      if (c.nodeType === 3) { target.append(c.nodeValue.replace(/\s+/g, ' ')); continue; }
      if (c.nodeType !== 1) continue;
      const tag = c.localName.toLowerCase();
      if (SKIP_TAGS.has(tag)) continue;
      if (tag === 'br') { target.append(el('br')); continue; }
      if (tag === 'em' || tag === 'i' || tag === 'cite') { const e = el('em'); inlineInto(e, c); target.append(e); continue; }
      if (tag === 'strong' || tag === 'b') { const e = el('strong'); inlineInto(e, c); target.append(e); continue; }
      inlineInto(target, c); // a, span, sup, small… viram texto simples
    }
  };
  const hasText = n => n.textContent.replace(/\s+/g, '').length > 0;
  const trimEdges = n => {
    const f = n.firstChild; if (f && f.nodeType === 3) f.nodeValue = f.nodeValue.replace(/^\s+/, '');
    const l = n.lastChild; if (l && l.nodeType === 3) l.nodeValue = l.nodeValue.replace(/\s+$/, '');
  };
  const walk = (node, into) => {
    let cur = null;
    for (const c of node.childNodes) {
      if (c.nodeType === 3) {
        const t = c.nodeValue.replace(/\s+/g, ' ');
        if (!cur && !t.trim()) continue;
        if (!cur) { cur = el('p'); into.append(cur); }
        cur.append(t); continue;
      }
      if (c.nodeType !== 1) continue;
      const tag = c.localName.toLowerCase();
      if (SKIP_TAGS.has(tag)) continue;
      if (tag === 'br') { if (cur) cur.append(el('br')); continue; }
      if (!BLOCKS.has(tag) && !HEADINGS.has(tag)) {
        if (!cur) { cur = el('p'); into.append(cur); }
        inlineInto(cur, { childNodes: [c] }); continue;
      }
      cur = null;
      if (HEADINGS.has(tag)) { const h = el(tag); inlineInto(h, c); trimEdges(h); if (hasText(h)) into.append(h); }
      else if (tag === 'p' || tag === 'li' || tag === 'dt' || tag === 'dd' || tag === 'pre' || tag === 'figcaption') { const p = el('p'); inlineInto(p, c); trimEdges(p); if (hasText(p)) into.append(p); }
      else if (tag === 'hr') into.append(el('hr'));
      else if (tag === 'blockquote') { const q = el('blockquote'); walk(c, q); if (hasText(q)) into.append(q); }
      else walk(c, into);
    }
    // tira espaços nas pontas dos parágrafos criados por texto solto
    for (const p of $$(':scope > p', into)) { trimEdges(p); if (!hasText(p)) p.remove(); }
  };
  walk(root, out);
  return out;
}

function chapterRecord(title, outDiv) {
  const text = outDiv.textContent.replace(/\s+/g, ' ').trim();
  return { title, html: outDiv.innerHTML, chars: text.length };
}

const dirOf = p => p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '';
function resolvePath(dir, href) {
  const parts = (dir + decodeURIComponent(href)).split('/'); const out = [];
  for (const s of parts) { if (s === '..') out.pop(); else if (s && s !== '.') out.push(s); }
  return out.join('/');
}

async function parseEpub(buf, fname) {
  const zip = await JSZip.loadAsync(buf);
  const read = async p => { const f = zip.file(p) || zip.file(decodeURIComponent(p)); return f ? f.async('string') : null; };
  const xml = (s, type = 'application/xml') => new DOMParser().parseFromString(s, type);
  const xhtml = s => { const d = xml(s, 'application/xhtml+xml'); return d.getElementsByTagName('parsererror').length ? xml(s, 'text/html') : d; };

  const containerXml = await read('META-INF/container.xml');
  if (!containerXml) throw new Error('Este arquivo não parece ser um EPUB válido.');
  const rootPath = xml(containerXml).getElementsByTagName('rootfile')[0].getAttribute('full-path');
  const opf = xml(await read(rootPath));
  const base = dirOf(rootPath);
  const meta = tag => { const n = opf.getElementsByTagNameNS('*', tag)[0]; return n ? n.textContent.trim() : ''; };

  const manifest = {};
  for (const it of opf.getElementsByTagNameNS('*', 'item')) manifest[it.getAttribute('id')] = { href: it.getAttribute('href'), props: it.getAttribute('properties') || '' };
  const spine = [...opf.getElementsByTagNameNS('*', 'itemref')].filter(r => r.getAttribute('linear') !== 'no').map(r => r.getAttribute('idref')).filter(id => manifest[id]);

  // rótulos do sumário (EPUB3 nav ou EPUB2 ncx)
  const labels = {};
  try {
    const nav = Object.values(manifest).find(m => m.props.split(/\s+/).includes('nav'));
    if (nav) {
      const p = resolvePath(base, nav.href); const doc = xml(await read(p), 'text/html');
      const toc = doc.querySelector('nav[epub\\:type~="toc"]') || doc.querySelector('nav');
      for (const a of toc ? toc.querySelectorAll('a[href]') : []) { const k = resolvePath(dirOf(p), a.getAttribute('href').split('#')[0]); if (!labels[k]) labels[k] = a.textContent.replace(/\s+/g, ' ').trim(); }
    } else {
      const ncxItem = Object.values(manifest).find(m => /\.ncx$/i.test(m.href));
      if (ncxItem) {
        const p = resolvePath(base, ncxItem.href); const doc = xml(await read(p));
        for (const np of doc.getElementsByTagName('navPoint')) {
          const t = np.getElementsByTagName('text')[0], c = np.getElementsByTagName('content')[0];
          if (t && c) { const k = resolvePath(dirOf(p), c.getAttribute('src').split('#')[0]); if (!labels[k]) labels[k] = t.textContent.replace(/\s+/g, ' ').trim(); }
        }
      }
    }
  } catch { /* sumário é opcional */ }

  // capa (EPUB3 "cover-image" ou EPUB2 <meta name="cover">)
  let cover = null;
  try {
    let item = Object.values(manifest).find(m => m.props.split(/\s+/).includes('cover-image'));
    if (!item) {
      const mc = [...opf.getElementsByTagNameNS('*', 'meta')].find(m => m.getAttribute('name') === 'cover');
      item = mc && manifest[mc.getAttribute('content')];
    }
    const f = item && zip.file(resolvePath(base, item.href));
    if (f) cover = await shrinkCover(new Blob([await f.async('arraybuffer')]));
  } catch { /* sem capa: usa a capa desenhada */ }

  const chapters = [];
  let n = 0;
  for (const id of spine) {
    const path = resolvePath(base, manifest[id].href);
    const raw = await read(path); if (!raw) continue;
    const doc = xhtml(raw);
    const body = doc.getElementsByTagName('body')[0]; if (!body) continue;
    const clean = sanitize(body);
    const ch = chapterRecord('', clean);
    if (ch.chars < 40) continue;
    n++;
    const h = clean.querySelector('h1,h2,h3');
    ch.title = labels[path] || (h && h.textContent.replace(/\s+/g, ' ').trim()) || ('Seção ' + n);
    chapters.push(ch);
  }
  return { title: meta('title') || fname.replace(/\.epub$/i, ''), author: meta('creator'), chapters, cover };
}

/** Reduz a imagem da capa para ~260×390 (JPEG) para caber folgado no armazenamento. */
async function shrinkCover(blob) {
  const bmp = await createImageBitmap(blob);
  const W = 260, H = 390, scale = Math.max(W / bmp.width, H / bmp.height);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.drawImage(bmp, (W - bmp.width * scale) / 2, (H - bmp.height * scale) / 2, bmp.width * scale, bmp.height * scale);
  bmp.close && bmp.close();
  return c.toDataURL('image/jpeg', 0.78);
}

function parseTxt(text, fname) {
  text = text.replace(/\r\n?/g, '\n');
  const title = (text.match(/^Title:\s*(.+)$/m) || [])[1];
  const author = (text.match(/^Author:\s*(.+)$/m) || [])[1];
  const s = text.search(/\*\*\* ?START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (s >= 0) text = text.slice(text.indexOf('\n', s) + 1);
  const e = text.search(/\*\*\* ?END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (e >= 0) text = text.slice(0, e);

  const paras = text.split(/\n\s*\n/).map(p => p.split('\n').map(l => l.trim()).filter(Boolean).join(' ')).filter(Boolean);
  const isHead = p => p.length < 90 && /^(chapter|book|part|section|prologue|epilogue|preface|introduction)\b/i.test(p);
  const chapters = []; let cur = null;
  const flush = () => { if (cur && cur.paras.length) chapters.push(cur); };
  for (const p of paras) {
    if (isHead(p)) { flush(); cur = { title: p, paras: [] }; }
    else { if (!cur) cur = { title: 'Início', paras: [] }; cur.paras.push(p); }
  }
  flush();
  // sem marcações de capítulo: divide em blocos de ~8 mil caracteres
  if (chapters.length <= 1 && paras.length > 1) {
    chapters.length = 0; let acc = [], size = 0, k = 1;
    for (const p of paras) { acc.push(p); size += p.length; if (size > 8000) { chapters.push({ title: 'Parte ' + k++, paras: acc }); acc = []; size = 0; } }
    if (acc.length) chapters.push({ title: 'Parte ' + k, paras: acc });
  }
  return { title: (title || fname.replace(/\.txt$/i, '')).trim(), author: (author || '').trim(), chapters: chapters.map(c => paragraphsToChapter(c.title, c.paras)) };
}

function paragraphsToChapter(title, paras) {
  const d = el('div');
  d.append(el('h2', null, title));
  for (const p of paras) {
    if (p.startsWith('## ')) { d.append(el('h3', null, p.slice(3))); continue; }
    const para = el('p', /^(Day|Step) \d/.test(p) ? 'nodrop' : null, p);
    d.append(para);
  }
  return chapterRecord(title, d);
}

async function saveBook(book) {
  const cover = book.cover; delete book.cover;
  await DB.put('books', book);
  if (cover) { await DB.put('covers', { id: book.id, url: cover }); coverCache.set(book.id, cover); }
  const chars = book.chapters.reduce((a, c) => a + c.chars, 0);
  lib = lib.filter(b => b.id !== book.id);
  lib.unshift({ id: book.id, title: book.title, author: book.author, level: book.level || '', hue: book.hue, chapters: book.chapters.length, chars, added: Date.now() });
  saveLib();
}

async function importFile(file) {
  const name = file.name.toLowerCase();
  let book;
  if (name.endsWith('.epub') || file.type === 'application/epub+zip') book = await parseEpub(await file.arrayBuffer(), file.name);
  else book = parseTxt(await file.text(), file.name);
  if (!book.chapters.length) throw new Error('Não encontrei texto neste arquivo.');
  book.id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  await saveBook(book);
  return book;
}

async function ensureSample() {
  if (store.get('lv:sample-removed', false) || lib.some(b => b.id === SAMPLE.id)) return;
  const book = { id: SAMPLE.id, title: SAMPLE.title, author: SAMPLE.author, chapters: SAMPLE.chapters.map(c => paragraphsToChapter(c.title, c.paras)) };
  await saveBook(book);
}

/* ================= tela da biblioteca ================= */
const views = { library: $('#library'), reader: $('#reader') };
function showView(name) { for (const [k, v] of Object.entries(views)) v.hidden = k !== name; }

function hueOf(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; }

const coverCache = new Map();   // id -> dataURL da capa real (EPUB)

/** Monta a capa de um livro: capa desenhada (com moldura dourada) ou imagem real quando existir. */
function buildCover(b, tag = 'button') {
  const open = el(tag, 'cover'); if (tag === 'button') open.type = 'button';
  open.dataset.id = b.id;
  const h = b.hue != null ? b.hue : hueOf(b.title);
  open.style.background = `linear-gradient(160deg, hsl(${h} 42% 34%), hsl(${(h + 30) % 360} 48% 17%))`;
  const top = el('div'); top.append(el('div', 't', b.title), el('div', 'orn'));
  open.append(el('div', 'mono', (b.title.match(/[A-Za-zÀ-ÿ]/) || ['·'])[0].toUpperCase()), top, el('div', 'a', b.author || ''));
  if (b.level) { open.append(el('span', 'badge', b.level)); open.classList.add('lv'); }
  open.setAttribute('aria-label', b.title);
  if (coverCache.get(b.id)) applyCover(open, coverCache.get(b.id));
  return open;
}
function applyCover(node, url) {
  node.classList.add('img');
  node.style.backgroundImage = `url("${url}")`;
  node.style.backgroundSize = 'cover'; node.style.backgroundPosition = 'center';
}
/** Busca no IndexedDB as capas que ainda não estão na memória e aplica nas capas já desenhadas. */
async function hydrateCovers() {
  for (const node of $$('.cover[data-id]')) {
    const id = node.dataset.id;
    if (node.classList.contains('img') || id.startsWith('cat-')) continue;
    if (!coverCache.has(id)) {
      try { const rec = await DB.get('covers', id); coverCache.set(id, rec ? rec.url : null); } catch { coverCache.set(id, null); }
    }
    if (coverCache.get(id)) $$(`.cover[data-id="${id}"]`).forEach(n => applyCover(n, coverCache.get(id)));
  }
}

const COVER_W = 176, SHELF_GAP = 30, CASE_PAD = 34;

function renderShelf() {
  const shelf = $('#shelf'); shelf.replaceChildren();
  renderHero();
  if (!lib.length) { shelf.append(el('p', 'empty-note', 'A estante está vazia. Adicione um livro ou escolha um dos livros grátis logo abaixo.')); renderCatalog(); return; }
  const inner = Math.max(COVER_W, (shelf.clientWidth || innerWidth - 56) - 2 * CASE_PAD);
  const cols = Math.max(1, Math.floor((inner + SHELF_GAP) / (COVER_W + SHELF_GAP)));
  for (let i = 0; i < lib.length; i += cols) {
    const row = el('div', 'shelf-row');
    for (const b of lib.slice(i, i + cols)) row.append(shelfCard(b));
    shelf.append(row);
  }
  hydrateCovers();
  renderCatalog();
}

function shelfCard(b) {
  const card = el('div', 'card');
  const open = buildCover(b);
  open.addEventListener('click', () => openBook(b.id));
  const del = el('button', 'del', '✕'); del.type = 'button'; del.setAttribute('aria-label', 'Remover ' + b.title);
  del.addEventListener('click', async e => {
    e.stopPropagation();
    if (!confirm('Remover “' + b.title + '” da estante?')) return;
    await DB.del('books', b.id); await DB.del('audio', b.id).catch(() => {}); await DB.del('covers', b.id).catch(() => {}); coverCache.delete(b.id);
    lib = lib.filter(x => x.id !== b.id); saveLib();
    store.del('lv:pos:' + b.id); store.del('lv:pct:' + b.id); store.del('lv:apos:' + b.id); store.del('lv:ann:' + b.id);
    if (b.id === SAMPLE.id) store.set('lv:sample-removed', true);
    renderShelf();
  });
  const pct = Math.round((store.get('lv:pct:' + b.id, 0)) * 100);
  const prog = el('div', 'prog'); const bar = el('i'); bar.style.width = pct + '%'; prog.append(bar);
  const meta = el('div', 'meta'); meta.append(el('span', null, pct ? pct + '% lido' : 'Novo'), el('span', null, b.chapters + ' cap.'));
  card.append(open, del, el('div', 'info'));
  $('.info', card).append(prog, meta);
  return card;
}

/** "Continuar lendo": o último livro aberto. */
function renderHero() {
  const hero = $('#hero'); hero.replaceChildren();
  const last = lib.find(b => b.id === store.get('lv:last', ''));
  hero.hidden = !last;
  if (!last) return;
  const pct = Math.round(store.get('lv:pct:' + last.id, 0) * 100);
  const cover = buildCover(last); cover.addEventListener('click', () => openBook(last.id));
  const txt = el('div', 'hero-txt');
  txt.append(el('span', 'kicker', 'Continuar lendo'), el('h2', null, last.title), el('p', 'by', last.author || ''));
  const prog = el('div', 'prog'); const bar = el('i'); bar.style.width = pct + '%'; prog.append(bar);
  const go = el('button', 'btn primary', pct > 0 ? 'Continuar de onde parei' : 'Começar a ler'); go.type = 'button';
  go.addEventListener('click', () => openBook(last.id));
  txt.append(prog, el('p', 'pct', pct ? pct + '% lido' : 'Ainda não começou'), go);
  hero.append(cover, txt);
}

/* ================= catálogo de livros grátis ================= */
let catalog = null;
async function loadCatalog() {
  if (catalog) return catalog;
  try { const r = await fetch('catalogo.json'); catalog = (await r.json()).books || []; } catch { catalog = []; }
  return catalog;
}
let catFilter = 'Todos';
async function renderCatalog() {
  const list = $('#catalog-list'), bar = $('#cat-filter');
  const books = await loadCatalog();
  list.replaceChildren(); bar.replaceChildren();
  if (!books.length) { list.append(el('p', 'muted', 'Não consegui carregar o catálogo agora. Conecte-se à internet e tente de novo.')); return; }
  const topics = ['Todos', ...new Set(books.flatMap(b => b.topics))];
  if (!topics.includes(catFilter)) catFilter = 'Todos';
  for (const t of topics) {
    const n = t === 'Todos' ? books.length : books.filter(b => b.topics.includes(t)).length;
    const b = el('button', 'fchip' + (t === catFilter ? ' on' : ''), `${t} · ${n}`); b.type = 'button';
    b.setAttribute('aria-pressed', t === catFilter);
    b.addEventListener('click', () => { catFilter = t; renderCatalog(); });
    bar.append(b);
  }
  for (const cb of books.filter(b => catFilter === 'Todos' || b.topics.includes(catFilter))) {
    const have = lib.some(b => b.id === cb.id);
    const card = el('article', 'cat-card');
    const cover = buildCover(cb); cover.addEventListener('click', () => have ? openBook(cb.id) : addFromCatalog(cb));
    const txt = el('div', 'cat-txt');
    txt.append(el('h3', null, cb.title), el('p', 'sub', cb.subtitle || ''));
    const chips = el('div', 'chips');
    chips.append(el('span', 'tchip lvl', 'Nível ' + cb.level), ...cb.topics.map(t => el('span', 'tchip', t)));
    const words = cb.chapters.reduce((a, c) => a + c.paras.reduce((n, p) => n + p.split(/\s+/).length, 0), 0);
    txt.append(chips, el('p', 'blurb', cb.blurb), el('p', 'size', `${cb.chapters.length} capítulos · ~${Math.round(words / 50) * 50} palavras · grátis`));
    const btn = el('button', have ? 'btn' : 'btn primary', have ? 'Abrir na estante' : '＋ Adicionar à estante'); btn.type = 'button';
    btn.addEventListener('click', () => have ? openBook(cb.id) : addFromCatalog(cb));
    txt.append(btn);
    card.append(cover, txt);
    list.append(card);
  }
}
async function addFromCatalog(cb) {
  try {
    await saveBook({ id: cb.id, title: cb.title, author: cb.author, level: cb.level, hue: cb.hue,
      chapters: cb.chapters.map(c => paragraphsToChapter(c.title, c.paras)) });
    renderShelf(); toast('“' + cb.title + '” está na sua estante ✓');
  } catch (e) { console.error(e); toast('Não consegui adicionar este livro.'); }
}

/* ================= leitor: estado ================= */
let book = null;                         // {id,title,author,chapters:[{title,html,chars}]}
let pos = { c: 0, p: 0 };                // capítulo e primeira página visível
const g = { per: 1, pw: 600, ph: 800, padX: 48, padY: 56, tw: 504, th: 688, gap: 96 };
const layouts = new Map();               // capítulo -> {tpl,n,sents,sentPage,pageFirst}
const bookEl = $('#book'), stageEl = $('#stage');
const measureBox = el('div'); measureBox.style.cssText = 'position:fixed;left:-20000px;top:0;visibility:hidden;pointer-events:none;';
document.body.append(measureBox);

function computeGeometry() {
  const probe = getComputedStyle($('#safe-probe'));
  const sat = parseFloat(probe.paddingTop) || 0, sar = parseFloat(probe.paddingRight) || 0, sab = parseFloat(probe.paddingBottom) || 0, sal = parseFloat(probe.paddingLeft) || 0;
  const rs = document.documentElement.style;
  rs.setProperty('--sat', sat + 'px'); rs.setProperty('--sar', sar + 'px'); rs.setProperty('--sab', sab + 'px'); rs.setProperty('--sal', sal + 'px');
  const W = innerWidth, H = innerHeight;
  const availW = W - sal - sar - 28, availH = H - sat - sab - 40;
  g.per = (W >= 900 && W > H * 1.05) ? 2 : 1;
  const pw = g.per === 2 ? Math.min(availW / 2, availH * 0.82) : Math.min(availW, 700, availH * 0.86);
  g.pw = Math.floor(pw);
  g.ph = Math.floor(Math.min(availH, g.pw * 1.62));
  g.padX = clamp(Math.round(g.pw * 0.085), 26, 60);
  g.padY = clamp(Math.round(g.ph * 0.075), 38, 66);
  g.tw = g.pw - 2 * g.padX; g.th = g.ph - 2 * g.padY; g.gap = 2 * g.padX;
  rs.setProperty('--pw', g.pw + 'px'); rs.setProperty('--ph', g.ph + 'px'); rs.setProperty('--fs', S.size + 'px');
}

/* ----- frases: quebra o texto em sentenças e envolve cada uma num <span class="s" data-i> ----- */
const ABBR = /(?:\b(?:Mr|Mrs|Ms|Dr|St|Prof|Jr|Sr|vs|etc|No|Mt|Gen|Col|Capt|Lt|Sgt|Rev|Hon)|\b[A-Z])\.$/;
function splitSentences(full) {
  const cuts = [0];
  const re = /([.!?…]+["'”’)\]]*)(\s+)/g; let m;
  while ((m = re.exec(full))) {
    const end = m.index + m[0].length;
    const before = full.slice(0, m.index + m[1].length);
    const next = full.charAt(end);
    if (/^[a-z]/.test(next)) continue;               // “…!” she said  /  etc. and
    if (m[1] === '.' && ABBR.test(before)) continue; // Mr. Rabbit
    cuts.push(end);
  }
  cuts.push(full.length);
  const ranges = [];
  for (let i = 0; i < cuts.length - 1; i++) if (cuts[i + 1] > cuts[i]) ranges.push({ s: cuts[i], e: cuts[i + 1] });
  return ranges;
}

function wrapSentences(tpl) {
  const sents = [], firsts = [];
  for (const block of $$('p,h1,h2,h3,h4,h5,h6', tpl)) {
    const nodes = []; let full = '';
    const w = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) { nodes.push({ node: n, start: full.length }); full += n.nodeValue; }
    if (!full.trim()) continue;
    const ranges = splitSentences(full);
    const base = sents.length;
    for (const r of ranges) sents.push(full.slice(r.s, r.e).replace(/\s+/g, ' ').trim());
    for (const { node, start } of nodes) {
      const text = node.nodeValue, end = start + text.length, frag = document.createDocumentFragment();
      ranges.forEach((r, k) => {
        const a = Math.max(r.s, start), b = Math.min(r.e, end);
        if (a >= b) return;
        const span = el('span', 's', text.slice(a - start, b - start)); span.dataset.i = base + k;
        if (!firsts[base + k]) firsts[base + k] = span;
        frag.append(span);
      });
      node.replaceWith(frag);
    }
  }
  return { sents, firsts };
}

function getLayout(c) {
  let L = layouts.get(c);
  if (L) return L;
  const tpl = el('div', 'flow'); tpl.lang = 'en';
  tpl.innerHTML = book.chapters[c].html;
  const { sents, firsts } = wrapSentences(tpl);
  paintChapter(c, tpl);
  tpl.style.cssText = `width:${g.tw}px;height:${g.th}px;column-width:${g.tw}px;column-gap:${g.gap}px;position:static;`;
  measureBox.append(tpl);
  const n = Math.max(1, Math.round((tpl.scrollWidth + g.gap) / g.pw));
  const left0 = tpl.getBoundingClientRect().left;
  const sentPage = firsts.map(sp => { const r = sp.getClientRects()[0]; return r ? clamp(Math.floor((r.left - left0 + 2) / g.pw), 0, n - 1) : 0; });
  const pageFirst = []; let i = 0;
  for (let p = 0; p < n; p++) { while (i < sentPage.length && sentPage[i] < p) i++; pageFirst[p] = i; }
  tpl.style.position = 'absolute'; // as cópias usadas nas páginas são absolutas
  L = { tpl, n, sents, sentPage, pageFirst };
  layouts.set(c, L);
  // mantém poucos capítulos medidos na memória
  if (layouts.size > 5) for (const k of layouts.keys()) { if (Math.abs(k - c) > 2 && k !== pos.c) { layouts.get(k).tpl.remove(); layouts.delete(k); } }
  return L;
}
function clearLayouts() { layouts.clear(); measureBox.replaceChildren(); }

/* ----- páginas ----- */
function pageView(c, p, kind) {
  const L = getLayout(c);
  const page = el('div', 'page ' + kind); page.dataset.c = c;
  if (p < 0 || p >= L.n) { page.classList.add('blank'); return page; }
  const clip = el('div', 'clip');
  clip.style.cssText = `left:${g.padX}px;top:${g.padY}px;width:${g.tw}px;height:${g.th}px`;
  const flow = L.tpl.cloneNode(true);
  flow.style.position = 'absolute';
  flow.style.transform = `translateX(${-p * g.pw}px)`;
  clip.append(flow);
  page.append(clip, el('div', 'folio top', book.chapters[c].title), el('div', 'folio bot', String(p + 1)));
  if (hasBm(c, p, L)) page.append(el('div', 'ribbon'));
  return page;
}

const lastStart = n => Math.floor((n - 1) / g.per) * g.per;
function nextPos(P) {
  const L = getLayout(P.c);
  if (P.p + g.per < L.n) return { c: P.c, p: P.p + g.per };
  return P.c + 1 < book.chapters.length ? { c: P.c + 1, p: 0 } : null;
}
function prevPos(P) {
  if (P.p - g.per >= 0) return { c: P.c, p: P.p - g.per };
  return P.c > 0 ? { c: P.c - 1, p: lastStart(getLayout(P.c - 1).n) } : null;
}

function renderSpread() {
  bookEl.replaceChildren();
  bookEl.classList.toggle('single', g.per === 1);
  const { c, p } = pos;
  if (g.per === 2) bookEl.append(pageView(c, p, 'left'), pageView(c, p + 1, 'right'));
  else bookEl.append(pageView(c, p, 'solo'));
  if (hl) applyHL();
  applyFound();
  refreshChrome();
}

/* ----- virada de página ----- */
const DUR = 720;
let flip = null;

function swapSlot(sel, node) { const old = $(':scope > .page' + sel, bookEl); if (old) old.replaceWith(node); }

function startFlip(dir) {
  if (flip) return false;
  closeCard();
  const target = dir > 0 ? nextPos(pos) : prevPos(pos);
  if (!target) { toast(dir > 0 ? 'Fim do livro 📖' : 'Você está no início', 1400); return false; }
  const two = g.per === 2;
  const leaf = el('div', 'leaf'), front = el('div', 'face front'), back = el('div', 'face back');
  const shF = el('div', 'shade'), shB = el('div', 'shade');
  leaf.append(front, back);
  leaf.style.transformOrigin = 'left center';
  if (two) {
    if (dir > 0) {
      front.append(pageView(pos.c, pos.p + 1, 'right'), shF); back.append(pageView(target.c, target.p, 'left'), shB);
      leaf.style.left = g.pw + 'px';
      swapSlot('.right', pageView(target.c, target.p + 1, 'right'));
    } else {
      front.append(pageView(pos.c, pos.p, 'left'), shF); back.append(pageView(target.c, target.p + 1, 'right'), shB);
      leaf.style.left = '0px'; leaf.style.transformOrigin = 'right center';
      swapSlot('.left', pageView(target.c, target.p, 'left'));
    }
  } else if (dir > 0) {
    front.append(pageView(pos.c, pos.p, 'solo'), shF);
    swapSlot('.solo', pageView(target.c, target.p, 'solo'));
  } else {
    front.append(pageView(target.c, target.p, 'solo'), shF);
  }
  bookEl.append(leaf);
  flip = { dir, target, leaf, shF, shB, two, p: 0, done: false, byUser: true };
  setFlip(0, false);
  void leaf.offsetWidth; // força o layout antes de animar
  return true;
}

function setFlip(p, animate, dur = DUR) {
  const f = flip; if (!f) return;
  f.p = p;
  const ease = 'cubic-bezier(.42,.05,.22,1)';
  f.leaf.style.transition = animate ? `transform ${dur}ms ${ease}, opacity ${dur}ms ease` : 'none';
  const sh = animate ? `opacity ${dur}ms ease` : 'none';
  f.shF.style.transition = sh; f.shB.style.transition = sh;
  if (f.two) {
    f.leaf.style.transform = `rotateY(${(f.dir > 0 ? -1 : 1) * p * 180}deg)`;
    f.leaf.style.opacity = 1;
    f.shF.style.opacity = 0.42 * p; f.shB.style.opacity = 0.42 * (1 - p);
  } else {
    const q = f.dir > 0 ? p : 1 - p; // q = quanto a folha está "levantada"
    f.leaf.style.transform = `rotateY(${-q * 100}deg)`; // passa de 90° e some de lado, como uma página real
    f.leaf.style.opacity = 1;
    f.shF.style.opacity = 0.5 * q;
  }
}

function finishFlip() {
  const f = flip; if (!f || f.done) return;
  f.done = true; setFlip(1, true);
  setTimeout(() => {
    if (flip !== f) return;
    flip = null; pos = f.target; renderSpread(); afterTurn(f.byUser);
  }, DUR + 40);
}
function cancelFlip() {
  const f = flip; if (!f || f.done) return;
  f.done = true; setFlip(0, true, 380);
  setTimeout(() => { if (flip !== f) return; flip = null; renderSpread(); }, 420);
}
function turn(dir, byUser = true) {
  if (!startFlip(dir)) return false;
  flip.byUser = byUser;
  requestAnimationFrame(finishFlip);
  if (byUser && S.sound && !tts.on) pageSound();
  return true;
}
function jumpTo(target, byUser = true) {
  closeCard(); flip = null; pos = { c: target.c, p: target.p - target.p % g.per };
  renderSpread(); afterTurn(byUser);
}

function afterTurn(byUser) {
  if (tts.on) {
    if (byUser) { tts.c = pos.c; tts.idx = getLayout(pos.c).pageFirst[pos.p] || 0; speakCurrent(true); }
    else ensureVisible(tts.c, tts.idx);
  }
  saveProgress();
}

/* ----- progresso ----- */
function saveProgress() {
  if (!book) return;
  const L = getLayout(pos.c);
  const s = (tts.on && tts.c === pos.c) ? tts.idx : (L.pageFirst[pos.p] || 0);
  store.set('lv:pos:' + book.id, { c: pos.c, s });
  store.set('lv:pct:' + book.id, bookFraction());
}
function bookFraction() {
  const total = book.chapters.reduce((a, c) => a + c.chars, 0) || 1;
  let before = 0; for (let i = 0; i < pos.c; i++) before += book.chapters[i].chars;
  const L = getLayout(pos.c);
  return clamp((before + book.chapters[pos.c].chars * ((pos.p + g.per) / L.n)) / total, 0, 1);
}

function refreshChrome() {
  const L = getLayout(pos.c);
  $('#bk-title').textContent = book.title;
  $('#bk-chapter').textContent = book.chapters[pos.c].title;
  const slider = $('#slider');
  slider.max = Math.max(0, Math.ceil(L.n / g.per) - 1); slider.value = Math.floor(pos.p / g.per);
  $('#pos-label').textContent = `Página ${pos.p + 1}${g.per === 2 && pos.p + 1 < L.n ? '–' + (pos.p + 2) : ''} de ${L.n} · Cap. ${pos.c + 1}/${book.chapters.length} · ${Math.round(bookFraction() * 100)}%`;
  $$('#toc-list button').forEach((b, i) => b.classList.toggle('cur', i === pos.c));
  $('#btn-bm').classList.toggle('on', !!bmOnSpread().length);
}

/* ================= abrir livro ================= */
async function openBook(id) {
  let b;
  try { b = await DB.get('books', id); } catch { b = null; }
  if (!b) { toast('Não consegui abrir este livro.'); return; }
  ttsStop(); audioStop();
  book = b; clearLayouts(); resetAnnState(); loadAnn();
  showView('reader'); computeGeometry();
  const pr = store.get('lv:pos:' + id, { c: 0, s: 0 });
  const c = clamp(pr.c | 0, 0, b.chapters.length - 1), L = getLayout(c);
  const page = L.sentPage[pr.s] || 0;
  pos = { c, p: page - page % g.per };
  buildToc(); renderAnnLists(); showTab('toc'); renderSpread(); saveProgress();
  loadAudioFor(id);
  showUI(true);
  store.set('lv:last', id);
  history.replaceState(null, '', '#' + id);
  if (S.dict && !store.get('lv:tip-dict', false)) { store.set('lv:tip-dict', true); setTimeout(() => toast('Dica: toque numa palavra para ver o significado 📖', 5000), 900); }
}
function closeBook() {
  ttsStop(); audioStop(); saveProgress(); resetAnnState(); ann = [];
  book = null; clearLayouts(); flip = null; bookEl.replaceChildren();
  showView('library'); renderShelf(); history.replaceState(null, '', location.pathname);
}

function buildToc() {
  const ol = $('#toc-list'); ol.replaceChildren();
  book.chapters.forEach((ch, i) => {
    const li = el('li'), b = el('button', null, ch.title); b.type = 'button';
    b.addEventListener('click', () => { closeSheets(); jumpTo({ c: i, p: 0 }); });
    li.append(b); ol.append(li);
  });
}

/* ================= marcadores, destaques, anotações e busca ================= */
// Tudo é ancorado no número da frase dentro do capítulo; por isso continua no lugar
// quando você muda o tamanho da letra ou gira o iPad.
let ann = [];                         // itens do livro aberto: {id,k:'bm'|'hl',c,s,col,note,text,t}
const uid = () => Math.random().toString(36).slice(2, 9);
const loadAnn = () => { ann = store.get('lv:ann:' + book.id, []); };
const saveAnn = () => { store.set('lv:ann:' + book.id, ann); renderAnnLists(); };
const COLORS = { y: 'Amarelo', g: 'Verde', p: 'Rosa', b: 'Azul' };

/* frases de qualquer capítulo (sem medir páginas) */
const sentsCache = new Map();
function sentencesOf(c) {
  const L = layouts.get(c); if (L) return L.sents;
  if (!sentsCache.has(c)) { const tpl = el('div'); tpl.innerHTML = book.chapters[c].html; sentsCache.set(c, wrapSentences(tpl).sents); }
  return sentsCache.get(c);
}
const sentText = (c, i) => (sentencesOf(c)[i] || '').trim();

/* pintura das frases (no modelo do capítulo e nas páginas que já estão na tela) */
function markSentence(c, idx, cls, on) {
  const q = `[data-i="${idx}"]`, L = layouts.get(c);
  if (L) L.tpl.querySelectorAll(q).forEach(e => e.classList.toggle(cls, on));
  bookEl.querySelectorAll(`.page[data-c="${c}"] ${q}`).forEach(e => e.classList.toggle(cls, on));
}
function paintInto(root, a) {
  for (const e of root.querySelectorAll(`[data-i="${a.s}"]`)) {
    for (const k of Object.keys(COLORS)) e.classList.remove('a-' + k);
    e.classList.remove('has-note');
    if (a.k === 'hl') { e.classList.add('a-' + a.col); if (a.note) e.classList.add('has-note'); }
  }
}
function paintAnn(a) {
  const L = layouts.get(a.c); if (L) paintInto(L.tpl, a);
  bookEl.querySelectorAll(`.page[data-c="${a.c}"]`).forEach(pg => paintInto(pg, a));
}
function paintChapter(c, tpl) { for (const a of ann) if (a.k === 'hl' && a.c === c) paintInto(tpl, a); }

/* ----- marcador de página (fita dourada) ----- */
const hasBm = (c, p, L) => ann.some(a => a.k === 'bm' && a.c === c && (L.sentPage[a.s] || 0) === p);
const bmOnSpread = () => { const L = getLayout(pos.c); return ann.filter(a => a.k === 'bm' && a.c === pos.c && (L.sentPage[a.s] || 0) >= pos.p && (L.sentPage[a.s] || 0) < pos.p + g.per); };
function toggleBookmark() {
  if (!book || flip) return;
  const here = bmOnSpread();
  if (here.length) { ann = ann.filter(a => !here.includes(a)); toast('Marcador removido', 1400); }
  else {
    const L = getLayout(pos.c), s = L.pageFirst[pos.p] || 0;
    ann.push({ id: uid(), k: 'bm', c: pos.c, s, text: sentText(pos.c, s).slice(0, 160), t: Date.now() });
    toast('Página marcada 🔖', 1400);
  }
  saveAnn(); renderSpread();
}

/* ----- destaques ----- */
const findHl = (c, s) => ann.find(a => a.k === 'hl' && a.c === c && a.s === s);
function setHighlight(c, s, col) {
  let a = findHl(c, s);
  if (a && a.col === col && !a.note) { removeAnn(a); return; }   // mesma cor de novo = tirar
  if (!a) { a = { id: uid(), k: 'hl', c, s, col, note: '', text: sentText(c, s).slice(0, 400), t: Date.now() }; ann.push(a); }
  else a.col = col;
  saveAnn(); paintAnn(a);
}
function removeAnn(a) {
  ann = ann.filter(x => x !== a); saveAnn();
  if (a.k === 'hl') paintAnn({ c: a.c, s: a.s, k: 'none' }); else renderSpread();
}

/* ----- anotações (texto livre ligado a uma frase) ----- */
let noteTarget = null;
function openNote(c, s) {
  noteTarget = { c, s };
  const a = findHl(c, s);
  $('#note-quote').textContent = sentText(c, s);
  $('#note-text').value = a ? a.note : '';
  $('#note-del').hidden = !(a && a.note);
  $('#note-modal').hidden = false; showUI(false);
  setTimeout(() => $('#note-text').focus(), 60);
}
function closeNote() { $('#note-modal').hidden = true; noteTarget = null; if (book) showUI(true); }
$('#note-cancel').addEventListener('click', closeNote);
$('#note-modal').addEventListener('pointerdown', e => { if (e.target.id === 'note-modal') closeNote(); });
$('#note-save').addEventListener('click', () => {
  if (!noteTarget) return;
  const { c, s } = noteTarget, txt = $('#note-text').value.trim();
  let a = findHl(c, s);
  if (!txt && !a) { closeNote(); return; }
  if (!a) { a = { id: uid(), k: 'hl', c, s, col: 'y', note: '', text: sentText(c, s).slice(0, 400), t: Date.now() }; ann.push(a); }
  a.note = txt; saveAnn(); paintAnn(a); closeNote(); toast('Anotação salva ✓', 1400);
});
$('#note-del').addEventListener('click', () => {
  if (!noteTarget) return;
  const a = findHl(noteTarget.c, noteTarget.s); if (a) { a.note = ''; saveAnn(); paintAnn(a); }
  closeNote();
});

/* ----- menu de toque longo sobre uma frase ----- */
let menuEl = null, selMark = null;
function closeMenu() {
  if (menuEl) { menuEl.remove(); menuEl = null; }
  if (selMark) { markSentence(selMark.c, selMark.s, 'sel', false); selMark = null; }
}
function openMenu(span, x, y) {
  closeMenu();
  const page = span.closest('.page'); if (!page) return;
  const c = +page.dataset.c, s = +span.dataset.i, a = findHl(c, s);
  const m = el('div', 'pop'); menuEl = m;
  for (const [k, name] of Object.entries(COLORS)) {
    const b = el('button', 'dot d-' + k + (a && a.col === k ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-label', 'Destacar em ' + name.toLowerCase());
    b.addEventListener('click', () => { closeMenu(); setHighlight(c, s, k); });
    m.append(b);
  }
  m.append(el('i', 'sep'));
  const act = (label, fn) => { const b = el('button', 'act', label); b.type = 'button'; b.addEventListener('click', () => { closeMenu(); fn(); }); m.append(b); };
  act(a && a.note ? 'Editar nota' : 'Anotar', () => openNote(c, s));
  act('Ler daqui', () => ttsStart(c, s));
  act('Copiar', () => copyText(sentText(c, s)));
  if (a) act('Remover', () => removeAnn(a));
  document.body.append(m);
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let top = y - mh - 28; if (top < 70) top = y + 34;
  m.style.left = clamp(x - mw / 2, 8, innerWidth - mw - 8) + 'px';
  m.style.top = clamp(top, 8, innerHeight - mh - 8) + 'px';
  selMark = { c, s }; markSentence(c, s, 'sel', true);
}
document.addEventListener('pointerdown', e => { if (menuEl && !menuEl.contains(e.target) && !stageEl.contains(e.target)) closeMenu(); }, true);

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('Copiado ✓', 1200); return; } catch { /* tenta o método antigo */ }
  try {
    const ta = el('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;left:-999px'; document.body.append(ta);
    ta.select(); document.execCommand('copy'); ta.remove(); toast('Copiado ✓', 1200);
  } catch { toast('Não consegui copiar.'); }
}

/* ----- painel: marcadores e destaques ----- */
function jumpToSentence(c, s) {
  closeMenu(); closeSheets();
  const L = getLayout(c), page = L.sentPage[s] || 0, start = page - page % g.per;
  if (c === pos.c && start === pos.p) return;
  jumpTo({ c, p: start });
}
function annItem(a, kind) {
  const li = el('div', 'aitem');
  const go = el('button', 'ago'); go.type = 'button';
  const head = el('div', 'ahead');
  if (kind === 'hl') head.append(el('i', 'dot sm d-' + a.col));
  head.append(el('span', null, book.chapters[a.c].title));
  go.append(head, el('div', 'aquote', '“' + (a.text || sentText(a.c, a.s)).slice(0, 180) + '”'));
  if (a.note) go.append(el('div', 'anote', a.note));
  go.addEventListener('click', () => jumpToSentence(a.c, a.s));
  const del = el('button', 'adel', '✕'); del.type = 'button'; del.setAttribute('aria-label', 'Remover');
  del.addEventListener('click', () => removeAnn(a));
  li.append(go, del);
  return li;
}
const byPlace = (x, y) => x.c - y.c || x.s - y.s;
function renderAnnLists() {
  if (!book) return;
  const bms = ann.filter(a => a.k === 'bm').sort(byPlace), hls = ann.filter(a => a.k === 'hl').sort(byPlace);
  const bl = $('#bm-list'), nl = $('#notes-list');
  bl.replaceChildren(); nl.replaceChildren();
  if (!bms.length) bl.append(el('p', 'muted', 'Nenhum marcador ainda. Toque no ícone de marcador (🔖) na barra de cima para marcar a página.'));
  bms.forEach(a => bl.append(annItem(a, 'bm')));
  if (!hls.length) nl.append(el('p', 'muted', 'Nenhum destaque ainda. Segure o dedo sobre uma frase para destacar ou anotar.'));
  hls.forEach(a => nl.append(annItem(a, 'hl')));
  $('[data-tab="bm"]').textContent = 'Marcadores' + (bms.length ? ' · ' + bms.length : '');
  $('[data-tab="notes"]').textContent = 'Destaques' + (hls.length ? ' · ' + hls.length : '');
  $('#btn-bm').classList.toggle('on', !!bmOnSpread().length);
}
let tocTab = 'toc';
function showTab(name) {
  tocTab = name;
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
  $('#toc-list').hidden = name !== 'toc'; $('#bm-list').hidden = name !== 'bm'; $('#notes-list').hidden = name !== 'notes';
  $('#btn-copy-notes').hidden = name === 'toc' || !ann.some(a => name === 'bm' ? a.k === 'bm' : a.k === 'hl');
}
$$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
$('#btn-copy-notes').addEventListener('click', () => {
  const kind = tocTab === 'bm' ? 'bm' : 'hl';
  const lines = [`${book.title}${book.author ? ' — ' + book.author : ''}`, ''];
  for (const a of ann.filter(x => x.k === kind).sort(byPlace)) {
    lines.push(book.chapters[a.c].title, '“' + (a.text || sentText(a.c, a.s)) + '”');
    if (a.note) lines.push('Nota: ' + a.note);
    lines.push('');
  }
  copyText(lines.join('\n').trim());
});
$('#btn-bm').addEventListener('click', toggleBookmark);

/* ----- busca no texto ----- */
let results = [], resIdx = -1, foundMark = null, searchToken = 0;
function foldMap(t) {                 // ignora maiúsculas e acentos, guardando a posição original
  let f = ''; const idx = [];
  for (let i = 0; i < t.length; i++) {
    const ch = t[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const x of ch) { f += x; idx.push(i); }
  }
  return { f, idx };
}
async function runSearch(q) {
  const token = ++searchToken, status = $('#q-status'), list = $('#q-results');
  const nq = foldMap(q.trim()).f;
  results = []; list.replaceChildren();
  if (nq.length < 2) { status.textContent = q.trim() ? 'Digite pelo menos 2 letras.' : ''; return; }
  status.textContent = 'Buscando…';
  for (let c = 0; c < book.chapters.length; c++) {
    sentencesOf(c).forEach((t, s) => {
      const { f, idx } = foldMap(t), at = f.indexOf(nq);
      if (at >= 0) results.push({ c, s, a: idx[at], b: idx[at + nq.length - 1] + 1, t });
    });
    if (c % 4 === 3) { await new Promise(r => setTimeout(r)); if (token !== searchToken) return; }
  }
  if (token !== searchToken) return;
  const MAX = 150;
  status.textContent = results.length ? `${results.length} resultado${results.length > 1 ? 's' : ''}${results.length > MAX ? ` (mostrando os ${MAX} primeiros)` : ''}` : 'Nada encontrado.';
  results.slice(0, MAX).forEach((r, i) => {
    const li = el('li'), b = el('button'); b.type = 'button';
    const from = Math.max(0, r.a - 42), to = Math.min(r.t.length, r.b + 70);
    const snip = el('div', 'snip');
    snip.append((from > 0 ? '… ' : '') + r.t.slice(from, r.a), el('mark', null, r.t.slice(r.a, r.b)), r.t.slice(r.b, to) + (to < r.t.length ? ' …' : ''));
    b.append(el('div', 'where', book.chapters[r.c].title), snip);
    b.addEventListener('click', () => { closeSheets(); gotoResult(i); });
    li.append(b); list.append(li);
  });
}
function setFound(c, s) {
  clearFoundMark();
  foundMark = c == null ? null : { c, s };
  applyFound();
}
function clearFoundMark() { if (foundMark) markSentence(foundMark.c, foundMark.s, 'found', false); }
function applyFound() { if (foundMark) markSentence(foundMark.c, foundMark.s, 'found', true); }
function gotoResult(i) {
  if (!results.length) return;
  resIdx = clamp(i, 0, results.length - 1);
  const r = results[resIdx];
  setFound(r.c, r.s); jumpToSentence(r.c, r.s);
  $('#sp-label').textContent = `${resIdx + 1} / ${results.length}`;
  $('#search-pill').hidden = false;
}
function endSearchNav() { $('#search-pill').hidden = true; setFound(null); }
$('#sp-prev').addEventListener('click', () => gotoResult(resIdx - 1));
$('#sp-next').addEventListener('click', () => gotoResult(resIdx + 1));
$('#sp-close').addEventListener('click', endSearchNav);
let qTimer;
$('#q').addEventListener('input', e => { clearTimeout(qTimer); const v = e.target.value; qTimer = setTimeout(() => runSearch(v), 260); });
$('#q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); clearTimeout(qTimer); runSearch(e.target.value).then(() => { if (results.length) { closeSheets(); gotoResult(0); } }); e.target.blur(); } });
function openSearch() { openSheet('#sheet-search'); setTimeout(() => { const q = $('#q'); q.focus(); q.select(); }, 80); }
$('#btn-search').addEventListener('click', openSearch);
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f' && book && !views.reader.hidden) { e.preventDefault(); openSearch(); } });

/** Zera tudo ao abrir/fechar um livro. */
function resetAnnState() {
  closeMenu(); closeCard(); closeNote(); endSearchNav();
  results = []; resIdx = -1; searchToken++; sentsCache.clear();
  $('#q').value = ''; $('#q-status').textContent = ''; $('#q-results').replaceChildren();
}

/* ================= dicionário inglês→português, vocabulário e revisão ================= */
let dictLoaded = false;
async function loadDictionary() {
  try { const r = await fetch('dicionario-en-pt.json'); LvDict.load(await r.json()); dictLoaded = true; } catch { /* sem dicionário: só a busca online */ }
}

/* ----- qual palavra está sob o dedo? ----- */
const WORD_CH = /[A-Za-z0-9À-ɏ'’-]/;
function wordAt(x, y) {
  let node = null, off = 0;
  if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { node = p.offsetNode; off = p.offset; } }
  else if (document.caretRangeFromPoint) { const r = document.caretRangeFromPoint(x, y); if (r) { node = r.startContainer; off = r.startOffset; } }
  if (!node || node.nodeType !== 3 || !bookEl.contains(node)) return null;
  const t = node.nodeValue;
  let i = off;
  if (i >= t.length || !WORD_CH.test(t[i])) { if (i > 0 && WORD_CH.test(t[i - 1])) i -= 1; else return null; }
  let a = i, b = i + 1;
  while (a > 0 && WORD_CH.test(t[a - 1])) a--;
  while (b < t.length && WORD_CH.test(t[b])) b++;
  while (a < b && /['’-]/.test(t[a])) a++;
  while (b > a && /['’-]/.test(t[b - 1])) b--;
  const text = t.slice(a, b);
  if (!/[A-Za-z]/.test(text)) return null;
  const range = document.createRange(); range.setStart(node, a); range.setEnd(node, b);
  const rect = [...range.getClientRects()].find(r => x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 5 && y <= r.bottom + 5);
  if (!rect) return null;
  const sp = node.parentElement && node.parentElement.closest('.s'), pg = node.parentElement && node.parentElement.closest('.page');
  return { text, node, a, b, off: i, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, c: pg ? +pg.dataset.c : pos.c, s: sp ? +sp.dataset.i : -1 };
}

/* marca temporariamente a palavra tocada */
let wsel = null;
function markWord(node, a, b) {
  const mid = node.splitText(a); mid.splitText(b - a);
  const span = el('span', 'wsel'); mid.replaceWith(span); span.append(mid);
  return span;
}
function unmarkWord() {
  if (!wsel) return;
  const sp = wsel, parent = sp.parentNode; wsel = null;
  if (parent) { while (sp.firstChild) parent.insertBefore(sp.firstChild, sp); sp.remove(); parent.normalize(); }
}

/* ----- consultas online (reserva) ----- */
const decodeHtml = s => { const t = el('textarea'); t.innerHTML = s; return t.value; };
async function fetchJSON(url, ms = 7000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); }
  finally { clearTimeout(timer); }
}
async function onlineTranslate(text) {                       // inglês → português (MyMemory)
  const j = await fetchJSON('https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text) + '&langpair=en|pt-BR');
  const t = j && j.responseData && j.responseData.translatedText;
  if (!t || /MYMEMORY WARNING|INVALID|QUERY LENGTH|PLEASE SELECT/i.test(t)) throw new Error('sem tradução');
  const out = decodeHtml(t).trim();
  if (out.toLowerCase() === text.trim().toLowerCase() && text.trim().includes(' ') === false) throw new Error('sem tradução');
  return out;
}
async function onlineDefine(word) {                          // definição em inglês + pronúncia (dictionaryapi.dev)
  const j = await fetchJSON('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
  const e = Array.isArray(j) ? j[0] : null;
  if (!e) throw new Error('sem definição');
  const ph = (e.phonetics || []);
  return {
    phonetic: e.phonetic || (ph.find(p => p.text) || {}).text || '',
    audio: (ph.find(p => p.audio) || {}).audio || '',
    meanings: (e.meanings || []).slice(0, 3).map(m => ({ pos: m.partOfSpeech, def: (m.definitions && m.definitions[0] && m.definitions[0].definition) || '', ex: (m.definitions && m.definitions[0] && m.definitions[0].example) || '' })),
  };
}
const dcache = store.get('lv:dcache', {});
function dcacheSet(k, v) {
  dcache[k] = Object.assign(dcache[k] || {}, v);
  const keys = Object.keys(dcache); if (keys.length > 400) delete dcache[keys[0]];
  store.set('lv:dcache', dcache);
}

/* ----- pronúncia ----- */
function speakWord(w, audioUrl) {
  if (tts.on) ttsStop();
  if (audioUrl) { try { const a = new Audio(audioUrl); a.play().catch(() => speakPlain(w)); return; } catch { /* usa a voz do aparelho */ } }
  speakPlain(w);
}
function speakPlain(w) {
  if (!synth) { toast('Este navegador não tem voz para ler a palavra.'); return; }
  synth.cancel();
  const u = utter(w); u.rate = Math.min(S.rate, 0.9);
  setTimeout(() => synth.speak(u), 60);
}

/* ----- vocabulário salvo ----- */
let vocab = store.get('lv:vocab', []);
const saveVocab = () => { store.set('lv:vocab', vocab); updateVocabBtn(); };
const vkey = w => LvDict.norm(w);
/** Trecho da frase em volta da palavra (até ~170 caracteres), cortando em limites de palavra. */
function snippet(sentence, word, max = 170) {
  if (sentence.length <= max) return sentence;
  const at = Math.max(0, sentence.toLowerCase().indexOf(word.toLowerCase()));
  let a = Math.max(0, at - Math.floor(max / 2)), b = Math.min(sentence.length, a + max);
  a = Math.max(0, b - max);
  if (a > 0) { const sp = sentence.indexOf(' ', a); if (sp > 0 && sp < at) a = sp + 1; }
  if (b < sentence.length) { const sp = sentence.lastIndexOf(' ', b); if (sp > at + word.length) b = sp; }
  return (a > 0 ? '… ' : '') + sentence.slice(a, b).trim() + (b < sentence.length ? ' …' : '');
}
/** Cria um elemento com a frase, deixando a palavra em negrito. */
function exampleEl(cls, text, word) {
  const box = el('div', cls); const q = '“' + text + '”';
  const i = word ? q.toLowerCase().indexOf(word.toLowerCase()) : -1;
  if (i < 0) { box.textContent = q; return box; }
  box.append(q.slice(0, i), el('strong', null, q.slice(i, i + word.length)), q.slice(i + word.length));
  return box;
}
const isSaved = w => vocab.some(v => v.k === vkey(w));
function updateVocabBtn() {
  const due = vocab.filter(v => v.due <= Date.now()).length;
  const b = $('#btn-vocab'); if (b) b.textContent = '📚 Meu vocabulário' + (vocab.length ? ` · ${vocab.length}` : '') + (due ? ` (${due} p/ revisar)` : '');
}

/* ----- cartão de significado ----- */
let cardEl = null, cardToken = 0;
function closeCard() { if (cardEl) { cardEl.remove(); cardEl = null; } unmarkWord(); cardToken++; }
document.addEventListener('pointerdown', e => { if (cardEl && !cardEl.contains(e.target) && !stageEl.contains(e.target)) closeCard(); }, true);

function posChip(pos) { return el('span', 'wpos', (LvDict.POS[pos] || pos)); }
function renderEntries(res) {
  const wrap = el('div', 'wentries');
  for (const f of res.forms) {
    if (!f.direct) wrap.append(el('div', 'wform', `forma de “${f.lemma}”`));
    for (const [pos, pt] of f.entries) { const row = el('div', 'went'); row.append(posChip(pos), el('span', 'wpt', pt)); wrap.append(row); }
  }
  return wrap;
}
const primaryPt = res => (res && res.forms[0] && res.forms[0].entries[0][1]) || '';

function placeCard(rect) {
  if (!cardEl) return;
  const w = cardEl.offsetWidth, h = cardEl.offsetHeight;
  let top = rect.bottom + 12; if (top + h > innerHeight - 10) top = rect.top - h - 12;
  cardEl.style.left = clamp((rect.left + rect.right) / 2 - w / 2, 8, innerWidth - w - 8) + 'px';
  cardEl.style.top = clamp(top, 8, innerHeight - h - 8) + 'px';
}

function openCard(hit) {
  closeCard(); closeMenu();
  const token = ++cardToken, raw = hit.text, rect = hit.rect;
  wsel = markWord(hit.node, hit.a, hit.b);
  const sentence = hit.s >= 0 ? sentText(hit.c, hit.s) : '';
  const card = el('div', 'wcard'); cardEl = card;

  /* compostos com hífen: tenta o composto inteiro e, se não existir, cada parte */
  let parts = [raw];
  if (raw.includes('-') && !LvDict.lookup(raw)) parts = raw.split('-').filter(p => /[A-Za-z]/.test(p));
  const single = parts.length === 1;
  const word = single ? raw.replace(/’/g, "'") : raw;
  const res = single ? LvDict.lookup(raw) : null;
  const cur = { key: vkey(single ? (res ? res.forms[0].lemma : raw) : raw), shown: word, pt: primaryPt(res), pos: res ? res.forms[0].entries[0][0] : '', audio: '' };

  const head = el('div', 'whead');
  const title = el('div', 'wtitle'); title.append(el('strong', null, word), el('span', 'wphon'));
  const bSay = el('button', 'wbtn', '🔊'); bSay.type = 'button'; bSay.setAttribute('aria-label', 'Ouvir a pronúncia');
  bSay.addEventListener('click', () => speakWord(word, cur.audio));
  const bX = el('button', 'wbtn x', '✕'); bX.type = 'button'; bX.setAttribute('aria-label', 'Fechar');
  bX.addEventListener('click', closeCard);
  head.append(title, bSay, bX);

  const body = el('div', 'wbody'), extra = el('div', 'wextra');
  card.append(head, body, extra);

  if (!single) {
    for (const p of parts) {
      const r = LvDict.lookup(p), blk = el('div', 'wpart');
      blk.append(el('div', 'wform', p));
      blk.append(r ? renderEntries(r) : el('div', 'muted', 'sem tradução no dicionário do app'));
      body.append(blk);
    }
    cur.pt = parts.map(p => { const r = LvDict.lookup(p); return r ? p + ': ' + primaryPt(r).split(';')[0] : ''; }).filter(Boolean).join(' · ');
  } else if (res) {
    body.append(renderEntries(res));
  } else if (S.dictOnline) {
    body.append(el('div', 'muted', 'Procurando na internet…'));
    onlineTranslate(raw).then(pt => {
      if (token !== cardToken) return;
      cur.pt = pt; dcacheSet(cur.key, { pt });
      body.replaceChildren(); const row = el('div', 'went'); row.append(el('span', 'wpos', 'tradução automática'), el('span', 'wpt', pt)); body.append(row);
      placeCard(rect);
    }).catch(() => {
      if (token !== cardToken) return;
      const cached = dcache[cur.key] && dcache[cur.key].pt;
      body.replaceChildren(el('div', 'muted', cached ? cached : 'Não achei esta palavra no dicionário do app e a internet não respondeu. Tente de novo quando estiver conectado.'));
      if (cached) cur.pt = cached;
      placeCard(rect);
    });
  } else {
    body.append(el('div', 'muted', 'Esta palavra não está no dicionário do app. Ative a busca na internet em Ajustes para traduzir palavras que faltam.'));
  }

  /* definição em inglês (online): automática se a palavra não existe offline, sob demanda se existe */
  const loadDefinition = async () => {
    extra.replaceChildren(el('div', 'muted', 'Buscando definição…')); placeCard(rect);
    try {
      const key = single ? vkey(raw) : vkey(parts[0]);
      const d = (dcache[key] && dcache[key].def) || await onlineDefine(single ? raw : parts[0]);
      dcacheSet(key, { def: d });
      if (token !== cardToken) return;
      cur.audio = d.audio || ''; $('.wphon', title).textContent = d.phonetic || '';
      extra.replaceChildren(el('div', 'wlabel', 'Definição em inglês'));
      for (const m of d.meanings) { const row = el('div', 'wdef'); row.append(el('i', null, m.pos + ' '), m.def); if (m.ex) row.append(el('div', 'wex', '“' + m.ex + '”')); extra.append(row); }
    } catch { if (token === cardToken) extra.replaceChildren(el('div', 'muted', 'Não consegui buscar a definição agora.')); }
    placeCard(rect);
  };
  if (S.dictOnline) {
    if (!res && single) loadDefinition();
    else { const more = el('button', 'wlink', 'Definição em inglês e pronúncia (internet)'); more.type = 'button'; more.addEventListener('click', loadDefinition); extra.append(more); }
  }

  /* ações */
  const acts = el('div', 'wacts');
  const star = el('button', 'wact' + (isSaved(cur.key) ? ' on' : ''), isSaved(cur.key) ? '★ Salva' : '☆ Salvar'); star.type = 'button';
  star.addEventListener('click', () => {
    const i = vocab.findIndex(v => v.k === cur.key);
    if (i >= 0) { vocab.splice(i, 1); star.classList.remove('on'); star.textContent = '☆ Salvar'; }
    else {
      vocab.push({ id: uid(), k: cur.key, w: single && res ? res.forms[0].lemma : word, form: word, pt: cur.pt, pos: cur.pos, ex: snippet(sentence, word), book: book.title, t: Date.now(), box: 0, due: Date.now() });
      star.classList.add('on'); star.textContent = '★ Salva'; toast('Palavra salva no vocabulário 📚', 1500);
    }
    saveVocab();
  });
  acts.append(star);
  if (hit.s >= 0) {
    const rd = el('button', 'wact', '▶ Ler frase'); rd.type = 'button';
    rd.addEventListener('click', () => { closeCard(); ttsStart(hit.c, hit.s); });
    acts.append(rd);
    if (S.dictOnline && sentence) {
      const tr = el('button', 'wact', 'Traduzir frase'); tr.type = 'button';
      tr.addEventListener('click', async () => {
        if (sentence.length > 450) { toast('Frase longa demais para traduzir de uma vez.'); return; }
        tr.disabled = true; tr.textContent = 'Traduzindo…';
        try { const t = await onlineTranslate(sentence); if (token !== cardToken) return; let box = $('.wsent', card); if (!box) { box = el('div', 'wsent'); card.insertBefore(box, acts); } box.textContent = t; tr.remove(); }
        catch { tr.disabled = false; tr.textContent = 'Traduzir frase'; toast('Não consegui traduzir agora (internet?).'); }
        placeCard(rect);
      });
      acts.append(tr);
    }
  }
  card.append(acts);
  document.body.append(card);
  placeCard(rect);
}

/* ----- lista do vocabulário ----- */
const DAY = 86400000, STEPS = [1, 2, 4, 8, 16, 32];
function renderVocab() {
  const list = $('#vocab-list'); list.replaceChildren();
  const due = vocab.filter(v => v.due <= Date.now()).length;
  $('#vocab-sum').textContent = vocab.length ? `${vocab.length} palavra${vocab.length > 1 ? 's' : ''} salva${vocab.length > 1 ? 's' : ''} · ${due} para revisar agora` : 'Você ainda não salvou nenhuma palavra. Enquanto lê, toque numa palavra e depois em “Salvar”.';
  $('#btn-review').hidden = !due; $('#btn-copy-vocab').hidden = !vocab.length;
  for (const v of [...vocab].sort((a, b) => b.t - a.t)) {
    const item = el('div', 'aitem'), box = el('div', 'ago');
    const head = el('div', 'vhead'); head.append(el('strong', null, v.w));
    const say = el('button', 'wbtn sm', '🔊'); say.type = 'button'; say.addEventListener('click', () => speakWord(v.w));
    head.append(say);
    box.append(head, el('div', 'vpt', v.pt || '—'));
    if (v.ex) box.append(exampleEl('aquote', v.ex, v.form));
    box.append(el('div', 'vbook', v.book));
    const del = el('button', 'adel', '✕'); del.type = 'button'; del.setAttribute('aria-label', 'Remover ' + v.w);
    del.addEventListener('click', () => { vocab = vocab.filter(x => x !== v); saveVocab(); renderVocab(); });
    item.append(box, del); list.append(item);
  }
}
$('#btn-vocab').addEventListener('click', () => { renderVocab(); openSheet('#sheet-vocab'); });
$('#btn-copy-vocab').addEventListener('click', () => copyText([...vocab].sort((a, b) => a.k.localeCompare(b.k)).map(v => `${v.w} — ${v.pt}${v.ex ? '\n   “' + v.ex + '”' : ''}`).join('\n')));

/* ----- revisão com flashcards (repetição espaçada simples) ----- */
let queue = [], qTotal = 0, qDone = 0;
function startReview() {
  queue = vocab.filter(v => v.due <= Date.now()).sort((a, b) => a.due - b.due);
  qTotal = queue.length; qDone = 0;
  if (!qTotal) { toast('Nada para revisar agora 🎉'); return; }
  closeSheets(); $('#flash-modal').hidden = false; showCard();
}
function showCard() {
  const body = $('#flash-body'); body.replaceChildren();
  const v = queue[0];
  $('#flash-count').textContent = v ? `${Math.min(qDone + 1, qTotal)} / ${qTotal}` : '';
  if (!v) {
    body.append(el('h3', null, 'Revisão concluída 🎉'), el('p', 'muted', `Você revisou ${qTotal} palavra${qTotal > 1 ? 's' : ''}. Volte amanhã para as próximas.`));
    const ok = el('button', 'btn primary', 'Fechar'); ok.type = 'button'; ok.addEventListener('click', closeReview); body.append(ok);
    return;
  }
  const front = el('div', 'fc-front');
  const w = el('div', 'fc-word', v.w); const say = el('button', 'wbtn', '🔊'); say.type = 'button'; say.addEventListener('click', () => speakWord(v.w));
  const wr = el('div', 'fc-wr'); wr.append(w, say); front.append(wr);
  if (v.ex) front.append(exampleEl('fc-ex', v.ex, v.form));
  const back = el('div', 'fc-back'); back.hidden = true;
  back.append(el('div', 'fc-pt', v.pt || '—'));
  const show = el('button', 'btn primary', 'Mostrar tradução'); show.type = 'button';
  const row = el('div', 'modal-actions'); row.hidden = true;
  const again = el('button', 'btn', 'Ver de novo'), know = el('button', 'btn primary', 'Já sei'); again.type = know.type = 'button';
  again.addEventListener('click', () => { v.box = 0; v.due = Date.now() + 10 * 60000; queue.push(queue.shift()); saveVocab(); showCard(); });
  know.addEventListener('click', () => { v.box = Math.min(v.box + 1, STEPS.length - 1); v.due = Date.now() + STEPS[v.box] * DAY; queue.shift(); qDone++; saveVocab(); showCard(); });
  row.append(again, know);
  show.addEventListener('click', () => { back.hidden = false; show.hidden = true; row.hidden = false; });
  body.append(front, back, show, row);
}
function closeReview() { $('#flash-modal').hidden = true; renderVocab(); }
$('#btn-review').addEventListener('click', startReview);
$('#flash-close').addEventListener('click', closeReview);

/* ================= interação: toque, arrastar, teclado ================= */
let uiTimer = null;
function showUI(autoHide) { document.body.classList.remove('ui-hidden'); clearTimeout(uiTimer); if (autoHide) uiTimer = setTimeout(hideUI, 4500); }
function hideUI() { if (!sheetOpen()) document.body.classList.add('ui-hidden'); }
function toggleUI() { document.body.classList.contains('ui-hidden') ? showUI(true) : hideUI(); }

let drag = null, lastTap = { t: 0, x: 0, y: 0 };
let lpTimer = null;
stageEl.addEventListener('pointerdown', e => {
  if (menuEl) { closeMenu(); drag = null; return; }
  const hadCard = !!cardEl; if (hadCard) closeCard();
  if (flip) return;
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), active: false, dir: 0, target: e.target, lp: false, hadCard };
  clearTimeout(lpTimer);
  const sp = e.target.closest ? e.target.closest('.s') : null;
  if (sp) lpTimer = setTimeout(() => {          // segurar sobre uma frase abre o menu de destaque/anotação
    if (drag && !drag.active && drag.id === e.pointerId) { drag.lp = true; openMenu(sp, e.clientX, e.clientY); }
  }, 480);
});
stageEl.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.active) {
    if (Math.hypot(dx, dy) > 10) clearTimeout(lpTimer);
    if (drag.lp) return;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      const dir = dx < 0 ? 1 : -1;
      if (!startFlip(dir)) { drag = null; return; }
      flip.byUser = true; drag.active = true; drag.dir = dir;
      try { stageEl.setPointerCapture(e.pointerId); } catch { /* ok */ }
      hideUI();
    }
    return;
  }
  const span = g.per === 2 ? g.pw : g.pw * 0.8;
  const signed = (drag.dir > 0 ? -dx : dx) / span;
  setFlip(clamp(signed, 0, 1), false);
});
const endDrag = e => {
  if (!drag || drag.id !== e.pointerId) return;
  const d = drag; drag = null; clearTimeout(lpTimer);
  if (d.lp) return;
  if (d.active) {
    const dt = Math.max(1, performance.now() - d.t), dx = Math.abs(e.clientX - d.x);
    const p = flip ? flip.p : 0, speed = dx / dt;
    if (S.sound && p > 0.35 && !tts.on) pageSound();
    (p > 0.33 || (speed > 0.5 && p > 0.06)) ? finishFlip() : cancelFlip();
    return;
  }
  if (e.type === 'pointercancel') return;
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12) return;
  onTap(e, d.target, d.hadCard);
};
stageEl.addEventListener('contextmenu', e => e.preventDefault());
stageEl.addEventListener('pointerup', endDrag);
stageEl.addEventListener('pointercancel', endDrag);

function onTap(e, target, hadCard) {
  const W = innerWidth, H = innerHeight, x = e.clientX, y = e.clientY;
  if (S.dict && dictLoaded) {
    if (x < W * 0.08) { turn(-1, true); return; }          // margens externas: sempre viram a página
    if (x > W * 0.92) { turn(1, true); return; }
    if (y > H * 0.14 && y < H * 0.88) {                     // no meio da tela, uma palavra tem prioridade
      const hit = wordAt(x, y);
      if (hit) { openCard(hit); return; }
    }
    if (hadCard) return;                                     // tocar fora só fecha o cartão
    if (x < W * 0.22) { turn(-1, true); return; }           // espaço em branco: lados viram a página, centro mostra os controles
    if (x > W * 0.78) { turn(1, true); return; }
    toggleUI(); return;
  }
  if (x < W * 0.22) { turn(-1, true); return; }
  if (x > W * 0.78) { turn(1, true); return; }
  const now = performance.now();
  const span = target && target.closest ? target.closest('.s') : null;
  if (span && now - lastTap.t < 330 && Math.hypot(x - lastTap.x, y - lastTap.y) < 36) {
    lastTap.t = 0; readFromSpan(span); return;
  }
  lastTap = { t: now, x, y };
  toggleUI();
}
function readFromSpan(span) {
  const page = span.closest('.page'); if (!page) return;
  ttsStart(+page.dataset.c, +span.dataset.i);
}

document.addEventListener('keydown', e => {
  if (!book || views.reader.hidden || sheetOpen()) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); turn(1); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
  else if (e.key === 'Escape') closeBook();
});

$('#slider').addEventListener('input', e => {
  const v = +e.target.value * g.per, L = getLayout(pos.c);
  $('#pos-label').textContent = `Página ${v + 1} de ${L.n}`;
});
$('#slider').addEventListener('change', e => jumpTo({ c: pos.c, p: +e.target.value * g.per }));

/* ================= som de página ================= */
let actx;
function pageSound() {
  if (!S.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const dur = 0.3, sr = actx.sampleRate, buf = actx.createBuffer(1, Math.floor(sr * dur), sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      const t = i / d.length, env = Math.pow(1 - t, 2.4) * (t < 0.05 ? t / 0.05 : 1);
      d[i] = (Math.random() * 2 - 1) * env * (0.55 + 0.45 * Math.sin(t * 46));
    }
    const src = actx.createBufferSource(); src.buffer = buf;
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2800; bp.Q.value = 0.7;
    const gain = actx.createGain(); gain.gain.value = 0.2;
    src.connect(bp); bp.connect(gain); gain.connect(actx.destination); src.start();
  } catch { /* sem áudio web */ }
}

/* ================= leitura em voz alta (TTS) ================= */
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
const tts = { on: false, c: 0, idx: 0, token: 0 };
let voices = [];
let hl = null;     // {c, idx}

function loadVoices() {
  if (!synth) return;
  const all = synth.getVoices();
  voices = all.filter(v => /^en([-_]|$)/i.test(v.lang));
  const q = v => /premium/i.test(v.name + v.voiceURI) ? 0 : /enhanced|aprimorad/i.test(v.name + v.voiceURI) ? 1 : 2;
  voices.sort((a, b) => q(a) - q(b) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
  const sel = $('#sel-voice'); sel.replaceChildren();
  if (!voices.length) { sel.append(new Option('Voz padrão do sistema', '')); return; }
  for (const v of voices) sel.append(new Option(`${v.name} (${v.lang.replace('_', '-')})${q(v) < 2 ? ' ★' : ''}`, v.voiceURI));
  sel.value = pickVoice() ? pickVoice().voiceURI : voices[0].voiceURI;
}
function pickVoice() {
  if (!voices.length) return null;
  return voices.find(v => v.voiceURI === S.voice)
    || voices.find(v => /premium|enhanced/i.test(v.name) && /en[-_]US/i.test(v.lang))
    || voices.find(v => /samantha|ava|allison|nicky/i.test(v.name) && /en[-_]US/i.test(v.lang))
    || voices.find(v => /en[-_]US/i.test(v.lang)) || voices[0];
}
if (synth) { loadVoices(); synth.addEventListener ? synth.addEventListener('voiceschanged', loadVoices) : (synth.onvoiceschanged = loadVoices); }

function utter(text, onend, onerror) {
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
  u.rate = S.rate; u.pitch = 1;
  u.onend = onend; u.onerror = onerror;
  return u;
}

function ttsStart(c, idx) {
  if (!synth) { toast('Este navegador não tem leitura em voz alta.'); return; }
  audioStop();
  tts.on = true; tts.c = c; tts.idx = idx;
  setTtsUi(true); keepAwake(true);
  speakCurrent(true);
}
function ttsStop() {
  tts.on = false; tts.token++;
  if (synth) synth.cancel();
  setHL(null); setTtsUi(false); keepAwake(false);
}
function setTtsUi(on) { $('#ic-play').hidden = on; $('#ic-pause').hidden = !on; }

function speakCurrent(fresh) {
  if (!tts.on) return;
  const token = ++tts.token;
  const L = getLayout(tts.c);
  if (tts.idx >= L.sents.length) {
    if (tts.c + 1 < book.chapters.length) { tts.c++; tts.idx = 0; return speakCurrent(fresh); }
    ttsStop(); toast('Fim do livro 📖'); return;
  }
  const text = (L.sents[tts.idx] || '').replace(/_{2,}/g, ' blank ');
  if (!text.trim()) { tts.idx++; return speakCurrent(fresh); }
  setHL(tts.c, tts.idx);
  ensureVisible(tts.c, tts.idx);
  saveProgress();
  const next = () => { if (token !== tts.token || !tts.on) return; tts.idx++; speakCurrent(false); };
  const u = utter(text, next, e => { if (token !== tts.token) return; if (e && (e.error === 'interrupted' || e.error === 'canceled')) return; next(); });
  if (fresh) { synth.cancel(); setTimeout(() => { if (token === tts.token && tts.on) synth.speak(u); }, 60); }
  else synth.speak(u);
}

/** Garante que a frase lida está visível, virando páginas se preciso. */
function ensureVisible(c, idx) {
  if (flip) return;
  const L = getLayout(c);
  const page = L.sentPage[idx] || 0, start = page - page % g.per;
  if (c === pos.c && start === pos.p) return;
  const n = nextPos(pos);
  if (n && n.c === c && n.p === start) { turn(1, false); return; }
  jumpTo({ c, p: start }, false);
}

function ttsStep(delta) {
  if (!book) return;
  if (!tts.on) { ttsStart(pos.c, getLayout(pos.c).pageFirst[pos.p] || 0); return; }
  tts.idx = Math.max(0, tts.idx + delta);
  speakCurrent(true);
}
$('#tts-play').addEventListener('click', () => {
  if (tts.on) { ttsStop(); return; }
  const L = getLayout(pos.c);
  ttsStart(pos.c, L.pageFirst[pos.p] || 0);
});
$('#tts-prev').addEventListener('click', () => ttsStep(-1));
$('#tts-next').addEventListener('click', () => ttsStep(1));

const RATES = [0.7, 0.85, 1, 1.15, 1.3, 1.5];
const fmtRate = r => r.toFixed(2).replace(/0$/, '') + '×';
function setRate(r, restart = true) {
  S.rate = r; saveSettings();
  $('#tts-rate').textContent = fmtRate(r); $('#rate-val').textContent = fmtRate(r); $('#rng-rate').value = r;
  if (tts.on && restart) speakCurrent(true);
}
$('#tts-rate').addEventListener('click', () => {
  const i = RATES.findIndex(r => Math.abs(r - S.rate) < 0.01);
  setRate(RATES[(i + 1) % RATES.length]);
});

/* ----- destaque da frase ----- */
function clearHLDom() { $$('.s.hl').forEach(e => e.classList.remove('hl')); const f = layouts; for (const L of f.values()) L.tpl.querySelectorAll('.hl').forEach(e => e.classList.remove('hl')); }
function applyHL() {
  if (!hl) return;
  const q = `[data-i="${hl.idx}"]`;
  const L = layouts.get(hl.c); if (L) L.tpl.querySelectorAll(q).forEach(e => e.classList.add('hl'));
  bookEl.querySelectorAll(`.page[data-c="${hl.c}"] ${q}`).forEach(e => e.classList.add('hl'));
}
function setHL(c, idx) { clearHLDom(); hl = c == null ? null : { c, idx }; applyHL(); }

/* ----- tela sempre acesa durante a leitura ----- */
let wake = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
    else if (!on && wake) { await wake.release(); wake = null; }
  } catch { /* opcional */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (tts.on && synth && !synth.speaking && !synth.pending) speakCurrent(true);
  if (tts.on || !audio.paused) keepAwake(true);
});

/* ================= audiolivro (arquivo do usuário) ================= */
const audio = new Audio(); audio.preload = 'metadata';
let audioUrl = null, sleepTimer = null, lastSave = 0;

async function loadAudioFor(id) {
  audioUnload();
  try {
    const rec = await DB.get('audio', id);
    if (rec) attachAudio(rec.blob, rec.name, id);
  } catch { /* sem áudio */ }
  syncAudioPanel();
}
function attachAudio(blob, name, id) {
  audioUnload();
  audioUrl = URL.createObjectURL(blob); audio.src = audioUrl;
  audio.dataset.name = name; audio.dataset.book = id;
  const saved = store.get('lv:apos:' + id, 0);
  audio.addEventListener('loadedmetadata', () => { if (saved && saved < audio.duration) audio.currentTime = saved; updateAudioUi(); }, { once: true });
  audio.playbackRate = +$('#a-speed').value;
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: book.title, artist: book.author || 'Audiolivro', album: 'Alice\'s Library' });
    navigator.mediaSession.setActionHandler('play', () => audio.play());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-15));
    navigator.mediaSession.setActionHandler('seekforward', () => skip(15));
  }
}
function audioUnload() {
  audio.pause(); audio.removeAttribute('src'); audio.load();
  if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
  clearTimeout(sleepTimer); $('#a-sleep').value = '0';
}
function audioStop() { if (!audio.paused) audio.pause(); }
function syncAudioPanel() {
  const has = !!audioUrl;
  $('#audio-empty').hidden = has; $('#audio-player').hidden = !has;
  $('#audio-name').textContent = audio.dataset.name || '';
  updateAudioUi();
}
function updateAudioUi() {
  const d = audio.duration || 0;
  $('#audio-cur').textContent = fmtTime(audio.currentTime); $('#audio-dur').textContent = fmtTime(d);
  $('#audio-seek').value = d ? Math.round(audio.currentTime / d * 1000) : 0;
  $('#a-ic-play').hidden = !audio.paused; $('#a-ic-pause').hidden = audio.paused;
}
function skip(s) { audio.currentTime = clamp(audio.currentTime + s, 0, audio.duration || 0); }

audio.addEventListener('timeupdate', () => {
  updateAudioUi();
  const now = Date.now();
  if (book && now - lastSave > 4000) { lastSave = now; store.set('lv:apos:' + book.id, audio.currentTime); }
});
audio.addEventListener('play', () => { ttsStop(); keepAwake(true); updateAudioUi(); });
audio.addEventListener('pause', () => { if (book) store.set('lv:apos:' + book.id, audio.currentTime); updateAudioUi(); if (!tts.on) keepAwake(false); });
audio.addEventListener('ended', updateAudioUi);
$('#a-play').addEventListener('click', () => audio.paused ? audio.play().catch(() => toast('Não consegui tocar este áudio.')) : audio.pause());
$('#a-back').addEventListener('click', () => skip(-15));
$('#a-fwd').addEventListener('click', () => skip(15));
$('#audio-seek').addEventListener('input', e => { if (audio.duration) audio.currentTime = e.target.value / 1000 * audio.duration; });
$('#a-speed').addEventListener('change', e => { audio.playbackRate = +e.target.value; });
$('#a-sleep').addEventListener('change', e => {
  clearTimeout(sleepTimer); const m = +e.target.value;
  if (m) { sleepTimer = setTimeout(() => { audio.pause(); ttsStop(); $('#a-sleep').value = '0'; toast('Boa noite! 🌙'); }, m * 60000); toast(`Desliga em ${m} min`); }
});
$('#file-audio').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f || !book) return;
  try {
    await DB.put('audio', { id: book.id, name: f.name, blob: f });
    attachAudio(f, f.name, book.id); syncAudioPanel(); toast('Áudio anexado ✓');
  } catch { toast('Não consegui guardar o áudio (espaço insuficiente?).'); }
});
$('#a-remove').addEventListener('click', async () => {
  if (!confirm('Remover o áudio deste livro?')) return;
  await DB.del('audio', book.id).catch(() => {}); store.del('lv:apos:' + book.id);
  audioUnload(); delete audio.dataset.name; syncAudioPanel();
});

/* ================= painéis e ajustes ================= */
const sheets = ['#sheet-toc', '#sheet-settings', '#sheet-audio', '#sheet-search', '#sheet-vocab'].map(s => $(s));
const sheetOpen = () => sheets.some(s => !s.hidden);
function openSheet(id) { closeMenu(); closeCard(); closeSheets(); if (id === '#sheet-toc') renderAnnLists(); $(id).hidden = false; $('#scrim').hidden = false; showUI(false); if (id === '#sheet-audio') syncAudioPanel(); }
function closeSheets() { sheets.forEach(s => { s.hidden = true; }); $('#scrim').hidden = true; if (book) showUI(true); }
$('#scrim').addEventListener('click', closeSheets);
$$('[data-close]').forEach(b => b.addEventListener('click', closeSheets));
$('#btn-toc').addEventListener('click', () => openSheet('#sheet-toc'));
$('#btn-settings').addEventListener('click', () => openSheet('#sheet-settings'));
$('#btn-audio').addEventListener('click', () => openSheet('#sheet-audio'));
$('#btn-back').addEventListener('click', closeBook);

function applySettings() {
  document.documentElement.dataset.theme = S.theme;
  document.body.classList.toggle('sans', S.font === 'sans');
  $$('#seg-theme button').forEach(b => b.classList.toggle('on', b.dataset.v === S.theme));
  $$('#seg-font button').forEach(b => b.classList.toggle('on', b.dataset.v === S.font));
  $('#fs-val').textContent = S.size; $('#chk-sound').checked = S.sound; $('#chk-dict').checked = S.dict; $('#chk-online').checked = S.dictOnline;
  $('#tts-rate').textContent = fmtRate(S.rate); $('#rate-val').textContent = fmtRate(S.rate); $('#rng-rate').value = S.rate;
  document.documentElement.style.setProperty('--fs', S.size + 'px');
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = S.theme === 'night' ? '#0c0b0a' : '#2a1a14';
}

/** Recalcula as páginas mantendo o leitor na mesma frase (rotação, fonte, tema). */
function relayout() {
  if (!book) return;
  const L0 = layouts.get(pos.c);
  const anchor = L0 ? (tts.on && tts.c === pos.c ? tts.idx : (L0.pageFirst[pos.p] || 0)) : 0;
  const c = pos.c; flip = null;
  computeGeometry(); clearLayouts();
  const L = getLayout(c), page = L.sentPage[anchor] || 0;
  pos = { c, p: page - page % g.per };
  renderSpread();
}
let rzTimer;
const onResize = ms => () => { clearTimeout(rzTimer); rzTimer = setTimeout(() => { relayout(); if (!views.library.hidden) renderShelf(); }, ms); };
addEventListener('resize', onResize(180));
addEventListener('orientationchange', onResize(350));

$('#fs-minus').addEventListener('click', () => { S.size = clamp(S.size - 1, 15, 34); saveSettings(); applySettings(); relayout(); });
$('#fs-plus').addEventListener('click', () => { S.size = clamp(S.size + 1, 15, 34); saveSettings(); applySettings(); relayout(); });
$$('#seg-theme button').forEach(b => b.addEventListener('click', () => { S.theme = b.dataset.v; saveSettings(); applySettings(); }));
$$('#seg-font button').forEach(b => b.addEventListener('click', () => { S.font = b.dataset.v; saveSettings(); applySettings(); relayout(); }));
$('#chk-sound').addEventListener('change', e => { S.sound = e.target.checked; saveSettings(); if (S.sound) pageSound(); });
$('#chk-dict').addEventListener('change', e => { S.dict = e.target.checked; saveSettings(); });
$('#chk-online').addEventListener('change', e => { S.dictOnline = e.target.checked; saveSettings(); });
$('#sel-voice').addEventListener('change', e => { S.voice = e.target.value; saveSettings(); if (tts.on) speakCurrent(true); });
$('#rng-rate').addEventListener('input', e => setRate(+e.target.value, false));
$('#rng-rate').addEventListener('change', e => setRate(+e.target.value, true));
$('#btn-voice-test').addEventListener('click', () => {
  if (!synth) return toast('Sem leitura em voz alta neste navegador.');
  synth.cancel(); setTimeout(() => synth.speak(utter('Alice was beginning to get very tired of sitting by her sister on the bank.')), 60);
});
if (!synth) { $('#tts-play').disabled = true; $('#tts-prev').disabled = true; $('#tts-next').disabled = true; $('#tts-rate').hidden = true; }

/* ================= importar arquivo ================= */
$('#file-book').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  toast('Importando…', 8000);
  try { const b = await importFile(f); renderShelf(); toast('Livro adicionado ✓'); openBook(b.id); }
  catch (err) { console.error(err); toast(err.message || 'Não consegui ler este arquivo.', 4200); }
});

/* ================= início ================= */
(async function init() {
  applySettings();
  loadDictionary(); updateVocabBtn();
  try { await ensureSample(); } catch (e) { console.error(e); toast('Aviso: o armazenamento do navegador não está disponível.', 5000); }
  renderShelf();
  const hash = location.hash.slice(1);
  if (hash && lib.some(b => b.id === hash)) openBook(hash); else showView('library');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

// ganchos para teste automatizado
window.__lv = { get pos() { return pos; }, get g() { return g; }, get tts() { return tts; }, turn, jumpTo, ttsStart, ttsStop, getLayout, importFile, openBook };
})();
