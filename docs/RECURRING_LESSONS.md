## 16/10/2026 — ampliação da Missão 2, somente Draft PR18/PR19

**Não publicado. Não ativado.** Agora há Aula única, Semanal por período e Fixo
contínuo. Os contratos finitos e seus fingerprints/aceite v1 permanecem compatíveis.
A descrição anterior de “sem tarefa de expansão futura” abaixo refere-se somente
à primeira entrega finita; a ampliação contínua está descrita nesta seção.

### Contrato contínuo e progresso durável

`recurrenceMode: continuous`, `startDate`, `endDate: null`, demais campos iguais à
série finita. Policy `rolling-weekly-lessons-v1`; confirmação **v2** explícita
inclui autorização das extensões futuras até encerramento. Não é novo consentimento
OAuth nem comprovação Limited Use. Nenhuma alteração de scopes/conexões.

Primeiro horizonte: 84 dias de calendário contados da data inicial, no máximo 12
aulas semanais. Validação e gravação inicial continuam todas-ou-nenhuma. Depois,
o horizonte acompanha a data atual em America/Sao_Paulo, sem passar 83 dias além
do maior entre hoje e início. Cada execução confirma somente datas dentro desse
limite, usando os mesmos validadores nativos, publicação válida, exceções/férias,
semanas específicas inclusive vazias/rascunhos, feriados, aluno, professor ativo,
Google pessoal LIVE e locks de professor/aluno/data. Não integra freeBusy central
nem muda os critérios Google já publicados (Etapa4 continua fora desta missão).
Google desconhecido é indisponível, nunca livre. Push Google/Meet fica pendente
no registro durável para o mecanismo de manutenção existente; não prometer Meet
pronto na confirmação. Eventos Google continuam com os IDs determinísticos existentes.

`aula_series/{id}` guarda config, confirmation, count, continuousStatus,
reservedThrough (última data materializada), nextOccurrenceDate, revision e
continuousNextCheckAt. `occurrences/{data-original}` guarda lessonId/date. A raiz
não acumula array ilimitado: somente primeira ocorrência para autorização existente.
Cada extensão cria aula nativa/histórico/recibo/auditoria e avança cursor **na mesma
transação**. IDs determinísticos por série e data original, sem recriar aula
cancelada/remarcada. Metadados de recorrência preservam originalDate e vínculo
para a futura Missão3. Não há projeções fictícias em GET /aulas.

A UI mostra até onde foram criadas reservas, status ativo/bloqueado/encerrado e a
primeira data não reservada com motivo. Alterações/cancelamentos individuais
continuam na Agenda nativa; reservedThrough é o limite materializado, não promessa
de que nenhuma aula individual foi posteriormente remarcada/cancelada.

Conflito/erro para na **mesma** nextOccurrenceDate, sem pular. Preserva todas as
aulas existentes, registra lastBlock, avisa admins ativos por notificações internas
com ID determinístico e tenta novamente após 6h. Interrupção longa que deixou a
próxima data no passado gera pendência BOOKING_START_PASSED, sem reservar no passado
ou avançar sozinha. Secretaria deve revisar/encerrar o contrato e criar outro se
necessário; não existe reparação destrutiva automática.

### Executor independente e limites

Workflow novo `Estender horários fixos FORJA`: horário, minuto17, somente main,
gate explícito; não depende de portal aberto nem de timers do Render. POST
`/internal/aulas-recorrentes/extend` aceita apenas bearer de automação servidor,
sem dados de aula/configuração fornecidos pelo chamador. URL oficial fixa,
redirects recusados, timeout55s e até duas tentativas, sem imprimir headers,
credenciais ou payload bruto. Não reutiliza D-2/WhatsApp nem suas credenciais.

Firestore `_agenda_recurring_automation/lease` tem owner/TTL60s, fencing no commit
e liberação pelo dono. Cada trigger examina no máximo6 séries vencidas e cria no
máximo uma aula por série; orçamento20s entre séries, chamadas Google podem levar
até seus timeouts existentes. Cada commit exige lease ainda válida. Até6 extensões
por hora; séries já dentro do horizonte voltam à fila após24h. Single-field index
padrão de continuousNextCheckAt e documentId, sem composite index novo.

