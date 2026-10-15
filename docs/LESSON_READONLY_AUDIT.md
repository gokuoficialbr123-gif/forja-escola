# Revisão crítica — aulas contratadas e consultas sem cancelamento

Preparado em15/10/2026, NÃO publicado. Base backend main1b4012d; frontend main2d78aa0.
PRs próprios, separados da Missão1. Sem OAuth real/produção/dados reais/migrações.

## Causa comprovada

`lessonShouldAutoCancel` antigo considerava agendada e confirmada, sem início/fim
registrados e sem remarcação pendente, após horaFim+15min em America/Sao_Paulo.
Resposta confirmada do aluno não impedia o cancelamento. Oito casos sintéticos
executaram a função real extraída de main e confirmaram esse comportamento.

`reconcileExpiredLessons` gravava status cancelada_automaticamente, motivo,
campos de justificativa/cancelamento, timestamps e histórico; podia notificar
aluno/admin e chamar cancelForjaEntityGoogle. Também fazia backfill de registros
já cancelados, adicionando justificativa obrigatória/notificações durante leitura.
Não havia transação com a decisão inicial: uma leitura concorrente poderia usar
um snapshot antigo e sobrescrever uma alteração legítima posterior.

Chamadores auditados (quatro): GET /aulas, GET /aulas/:id,
PATCH /aulas/:id/responder, PATCH /aulas/:id/solicitar-remarcacao.
No GET detalhe, reconciliação precedia lessonVisibleTo: usuário autenticado sem
acesso ao registro podia provocar efeitos antes do403. Não foi acessado dado real.
Nenhum job separado chama essas funções; pesquisa integral de src confirmou.

Frontend também fabricava cancelada_automaticamente em lessonOperationalStatus
pelo relógio, afetando linhas/agenda/filtros sem alteração do banco. Corrigido em
PR coordenado próprio; manter só a correção backend deixaria a classificação falsa.

## Correção mínima

Removidas a transição automática, a reconciliação e o backfill em leituras. GETs
somente consultam e projetam os dados após autorização, sem criar histórico,
notificação, lock ou operação Google. Registros anteriormente cancelados ficam
exatamente como estavam; não há reparo/restauração automática ou migração.

O prazo anterior para responder/solicitar remarcação é conservado, mas sua recusa
não modifica a aula. Mensagem não afirma mais que o status foi atualizado.
Cancelamentos explícitos autorizados e fluxos Google existentes não são alterados.

Aulas agendada/confirmada vencidas sem início/realização recebem SOMENTE na resposta
para admin/professor operationalReview{required:true,code:attendance_record_pending,
message:...}. Não persiste, não muda confirmação, presença, faturamento ou status;
não atribui falta nem considera a aula realizada. É conferência de registro pela
Secretaria, mantendo a margem operacional antiga15min. Após registro legítimo,
a projeção desaparece. Política health: contracted-lessons-readonly-v1.

Frontend conserva status armazenado e mostra nas linhas administrativas/professor
“Registro de realização pendente; conferir com a Secretaria”. Aluno/responsável
não recebem esse aviso interno. Sem redesign/novas telas nem procedimentos de falta.
Critérios de faltas e fechamento histórico precisam de decisão da escola; fora do escopo.

## Testes e limites

Dados exclusivamente Auth/Firestore demo-forja com emuladores em loopback e Google
mockado na borda. Matriz unitária inclui agendada/confirmada, com/sem resposta,
realizada/concluída, iniciada/finalizada, cancelada antiga, remarcação, futuro,
limite15min e meia-noite São Paulo. HTTP real compara snapshots, históricos,
contagem de notificações/auditoria/locks e chamadas Google após GETs repetidos,
concorrentes, detalhe não autorizado e recusas de resposta/remarcação vencidas.
Chromium testa status real do frontend e mensagem de pendência por perfil.
Regressões de booking, locks, CORS, Auth, OAuth/Google e isolamento são preservadas.

Não se auditou/restaurou aula real cancelada. Quantidade/impacto real não comprovados.
Não declarar integração Google real/Carlos/Testing resolvida. Sem dados reais no QA.

## Publicação futura

Requer nova autorização. Publicar backend desta correção primeiro, verificar SHA
LIVE, lessonReadPolicy/health/Auth/CORS sem usar GET autenticado em produção para
QA. Publicar frontend coordenado, confirmar artifact/hash e status sem simular
cancelamento. Depois integrar/publicar PRs16 preservando AMBAS as correções, com
hash/inversores compostos conferidos; não publicar #16 isoladamente por engano.
Não alterar OAuth/scopes/central/DNS/usuários. Não realizar rollback ou restaurar
status reais sem autorização específica. Missões2 e3 não foram iniciadas.
