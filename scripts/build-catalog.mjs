#!/usr/bin/env node
/**
 * Builds the Alice's Library book catalog from the batch files in
 * supabase/catalog/fonte/lote-*.txt and writes:
 *   supabase/catalog/livros.json   (array of book objects)
 *   supabase/catalog/livros.sql    (create table + RLS + idempotent inserts)
 *
 * Source line format (one book per line, "|" separated, "#" starts a comment):
 *   titulo|autor|genero|idioma|nivel|tag1,tag2,tag3|resumo
 * `nivel` is Iniciante | Intermediário | Avançado for English books, and "-" for Portuguese books.
 *
 * Usage:  node scripts/build-catalog.mjs          (validate + write)
 *         node scripts/build-catalog.mjs --check  (validate only)
 * Exits non-zero on any validation error, so it can gate CI.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'supabase/catalog/fonte')
const outJson = join(root, 'supabase/catalog/livros.json')
const outSql = join(root, 'supabase/catalog/livros.sql')
const checkOnly = process.argv.includes('--check')

const GENEROS = new Set([
  'Ficção Clássica', 'Romance', 'Ficção Científica', 'Fantasia', 'Mistério e Suspense', 'Terror', 'Aventura',
  'Infantil', 'Juvenil', 'Drama', 'Poesia', 'Teatro', 'Contos', 'Humor', 'Quadrinhos e Graphic Novels',
  'Desenvolvimento Pessoal', 'Negócios e Finanças', 'Ciência', 'História', 'Biografia e Memórias',
  'Filosofia', 'Espiritualidade', 'Psicologia', 'Ensaios e Crônicas', 'Didático',
])
const IDIOMAS = new Set(['en', 'pt'])
const NIVEIS = new Set(['Iniciante', 'Intermediário', 'Avançado'])

// Fixed namespace: the same title+author always gets the same id, so re-running is idempotent.
const NS = '7f3b2c1e-5a4d-4e8a-9c63-2a1b0d9e8f70'
function uuidv5(name) {
  const h = createHash('sha1').update(Buffer.from(NS.replace(/-/g, ''), 'hex')).update(name, 'utf8').digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const key = (titulo, autor) =>
  fold(titulo).replace(/^(the|a|an|o|a|os|as|um|uma)\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim() + '|' +
  fold(autor).replace(/[^a-z0-9]+/g, ' ').trim()

const errors = []
const fail = (where, msg) => errors.push(`${where}: ${msg}`)
const books = []
const seen = new Map()

const files = readdirSync(srcDir).filter((f) => /^lote-\d+\.txt$/.test(f)).sort()
for (const file of files) {
  readFileSync(join(srcDir, file), 'utf8').split('\n').forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const where = `${file}:${i + 1}`
    const parts = line.split('|').map((p) => p.trim())
    if (parts.length !== 7) return fail(where, `esperava 7 campos, achei ${parts.length}`)
    const [titulo, autor, genero, idioma, nivel, tagsRaw, resumo] = parts
    if (!titulo || !autor) return fail(where, 'título e autor são obrigatórios')
    if (!GENEROS.has(genero)) fail(where, `gênero fora da lista: "${genero}"`)
    if (!IDIOMAS.has(idioma)) fail(where, `idioma inválido: "${idioma}"`)
    let nivel_dificuldade = null
    if (idioma === 'en') {
      if (!NIVEIS.has(nivel)) fail(where, `nível inválido para livro em inglês: "${nivel}"`)
      else nivel_dificuldade = nivel
    } else if (nivel !== '-') fail(where, 'livros em português devem ter nível "-"')
    const tags = tagsRaw.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
    if (tags.length < 3 || tags.length > 6) fail(where, `precisa de 3 a 6 tags (tem ${tags.length})`)
    if (new Set(tags).size !== tags.length) fail(where, 'tags repetidas')
    const sentences = (resumo.match(/[.!?…]+(?=\s|$)/g) || []).length
    if (sentences < 2 || sentences > 3) fail(where, `resumo deve ter 2 a 3 frases (tem ${sentences})`)
    if (resumo.length < 80 || resumo.length > 460) fail(where, `resumo com ${resumo.length} caracteres (esperado 80–460)`)
    const k = key(titulo, autor)
    if (seen.has(k)) fail(where, `duplicado de ${seen.get(k)} ("${titulo}" — ${autor})`)
    else seen.set(k, where)
    books.push({ id: uuidv5(k), titulo, autor, genero, idioma, resumo, nivel_dificuldade, tags })
  })
}
const ids = new Set(books.map((b) => b.id))
if (ids.size !== books.length) fail('ids', 'ids repetidos (colisão de título+autor)')

const count = (f) => books.reduce((m, b) => ((m[f(b)] = (m[f(b)] || 0) + 1), m), {})
console.log(`${books.length} livros em ${files.length} lote(s)`)
console.log('por idioma :', JSON.stringify(count((b) => b.idioma)))
console.log('por nível  :', JSON.stringify(count((b) => b.nivel_dificuldade ?? 'n/a')))
console.log('por gênero :', JSON.stringify(count((b) => b.genero)))
if (errors.length) {
  console.error(`\n${errors.length} erro(s):\n- ` + errors.join('\n- '))
  process.exit(1)
}
if (checkOnly) process.exit(0)

writeFileSync(outJson, JSON.stringify(books, null, 2) + '\n')

const q = (s) => `'${s.replace(/'/g, "''")}'`
const row = (b) =>
  `  (${q(b.id)}, ${q(b.titulo)}, ${q(b.autor)}, ${q(b.genero)}, ${q(b.idioma)}, ${q(b.resumo)}, ` +
  `${b.nivel_dificuldade ? q(b.nivel_dificuldade) : 'null'}, array[${b.tags.map(q).join(', ')}])`
const sql = [
  `-- Alice's Library -- book catalog (${books.length} books).`,
  '-- Generated by scripts/build-catalog.mjs from supabase/catalog/fonte/*.txt. Do not edit by hand.',
  '-- Run once in the Supabase SQL editor (Dashboard > SQL Editor > New query). Safe to re-run:',
  '-- the table is created only if missing and every insert is "on conflict do nothing".',
  '',
  'create table if not exists public.livros (',
  '  id uuid primary key,',
  '  titulo text not null,',
  '  autor text not null,',
  '  genero text not null,',
  "  idioma text not null check (idioma in ('pt', 'en')),",
  '  resumo text not null,',
  "  nivel_dificuldade text check (nivel_dificuldade in ('Iniciante', 'Intermediário', 'Avançado')),",
  "  tags text[] not null default '{}',",
  '  created_at timestamptz not null default now(),',
  '  unique (titulo, autor)',
  ');',
  'create index if not exists livros_idioma_idx on public.livros (idioma);',
  'create index if not exists livros_genero_idx on public.livros (genero);',
  'create index if not exists livros_tags_idx on public.livros using gin (tags);',
  '',
  '-- The catalog is public reference data: anyone may read it, nobody may write it with the',
  '-- public anon key (writes go through the SQL editor / service role only).',
  'alter table public.livros enable row level security;',
  'drop policy if exists "livros are readable by everyone" on public.livros;',
  'create policy "livros are readable by everyone" on public.livros for select to anon, authenticated using (true);',
  '',
]
for (let i = 0; i < books.length; i += 100) {
  sql.push('insert into public.livros (id, titulo, autor, genero, idioma, resumo, nivel_dificuldade, tags) values')
  sql.push(books.slice(i, i + 100).map(row).join(',\n'))
  sql.push('on conflict (id) do nothing;', '')
}
writeFileSync(outSql, sql.join('\n'))
console.log(`escrito: ${outJson.replace(root + '/', '')}, ${outSql.replace(root + '/', '')}`)
