<div align="center">

# 🎵 CantAlice

**Aprender inglês cantando — letras sincronizadas, tradução e suas músicas favoritas do Spotify.**

Um app feito com carinho para a Alice praticar inglês com as músicas que ela ama.
Conecte o Spotify, abra uma música, acompanhe a letra linha por linha como um
karaokê, veja a tradução em português e toque em qualquer palavra para guardá-la
no caderninho de vocabulário.

</div>

---

## ✨ O que ele faz

- **Cante junto** — letras sincronizadas (estilo karaokê) que acompanham a música em tempo real (Spotify Premium).
- **Entenda tudo** — tradução de cada linha para o português e toque em qualquer palavra para ver o significado.
- **Caderninho de vocabulário** — guarde palavras novas e pratique com flashcards (repetição espaçada).
- **Frases úteis** — frases do dia a dia e as suas próprias, com tradução e prática de pronúncia no microfone.
- **Tradutor com exemplos reais** — traduza palavras e frases e veja exemplos bilíngues (estilo Reverso) para guardar na revisão.
- **Conversar com IA** — um parceiro de conversa por voz que ouve, responde e fala de volta (opcional).
- **Modo espelho** — trave menos na conversação: você diz em português o que quer falar, a IA mostra e fala a frase no idioma que você estuda, você repete (com nota de pronúncia) e só então ela entra na conversa — que segue com tradução embaixo de cada resposta. Nos dois modos o microfone fica aberto até você mandar (**Pronto** no espelho; tocar de novo no microfone no direto), então dá para pensar no meio da frase sem ser cortada.
- **Inglês ou espanhol** — cada pessoa escolhe o idioma que quer aprender.
- **Minhas músicas** — duas coleções: *Quero aprender* e *Já sei cantar*.
- **Acompanhe o progresso** — quantas músicas, quantas palavras, e continue de onde parou.
- **Lindo de viver nele** — fundo aurora animado, vidro fosco, tipografia elegante e tudo em português.

- **Instale como app** — no iPhone/iPad/Android dá pra adicionar à tela de início e abrir em tela cheia, com ícone próprio (PWA).
- **Atualiza sozinho** — quando você publica uma mudança, a página aberta da Alice detecta e se atualiza (sem precisar limpar cache).
- **Ajuda &amp; dicas** — um guia rápido dentro do app (botão de ajuda), com reconectar Spotify e "Atualizar agora".

A biblioteca da Alice fica salva **no próprio navegador** dela (localStorage) — sem
contas, sem servidor, privado. (Opcionalmente, dá para ligar a **sincronização
na nuvem** — veja a seção mais abaixo — para o progresso acompanhar entre
aparelhos.)

> 📱 **Instalar na tela de início (iPhone/iPad):** abra o site no Safari → botão de
> compartilhar → *Adicionar à Tela de Início*. Vira um app de verdade, em tela cheia.

## 🧰 Tecnologia

