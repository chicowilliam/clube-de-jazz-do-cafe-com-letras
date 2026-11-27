# Transferência técnica

Documento para o desenvolvedor que vai assumir o site do Clube de Jazz do Café com Letras. Data do pacote: 23/11/2026.

## 1. Origem e o que é este projeto

- O design foi aprovado como protótipo no **Claude Design** (canvas com 11 componentes `.dc.html`). O código original está em `source-design/` apenas como referência; ele **não** é usado no build.
- Cada página do protótipo foi exportada para HTML estático por script. Os estilos inline do design foram preservados (fidelidade 1:1). Tamanhos de fonte grandes viraram `clamp()` e grades com `minmax(Npx, 1fr)` viraram `minmax(min(Npx, 100%), 1fr)`, para funcionar no celular.
- As partes repetidas (cabeçalho, rodapé, card de show, item de agenda, página de show) foram extraídas para `src/partials` e `src/templates` e são preenchidas com `src/data/*.json`.

## 2. Arquitetura

| Camada | Arquivo(s) | Função |
|---|---|---|
| Dados | `src/data/shows.json`, `site.json`, `nav-styles.json` | Programação, contato, estilos do menu ativo/inativo |
| Páginas | `src/pages/*.html` | Corpo de cada página com marcadores `<!--@…-->` |
| Partials | `src/partials/header*.html`, `footer*.html` | Versão Home (com chancela de patrocínio grande) e versão interna |
| Templates | `src/templates/*.html`, `show-parts.json` | Moldes com `{{placeholders}}` |
| Build | `scripts/build.mjs` | Monta `<head>` (SEO, OG, JSON-LD), páginas, shows, `.ics`, sitemap, robots |
| Verificação | `scripts/check.mjs` | Falha o build se houver link interno quebrado, imagem sem `alt`, placeholder sobrando etc. |
| Interações | `src/assets/js/site.js` | Slideshow, filtro da agenda, abas do cardápio, envio de formulários, compartilhar |
| Estilo global | `src/assets/css/site.css` | `@font-face`, foco visível, ajustes de celular, `prefers-reduced-motion` |
| Backend | `functions/api/forms.js` | Pages Function: valida e repassa formulários a um webhook |
| Hospedagem | `public/_headers`, `public/_redirects` | Cabeçalhos de segurança/cache e redirecionamentos do site antigo |

Não há bundler, framework nem `node_modules`. Isso é intencional: o site é pequeno, e qualquer pessoa consegue editar HTML e JSON.

## 3. Identidade visual (tokens)

| Token | Valor | Uso |
|---|---|---|
| Fundo | `#0F0E0D` | Fundo geral |
| Texto | `#F2ECE1` | Texto principal |
| Texto secundário | `#D9D1C4`, `#B9B0A3` | Parágrafos, legendas |
| Mostarda | `#DEAC00` | Botões, destaques, sobretítulos |
| Lilás | `#EFADFF` | Subtítulos em itálico, filtro ativo |
| Azul | `#0000DE` | Peças da IDV |
| Verde | `#0C2E00` | Peças da IDV |
| Vermelho | `#C1272D` | Peças da IDV |

Tipografia: **Sharp Grotesk Black 15** (títulos, caixa alta, peso 900; arquivo em `src/assets/fonts`), **Playfair Display itálico** (subtítulos; Google Fonts) e **Inter** (texto; Google Fonts). Regra editorial do Clube: títulos grandes de página **sem ponto final**.

## 4. Formato de `src/data/shows.json`

