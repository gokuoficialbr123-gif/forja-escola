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
