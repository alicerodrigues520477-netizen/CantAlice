#!/usr/bin/env node
/**
 * Gera supabase/catalog/traducoes/*.sql (arquivos numerados, cada um pequeno o bastante para o SQL Editor) a partir das traduções que o leitor bilíngue usa:
 *   public/alices-library/livros/<slug>.pt.json   (fonte única; o app lê estes arquivos)
 *
 * O SQL cria a tabela public.livros_traducoes (uma linha por livro, leitura pública), guarda os
 * parágrafos em jsonb e marca public.livros.traducao_pt ('parcial' | 'completa') pelo texto_slug.
 *
 * Uso:  node scripts/build-traducoes-sql.mjs
 */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'public/alices-library/livros')

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

const header = `-- Alice's Library -- traduções em português (leitura bilíngue).
-- Gerado por scripts/build-traducoes-sql.mjs a partir de public/alices-library/livros/*.pt.json. Não edite à mão.
-- Rodar DEPOIS de livros.sql e livros_texto.sql, na ordem dos números dos arquivos (00, 01, 02 ... e o último). Pode repetir: é um "upsert".
--
-- IMPORTANTE: o leitor do iPad lê as traduções dos arquivos livros/<slug>.pt.json que vão no app; rodar este SQL
-- NÃO é necessário para a leitura bilíngue funcionar. Ele guarda a mesma tradução no banco (consulta, backup,
-- revisão) e marca em public.livros quais livros têm tradução.
`
const estrutura = header + `
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

commit;
`
const insertOf = ({ slug, d, n }) =>
  `-- ${slug} (${n} parágrafos)\n` +
  `insert into public.livros_traducoes (texto_slug, idioma, cobertura, credito, titulos, paragrafos, total_paragrafos) values (${q(slug)}, 'pt', ${q(d.coverage === 'partial' ? 'parcial' : d.coverage === 'full' ? 'completa' : 'trecho')}, ${q(d.credit || '')}, ${json(d.titles || {})}, ${json(d.paras)}, ${n})\n` +
  `on conflict (texto_slug, idioma) do update set cobertura = excluded.cobertura, credito = excluded.credito, titulos = excluded.titulos, paragrafos = excluded.paragrafos, total_paragrafos = excluded.total_paragrafos, atualizado_em = now();\n\n`

// partes de até ~600 KB: cabem no SQL Editor do Supabase
const MAX = 600 * 1024
const parts = []; let cur = '', curN = 0
for (const r of rows) {
  const ins = insertOf(r)
  if (cur && cur.length + ins.length > MAX) { parts.push([cur, curN]); cur = ''; curN = 0 }
  cur += ins; curN++
}
if (cur) parts.push([cur, curN])

const outDir = join(root, 'supabase/catalog/traducoes')
mkdirSync(outDir, { recursive: true })
for (const f of readdirSync(outDir)) if (f.endsWith('.sql')) rmSync(join(outDir, f))
const pad = n => String(n).padStart(2, '0')
writeFileSync(join(outDir, '00_estrutura.sql'), estrutura)
parts.forEach(([body, n], i) => writeFileSync(join(outDir, `${pad(i + 1)}_livros.sql`), header + `\n-- parte ${i + 1} de ${parts.length}: ${n} livros\nbegin;\n\n${body}commit;\n`))
const last = `${pad(parts.length + 1)}_marcar_livros.sql`
writeFileSync(join(outDir, last), header + `\n-- marca em public.livros quais livros têm tradução (rodar depois de todas as partes)\nupdate public.livros l set traducao_pt = t.cobertura from public.livros_traducoes t where t.texto_slug = l.texto_slug and t.idioma = 'pt';\n`)
console.log(`${rows.length} livros -> supabase/catalog/traducoes/ (${parts.length + 2} arquivos: 00_estrutura, ${parts.length} partes, ${last})`)
