# FORJA — auditoria geral e confirmação administrativa de aulas

17/10/2026. Código preparado em branches novas; nenhum merge ou deploy autorizado nesta rodada.
QA mutável exclusivamente em `demo-forja`, com Firebase Auth/Firestore emulados,
Chromium e Google simulado na borda. Não foram consultados eventos privados reais.

## Referência e limites da investigação

- Backend publicado inicial: `72ab2ddb6586d038bc90753bb4cd0efbbc866e3d`.
- Frontend publicado inicial: `80e30d13d22df445e1f68309b4eb2a3363940223`.
- Branch nova nos dois repositórios: `fix/aulas-confirmadas-auditoria-2026-10`.
- Health e HTML públicos foram comparados com essas referências. HTML inicial:
  SHA256 `2ce1681d866ec4a5100dea11a89035a9bf040a6d6c5f3f480bc68d48fe64893b`.
- Privacidade, Termos, CSS legal e arquivo Search Console permaneceram byte a byte
  iguais. O Hosting continua com allowlist explícita de cinco arquivos públicos.
- Não foram lidas credenciais, dados escolares reais, configuração privada do
  Google Cloud nem Rules reais. Nenhum job de produção foi disparado para QA.
- Não importar PRs antigos ou considerar suas propostas como publicadas. A Etapa4
  central→booking, consentimento pessoal proposto e missões futuras não foram ativados.

## Inventário do produto e cobertura por perfil

O portal continua em `index.html`, com funções originais e extensões existentes.
A API HTTP fica em `src/server.js`; serviços menores tratam disponibilidade,
recorrências, OAuth/OIDC, CalendarList/freeBusy, convites e isolamento central.

| Perfil | Áreas existentes observadas no código e na navegação Chromium | Verificação funcional adicional |
|---|---|---|
| Secretaria/admin | Central, Agenda geral, Disponibilidade, Aulas, calendário escolar, indisponibilidades, Acadêmico, tarefas, catálogos, pendências, acompanhamento, solicitações, matrículas, vínculos familiares, sessões, comunicados, documentos, usuários, relatórios, auditoria, configurações | Booking HTTP, conflitos, recorrências, cadastros/convites, CRUD acadêmico, permissões e cancelamentos em emuladores |
| Professor | Hoje, Minha agenda, Disponibilidade, Meus alunos, Registros e conta | Publicação semanal/fixa, isolamento, leitura de aulas e materiais, início/fim, Google pessoal simulado |
| Psicólogo | Hoje, Minha agenda, Disponibilidade, Pacientes e conta | Disponibilidade e integração pessoal preservadas; confirmação de terapia continua separada da regra escolar |
| Aluno | Hoje, Minhas aulas/agenda, agenda de professores permitida, calendário, desempenho, tarefas, materiais, acompanhamento, solicitações e áreas pedagógicas já existentes | Aula confirmada, cancelamento próprio, histórico, entrega de tarefa, materiais/notas, negativa de acesso a outro aluno |
| Responsável | Hoje, filhos, agenda permitida, tarefas e demais áreas familiares habilitadas pelo menu | Vínculo entre famílias, materiais/notas/tarefas autorizados e negativa de acesso/alteração fora do vínculo |

Todos os menus declarados para os cinco perfis foram renderizados pelo portal
com login real no Auth Emulator e API/Firestore reais locais. Isso comprova navegação
sem erro de montagem no cenário sintético; não equivale a testar todas as combinações
de todos os módulos. O ensaio de acesso acrescenta tarefas (criar/entregar/corrigir),
avaliações/notas, materiais por URL, acompanhamento e visibilidade, comunicados,
documentos/aceites, notificações e terapia. Upload binário no Storage e entrega de
e-mail/WhatsApp não foram executados contra serviços reais.

## Mudanças de regra solicitadas, distintas dos defeitos anteriores

**R01 — reserva confirmada pelo agendamento autorizado.** `newLessonRecord` grava
`status: confirmada`, `confirmacaoAluno: null` e `bookingConfirmation` com versão1,
origem, ator e timestamp. Aula única, série finita, fixo contínuo e extensão usam a
mesma fábrica. A extensão registra origem `recorrencia_autorizada`, além do admin
autorizador já mantido pela série. Confirmação da reserva não registra presença.

Remarcações preservam respostas/histórico antigos; o Google não exige uma nova
resposta do aluno. Leitura de uma reserva legada `agendada` projeta `confirmada`,
com origem inferida `legacy_reservation`, sem escrever/migrar o documento. Resposta
negativa antiga continua identificável para revisão. Canceladas/concluídas não são
restauradas. A passagem do horário não cancela, registra falta ou realiza aula.