React 19 · TypeScript · Vite · Tailwind CSS v4 · Framer Motion · Zustand · Spotify Web API + Web Playback SDK · [LRClib](https://lrclib.net) (letras) · Google Translate / DeepL / MyMemory (tradução).

O site é **100% estático** — perfeito para o GitHub Pages. Os recursos
opcionais (sincronização, tradutor premium e conversa por IA) usam Edge
Functions do Supabase, também sem servidor próprio.

---

## 🚀 Como colocar no ar (passo a passo)

### 1. Crie um app no Spotify (grátis)

1. Acesse o [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) e clique em **Create app**.
2. Dê um nome (ex.: *CantAlice*) e uma descrição.
3. Em **Redirect URIs**, adicione **os dois** endereços abaixo (ajuste para o seu usuário/repositório):
   - Produção (GitHub Pages): `https://SEU_USUARIO.github.io/CantAlice/`
   - Desenvolvimento local: `http://127.0.0.1:5173/`
4. Em **APIs used**, marque **Web Playback SDK**.
5. Salve e copie o **Client ID** (ele é público — pode ficar visível).

> ⚠️ O endereço em *Redirect URIs* precisa bater **exatamente** com o do site, incluindo a barra `/` no final.

### 2. Coloque o Client ID

Você tem duas opções:

**Opção A — no código** (mais simples): abra `src/config.ts` e substitua
`PASTE_YOUR_SPOTIFY_CLIENT_ID_HERE` pelo seu Client ID.

**Opção B — via GitHub** (não toca no código): em **Settings → Secrets and
variables → Actions → Variables**, crie uma variável chamada
`SPOTIFY_CLIENT_ID` com o seu Client ID. O deploy usa esse valor
automaticamente.

### 3. Ative o GitHub Pages

Em **Settings → Pages → Build and deployment**, escolha **Source: GitHub Actions**.

### 4. Faça o deploy

Dê `push` na branch `main` (ou rode o workflow manualmente em **Actions →
Deploy to GitHub Pages → Run workflow**). Em ~1 minuto o site estará no ar em:

```
https://SEU_USUARIO.github.io/CantAlice/
```

> Se o seu repositório tiver outro nome, ajuste o `base` em `vite.config.ts`
> (ou defina a variável de ambiente `BASE_PATH`).

---

## 🔑 Liberar acesso para outras pessoas

O app do Spotify começa em **Development Mode**, então só contas que você
adicionar (em **Dashboard → seu app → User Management**) conseguem conectar.
Para facilitar, o site tem um botão **"Pedir acesso"**: quem for barrado
informa o e-mail do Spotify e envia para você num toque.

Para o envio em um toque, defina (opcional) o seu contato — como variáveis de
build ou editando `OWNER` em `src/config.ts`:

- `VITE_OWNER_WHATSAPP` — só números, com código do país (ex.: `5511999998888`)
- `VITE_OWNER_EMAIL` — seu e-mail

Sem isso, o botão ainda funciona oferecendo "copiar mensagem".

---

## ☁️ Sincronização na nuvem (opcional, mas recomendado)

Por padrão, o progresso (músicas, vocabulário, sequência) fica salvo **no
navegador** (localStorage). Isso é privado e simples, mas no iOS pode ser
apagado ao limpar dados do Safari e **não sincroniza entre aparelhos**.

Ative a **sincronização na nuvem** para que o progresso fique **vinculado à
conta do Spotify** e acompanhe a Alice no iPad e no celular. Usamos o
[Supabase](https://supabase.com) (gratuito) — sem servidor próprio.

1. Crie um projeto grátis no [Supabase](https://supabase.com/dashboard).
2. **SQL Editor → New query**: cole e rode o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql) (cria a tabela e tranca o acesso
   com RLS).
3. **Edge Functions → Create a function**, nome **`progress`**, cole o conteúdo
   de [`supabase/functions/progress/index.ts`](supabase/functions/progress/index.ts)
   e **Deploy**. (Ou via CLI: `supabase functions deploy progress`.)
   - ⚠️ **Desligue "Verify JWT"** na função (Settings da função). As novas chaves
     do Supabase (`sb_publishable_…`) não são JWT, então com o gate ligado a
     função recusa toda chamada do app. É seguro desligar: a `progress` confere a
     identidade pelo token do Spotify por conta própria.
4. Em **Project Settings → API**, copie o **Project URL** e a **anon public key**.
5. No GitHub, em **Settings → Secrets and variables → Actions → Variables**,
   crie duas variáveis:
   - `SUPABASE_URL` → o Project URL (ex.: `https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` → a anon public key
6. Rode o deploy de novo. Pronto — ao conectar o Spotify, o progresso passa a
   sincronizar entre os aparelhos.

**Como é seguro:** a *anon key* é pública por natureza. A tabela fica trancada
por RLS (ninguém acessa direto com ela). Só a Edge Function acessa os dados, e
ela **verifica a identidade pelo token do Spotify** (chama `/me`), então cada
pessoa só lê/grava o próprio progresso. A *service role key* nunca sai do
Supabase.

> Sem essas variáveis, o app continua funcionando normalmente, só que o
> progresso fica apenas no aparelho.

---

## 🌎 Tradutor + exemplos (opcional: DeepL)

O app tem uma aba **Tradutor** (estilo Reverso Context): traduz palavras/frases e
mostra **exemplos reais bilíngues** (do [Tatoeba](https://tatoeba.org), corpus
aberto), que dá pra guardar direto no baralho de revisão.

A tradução já funciona sem configurar nada (usa o Google gratuito). Para usar o
**DeepL** (qualidade ainda melhor), publique a segunda Edge Function e guarde a
chave como **secret** (ela nunca vai para o navegador):

1. **Edge Functions → Create a function**, nome **`translate`**, cole o conteúdo
   de [`supabase/functions/translate/index.ts`](supabase/functions/translate/index.ts)
   e **Deploy**. (Ou via CLI: `supabase functions deploy translate`.)
   - ⚠️ **Desligue "Verify JWT"** nesta função também — senão o app cai no Google
     + Wiktionary (sem DeepL nem Tatoeba). É seguro desligar: assim como a
     `progress` e a `converse`, a `translate` confere a identidade pelo token do
     Spotify por conta própria (ela gasta cota paga de DeepL/Claude, então não é
     um endpoint aberto). Quem usa a CLI já recebe isso via
     [`supabase/config.toml`](supabase/config.toml).
2. Pegue uma chave grátis em [DeepL API Free](https://www.deepl.com/pro-api)
   (500 mil caracteres/mês) e guarde como secret:
   - No painel: **Edge Functions → translate → Secrets → Add** `DEEPL_API_KEY`.
   - Ou via CLI: `supabase secrets set DEEPL_API_KEY=suachave:fx`
     (a chave grátis termina em `:fx`).

Sem o DeepL, a função ainda serve os exemplos do Tatoeba e a tradução cai no
Google automaticamente. O Tatoeba é proxyado pela função porque não tem CORS.

### 🗣️ Parceiro de conversa com IA (opcional)

A aba **Conversar** usa a função `converse`, que faz numa só chamada:
voz → texto (Whisper), resposta do tutor (Claude) e texto → voz (OpenAI TTS).
Ela se autentica pelo token do Spotify do usuário (não é um endpoint aberto).

A aba tem dois modos, atendidos pela mesma função:

- **💬 Direto** — você fala no idioma que está aprendendo e o tutor responde.
- **🪞 Espelho** — você fala **em português** o que quer dizer (o Whisper ouve em
  `pt`), o Claude devolve a frase pronta no idioma-alvo, o TTS fala, você repete
  no microfone e ganha a nota por palavra. Repetiu bem? A frase entra sozinha na
  conversa — e a resposta do tutor vem com a tradução em português embaixo.

**Microfone:** nos dois modos o reconhecimento do navegador roda em modo
contínuo e só fecha quando a pessoa manda — tocando em **Pronto** (espelho) ou
tocando de novo no microfone (direto). Pausar no meio da frase não corta a
fala: se o navegador encerrar a sessão no silêncio (o Chrome faz isso), o app
guarda o que já ouviu e reabre o microfone sozinho. Onde o navegador se recusa
a escutar (caso clássico: app instalado na tela de início do iPhone/iPad, onde
o Safari expõe a API mas não deixa usar), o app grava e manda para a função
transcrever (`mode: 'hear'` — só Whisper, sem Claude nem TTS). Se nem gravar
der, ela ainda pode escrever em português e ler a frase em voz alta antes de
enviar.

> Se você já tinha a função publicada, **republique a `converse`** para o modo
> espelho funcionar (o app continua funcionando no modo direto sem isso).

1. **Edge Functions → Create a function**, nome **`converse`**, cole
   [`supabase/functions/converse/index.ts`](supabase/functions/converse/index.ts),
   **Deploy** e **desligue "Verify JWT"** (a CLI já aplica via `config.toml`).
2. Guarde as duas chaves como secrets:
   - `supabase secrets set ANTHROPIC_API_KEY=...` (chat com Claude)
   - `supabase secrets set OPENAI_API_KEY=...` (Whisper STT + TTS)
   - Sem as duas, a função responde `503` e a aba mostra um aviso de "não
     configurado" — nada quebra.
3. **Quem pode usar (protege seus créditos pagos):** em *Development mode* o
   Spotify já só deixa logar quem está na lista de **User Management** do seu app
   — ou seja, só os membros chegam até aqui. Para travar também no servidor
   (e continuar travado se um dia for para Production), defina os IDs de usuário
   do Spotify permitidos:
   - `supabase secrets set ALLOWED_SPOTIFY_USERS="id1,id2,id3"`
   - O ID do Spotify de alguém está no link do perfil: **Perfil → ⋯ →
     Compartilhar → Copiar link**, em `open.spotify.com/user/<ID>`.
   - Se a variável ficar vazia, qualquer usuário logado é aceito (confiando no
     Development mode). Quem não está na lista recebe `403`.
   - A mesma lista também vale para a função `translate` (que gasta cota de
     DeepL/Claude) — um secret só protege as duas.
   - Sem créditos de IA, a aba avisa para falar com o responsável.

### 🚀 Deploy automático das funções

Com o secret de repositório **`SUPABASE_ACCESS_TOKEN`** (GitHub → Settings →
Secrets and variables → Actions), o workflow
[`deploy-functions.yml`](.github/workflows/deploy-functions.yml) roda
`supabase functions deploy` sempre que algo em `supabase/functions/**` muda —
sem deploy manual.

> ⚠️ **Sem o secret, esse workflow falha de propósito.** Antes ele era pulado
> "sem erro", e o resultado foi correção de função parada meses atrás de um
> check verde, com todo mundo achando que já estava no ar. Um ✗ vermelho aqui
> significa: *as funções no Supabase estão mais velhas que este repositório*.
> Depois de configurar o secret, dá para publicar na hora sem esperar o próximo
> push, em **Actions → Deploy Supabase functions → Run workflow**.

### 💤 Evitando a pausa automática do Supabase

Projetos gratuitos do Supabase pausam sozinhos depois de **7 dias sem
atividade** na API. O workflow
[`keep-supabase-alive.yml`](.github/workflows/keep-supabase-alive.yml) faz uma
chamada leve à API REST duas vezes por semana (segunda e quinta) usando as
mesmas variáveis `SUPABASE_URL`/`SUPABASE_ANON_KEY` da sincronização na
nuvem — sem elas configuradas, o job é pulado sem erro.

---

## 💻 Rodando localmente

```bash
npm install
npm run dev      # http://127.0.0.1:5173/
```

> Use **127.0.0.1**, não `localhost` — o Spotify exige o IP de loopback no redirect URI.

Outros comandos:

```bash
npm run build    # gera o site otimizado em dist/
npm run preview  # serve o build localmente
npm run lint     # checagem de tipos (tsc)
```

---

## 🎧 Premium vs. conta grátis

| Recurso | Premium | Grátis |
| --- | :---: | :---: |
| Tocar a música **inteira** | ✅ | ❌ (prévia de 30s) |
| Letra **sincronizada** (karaokê) | ✅ | ⚠️ letra estática |
| Tradução + vocabulário | ✅ | ✅ |

A sincronização em tempo real depende do **Web Playback SDK**, que só funciona
com Spotify Premium. Sem Premium, a Alice ainda ouve a prévia, lê a letra
completa, vê as traduções e monta o vocabulário.

---

## 📁 Estrutura

```
src/
  config.ts            # Client ID, scopes, idiomas e endpoints
  spotify/             # auth (PKCE), Web API, Web Playback SDK
  lyrics/              # LRClib (letras) + tradução
  content/             # frases úteis (phrasebook)
  lib/                 # voz (falar/ouvir), idioma e conversa
  srs/                 # repetição espaçada (FSRS)
  store/               # estado (Zustand): biblioteca, sessão, navegação
  sync/                # sincronização na nuvem (Supabase)
  hooks/               # player e reprodução do karaokê
  components/          # UI (aurora, nav, letras, player, etc.)
  pages/               # Início, Buscar, Músicas, Vocabulário, Tradutor, Frases, Conversar, Progresso, Karaokê
supabase/              # schema SQL + Edge Functions (progress, translate, converse)
```

---

Feito com 💛 para a Alice cantar e aprender.

> ⚠️ **Aviso:** o **Juninho** passou por aqui e fez umas mudanças — auditoria
> completa, uns bugs a menos, uns acentos a mais. Se algo aparecer diferente,
> foi ele. 😄🎶
