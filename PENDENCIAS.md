# Pendências

O que depende de informação, decisão ou acesso do Clube. Nada aqui foi inventado ou simulado no site.

## Conteúdo e dados do Clube

- [ ] **Valores e benefícios das cotas do Amigos do Clube** (Groove, Swing, Jam Session). Bruno vai enviar.
- [ ] **Links da Risa** para cada cota (`data-pendente="escolher-groove"`, `escolher-swing`, `escolher-jam-session`), após a migração do Evoé.
- [ ] **Patrocínio de festivais** (Só Bigs, Piano Duo, Savassi Festival): destino dos botões "Quero patrocinar…" (formulário, e-mail ou PDF de cotas).
- [ ] **"Quero ser avisado da programação"** (Festivais): ligar à newsletter ou a uma lista específica.
- [ ] **Arquivo de shows passados**: decidir se existirá no novo site (`data-pendente="arquivo-shows-passados"`).
- [ ] **Versão em inglês**: decidir se haverá (link "EN" em todas as páginas).
- [x] **Telefone**: confirmado (31) 98424-4285 (WhatsApp) para todo o site (23/11/2026).
- [ ] **Cardápio**: decidido (23/11/2026) manter preços e itens do cardápio do site atual. Descrições que faltavam e itens ausentes foram completados com a carta em PDF de fev/2025. Os 45 itens incluídos a partir dessa carta (clássicos extras, vinhos, doses, destilados, cafés, águas e sucos) estão marcados com `data-fonte="cardapio-fev25"` em `src/pages/cardapio.html` e usam os **preços de fev/2025**: conferir preços e disponibilidade (sobretudo vinhos e safras) antes de publicar.
- [ ] **Releases dos shows** em `src/data/shows.json`: copiados do site atual sem revisão. Regra do Clube: revisar antes de publicar (há, por exemplo, "Inspirada" com maiúscula no meio da frase no show de 25/11).
- [ ] **Acessibilidade física**: o site não afirma acessibilidade (a casa ainda não tem rampa). Atualizar quando houver.
- [ ] **Créditos de fotos**: as fotos da abertura têm crédito (Flávio Charchar / Savassi Festival 2024). Confirmar créditos das demais (salão, piano, Nova Onda, fotos dos shows).

## Técnico

- [ ] **Destino dos formulários**: escolher a ferramenta (Make, Zapier, Google Apps Script → planilha, CRM, plataforma de e-mail) e cadastrar `FORMS_WEBHOOK_URL` (+ `FORMS_WEBHOOK_SECRET`) no Cloudflare Pages.
- [ ] **Fonte de dados da agenda**: hoje é `shows.json` editado à mão. Avaliar leitura automática da planilha de programação ou do admin atual.
- [ ] **Rebuild diário** por Deploy Hook (de madrugada) para a agenda andar sozinha.
- [ ] **Cloudflare Web Analytics**: criar e cadastrar `CF_WEB_ANALYTICS_TOKEN`.
- [ ] **Licença web da fonte Sharp Grotesk**: confirmar que a licença da IDV cobre uso em site (webfont). Só há `.woff`/`.otf`; gerar `.woff2` melhora o carregamento.
- [ ] **Google Fonts**: considerar hospedar Inter e Playfair localmente (privacidade/LGPD e desempenho).
- [ ] **Redirecionamento show a show** das URLs antigas `/show/?id=NNNN` (precisa de Function; hoje vão para `/agenda/`).
- [ ] **Admin atual**: definir onde o admin e o site antigo ficam antes de apontar o domínio.
- [ ] **Domínio**: apontar `clubedejazzdocafe.com` para o Pages só depois da aprovação da prévia (não feito neste pacote).
- [ ] **Testes não executados**: deploy real, `wrangler pages dev`, Safari/Firefox/aparelhos reais, leitores de tela, Lighthouse. Ver `TRANSFERENCIA_TECNICA.md`, seção 10.
- [ ] **Política de privacidade / LGPD**: o site coleta e-mail e dados de contato nos formulários; criar página de privacidade e link no rodapé antes de ativar o envio.
