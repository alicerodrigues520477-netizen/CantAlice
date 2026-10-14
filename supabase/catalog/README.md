# Catálogo de livros — Alice's Library

987 livros prontos para inserir no banco do Supabase (tabela `public.livros`).

| Arquivo | Para quê |
|---|---|
| `livros.sql` | Cria a tabela, índices, RLS e insere todos os livros. Pode ser rodado mais de uma vez (`on conflict (id) do nothing`). |
| `livros.json` | Os mesmos dados em JSON (array de objetos), para importação por código. |
| `fonte/lote-NN.txt` | Fonte editável, um livro por linha. |
| `../../scripts/build-catalog.mjs` | Valida a fonte e gera o JSON e o SQL. |

## Campos

`id` (UUID v5 determinístico a partir de título + autor), `titulo`, `autor`, `genero`, `idioma` (`pt` ou `en`), `resumo` (2–3 frases), `nivel_dificuldade` (`Iniciante`, `Intermediário` ou `Avançado`; `null` nos livros em português) e `tags` (3 a 6, em minúsculas).

## Como aplicar

1. Abra o **SQL Editor** do projeto no Supabase, cole o conteúdo de `livros.sql` e rode. Ou use `supabase db query < supabase/catalog/livros.sql` com a CLI.
2. A tabela fica com leitura pública (RLS ligada, política de `select` para `anon` e `authenticated`; escrita só pelo painel/serviço).

> Este SQL **não foi aplicado** a nenhum projeto. Foi validado num Postgres real (PGlite): roda duas vezes sem duplicar, o papel `anon` lê mas não escreve, e a busca por tag funciona.

## Adicionar mais livros

Crie `fonte/lote-NN.txt` com linhas no formato
`titulo|autor|genero|idioma|nivel|tag1,tag2,tag3|resumo` e rode:

```
node scripts/build-catalog.mjs --check   # só valida
node scripts/build-catalog.mjs           # valida e regenera JSON + SQL
```

O validador recusa: duplicatas (título sem artigo inicial + autor), gênero fora da lista, idioma diferente de `pt`/`en`, nível ausente em livros em inglês, tags fora de 3–6 e resumos fora de 2–3 frases (evite abreviações com ponto, como "Dr." ou "C. S.", dentro do resumo).

## Avisos honestos

- **Níveis** são estimativa editorial, não medição: Iniciante ≈ A2–B1, Intermediário ≈ B2, Avançado ≈ C1–C2 ou texto arcaico/denso. O nível serve a quem estuda inglês, por isso é vazio nos livros em português.
- **Resumos** são textos originais, escritos de memória; títulos, autores e fatos **não foram conferidos na web**. Vale uma revisão antes de publicar.
- Títulos de obras do mesmo texto em inglês e em português (por exemplo, edições distintas) aparecem como entradas separadas, pois o idioma muda a edição.
- Meta de 1000 livros: ficou em 987, priorizando só obras que tenho certeza de que existem, em vez de preencher o número.