Cursor, recibos, pendências e leases sobrevivem a reinícios. Jobs repetidos são
seguros; lease expirado é recuperável. Desligar automação **não apaga aulas**.
GitHub schedule/Render/rede não são SLA: atrasos, Actions suspenso (inclusive regra
de inatividade de repositório público) ou falhas persistentes precisam de atenção
operacional. Monitorar workflow/heartbeat e notificações. Não é mecanismo para
reservar horizonte infinito nem garantia de execução sem infraestrutura operante.

### Configuração futura, NÃO realizada nesta rodada

Nomes necessários:
- Render servidor: `RECURRING_LESSONS_AUTOMATION_ENABLED`.
- Render segredo + GitHub Actions repository secret, mesmo segredo exclusivo:
  `RECURRING_LESSONS_JOB_SECRET` (64 caracteres hex aleatórios; gerar/configurar
  fora do chat, não copiar tokens Google nem credenciais Firebase para o job).
- GitHub Actions repository variable: `RECURRING_LESSONS_AUTOMATION_ENABLED`.

Flags explícitas true; padrão desativado. Preview/namespace não-produção jamais
executa o job, mesmo com segredo configurado. Não configurar nem disparar serviço
real nesta rodada. Após futura autorização: backend primeiro, configurar segredo
exclusivo/flags, executar workflow_dispatch em main e conferir sucesso; só depois
frontend/aceitação institucional. O primeiro heartbeat habilita novos contínuos.

Status usa `_agenda_recurring_automation/health.lastSuccessAt`. Sem configuração ou
sem execução bem-sucedida nas últimas3h, prévia/criação contínua retornam503
RECURRING_AUTOMATION_UNAVAILABLE, antes de gravar. Aula única/finita permanecem
operacionais. Recuperar recibo existente continua possível. UI exibe bloqueio real;
**não há simulação de recorrência permanente enquanto o job não estiver ativo**.

### Administração e encerramento

GET `/aulas-recorrentes?cursor=...`: admin ativo, páginas20, status operacional,
configuração e datas efetivamente materializadas; sem tokens/eventos privados.
POST `/aulas-recorrentes/{id}/encerrar` com accepted=true: admin ativo, transação
versionada, idempotente, interrompe extensões. Não cancela/exclui aulas, histórico
ou Google, nem muda o status confirmado. Corrida encerra/estende serializada pela
transação da série: uma aula já confirmada antes de encerrar continua preservada.
GET individual mantém os vínculos e projeções por perfil. Todas as rotas no-store.

### Recuperação e aceitação futura

QA só demo-forja, dois emuladores, provedor Google sintético e Chromium. Nenhum
OAuth real, mudança de banco real, Hosting/Render deploy, merge ou Cloud/DNS.

Em publicação futura autorizada: conferir heartbeat recente; testar aula única,
finita e contínua com dados autorizados; confirmar limite/12 ocorrências; bloquear
uma data e conferir pendência/ausência de salto; resolver e observar recuperação;
encerrar e confirmar histórico/aulas preservados. Verificar execução horária sem
portal aberto. Sem estes testes reais não afirmar automação real validada.

Rollback exige autorização. Desativar flag do job e do servidor impede novas
extensões/contratos; manter registros. Frontend antigo continua vendo aulas nativas.
Backend anterior lê aulas mas não estende contínuos: anunciar suspensão, não apagar
metadados nem recriar séries para “recuperar”. Não alterar Rules/credenciais por QA.


---

# Missão 2 — aulas semanais finitas (somente rascunho)

Preparado em 16/10/2026, **não publicado**. Bases verificadas:
backend `2f415feadad109f233911c11e575cd1192d3a105`, frontend
`8b60e06fb8b987bd540c73ef4d92dc4d0269669d`.
Branch coordenada: `feat/aulas-recorrentes-semanais`. Nenhuma migração.

## Diagnóstico e decisão

O sistema tinha padrão de disponibilidade, mas POST /aulas reservava somente
uma aula. Disponibilidade não reserva o professor para um aluno. A nova série
materializa todas as aulas autorizadas em uma transação limitada. Não há geração
fictícia na tela, expansão infinita, fila nova ou tarefa de expansão futura.

Primeira versão: **todas ou nenhuma**. Férias/feriados/semanas específicas podem
impedir a série; a Secretaria revisa o período ou divide o contrato em séries
menores. Não pular datas silenciosamente nem substituir aulas existentes.

## Contrato

- Admin ativo; professor teacher/active=true e aluno student/active=true.
- Matéria liberada ao aluno, compatível com sua série escolar e com o professor,
  usando os validadores nativos. `serieId` continua sendo a série escolar.