```jsonc
{
  "id": 1310,                       // id do show no site atual (referência)
  "slug": "2026-11-25-magno-alexandre-quarteto-standards-de-jazz", // vira /shows/<slug>/
  "date": "2026-11-25",             // AAAA-MM-DD
  "weekday": "Quarta",
  "title": "Magno Alexandre Quarteto: Standards de Jazz", // "Banda: complemento" ou "Banda - complemento" é dividido no título
  "subtitle": "Jazz e Vinhos - Rolha Free",
  "tags": ["Jazz"],                 // texto exibido
  "categories": ["jazz"],           // filtros: jazz, instrumental, minas, vocal, bigband, escola
  "times": [{ "label": "Abertura da casa", "value": "19:00" }, { "label": "Primeiro Set", "value": "20:00" }, { "label": "Segundo Set", "value": "21:30" }],
  "prices": [{ "label": "Área Interna", "value": "R$ 40,00" }, { "label": "Área Externa", "value": "R$ 20,00" }],
  "tickets_url": "https://bileto.sympla.com.br/event/129239",
  "tickets_label": "Garanta o seu lugar",
  "youtube": "_QC5sHhGwXo",         // só o ID; vazio = sem bloco de vídeo
  "image": "/assets/img/shows/1310.jpg",
  "description": ["parágrafo 1", "parágrafo 2"],
  "formation": [{ "name": "Magno Alexandre", "role": "guitarra" }], // role vazio = subtítulo de grupo
  "source_url": "https://clubedejazzdocafe.com/show/?id=1310",
  "escola": false                   // true = aparece na Escola do Jazz e na Home
}
```

Os 14 shows incluídos (23/11 a 05/12/2026) foram **copiados do site atual** em 23/11/2026, com fotos baixadas de lá. Nada foi inventado; os releases não passaram por revisão editorial (regra do Clube: revisar antes de publicar).

Horários: o build converte `20:00` em `20h` e `21:30` em `21h30`. Fuso: `-03:00` fixo (o Brasil não tem horário de verão desde 2019).

## 5. Rebuild diário (agenda "andando")

A publicação no Cloudflare Pages executa `npm run build` com a programação de `src/data/shows.json`. O build gera HTML completo para cada mudança programada e um índice para a Pages Function. Em cada acesso, a Function seleciona a versão da home, da agenda e das páginas relacionadas usando o fuso `America/Sao_Paulo`. As mudanças da data e os encerramentos cadastrados entram em vigor sem rebuild, cron ou Deploy Hook. As respostas das páginas variáveis usam `Cache-Control: no-store`. As novas datas entram no ar na próxima publicação do conteúdo.

Para conferir a seleção automática localmente, rode `npm run build` e `npm run pages:dev` na raiz do projeto. `BUILD_DATE` simula a data inicial do build. A Function usa o relógio do Cloudflare na publicação.

Evolução natural: trocar `shows.json` por uma fonte viva (a planilha de programação do Clube, o admin atual ou um CMS headless) lida no build. Não foi feito porque exige credenciais e decisão do Clube.

## 6. Integrações externas

| Integração | Estado no pacote | O que falta |
|---|---|---|
| Sympla / Bileto (ingressos) | Links reais por show (`tickets_url`), abrem em nova aba | Nada técnico. Não há API integrada |
| YouTube | Links para vídeos/canal reais, miniatura `i.ytimg.com` | Opcional: embed sob clique (adicionar `frame-src` na CSP) |
| Formulários (newsletter, festivais, eventos, Escola) | `POST /api/forms` → `functions/api/forms.js` → webhook | Definir destino e cadastrar `FORMS_WEBHOOK_URL`. Sem ele, o visitante vê "envio ainda não está ativo" e o e-mail de contato (nada é simulado) |
| Amigos do Clube (cotas Groove, Swing, Jam Session) | Botões marcados `data-pendente` | Link da página de cada cota na **Risa** (migração do Evoé) |
| Cloudflare Web Analytics | Beacon inserido se `CF_WEB_ANALYTICS_TOKEN` existir | Criar o site no painel e copiar o token |
| Versão em inglês | Link "EN" marcado `data-pendente` | Decidir se haverá versão em inglês |
| Google Fonts | Inter e Playfair via `fonts.googleapis.com` | Opcional: hospedar localmente (LGPD/desempenho) |

Links pendentes têm `href="#"` e `data-pendente="<chave>"`; o JS impede a navegação e registra no console. `npm run check` informa quantos existem. Lista completa em `PENDENCIAS.md`.

## 7. SEO