O endpoint escolar antigo `PATCH /aulas/:id/responder` responde410
`LESSON_RESPONSE_RETIRED`, após autenticação/vínculo, sem gravar confirmação.
A solicitação alternativa de remarcação pelo aluno também é retirada explicitamente;
os fluxos administrativos/professor/responsável permitidos permanecem.

**R02 — cancelamento próprio com motivo.** Reutiliza `PATCH /aulas/:id/cancelar`.
Admin, professor titular e aluno titular passam pelas próprias permissões; responsável
e psicólogo não recebem a permissão de cancelar aula escolar. O servidor exige
motivo textual de3–600 caracteres, perfil ativo, vínculo e estado ainda permitido.
O aluno preserva a janela operacional anterior (fim previsto+15min, sem início/fim
registrados); não foi inventada regra de24h ou penalidade. Professor/aluno não
contornam remarcação pendente. A decisão é revalidada em transação.

A transação grava cancelamento, motivo/autor/hora, histórico, auditoria e notificações
aos destinatários autorizados. A repetição retorna `alreadyCancelled`, preservando
o primeiro autor/motivo e sem duplicar histórico. A ocorrência recorrente conserva
seu ID/recibo; cancelar uma aula não encerra a série nem recria sua ocorrência.

## Defeitos encontrados e regressões

Reprodução abaixo usa somente registros sintéticos. P0 indica risco de integridade,
não uma afirmação de que esses efeitos ocorreram com usuários reais.

| ID / gravidade | Reprodução e causa | Correção e prova |
|---|---|---|
| B01 / P1 | Cancelar e falhar ao gravar histórico/notificação ou repetir simultaneamente. A gravação principal era separada das demais decisões e registros. | Transação, IDs determinísticos e replay; falha injetada no histórico reverte a decisão inteira. `lesson-confirmation-http`: concorrência, rollback e replay. |
| B02 / P1 | Exclusão Google falha, mas helper anterior captura o erro e grava `sincronizado`; canceladas ficam fora do backfill. Reprodução isolada da função publicada retornou esse falso estado. | Intenção de exclusão durável no próprio registro, estado pendente e retry nos jobs existentes; testes aula/atendimento/bloqueio, falha503, resposta perdida e GET404 posterior. |
| B03 / P0 | Um ID Google vinculado pode apontar para evento de outra aplicação; o PATCH anterior usava o ID sem comprovar propriedade. | GET e correspondência exata de `forjaManaged`, tipo e ID nativo antes de PATCH/DELETE; regressões recusam evento alheio. |
| B04 / P0 | Evento Google ativo atrasado podia reativar aula cancelada; ramo de evento cancelado vinha antes da guarda de aula concluída/iniciada. | Guardas de estado e atualização condicional; teste mantém cancelamento e conclusão diante desses dois eventos. |
| B05 / P0 | Ler aula, cancelar em outra requisição e concluir uma remarcação atrasada podia sobrescrever a decisão com um novo status ativo. | Fingerprint da situação de negócio revalidado na transação, além dos locks de Agenda; teste segura leitura, cancela e libera PATCH atrasado, que recebe409. |
| B06 / P1 | Início/fim ou remarcação já gravados podiam retornar erro após falha na leitura/histórico posterior. Repetir início/fim gerava nova recusa sem esclarecer o resultado anterior. | Histórico transacional nas operações alteradas, resposta de commit com aviso quando leitura falha e replay seguro de início/fim; testes de falha pós-commit e histórico único. |
| B07 / P1 | Frontend mostrava erro da atualização visual como falha da alteração já salva. | Cache local recebe o resultado confirmado; sucesso e aviso de atualização são separados. Chromium injeta falha de reload depois do sucesso. |
| B08 / P1 | D-2 selecionava aulas canceladas/concluídas e marcava `aguardando_resposta`, contrariando a reserva contratada. | Filtro de aula ativa e lembrete informativo `lembrete_solicitado`; teste puro cobre estados. Template Meta/entrega reais permanecem não verificados. |
| B09 / P1 | Logs de erro operacionais/Meta aceitavam texto/payload bruto do provedor. | Apenas códigos técnicos permitidos e marcadores estáticos; teste com sentinela privada e sem log de payload. WhatsApp ganhou timeout explícito de15s. |
| B10 / P1 | Ressincronização completa apagava o cache de ocupados antes da consulta; falha deixava snapshot vazio. Reprodução da função original confirmou cache com0 linhas após erro. | Receber/validar todas as páginas antes de retirar dados antigos; aplicar novos ocupados primeiro. Falhas/incompletude preservam o snapshot anterior. |
| B11 / P1 | Após410 do cursor, `continue` no `do…while(nextPageToken)` encerrava o laço com token vazio, sem a consulta completa, e retornava sucesso. | Sinalização explícita de nova tentativa completa; teste410→503 exige erro e preservação do cache, não HTTP200 enganoso. Paginação/timeout/resposta são limitados e validados. |
| B12 / P1 | DELETE pessoal capturava falha de exclusão local e respondia sucesso. | Exclusão é aguardada, falha local retorna503; conclusão parcial de revogação/canal/cache é explícita, com repetição segura. Teste injeta falha Firestore e revogação recusada. Sem alterar conexão central. |