- `startDate`/`endDate` inclusivos, explícitos, intervalo até 366 dias e 53 aulas.
- `weekday` inteiro 0=domingo a 6=sábado; duração inteira 15–240 minutos, contrato
  da consulta atual; seletor do portal mantém 30/60/90/120. Janela 07:00–22:00,
  mesma faixa atual de booking. Minutos reais preservados, sem arredondamento.
- Toda ocorrência futura em America/Sao_Paulo, integralmente contida em período
  publicado. Semana explícita, inclusive vazia/rascunho, prevalece sobre padrão.
  Vigência/exceções/férias, calendário escolar, ocupado manual, aulas,
  atendimentos, aluno e Google pessoal continuam sendo verificados.
- Sem Google pessoal legitimamente conectado: comportamento nativo preservado.
  Google conectado e consulta inválida/timeout/incompleta: indisponível, jamais livre.
- Não integra o freeBusy central ao booking (Etapa4 não incluída).

`POST /aulas-recorrentes/validar`: corpo canônico com IDs, startDate/endDate,
weekday, horaAula, duration, modalidade, localAula/meetLink/criarMeet.
Somente leitura; retorna policy `bounded-weekly-lessons-v1`, hash da configuração,
count, canConfirm, strategy=all_or_nothing e data/status/code/message por ocorrência.
Resultados disponíveis, conflitantes e indisponíveis são distintos. Não retorna
payload/eventos privados do Google. Leitura inicial de um intervalo pessoal é
reutilizada somente dentro da requisição; não existe cache novo entre usuários.

`POST /aulas-recorrentes`: mesmos campos + bookingRequestId UUID obrigatório e
confirmation {version:1, accepted:true, fingerprint:hash revisado}. Revalida tudo
no servidor; hash/checkbox não substituem validação. HTTP201 cria; HTTP200 recupera
recibo. Conflitos retornam 409 RECURRING_CONFLICT, bookingState=not_created e datas.

`GET /aulas-recorrentes/{id}`: somente admin/professor/aluno/responsável com vínculo,
projeções por perfil iguais às aulas nativas. Nunca sincroniza/escreve. As agendas
continuam lendo GET /aulas; identificação discreta Série semanal em lessonSub.
Nenhum endpoint novo de alteração/cancelamento de série nesta missão.

## Dados e atomicidade

`aula_series/recurring_{sha256(uid|uuid)}`: configuração canônica, política, fuso,
fingerprint do pedido, count, occurrenceIds, createdById/Role, createdAt/updatedAt,
confirmação versionada com hash/configuração, autor e horário do servidor.
`aulas/{seriesId}_{YYYY-MM-DD}`: todos os campos nativos + recurringSeriesId e
recurrence {type:weekly,startDate,endDate,weekday,originalDate,index,count}.
Histórico individual e auditoria da série criados na mesma transação.
Até 53 aulas +53 históricos +1 série +1 auditoria =108 documentos criados.
Não existe exclusão/restauração automática de dados antigos.

Acquire atômico dos mesmos locks professor/aluno/data usados pela aula avulsa,
em todas as datas. Owner token e validade de todas as leases relidos na transação
final, antes das escritas; TTL45s preservado, sem lease válida não há commit.
Leituras antecedem exclusões no release; só remove locks do mesmo proprietário,
finally preservado, erro de limpeza não transforma criação em falha. Aulas
avulsas e séries concorrem pelos mesmos documentos. Validação por data tem no
máximo quatro workers. Consultas nativas de conflitos são compartilhadas apenas
na mesma validação, por coleção/campo/UID, evitando reler todo o histórico53 vezes.
O commit abre um conjunto novo após adquirir os locks; nenhuma memória é compartilhada
entre requisições ou usuários. Lease que expira antes do commit exige nova tentativa.

UUID é vinculado ao UID e à configuração. Resposta perdida/in_progress preserva
chave e corpo imutáveis na sessão autenticada, inclusive ao desmontar/reabrir
o drawer durante a operação. Mudança de UID/generation descarta esse estado. Repetir lê o mesmo recibo; dados diferentes
com a mesma chave retornam RECURRING_REQUEST_CHANGED + ID, recuperado via GET.
Sem localStorage de demonstração ou registro fictício. Após reload, aulas salvas
são carregadas do backend; se perdeu a sessão, conferir a Agenda antes de novo
cadastro. Mesmo outro UUID não pode criar uma aula conflitante.

