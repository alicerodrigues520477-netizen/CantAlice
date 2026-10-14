# 📖 Alice's Library

Leitor gratuito de livros em inglês para iPad, com **páginas que viram**, **leitura em voz alta** com a frase destacada e **player de audiolivro**. Roda direto no Safari como app (PWA): sem App Store, sem conta, sem anúncios, sem servidor — os livros ficam só no seu iPad.

## Instalar no iPad

1. Abra o endereço do app no **Safari** do iPad:
   `https://alicerodrigues520477-netizen.github.io/O-Laboratorio-do-Ca-ador-de-Bugs/leitor-ipad/`
   (fica no ar depois que a branch for mesclada na `main`; o workflow `deploy-pages.yml` publica sozinho).
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início**.
3. Abra pelo ícone. Depois da primeira vez ele funciona **offline**.

## Como usar

| Ação | Gesto |
|---|---|
| Virar página | arraste a página, ou toque nas bordas esquerda/direita |
| Mostrar/esconder controles | toque no centro |
| Ler em voz alta a partir de uma frase | toque duas vezes na frase |
| Ler em voz alta a partir da página atual | botão ▶ da barra inferior |
| Capítulos | botão ☰ |
| Tamanho, tema, fonte, voz, velocidade | botão **Aa** |
| Audiolivro (MP3/M4A/M4B) | botão 🎧 → anexar arquivo |

## Dicionário inglês → português

Toque numa palavra do texto e abre um cartão com a **tradução**, a classe gramatical e o botão 🔊 para ouvir a pronúncia.

- **Dicionário embutido (funciona offline):** cerca de 1.470 palavras e 370 formas irregulares, incluindo todas as palavras dos livros do catálogo. Ele entende flexões: *walked → walk*, *children → child*, *making → make*, *happily → happy*. Em compostos com hífen (*rabbit-hole*) mostra cada parte.
- **Reserva pela internet:** se a palavra não estiver no dicionário embutido (por exemplo, num EPUB que você importou), o app busca a tradução automática (MyMemory) e a definição em inglês com fonética (dictionaryapi.dev). Nesse caso a palavra, ou a frase, é enviada a esses serviços gratuitos. Dá para desligar em **Aa › Buscar na internet…**. A tradução automática pode errar.
- **Botões do cartão:** ☆ Salvar (guarda no vocabulário), ▶ Ler frase e Traduzir frase (internet).
- **Meu vocabulário:** na biblioteca, o botão 📚 lista as palavras salvas, com a frase onde apareceram, e tem a **Revisão** com flashcards (repetição espaçada: “Já sei” adia a próxima revisão para 1, 2, 4, 8, 16 e 32 dias; “Ver de novo” volta em 10 minutos).
- No meio da tela, tocar numa palavra abre o dicionário; tocar nas margens externas ou num espaço em branco continua virando a página, e as faixas de cima e de baixo mostram/escondem os controles. Para voltar ao comportamento antigo (duplo toque lê a frase), desligue **Aa › Tocar numa palavra mostra o significado**.

## Busca, marcadores e anotações

| Ação | Como |
|---|---|
| Buscar no livro | botão 🔍 (ou ⌘F com teclado). Ignora maiúsculas e acentos; toque num resultado e use ‹ › para passar de um para outro |
| Marcar a página | botão 🔖: aparece uma fita dourada no canto da página; toque de novo para tirar |
| Destacar uma frase | **segure o dedo** sobre a frase e escolha a cor (amarelo, verde, rosa ou azul) |
| Anotar | segure o dedo na frase → **Anotar**. Frases com nota ficam com sublinhado pontilhado |
| Ver tudo e copiar | botão ☰ → abas **Marcadores** e **Destaques** → *Copiar para a área de transferência* |

