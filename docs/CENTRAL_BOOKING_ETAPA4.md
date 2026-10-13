# Etapa 4 — Agenda central e demonstração sintética

Preparado em 13/10/2026, somente PR/Preview. Base de sessões corrigida
`a1fc2538ccc97da9eecb57c0aedb7754a9c76513`; main conferido
`959b72f6d5a398fa3c1f0fbc79a3ce0b2436f580`. PRs anteriores preservados.

## Portal

Agenda administrativa consulta ocupado central sob demanda para o intervalo visível.
Mês de42dias é particionado em31+11. Mesma promessa para requests concorrentes, cache
<=60s/8janelas, sem timer novo. UID+geração e sessão do API guardam cada resposta,
erro e gravação de estado; mudança de usuário esvazia caches, inclusive esta fonte.

Google central soma somente Ocupado. Falha/resultado sem receipt válido não mostra
verde para o profissional afetado; aulas permanecem. Retorna aviso operacional.
Professor/psicólogo não recebem dados administrativos centrais na própria Agenda.
Drawer montado, layout, geometria/fuso, publicação confirmada e elegibilidade
permanecem; slots vêm somente do backend com duas provas: confirmed-week-v2 e
central-booking-fail-closed-v1. Backend antigo é recusado, não fallback.

## Preview seguro

Modo explícito `<!-- FORJA_PREVIEW_BACKEND=agenda-demo -->`.
`node scripts/prepare-hosting.mjs --agenda-demo` inclui o double somente no artefato.
SDK Auth real removido; API/fetch, XHR/WebSocket/EventSource e beacon bloqueados ou
simulados. Nenhum request real de Google/API/Auth/email. Fonte index.html/live
permanece sem doubles e com API oficial. Workflow de produção continua restrito
a push main autorizado; modo demo não pode alterar essa geração.

O Preview público é uma **demonstração**, não um backend Firebase isolado. A prova
dos controles reais vem dos testes HTTP/Chromium com Auth/Firestore emulados
demo-forja e Google simulado. Render Preview continua somente leitura porque pode
compartilhar produção. Não realizar escrita/Google OAuth real nele nesta tarefa.

## Roteiro para Roberta

1. Abrir Preview; conferir banner DEMONSTRAÇÃO SINTÉTICA DA AGENDA.
2. Clicar Abrir cenário:19/10/2026. Júlio fictício; Matemática; Aluno fictício.
3. Disponibilidade confirmada sintética13–18; Google ocupado simulado14–15.
4. Testar bloqueio14:00(sintético): resposta409, nenhuma aula criada.
5. Marcar aula → Júlio fictício → Matemática → Aluno fictício →19/10/2026,
   60min →13–14 →presencial/Sala sintética →Confirmar.
6. Abrir a aula azul →Reagendar →15–16. Abrir de novo →Cancelar aula,
   motivo sintético. Histórico/visual de cancelada preservados pelo portal.
7. F5, reabrir cenário; somente dados sintéticos locais permanecem.
8. Simular falha Google: ocupado desconhecido não vira verde/livre.
   Restaurar Google simulado; Limpar aulas sintéticas reinicia o cenário.

Todos os resultados Google/API desse Preview são simulados e declarados no banner.
O armazenamento local mantém SOMENTE aulas dos IDs fictícios conhecidos; nenhum
token/grant/conexão. Criação de contas e demais ações mutáveis ficam bloqueadas.
Os testes Chromium desktop/mobile usam o portal/drawer/modais reais.

## Limites antes de utilização real

freeBusy não identifica evento próprio: remarcação sobre intervalo do próprio
evento Google central pode ser bloqueada. Não existe exclusão segura por mera
coincidência de horário. Ver docs/CENTRAL_BOOKING_ETAPA4.md do backend para evidência,
limites de quota/cache, escopos e regra de alterações recebidas via sync pessoal.
Psicólogos conservam integração pessoal; associação central permanece teacher-only
conforme Etapa2. Nenhum scope ou configuração Google alterado.

Publicação futura depende de autorização e decisão sobre os limites: bases de
consentimento/desconexão/locks/sessões primeiro; API antes de frontend. Confirmar
receipt/capability, testes integrados e artefato live sem forja-agenda-demo.
Não excluir usuários/dados em rollback. Não declarar Limited Use concluído.
