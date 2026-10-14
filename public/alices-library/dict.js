/* Dicionário inglês→português: busca por palavra com resolução de flexões (plural, passado, -ing, comparativos…). */
(function (root) {
  'use strict';
  const POS = { n: 'substantivo', v: 'verbo', adj: 'adjetivo', adv: 'advérbio', prep: 'preposição', pron: 'pronome', conj: 'conjunção', det: 'determinante', interj: 'interjeição', num: 'numeral', aux: 'verbo auxiliar', contr: 'contração' };
  let data = null;
  const load = obj => { data = obj; };
  const isLoaded = () => !!data;

  const norm = w => w.toLowerCase().replace(/[’‘`]/g, "'").replace(/^'+|'+$/g, '');

  /** Possíveis formas-base de uma palavra flexionada, da mais provável para a menos. */
  function ruleCandidates(w) {
    const out = [];
    const add = x => { if (x && x.length >= 2 && x !== w && !out.includes(x)) out.push(x); };
    if (/'s$/.test(w)) add(w.slice(0, -2));
    if (/s'$/.test(w)) add(w.slice(0, -2));
    if (/n't$/.test(w)) add(w.slice(0, -3));
    if (/'(ll|re|ve|d|m)$/.test(w)) add(w.replace(/'(ll|re|ve|d|m)$/, ''));
    if (/ies$/.test(w)) add(w.slice(0, -3) + 'y');
    if (/ied$/.test(w)) add(w.slice(0, -3) + 'y');
    if (/ier$/.test(w)) add(w.slice(0, -3) + 'y');
    if (/iest$/.test(w)) add(w.slice(0, -4) + 'y');
    if (/ily$/.test(w)) add(w.slice(0, -3) + 'y');
    if (/(ches|shes|sses|xes|zes|oes)$/.test(w)) add(w.slice(0, -2));
    if (/es$/.test(w)) { add(w.slice(0, -1)); add(w.slice(0, -2)); }
    if (/s$/.test(w) && !/ss$/.test(w)) add(w.slice(0, -1));
    if (/ing$/.test(w)) { const b = w.slice(0, -3); add(b); add(b + 'e'); if (/(.)\1$/.test(b)) add(b.slice(0, -1)); }
    if (/ed$/.test(w)) { const b = w.slice(0, -2); add(b); add(b + 'e'); if (/(.)\1$/.test(b)) add(b.slice(0, -1)); }
    if (/ly$/.test(w)) { add(w.slice(0, -2)); add(w.slice(0, -1) + 'e'); }
    if (/(er|est)$/.test(w)) { const b = w.replace(/(er|est)$/, ''); add(b); add(b + 'e'); if (/(.)\1$/.test(b)) add(b.slice(0, -1)); }
    if (/eth$/.test(w)) { const b = w.slice(0, -3); add(b); add(b + 'e'); }
    if (/est$/.test(w)) { const b = w.slice(0, -3); add(b); add(b + 'e'); }
    if (/ness$/.test(w)) add(w.slice(0, -4));
    if (/ful$/.test(w)) add(w.slice(0, -3));
    return out;
  }

  /**
   * Procura uma palavra. Devolve null ou { word, forms: [{ lemma, entries: [[pos, pt], …], direct }] }.
   * "direct" = a palavra existe como está no dicionário; senão veio de uma forma-base (lemma).
   */
  function lookup(raw) {
    if (!data) return null;
    const w = norm(raw);
    if (!w) return null;
    const forms = [];
    const push = (lemma, direct) => {
      const entries = data.w[lemma];
      if (entries && !forms.some(f => f.lemma === lemma)) forms.push({ lemma, entries, direct });
    };
    if (data.c[w]) forms.push({ lemma: w, entries: [['contr', data.c[w]]], direct: true });
    push(w, true);
    const irr = data.irr[w];
    if (irr) irr.split('|').forEach(l => push(l, false));
    if (!forms.length) for (const cand of ruleCandidates(w)) { push(cand, false); if (forms.length) break; }
    if (!forms.length && /^[a-z]+$/.test(w) && w.length > 4) {
      // última tentativa: formas muito derivadas (ex.: hopefully → hopeful → hope)
      for (const cand of ruleCandidates(w)) for (const c2 of ruleCandidates(cand)) { push(c2, false); if (forms.length) break; if (forms.length) break; }
    }
    return forms.length ? { word: w, forms: forms.slice(0, 3) } : null;
  }

  root.LvDict = { load, isLoaded, lookup, ruleCandidates, norm, POS };
})(typeof window !== 'undefined' ? window : globalThis);