## Google e recuperação

Eventos individuais por ocorrência, sem RRULE Google: simplifica exceções,
remarcação individual futura e recuperação. Reutiliza syncForjaEntityGoogle,
identidade do professor, propriedades privadas FORJA e ID Google determinístico.
No máximo um push imediato por POST confirmado; outras aulas ficam explicitamente
pendentes e são retomadas pela manutenção pessoal existente (normalmente5min).
Não anunciar todas como sincronizadas. Falhas Google após commit produzem aviso,
nunca uma resposta dizendo que a série não existe. Repetição da mesma solicitação
pode recuperar mais uma pendência, sem criar aulas adicionais. Leituras não fazem push.

Insert aceito cuja resposta se perdeu: próximo push usa o mesmo ID; 409 só pode
ser recuperado se ID e propriedades privadas comprovarem a MESMA ocorrência.
Backfill de recorrentes pode ignorar apenas esse exato evento órfão próprio;
evento de outra aplicação, outra aula/tipo ou ID diferente continua bloqueando.
RequestId do Meet também é determinístico para recorrentes. A integração antiga
mantém seu comportamento. Nenhum evento pessoal é apagado por este código.

Google e Firestore não oferecem transação conjunta: uma alteração externa após
a consulta ainda pode criar conflito. A confirmação refaz a consulta sob locks,
e o push/backfill verifica conflitos e reporta pendências; não prometer atomicidade
com gravações realizadas fora do FORJA. Falhas persistentes exigem diagnóstico do
professor/administrador. O OAuth real/Testing/403 não é corrigido nesta missão.

## Interface, segurança e regressões

Drawer original permanece montado; opção Não repetir preserva o fluxo nativo.
Semanal acrescenta dia/hora/fim, revisão por data com scroll limitado e checkbox
não marcado. Mudanças invalidam a revisão. Single flight, campos congelados
em resposta ambígua e recuperação da mesma solicitação. Respostas de UID/generation
anteriores são descartadas. Mensagens/nomes por textContent, sem HTML de terceiros.
Um ajuste pontual eleva o botão Marcar aula no celular, antes coberto pela navegação.

Escopos, OAuth/PKCE/state/OIDC, consentimento atual, central, Make/n8n, Auth,
cadastros, políticas legais, arquivo de verificação e allowlist Hosting intactos.
Hash de escopo exige que remover somente o novo bloco/CSS/metadados de erro
restaure exatamente o portal main8b60. Nenhum mock entra em .firebase-public.
Preview Render compartilhado continua somente leitura; não usá-lo para QA mutável.

## Ensaio isolado e aceitação posterior

QA local/CI exclusivamente projeto demo-forja com DOIS emuladores, rede Google
interceptada na borda e Chromium desktop/celular. Testes verificam 53 aulas,
conflitos, futuros/fuso/minutos, versões de publicação, idempotência, concorrência,
falha atômica, Google inválido/timeout, resposta perdida no insert, papéis e reload.
O ensaio completo publica um padrão sintético pelo portal, agenda três aulas de
90min às13:33, recarrega e troca para o professor. Não é Google real validado.

Após autorização futura e backend compatível implantado, Roberta deve testar com
contas/dados autorizados: Não repetir; Semanal; informar fim contratual/duração;
verificar cada data; reproduzir bloqueio conhecido; confirmar série inteiramente
válida; conferir quantidades nas agendas e após reload; consultar status Google.
Não criar dados reais automaticamente. Cancelamento/edição de série e faltas ficam
para Missão3; uma ocorrência conserva ID próprio para os fluxos nativos existentes.

## Publicação futura, não executada

1. Revisar os dois Draft PRs e SHAs, CI completo e escopo.
2. Autorização explícita. Registrar versões anteriores.
3. Backend primeiro; Render LIVE/SHA e recurringLessonsPolicy +health/auth/CORS.
4. Frontend depois; validação/hash/produção Hosting/API oficial/prova Google/legais.
5. QA público não destrutivo; teste operacional pela escola autorizada.
Recuperação: versões anteriores anotadas; não excluir séries/aulas. Voltar somente
frontend esconde o editor mas mantém aulas materializadas. Backend antigo ainda
lê aulas nativas; rollback exige autorização e suspender novas séries antes de
retornar binário, preservando registros/metadados/IDs Google.