Marcadores, destaques e notas são guardados **neste iPad** (no Safari), por livro, e se mantêm ao mudar o tamanho da letra ou girar a tela. O destaque é sempre da **frase inteira**, não de palavras soltas. Limpar os dados do Safari apaga tudo; use *Copiar* para guardar uma cópia das suas anotações.

- **Paisagem** mostra duas páginas (livro aberto); **retrato** mostra uma.
- A posição de leitura e do áudio é salva automaticamente.
- Formatos de livro: **.epub** e **.txt** (inclusive os do Project Gutenberg).

## Livros grátis já incluídos

Na biblioteca, a seção **Livros grátis para começar** tem livros em inglês simples (níveis A1–A2), escritos originalmente para este app e liberados para uso livre. Um toque leva o livro para a estante, e ele funciona offline:

| Livro | Nível | Tema |
|---|---|---|
| *Small Steps* | A2 | Autoajuda: hábitos, medo, amizade, gratidão (com vocabulário em cada capítulo) |
| *One Thought a Day* | A1 | Autoajuda: 30 pensamentos curtos, um por dia |
| *Calm in Five Minutes* | A2 | Autoajuda: exercícios de respiração, atenção e relaxamento em passos curtos |
| *A Little Book of Gratitude* | A1 | Autoajuda e inglês: diário de 21 dias com uma frase para escrever por dia |
| *Speak English with Confidence* | A2 | Autoajuda e inglês: hábitos e frases úteis para perder o medo de falar |
| *Prayers for Every Day* | A1 | Orações: 12 orações do dia a dia, Pai Nosso e Salmo 23 (texto clássico + palavras simples) |
| *Prayers for Hard Days* | A2 | Orações: insônia, preocupação, solidão, raiva, cansaço, espera, dúvida, luto, cura |
| *Verses of Hope* | A2 | Orações: 10 versículos (Salmos, Provérbios, Isaías, Mateus, João…) com texto clássico, versão simples e uma pergunta |
| *Stories of Courage* | A2 | Histórias: 5 histórias curtas sobre coragem, perdão e gentileza |

No catálogo há um filtro por tema (Autoajuda, Orações, Histórias, Aprender inglês). Nos textos bíblicos, o inglês clássico é a *King James Version* (domínio público); as versões "in simple words" são originais e não são uma tradução oficial.

Os textos ficam em `catalogo.json`; para adicionar mais livros ao catálogo, basta incluir uma entrada nesse arquivo.

## Estante e capas

Cada livro aparece numa prateleira de madeira. Livros em **EPUB** usam a capa real do arquivo; os demais ganham uma capa desenhada. A seção **Continuar lendo** reabre o último livro de onde você parou.

## Onde achar mais livros e audiobooks grátis

- [Project Gutenberg](https://www.gutenberg.org) e [Standard Ebooks](https://standardebooks.org) — EPUB de domínio público.
- [LibriVox](https://librivox.org) e [Internet Archive](https://archive.org) — audiobooks em MP3.

## Voz mais natural (grátis)

Ajustes do iPad › Acessibilidade › Conteúdo Falado › Vozes › Inglês → baixe uma voz **Aprimorada** ou **Premium**. O app a usa automaticamente (marcada com ★ na lista de vozes).

## Limitações conhecidas

- A leitura em voz alta usa a voz do iPad e **pausa com a tela bloqueada** (limitação do iOS para apps web). Mantenha a tela acesa — o app pede ao iPad para não apagar. Já o **audiolivro em arquivo** continua tocando com a tela bloqueada.
- O áudio humano de um audiolivro **não sincroniza** com o texto (isso exigiria alinhamento palavra a palavra). Para ler e ouvir juntos, use o ▶ do app.
- EPUBs com imagens, tabelas ou layout fixo aparecem só como texto.

## Para desenvolver

Sem build: HTML/CSS/JS puros + [JSZip](https://stuk.github.io/jszip/) (em `lib/`) para abrir EPUB.

```bash
cd leitor-ipad && python3 -m http.server 8000   # abra http://localhost:8000
```
