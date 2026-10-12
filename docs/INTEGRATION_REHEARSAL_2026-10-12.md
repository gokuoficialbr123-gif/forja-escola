# Ensaio integrado — entrega de 13/10/2026, sem produção

Branch `integration/google-agenda-2026-10-12`, base frontend
`959b72f6d5a398fa3c1f0fbc79a3ce0b2436f580`. Combina PR8 `2cbbedf`,
PR9 `56fef60` e PR10 `5170c8c`; PRs originais/main não alterados.
Fonte oficial mantém API/marker/configurações; adaptadores de consentimento e
 desconexão aparecem uma vez cada. HTML integrado SHA-256:
`77260eab9fc1ba25630961e557493f1740662962ab32202aa0a5ee98b0d2f7dc`.
Guards removem exclusivamente os patches pessoais+rodapé e exigem hash do main;
não foi substituída a referência antiga por um hash arbitrário do resto do portal.
Páginas legais são idênticas às aprovadas temporariamente no PR8.

209 testes frontend passaram, incluindo Chromium desktop/mobile, regressões de
Agenda/drawer/scroll/minutos reais, publicação, central, cadastros, consentimento,
desconexão e páginas legais. Artefato de Hosting gerado/validado, NÃO publicado.

O teste backend `test/integration/combined-agenda-http.test.mjs` carrega este HTML
completo, usa Auth/Firestore reais emulados em demo-forja e API HTTP local, com
Google simulado na borda. Verifica consentimento/disconnect/callback antigo,
login teacher/admin/psychologist, editor Disponível/Ocupado, publicação semanal
do psicólogo, consulta administrativa e persistência após reload. Isso não é
OAuth real, não comprova atualização push entre dispositivos nem entrega e-mail.

**NÃO APTO para publicação ainda**: dois problemas preexistentes reproduzidos:
- liberação dos locks lê depois de escrever na transação; operações independentes
  para mesmo aluno/dia podem receber409 por até45s;
- troca de usuário no mesmo navegador conserva a semana futura/períodos de outro
  UID no editor. Reload evita estado antigo, mas não é correção definitiva.
Nenhuma dessas lógicas foi modificada. Testes de caracterização afirmam os bugs
explicitamente; não confundir testes verdes com problemas resolvidos.

Relatório completo, evidências, limitações, correções mínimas propostas e plano de
publicação/rollback no backend:
https://github.com/gokuoficialbr123-gif/forja-backend/blob/integration/google-agenda-2026-10-12/docs/INTEGRATION_REHEARSAL_2026-10-12.md

403 Google Testing depende de configuração pelo proprietário; nenhuma mudança
Cloud executada. FreeBusy central ainda NÃO alimenta Agenda/booking (Etapa4).
Limited Use integral e práticas externas IA/terceiros/acesso humano/backups não
estão declaradas concluídas. PR8 permanece sem publicação/merge.

Próximo passo: autorização para corrigir minimamente os bloqueios, regressões,
revisão do par integrado e somente depois autorização de publicação backend →
frontend. Não fazer merge/deploy/OAuth real a partir deste ensaio.
