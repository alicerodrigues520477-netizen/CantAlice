# Catálogo de livros — Alice's Library

1000 livros prontos para inserir no banco do Supabase (tabela `public.livros`).

| Arquivo | Para quê |
|---|---|
| `livros.sql` | Cria a tabela, índices, RLS e insere todos os livros. Pode ser rodado mais de uma vez (`on conflict (id) do nothing`). |
| `livros.json` | Os mesmos dados em JSON (array de objetos), para importação por código. |
| `fonte/lote-NN.txt` | Fonte editável, um livro por linha. |
| `../../scripts/build-catalog.mjs` | Valida a fonte e gera o JSON e o SQL. |

## Atualização de resumos e textos (`livros_texto.sql`)

Rode **depois** de `livros.sql` (pode repetir): troca as sinopses genéricas ou repetidas dos 59 livros com texto por sinopses específicas em português, acrescenta `resumo_en` (versão em inglês) e marca `texto_no_app`, `texto_slug`, `texto_fonte` e `estante_inicial`. Também dá um resumo próprio às 7 edições em inglês que repetiam o resumo da edição em português. A estante de leitura de cada pessoa fica no aparelho, não nesta tabela; `estante_inicial` só marca quais livros o app coloca na estante no primeiro uso.

## Traduções para a leitura bilíngue (`traducoes/*.sql`)

Rode **depois** de `livros.sql` e `livros_texto.sql`, **na ordem dos números** (pode repetir: é um "upsert"):

| Arquivo | O que faz |
|---|---|
| `traducoes/00_estrutura.sql` | Cria `public.livros_traducoes` (leitura pública, escrita só pelo painel) e a coluna `public.livros.traducao_pt`. |
| `traducoes/01_livros.sql` … `10_livros.sql` | Inserem as traduções, uma linha por livro (cada arquivo tem uns 500–630 KB, para caber no SQL Editor). |
| `traducoes/11_marcar_livros.sql` | Marca `traducao_pt` (`trecho`, `parcial` ou `completa`) nos 59 livros. |

No SQL Editor: abra cada arquivo, cole e clique em **Run**, um de cada vez, do 00 ao 11. Eles são gerados por `node scripts/build-traducoes-sql.mjs` a partir de `public/alices-library/livros/*.pt.json`.

**Atenção:** o leitor do iPad lê as traduções desses arquivos `.pt.json`, que vão junto com o app; rodar o SQL **não é necessário** para a leitura bilíngue funcionar. O SQL serve para guardar a tradução no banco (consulta, backup, revisão). Cobertura atual: *Alice's Adventures in Wonderland* capítulos I e II; os outros 58 livros, os 3 primeiros capítulos com texto (≈18,6 mil parágrafos no total).

> Validado em um Postgres real (PGlite): os 12 arquivos rodam em ordem, duas vezes, sem duplicar; `anon` lê e não escreve; os 59 livros ficam marcados.

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
- Meta de 1000 livros: atingida: 1000 livros, o teto pedido.
