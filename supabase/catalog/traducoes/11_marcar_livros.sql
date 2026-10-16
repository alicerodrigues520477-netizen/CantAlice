-- Alice's Library -- traduções em português (leitura bilíngue).
-- Gerado por scripts/build-traducoes-sql.mjs a partir de public/alices-library/livros/*.pt.json. Não edite à mão.
-- Rodar DEPOIS de livros.sql e livros_texto.sql, na ordem dos números dos arquivos (00, 01, 02 ... e o último). Pode repetir: é um "upsert".
--
-- IMPORTANTE: o leitor do iPad lê as traduções dos arquivos livros/<slug>.pt.json que vão no app; rodar este SQL
-- NÃO é necessário para a leitura bilíngue funcionar. Ele guarda a mesma tradução no banco (consulta, backup,
-- revisão) e marca em public.livros quais livros têm tradução.

-- marca em public.livros quais livros têm tradução (rodar depois de todas as partes)
update public.livros l set traducao_pt = t.cobertura from public.livros_traducoes t where t.texto_slug = l.texto_slug and t.idioma = 'pt';