Contagem:12 defeitos corrigidos, além das2 mudanças de produto acima.
Não significa ausência de outros bugs. As propostas mais amplas dos PRs pessoais
antigos não foram incorporadas; sua eventual integração exige rebase/revisão.

## Usabilidade e responsividade

Seis atritos tratados: obrigação artificial de resposta; contadores administrativos
baseados em resposta nula; identificação insuficiente da aula no cancelamento;
perda do motivo/recuperação ambígua; erro visual após gravação; sucesso genérico na
desconexão parcial. Não houve redesign global.

Cancelar mostra aula/data/horário, motivo obrigatório com nome acessível, confirmação
afirmativa, opção de desistir, singleflight, foco e feedback `aria-live`. Resposta
incerta preserva o motivo e consulta a MESMA aula antes de repetir. UID/geração
impedem resultado atrasado de atualizar outra sessão; os rascunhos são limpos na troca.

Chromium valida320/375/390/768/1366/1920px, início e Agenda dos cinco perfis, modais,
rolagem, limites da viewport, Escape e operação em altura reduzida. Capturas são
sintéticas. Isso não é certificação de acessibilidade/contraste ou ensaio de todos
os dispositivos/teclados físicos. Os testes existentes mantêm drawer montado,
scroll, seleção, estilos reais do DOM, slots e Agenda Dia/Semana/Mês.

## Agenda e recuperação

- Aula única: futuro/fuso, elegibilidade, duração, conflitos Google/FORJA/aluno,
  locks, chave de idempotência e recuperação após resposta perdida preservados.
- Semanal por período: tudo-ou-nada, até53 aulas/366dias, autorização exata, férias,
  feriados, exceções e conflito em uma ocorrência;53 aulas13:33–15:03 verificadas.
- Fixo contínuo: horizonte84dias/12aulas, recibos/cursor/locks, job horário,
  heartbeat, reinício, duas execuções, bloqueio sem pular data, retomada e encerramento
  seguros cobertos pelas regressões existentes. Automação real não foi acionada.
- Disponibilidade fixa: publicação/versionamento, precedência de semana vazia ou
  rascunho, validade, exceções e privacidade entre sessões permanecem testados.
- Cancelamento individual: série/IDs/recibos preservados. No ensaio de53 aulas,
  reinício e replay recuperam a ocorrência cancelada sem recriação.
- Conflito real ou Google indisponível continua impedindo nova marcação. Nenhum
  erro é convertido em autorização para reservar.

## Google: simulação versus validação real

| Funcionalidade | Evidência executada | Ambiente / resultado | Pendência real |
|---|---|---|---|
| OAuth pessoal | state atômico, PKCE, assinatura/issuer/audience/exp/nonce OIDC, conta trocada/mesma conta, recusa e legado | Google/certificados simulados, verificador real; regressões | OAuth interativo e403 de pessoas reais não testados |
| Busy pessoal | ocupado/livre, dia inteiro, limites,401/403/429/5xx, timeout/rede/paginação | HTTP real local com provedor simulado; falha fecha booking | Conferir conta de teste autorizada com Google real |
| Sync pessoal | consulta mínima, resposta completa, cursor410, cache preservado em falha | Provedor simulado; não solicita título/descrição/participantes | Quotas/permissões e calendários reais não medidos |
| Eventos FORJA | criação/alteração, ID determinístico,409, falha após commit, resposta perdida, propriedade do evento | Provedor simulado; regressões nativas | Escrita Google real NÃO AUTORIZADA |
| Cancelamento Google |503, exclusão ambígua, GET404, retries e push concorrente com cancelamento | Provedor simulado + Firestore real emulado | Latência/consistência externa real requer ensaio autorizado |
| Mudanças pelo Google | remarcação, exclusão e eventos atrasados com estado nativo protegido | Provedor simulado | Interface Google real não utilizada |
| Meet | ausência inicial e obtenção posterior, criação idempotente na recorrência | Provedor simulado | Contas/licenças/restrições reais NÃO TESTADAS |
| Central CalendarList/freeBusy | admin ativo, scopes, associações, perda de acesso, lotes/erros/timeout, namespaces | Suítes centrais completas com mocks/emuladores | Conta central real não foi conectada/desconectada para QA |
| Central→booking | Inspeção do código e branches publicadas | NÃO IMPLEMENTADO nesta base | Etapa4 continua pendente; nenhum novo scope/webhook |