- `<title>`, `meta description`, `canonical`, Open Graph e Twitter Card em todas as páginas (`SITE_URL` define o domínio).
- JSON-LD: `MusicVenue` na Home, `ItemList` na Agenda, `MusicEvent` em cada show (com `offers` quando a venda é no Sympla).
- `sitemap.xml` (só páginas fixas e shows futuros) e `robots.txt` gerados no build.
- `404.html` com `noindex`.
- Imagem de compartilhamento: `src/assets/img/og-clube-de-jazz.jpg` (1200x630).
- Favicons e `site.webmanifest` em `public/`.

## 8. Segurança

- `public/_headers`: HSTS, CSP restritiva (só o próprio domínio, Google Fonts, `i.ytimg.com` e Cloudflare Insights), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Se adicionar embed do YouTube, Sympla em iframe ou outro script externo, **atualize a CSP**.
- Nenhuma credencial no repositório. Segredos só em *Cloudflare Pages > Environment variables* (ou `.dev.vars` local, ignorado pelo git).
- A Function de formulários: limita tamanho (4 KB), valida e-mail, aceita só formulários conhecidos, descarta robôs (campo-isca `website`), restringe origem (`ALLOWED_ORIGINS`) e não grava dados.
- HTTPS: automático no Cloudflare Pages; HSTS ativo pelo `_headers`.

## 9. Domínio (não executado)

Este pacote **não** altera DNS nem domínios. Quando o Clube decidir trocar o site atual pelo novo:

1. Publique e aprove a prévia em `*.pages.dev`.
2. Confira se o admin atual (`/admin/`) e as páginas `/show/?id=` precisam continuar acessíveis (ex.: num subdomínio como `antigo.clubedejazzdocafe.com`) antes de apontar o domínio.
3. Em *Pages > Custom domains*, adicione `clubedejazzdocafe.com` e `www`. Se a zona DNS já estiver na Cloudflare, o registro é criado pelo painel; se não, a Cloudflare indica o CNAME a criar no provedor atual.
4. Defina `SITE_URL=https://clubedejazzdocafe.com` e refaça o deploy.
5. Envie o `sitemap.xml` no Google Search Console.

`public/_redirects` já leva `/shows/`, `/show/`, `/club/`, `/amigos/`, `/menu/` e `/old/` para as novas rotas. O Cloudflare Pages não diferencia parâmetros de query, então `/show/?id=1310` vai para `/agenda/`, não para o show específico. Para redirecionar show a show seria preciso uma Function lendo `id` (os ids antigos estão em `shows.json`).

## 10. O que foi testado (e o que não foi)

Executado de fato neste ambiente (Linux, Node 22, Chromium/Chrome via Playwright, **sem acesso à internet**):

- `npm run build` e `npm run check`: 23 páginas HTML, 83 arquivos, 647 referências internas, **0 erros**.
- Servidor local (`npm run preview`) com as 10 rotas principais em **1440x900** e **390x844**: status HTTP corretos (200; 404 para rota inexistente), **sem rolagem horizontal**, fonte Sharp Grotesk carregada, nenhum erro de JavaScript. Os únicos erros de console foram recursos externos bloqueados pela falta de internet (miniaturas do YouTube).
- Interações: filtro da agenda (14 → 3 shows em "Escola do Jazz", contador atualizado), abas do cardápio, troca de slide e legenda da Home, envio da newsletter (mostra o aviso de envio inativo, como esperado sem a Function).
- `functions/api/forms.js` chamada diretamente em Node com `Request` simulado: 503 sem webhook; 200 e repasse correto com webhook; 400 para e-mail inválido e formulário desconhecido; 403 para origem não permitida; honeypot ignorado; 405 em GET.
- Comparação visual das capturas com o protótipo aprovado (Home, show, agenda).

**Não** testado:

- `wrangler pages dev` e um deploy real no Cloudflare Pages (sem internet e sem conta neste ambiente). `_headers`, `_redirects` e a Function seguem a documentação da Cloudflare, mas não foram executados na plataforma.
- `npm install`: não é necessário (não há dependências); não foi rodado.
- Safari, Firefox e aparelhos reais; leitores de tela.
- Carregamento real do Google Fonts e das miniaturas do YouTube.
- Envio real de formulário para um webhook.
- Lighthouse/PageSpeed.
