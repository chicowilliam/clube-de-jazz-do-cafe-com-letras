# Vídeos do canal oficial

A home busca quatro vídeos públicos em `/api/youtube?feed=archive`. A Function percorre a playlist oficial de uploads em até 40 páginas de 50 itens, confirma via `videos.list` que os selecionados estão processados e disponíveis no Brasil e usa uma ordem pseudoaleatória por ciclo. Prioriza vídeos ausentes da seleção anterior. A primeira visita de cada ciclo global de 48 h, contado a partir do epoch UTC, atualiza o snapshot no Workers KV. O cache HTTP expira na mesma virada.

Falhas preservam o último snapshot válido por até 30 dias. O retry aguarda uma hora em caso de HTTP 403/429 e cinco minutos nas demais falhas. Sem snapshot, os quatro cards editoriais continuam disponíveis. O cabeçalho `X-YouTube-Cache` indica o resultado da consulta.

O ambiente de produção do Pages usa o secret `YOUTUBE_API_KEY` e seu próprio binding `YOUTUBE_CACHE`. Para rotacionar, crie uma chave restrita à YouTube Data API v3, substitua o secret no Cloudflare, publique a configuração e valide uma atualização antes de revogar a chave anterior. Restrinja a invalidação do cache ao snapshot do ambiente que estiver sendo testado.