Tokens permanecem no backend, criptografia/state/PKCE/OIDC preservados. Nenhuma
mudança no Cloud, scopes, Branding, Audience, OAuth clients, DNS ou credenciais.
A confirmação escolar não demonstra conformidade integral com Google Limited Use.

## Modelo operacional e dados

`aulas` recebe metadados de confirmação/cancelamento e intenção Google:
`googleCancellationState`, próxima tentativa/contador e erro estático. Histórico,
auditoria e notificações escolares usam IDs determinísticos na transação.
`_google_lesson_sync_locks` mantém leases de proprietário, com fencing/expiração;
não substitui nem altera os locks originais da Agenda. Push é limitado a45s sob
lease de60s. Atendimento e bloqueio usam a mesma proteção de escrita Google,
mantendo suas regras de negócio e tipos de evento.

Retries aproveitam o sync/backfill existentes, com lote de até20 por coleção e
recuo5min–12h, sem timer global novo. Conexão inválida mantém pendência; não inventa
sucesso. O cache contém somente ocupação/metadados operacionais. Seus parâmetros
de exibição45dias passados/180futuros não constituem política institucional de
retenção nem garantem expurgo de backups. Backups/exclusão reais não foram auditados.

## Segurança, limites e itens não comprovados

- API valida token com revogação, perfil ativo e vínculo; testes negam outros UIDs,
  famílias e perfis, inclusive chamadas diretas por ID. Não ampliar permissões.
- Rules de Firestore/Storage publicadas NÃO VERIFICADAS: não há arquivo Rules
  versionado disponível. Emulador/Admin bypass não comprova segurança do cliente
  direto. Conferência legítima das Rules é necessária antes de afirmar essa garantia.
- QA não usou dados reais. Capturas não contêm contas/nomes/eventos reais.
- Conexão Google real de Carlos e403/OAuth Testing não foram considerados resolvidos.
- Upload Storage binário, entrega de e-mail, template/entrega WhatsApp, backups,
  práticas institucionais/terceiros e Limited Use não são certificados por estas suítes.
- Não prometer cobertura de todas as corridas de OAuth/desconexão propostas em PRs
  antigos ainda abertos; coordenar a revisão desses PRs sem importá-los silenciosamente.
- Recursos de desmarcação por link público, notificações WhatsApp novas e integração
  central ao booking não foram construídos por esta missão.

## Performance e instabilidade dos testes

Medições locais, sem comparação A/B de produção: validação53 ocorrências362ms,
criação atômica1.324ms. Render sintético da Agenda com10/200/500 registros medido
em35/18,5/17,1ms numa execução; a ordem/aquecimento do navegador explica por que
esses números não demonstram escalabilidade nem melhoria. Não alterar consultas
por suposição. O ensaio completo registra tempos e quantidade de chamadas.

As regressões de recorrência desktop/mobile passaram em cerca de6,2/9,5s localmente.
O timeout intermitente histórico em CI não foi reproduzido com causa conclusiva;
não atribuir à aplicação, nem declarar eliminado. Nenhum timeout foi aumentado.
A primeira CI desta branch falhou na etapa Chromium, após hash/sintaxe/pipeline
aprovados. A execução concorrente foi alinhada à execução serial local, com
TAP e anotações sanitizadas, sem aumentar timeouts. A evidência disponível não
permite atribuir a causa original exclusivamente à concorrência; a CI no novo
HEAD continua sendo obrigatória.
Uma conferência local de hash falhou quando o HTML foi atualizado durante a suíte;
essa causa é conhecida e exige rerun com snapshot congelado, não remover o assert.

## Evidências e execução reproduzível

