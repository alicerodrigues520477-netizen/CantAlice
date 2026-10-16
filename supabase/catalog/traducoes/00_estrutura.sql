-- Alice's Library -- traduções em português (leitura bilíngue).
-- Gerado por scripts/build-traducoes-sql.mjs a partir de public/alices-library/livros/*.pt.json. Não edite à mão.
-- Rodar DEPOIS de livros.sql e livros_texto.sql, na ordem dos números dos arquivos (00, 01, 02 ... e o último). Pode repetir: é um "upsert".
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

commit;
