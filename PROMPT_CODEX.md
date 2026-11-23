# Prompt para o Codex (ou outro agente de código)

Copie o bloco abaixo como primeira mensagem ao abrir este repositório no Codex.

---

Você vai dar continuidade ao site do **Clube de Jazz do Café com Letras** (Savassi, Belo Horizonte). Responda e escreva textos do site em **português do Brasil**.

**Contexto**
- Site estático, sem framework e sem dependências. Build: `node scripts/build.mjs` → `dist/`. Verificação: `node scripts/check.mjs`. Hospedagem: Cloudflare Pages (saída `dist`, comando `npm run build`, `NODE_VERSION=22`).
- Leia antes de mexer: `README.md`, `TRANSFERENCIA_TECNICA.md` e `PENDENCIAS.md`.
- O visual é fiel a um protótipo aprovado (código de referência em `source-design/`). **Não redesenhe.** Mudanças visuais só quando pedidas.
- Programação em `src/data/shows.json`; contato e redes em `src/data/site.json`.

**Regras**
1. Não invente eventos, preços, fotos, nomes, contatos ou integrações. Se faltar informação, deixe o link com `href="#"` e `data-pendente="<chave>"` e registre em `PENDENCIAS.md`.
2. Nada de credenciais no código. Variáveis novas vão em `.env.example` e na documentação.
3. Títulos grandes de página não levam ponto final.
4. Releases de artistas precisam de revisão humana antes de publicar.
5. Não altere DNS nem domínios, e não publique em produção sem autorização do Clube.
6. Ao terminar cada tarefa, rode `npm test` (build + check) e só diga que algo foi testado se você realmente executou o teste.
7. Se incluir script ou iframe externo, atualize a CSP em `public/_headers`.

**Primeiras tarefas sugeridas** (confirme a prioridade com o Clube):
1. Ligar `functions/api/forms.js` ao webhook escolhido e testar com `npx wrangler pages dev dist`.
2. Criar a página de privacidade (LGPD) e o link no rodapé.
3. Automatizar a agenda: gerar `shows.json` a partir da fonte oficial (planilha de programação ou admin atual) e agendar um rebuild diário de madrugada por Deploy Hook.
4. Redirecionar `/show/?id=NNNN` para `/shows/<slug>/` com uma Pages Function, usando o campo `id` de `shows.json`.
5. Converter a fonte Sharp Grotesk para `.woff2` (se a licença permitir) e hospedar Inter/Playfair localmente.
6. Rodar Lighthouse e testes em Safari/iOS e Android; corrigir o que aparecer sem alterar o design.
