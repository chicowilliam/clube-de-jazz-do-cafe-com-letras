# Clube de Jazz do Café com Letras · site

Site estático do Clube de Jazz do Café com Letras (Rua Antônio de Albuquerque, 47, Savassi, Belo Horizonte), feito a partir do protótipo aprovado no Claude Design (novembro de 2026). Foi pensado para publicação no **Cloudflare Pages**.

- **Sem framework e sem dependências.** O build é um script Node.js (`scripts/build.mjs`) que monta HTML puro. Não há `npm install` obrigatório.
- **A fidelidade visual vem do protótipo.** Os estilos de cada bloco são os mesmos do design (inline), com ajustes de responsividade em `src/assets/css/site.css`.
- **A agenda é gerada por dados.** `src/data/shows.json` alimenta a Home, a Agenda, a Escola do Jazz, as páginas de show, o JSON-LD, os `.ics` e o sitemap.

## Requisitos

- Node.js 18 ou superior (testado com Node 22). Veja `.nvmrc`.
- Opcional: `wrangler` (CLI da Cloudflare) para rodar a Function de formulários localmente.

## Comandos

```bash
npm run build     # gera dist/
npm run check     # confere links, imagens, títulos, descrições, alt, placeholders
npm test          # build + check
npm run preview   # serve dist/ em http://localhost:8788 (sem as Functions)
npm run dev       # build + preview
npm run pages:dev # (requer internet) roda dist/ + functions/ com wrangler
```

Variáveis de ambiente: veja `.env.example`. Nenhuma é obrigatória para o build.

## Estrutura

```
src/
  pages/          páginas (corpo HTML) com marcadores <!--@header-->, <!--@footer-->, <!--@agenda-list--> etc.
  partials/       cabeçalho e rodapé (versão da Home e versão das demais páginas)
  templates/      moldes repetidos: card da semana, item da agenda, linha da Escola, página de show
  data/           shows.json (programação), site.json (contato, endereço, redes), nav-styles.json
  assets/         css, js, fontes (Sharp Grotesk) e imagens otimizadas
public/           arquivos copiados como estão: favicons, _headers, _redirects, manifest
functions/api/    forms.js — Cloudflare Pages Function que repassa os formulários a um webhook
scripts/          build.mjs, check.mjs, serve.mjs
source-design/    código-fonte original do protótipo no Claude Design (.dc.html + canvas.json), só para referência
dist/             saída do build (não versionar)
```

## Rotas

| Rota | Página |
|---|---|
| `/` | Home (abertura com fotos, próximo show, semana, Escola do Jazz, festivais) |
| `/agenda/` | Próximos shows com filtro por estilo |
| `/shows/<data>-<slug>/` | Página de cada show (+ `evento.ics`) |
| `/ao-vivo/` | Transmissões e vídeos no YouTube |
| `/escola-do-jazz/` | A Escola do Jazz e ensaios abertos |
| `/festivais/` | Só Bigs, Piano Duo e festivais parceiros |
| `/eventos/` | Eventos corporativos |
| `/cardapio/` | Cozinha e bar (abas; `/cardapio/#bar` abre o bar) |
| `/o-clube/` | O Clube e Amigos do Clube (`#amigos`) |
| `404.html` | Página não encontrada |

## Atualizar a programação

Edite `src/data/shows.json` (um objeto por show; o formato está descrito em `TRANSFERENCIA_TECNICA.md`), coloque a foto em `src/assets/img/shows/` e rode `npm run build`. Shows com data anterior a hoje somem da agenda e do sitemap automaticamente, mas a página continua existindo. Como o site é estático, a agenda só "anda" quando há um novo build: veja a seção *Rebuild diário* em `TRANSFERENCIA_TECNICA.md`.

## Publicar no Cloudflare Pages

1. Suba esta pasta para um repositório no GitHub (privado ou público).
2. Cloudflare > Workers & Pages > Create > Pages > *Connect to Git* > escolha o repositório.
3. Configuração de build:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: (vazio)
   - Variável `NODE_VERSION` = `22`
4. Em *Settings > Environment variables*, cadastre `SITE_URL` e, quando houver, `FORMS_WEBHOOK_URL`, `FORMS_WEBHOOK_SECRET`, `CF_WEB_ANALYTICS_TOKEN`.
5. Confira a prévia em `*.pages.dev` antes de qualquer mudança de domínio.

**Domínio:** este pacote não altera DNS nem domínios. A troca de `clubedejazzdocafe.com` para o novo site é uma decisão do Clube e está descrita, passo a passo, em `TRANSFERENCIA_TECNICA.md`.

## Outros documentos

- `TRANSFERENCIA_TECNICA.md` — arquitetura, dados, integrações, segurança, deploy, domínio e o que foi testado.
- `PENDENCIAS.md` — o que depende de informação ou decisão do Clube.
- `PROMPT_CODEX.md` — instruções prontas para continuar o trabalho com o Codex (ou outro agente).