Novos testes: `lesson-confirmation*.test.mjs`, `lesson-reminders.test.mjs`,
`operational-errors.test.mjs`, `product-access-audit.test.mjs`,
`google-native-cancellation-audit.test.mjs`, `google-cache-recovery-audit.test.mjs`,
`google-disconnect-audit.test.mjs`, `recurring-capacity-audit.test.mjs`.
O frontend mantém guard reversível até o SHA publicado, testes DOM/Chromium e
validação estrita do artefato. Snapshots de revisão não vão ao Hosting.

Node22, Java21 e Firebase CLI. Configure somente os hosts dos emuladores e o
projeto `demo-forja`, sem herdar credenciais reais. **Não executar `npm start`: é D-2.**

```sh
npm test
firebase emulators:exec --only auth,firestore --project demo-forja --config test/emulators/firebase.json 'npm run test:integration'
```

Para aceitação pareada, definir `FORJA_FRONTEND_DIR`, `FORJA_PLAYWRIGHT_MODULE`
e opcionalmente `FORJA_CHROMIUM_PATH` para instalações locais. No frontend:

```sh
node scripts/validate.mjs
node --test --test-concurrency=1 scripts/*.test.mjs
node scripts/prepare-hosting.mjs
```

Capturas/medidas sintéticas: `docs/evidence/`; contagem final e checks são registrados
no fechamento dos PRs. Contar testes-folha e grupos separadamente; não somar reruns.
Não confundir preview sintético de convite com entrega real. Nesta rodada nenhum
Firebase/Render Preview foi publicado; os PRs devem continuar em rascunho.

## Contagem e fechamento dos testes

| Conjunto | Testes-folha independentes | Grupos-pai (não somar como casos) | Total exibido pelo Node |
|---|---:|---:|---:|
| Backend unitário |243|1|244|
| Backend HTTP/Auth/Firestore/Chromium pareado |210|18|228|
| Frontend/pipeline/Chromium |266|0|266|
| Total único |719|19|738|

A base tinha680 testes-folha; foram acrescentados39 (6 unitários backend,
26 de integração e7 frontend). Não somar repetições nem os19 grupos aos719 casos.
Não há teste intencionalmente ignorado. Os casos afetados por falhas locais de hash,
contrato e rótulo foram corrigidos/reexecutados; a decisão final exige também os
checks completos no HEAD dos PRs, não apenas um rerun ou um SHA anterior.

No fechamento local: unitários aprovados; suíte frontend+rerun dos49 casos afetados
aprovados; integração completa complementada pelo rerun dos contratos e do portal.
O assert antigo da resposta de desconexão foi atualizado para verificar todos os
campos novos, mantendo verificações de revogação, usuário, aula e cache.
A regressão com aula histórica identificou e corrigiu o rótulo na versão ATIVA da
página de Pendências, além da definição antiga. CI pareada é obrigatória antes de merge.

Links permanentes dos checks desta branch:
- [Backend](https://github.com/gokuoficialbr123-gif/forja-backend/actions?query=branch%3Afix%2Faulas-confirmadas-auditoria-2026-10).
- [Frontend](https://github.com/gokuoficialbr123-gif/forja-escola/actions?query=branch%3Afix%2Faulas-confirmadas-auditoria-2026-10).

## Checklist para uma publicação futura, não executada

1. Revisar os dois PRs, SHAs exatos, CI pareada e mudanças de regra; autorização
   explícita do proprietário. Não incluir PRs antigos por dependência acidental.
2. Conferir Rules e plano institucional/operacional pendente. Planejar ensaio Google
   com conta de teste autorizada; não usar compromissos privados reais para QA.
3. Registrar versões anteriores e pendências de exclusão Google. Backend primeiro;
   Render LIVE no SHA correto, health com
   `lessonConfirmationPolicy=secretaria-confirmed-lessons-v1`, Auth/CORS preservados.
4. Frontend depois: workflow oficial, SHA/hash do artefato, API oficial, documentos
   legais e Search Console íntegros. Nada disso foi disparado nesta missão.
5. Aceitação por pessoa autorizada: reserva confirmada sem resposta do aluno,
   cancelamento com motivo e notificações, presença separada, recorrência individual,
   falha Google sem falso livre e recuperação da sincronização.
6. Se necessário recuperar código, pedir autorização; frontend compatível primeiro,
   depois backend. Não apagar registros/recibos/pendências Google, restaurar reservas
   canceladas ou sobrescrever banco a partir de backup. Voltar backend antigo pode
   suspender o retry dos novos marcadores; isso deve constar da decisão de recuperação.

Conclusão: implementação preparada para revisão técnica em ambiente isolado;
nenhuma declaração de funcionamento com Google real ou autorização de publicação.
