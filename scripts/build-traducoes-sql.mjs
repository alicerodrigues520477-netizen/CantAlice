#!/usr/bin/env node
/**
 * Gera supabase/catalog/livros_traducoes.sql a partir das traduções que o leitor bilíngue usa:
 *   public/alices-library/livros/<slug>.pt.json   (fonte única; o app lê estes arquivos)
 *
 * O SQL cria a tabela public.livros_traducoes (uma linha por livro, leitura pública), guarda os
 * parágrafos em jsonb e marca public.livros.traducao_pt ('parcial' | 'completa') pelo texto_slug.
 *
 * Uso:  node scripts/build-traducoes-sql.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'public/alices-library/livros')
const out = join(root, 'supabase/catalog/livros_traducoes.sql')

const q = s => "'" + String(s).replace(/'/g, "''") + "'"
// dollar-quoting com tag própria: o texto dos livros nunca contém esta marca
const json = o => { const j = JSON.stringify(o); if (j.includes('$tr$')) throw new Error('texto contém $tr$'); return '$tr$' + j + '$tr$::jsonb' }

const files = readdirSync(dir).filter(f => f.endsWith('.pt.json')).sort()
const rows = files.map(f => {
  const slug = f.replace(/\.pt\.json$/, '')
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8'))
  if (!d.paras || !Object.keys(d.paras).length) throw new Error(f + ': sem parágrafos')
  return { slug, d, n: Object.keys(d.paras).length }
})

let sql = `-- Alice's Library -- traduções em português (leitura bilíngue).
-- Gerado por scripts/build-traducoes-sql.mjs a partir de public/alices-library/livros/*.pt.json. Não edite à mão.
-- Rodar DEPOIS de livros.sql e livros_texto.sql (usa public.livros.texto_slug). Pode repetir: é um "upsert".
--
-- IMPORTANTE: o leitor do iPad lê as traduções dos arquivos livros/<slug>.pt.json que vão no app; rodar este SQL
-- NÃO é necessário para a leitura bilíngue funcionar. Ele guarda a mesma tradução no banco (consulta, backup,
-- revisão) e marca em public.livros quais livros têm tradução.

begin;

create table if not exists public.livros_traducoes (
  texto_slug text not null,
  idioma text not null default 'pt' check (idioma in ('pt')),
  cobertura text not null check (cobertura in ('trecho', 'parcial', 'completa')),
  credito text,
  titulos jsonb not null default '{}'::jsonb,
  paragrafos jsonb not null,
  total_paragrafos integer not null,
  atualizado_em timestamptz not null default now(),
  primary key (texto_slug, idioma)
);
comment on table public.livros_traducoes is 'Tradução parágrafo a parágrafo: paragrafos = { chave do parágrafo em inglês: texto em português }. A chave é keyOf() de public/alices-library/bilingual.js.';

alter table public.livros add column if not exists traducao_pt text check (traducao_pt in ('trecho', 'parcial', 'completa'));

revoke all on public.livros_traducoes from anon, authenticated;
grant select on public.livros_traducoes to anon, authenticated;
alter table public.livros_traducoes enable row level security;
drop policy if exists "traducoes are readable by everyone" on public.livros_traducoes;
create policy "traducoes are readable by everyone" on public.livros_traducoes for select to anon, authenticated using (true);

`
for (const { slug, d, n } of rows) {
  sql += `-- ${slug} (${n} parágrafos, ${d.coverage || 'trecho'})\n`
  sql += `insert into public.livros_traducoes (texto_slug, idioma, cobertura, credito, titulos, paragrafos, total_paragrafos) values (${q(slug)}, 'pt', ${q(d.coverage === 'partial' ? 'parcial' : d.coverage === 'full' ? 'completa' : 'trecho')}, ${q(d.credit || '')}, ${json(d.titles || {})}, ${json(d.paras)}, ${n})\n`
  sql += `on conflict (texto_slug, idioma) do update set cobertura = excluded.cobertura, credito = excluded.credito, titulos = excluded.titulos, paragrafos = excluded.paragrafos, total_paragrafos = excluded.total_paragrafos, atualizado_em = now();\n\n`
}
sql += `update public.livros l set traducao_pt = t.cobertura from public.livros_traducoes t where t.texto_slug = l.texto_slug and t.idioma = 'pt';\n\ncommit;\n`

writeFileSync(out, sql)
console.log(`${rows.length} livros -> ${out.replace(root + '/', '')} (${Math.round(sql.length / 1024)} KB)`)
