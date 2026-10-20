# Draft — Agenda confiável com consulta automática e quatro estados

Estado: texto de PR preparado localmente; nenhum PR remoto ou Preview criado.
Base: main `86134148337c4dfa9d9979cee734d5bb48a2cd30`.
Branch: `codex/agenda-inteligente-2`.
Depende do backend da mesma branch, policy `agenda-readonly-v1`.

Eventos Google de dia inteiro, bloqueios escolares e fontes falhas podiam deixar
disponibilidade visual indevida. As duas agendas agora compõem publicação e
fontes confirmadas: verde disponível, vermelho ocupado/bloqueado, amarelo
desconhecido/verificando e cinza fora da publicação; aulas mantêm sua identificação.

O controlador consulta somente `GET /agenda/snapshot`, 20s após uma resposta
completa, enquanto a Agenda estiver aberta e visível. Há timeout, expiração,
backoff, cancelamento por sessão/período e compartilhamento entre abas. O polling
não aciona sync Google. A grade preserva filtros, semana, scroll e formulários.
A hora da consulta completa é distinta da última sincronização Google; falha
parcial não produz mensagem de sucesso global.

O fonte gerado mantém reversão exata até o main auditado e todos os guards
anteriores. Ajustes Windows normalizam somente finais de linha/paths e exercitam
uma junction real na prova de arquivo regular. Páginas legais e prova pública
mantêm seus bytes; o artefato Hosting conserva a allowlist explícita.

Validação e evidências: `QA_AGENDA_INTELIGENTE_2_2026-10.md` e
`evidence/agenda2/`. Detalhes e limites: `AGENDA_INTELIGENTE_2_2026-10.md`.

Revisar especialmente sessão/TTL, hooks de renderização e composição das cores.
Fontes lentas, quotas ou backend ausente deixam a tela desconhecida. A consulta
visual não substitui a validação final da reserva. Sem garantia de propagação
Google em 20s nem promessa de cold start Free. Publicação exige autorização
específica, backend primeiro; verificar gatilhos Render antes de push/PR remoto.
