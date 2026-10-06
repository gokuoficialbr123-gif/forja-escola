## Isolamento do Preview da Etapa 3 — PR6 backend / PR5 frontend

Autorizado somente isolamento antes de OAuth real. Sem merge/main/produção.
Produção por padrão preserva google_secretaria_connections/escola,
_google_secretaria_oauth_states/{nonce} e google_calendar_admin_calendars/{hash}.
Resolvedor src/google-secretaria-storage.js recebe APENAS configuração servidor.
Preview exige FORJA_GOOGLE_ENVIRONMENT=preview e namespace estrito pr-N em
GOOGLE_SECRETARIA_STORAGE_NAMESPACE; IS_PULL_REQUEST=true e hostname oficial
forja-api-pr-N.onrender.com detectam Preview mesmo se configuração estiver ausente.
Namespace deve coincidir com hostname. Ausente/inválido/conflitante: CENTRAL_STORAGE_BLOCKED,
503, nenhum caminho de produção como fallback e Google pessoal desabilitado.

PR6 usa raiz google_secretaria_preview_envs/pr-6: connections/escola,
oauth_states/{nonce}, calendars/{hash}. Conexão/status/grants/freshness, state/PKCE/
nonce, CalendarList/PATCH/freeBusy usam o mesmo contexto. Não copiar dados/credenciais/
grants/associações. Preview inicia vazio; produção só compartilha users para leitura
de perfis admin/teacher ativos. IDs de calendário podem coincidir, mas paths não.
Tokens AES-GCM apenas backend; nenhum busy/evento persistido. Namespace nunca vem
de request, query ou frontend. Cache/requests pertencem à instância/contexto.

Novo state central assinado +documento gravado incluem oauthBinding SHA256 do
namespace/ambiente/clientId/redirectUri exatos. Validar assinatura/binding antes de
consumir, revalidar binding dentro da transação atômica. State cruzado ou binding
modificado não é consumido. PKCE/OIDC mantidos. Estados centrais legados sem binding
continuam aceitos APENAS em produção, até expiração original10min; Preview recusa.
Não alterar helper/payload pessoal por padrão nem desconectar/reconectar produção.

Preview usa somente GOOGLE_SECRETARIA_PREVIEW_* para cliente/secret/callback/frontend,
sem fallback aos GOOGLE_SECRETARIA_* de produção. ClientPreview deve ser exclusivo
e diferente do cliente central herdado e do pessoal. Callback/origem próprios.
Google pessoal: nenhum timer startup/manutenção de sync/watch registrado no Preview;
rotas pessoais callback/connect/sync/webhook/watch/connection/admin-sync bloqueadas;
funções internas sync/backfill/watch/cancel não executam operações pessoais no Preview.
Produção mantém as quatro agendas de execução e fluxo pessoal existentes.

Health/status expõem somente policy central-preview-isolation-v1, environment,
namespace, ready, personalGoogleEnabled. Gate Firebase exige Preview ready=true,
namespace correspondente ao Render selecionado, Google pessoal/webhook desabilitados.
UI Preview recusa backend antigo/produção/configuração incompleta antes de ler lista
ou oferecer ações. Badge identifica ambiente de teste; API oficial na fonte intacta.
Instruções antigas de OAuth Preview compartilhando conexão abaixo são OBSOLETAS.
Não executar OAuth/Google reais. Testes mutáveis exclusivamente demo-forja/mocks.
Nenhuma configuração/produção real modificada por esta implementação.

## 05/10/2026 — BLOCO A / ETAPA 3: freeBusy central (somente PR/Preview)

Base atual publicada: backend main f1399db e frontend main 1ba3458. A Etapa 2
está publicada, inclusive refresh automático de CalendarList. Histórico abaixo
não significa frontend pendente. Etapa 3 autorizada em branch própria
feat/secretaria-central-freebusy-etapa-3. Sem merge/main/produção ou Etapa 4.

Consulta administrativa sob demanda POST /admin/google-calendar/central/freebusy.
Somente admin ativo, conexão central/OIDC/grant válido e catálogo com sucesso há
menos de5min. Seleção no backend de associações explícitas, enabled=true, acesso
válido e teacher active=true. Removidos/sem acesso/desabilitados/inativos/sem
associação ficam ignored. Sem importar dados para Agenda/booking/disponibilidade,
locks, coleções pessoais ou Google Calendar pessoal. Sem webhooks/eventos.list.

/connect {} conserva scopes openid/email/CalendarList. /connect
{purpose:"central-freebusy-v1"} acrescenta SOMENTE calendar.events.freebusy;
purpose é salvo no state protegido e callback exige scope efetivamente concedido.
State atômico/PKCE/OIDC/AES-GCM preservados. GrantVersion=2 mantém CalendarList;
freeBusyGrantVersion=1 +freeBusyGrantedAt comprovam consentimento adicional.
Reconexão invalida snapshot de acesso mas preserva associações/enabled. Consentimento
falho conserva credenciais/configuração. Nenhuma migração/promocão automática.
Política CalendarList continua v2; capability nova central-freebusy-query-v1 em
status e health googleSecretariaFreeBusyPolicy. Conexão antiga continua utilizável.

Janela RFC3339 com timezone explícito até31dias, Google America/Sao_Paulo,
intervalos [start,end) sem arredondamento. Lotes <=50, concorrência2, timeout20s
por request/deadline60s, retries HTTP transitórios limitados. Consulta de token e
freeBusy somente no backend. JSON Google limitado2MiB/lote; limites1000 intervalos
por calendário/10000 normalizados por consulta, nunca truncar para indicar livre.
No máximo400 configurações (Etapa2), body16KiB,10 consultas distintas/minuto por
conta/instância. Cache memória <=60s/32 entradas; in-flight compartilhado <=10.
Releitura transacional read-only antes/depois; fingerprint inclui conexão,
associação/habilitação/acesso/teacher ativo. Mudanças invalidam inclusive cache.
Limites/cache são locais por instância; não prometer quota global distribuída.

Resultado whitelist de IDs operacionais opacos e status success/ignored/unavailable;
intervalos start/end/label=Ocupado somente em success. Erro/timeout/parcial/HTTP200
com errors nunca produz busy=[] bem-sucedido. Response no-store; sem payload bruto,
tokens, nomes/títulos de eventos, participantes ou IDs de evento. Nenhuma escrita
Firestore pelo endpoint; grant muda somente no OAuth explícito. Sem coleção busy
central. FreeBusy não identifica aulas FORJA: não deduplicar eventos por coincidência
com aulas; integração futura exige desenho separado aprovado (Etapa4).

Testes somente mocks/emuladores demo-forja. Preview usa Firebase compartilhado:
nenhum OAuth/CalendarList/alteração real é executado automaticamente para testar.
Manual admin deve consentir conscientemente se testar OAuth no Preview.


### Frontend da Etapa 3 — diagnóstico sob demanda

Configurações → Google Calendar da Secretaria conserva status/CalendarList da Etapa2.
Com backend central-freebusy-query-v1, mostra autorização explícita de ocupado
ou diagnóstico de intervalo por professor. Não consulta busy ao entrar/navegar:
o admin escolhe datas inclusivas em America/Sao_Paulo (até31dias) e clica Consultar.
Resultado mostra somente Ocupado e status operacional, nunca disponibilidade.
Falha/partial não significa livre. Alteração de configuração/role/navegação invalida
resposta pendente; ações concorrentes compartilham a chamada no backend.
Servidor antigo esconde esse diagnóstico e conserva a conexão anterior com3scopes.
Reconectar uma conta já autorizada para busy mantém seus4scopes; primeiro grant
exige ação explícita. Sem timers/polling/Etapa4, mudanças de Agenda ou booking.

Somente script/style forja-google-secretaria-* alterados no HTML; restante do
portal e relatório são byte a byte preservados (hash anterior sem bloco central
f14755958947c9eb4742f35083ef75493cca1d15a11202608f4472571327b5ed).
Hash da fonte atual foi atualizado conscientemente no validador; API oficial
continua https://forja-api-m1kq.onrender.com. URL RenderPR6 somente na descrição
do PR e artefato Preview, nunca na fonte oficial. Gate Preview exige nova policy.
Produção/main não recebem push/merge. ETAPA2 publicada; histórico abaixo é legado.

## 05/10/2026 — ETAPA 2: gatilho de entrada real em Configurações (PR4/Preview)

A navegação real usa navigate → renderPage → bindPage e page=configuracoes.
Auditoria reproduziu no HTML completo: memória da carga inicial escondia mudanças
no timestamp/grant do backend; listError antigo não era relido ao voltar; F5
reabria inicio porque activateUser reinicializa a página. Reconexão funcionava
por invalidar a memória. Testes anteriores extraíam apenas o script central.

Agora cada entrada real identifica um ciclo de visita, consulta status+snapshot
read-only e só depois avalia freshness para POST automático uma única vez.
Rebindings da mesma visita não reiniciam o ciclo. Reentrada compartilha leituras
pendentes e espera ação em andamento; timestamp/grant/erro são relidos do backend.
Se sair durante a leitura, não há POST em background. Falha preserva configuração;
novo acesso à tela pode recuperar a leitura. Backoff60s aplica-se a falhas, não
bloqueia sucesso seguido de timestamp comprovadamente vencido em outra entrada.

F5 restaura somente Configurações para o mesmo admin ativo autenticado, com marker
não secreto em sessionStorage vinculado ao UID. Sair da área remove o marker;
marker de outro admin não restaura. Nenhuma rota/URL ou Auth é alterado.
OAuth return continua abrindo a área e usa o mesmo ciclo de entrada.

Backend funcional permanece eb73b9e e calendarlist-association-v2: freshness5min,
manual forçado, compartilhamento in-flight e transações intactos. Sem novo scope,
coleção, timer/polling, eventos/freeBusy, Etapa3 ou alteração em Agenda/booking.
Testes de navegação executam todo index.html, Firebase Auth/HTTP simulados apenas
na borda, sem acesso Google/Firebase real; não substituir navigate/render/bind.
Na versão anterior, cinco regressões reais falharam (desktop/mobile reentrada,
listError, grant antigo, F5). A seção mais recente prevalece sobre o histórico.

Validação desta revisão: 97 unitários backend +77 HTTP/Auth/Firestore demo-forja;
23 pipeline frontend +95 Chromium (inclui13 navegações no portal completo) =292
aprovados. Fonte frontend SHA2566d11b17bd7c067e500577f1b8f720224b59595bb534c45a0ef7e6e4bef55d224;
HTML pré-central/Agenda/booking/relatório e API oficial preservados byte a byte.
Backend funcional não mudou. Testes em fixtures, sem OAuth/banco/Google reais.

## 05/10/2026 — ETAPA 2: refresh automático da CalendarList (somente PR/Preview)

Ajuste autorizado pelo usuário nos mesmos PRs backend#5/frontend#4 e branch
feat/secretaria-calendar-list-etapa-2. Sem merge/main/produção. Ao montar
Configurações → Google Calendar da Secretaria, a conexão autorizada atualiza
CalendarList se não houver sucesso nos últimos cinco minutos. Nada é importado:
somente metadados operacionais da lista, mantendo associações/enabled existentes.

Frontend chama POST .../calendars/refresh com {automatic:true}; botão manual
continua enviando {} e ignora freshness. GET continua read-only. Backend confere
último sucesso no Firestore, compartilha requisições simultâneas por conexão na
mesma instância e preserva revisão/transação contra corridas entre instâncias.
Erro permite nova tentativa automática depois de60s; manual permanece disponível.
Frontend também evita repetições enquanto há request ou tentativa recente.
Sem setInterval/setTimeout novo, job ou timer global: atualização ocorre somente
com a área montada, após carregamento/status ou reabertura da tela.

OAuth bem-sucedido muda revisão e marca not_refreshed; ao voltar a Configurações,
a atualização ocorre automaticamente mesmo se havia sucesso recente na revisão
anterior. Consentimento falho conserva conexão/configuração. Não há novo scope
nem nova configuração Google Cloud neste ajuste. Policy de health/UI passa a
calendarlist-association-v2 para exigir Render atualizado antes do Firebase Preview.

Falha/parcialidade não marca calendários removidos, não elimina períodos, não
indica horário livre. Lista/vínculos/intent ficam visíveis; effectiveEnabled fica
suspenso e há aviso local. Mesmo se a leitura de recuperação falhar, a UI preserva
os registros e mostra acesso não confirmado. Agenda/booking/disponibilidade,
pessoais, Google ocupado/eventos/freeBusy/watch e ETAPA3 continuam intactos.
O seletor continua estritamente teacher+active; um único professor é válido e
não exige correção nem cadastro automático. As seções anteriores são históricas.

Validação deste ajuste: 97 testes unitários backend +77 HTTP/Auth/Firestore demo-forja;
frontend23 pipeline +82 Chromium desktop/mobile. Todos279 aprovados, sem Google
real ou escrita no Firebase real. Cobertura nova: freshness5min, manual forçado,
concorrência, falha/cooldown, OAuth return, reabertura e troca de perfil.

## 04/10/2026 — Etapa 2 CalendarList central (em revisão, não produção)

### Etapa 2 — CalendarList central, configuração para uso futuro

Conta central existente; política `calendarlist-association-v1`. Conexão em
`google_secretaria_connections/escola`, separada de todas as conexões pessoais.
OAuth solicita somente openid/email + calendar.calendarlist.readonly. Prova do
scope efetivamente concedido no token endpoint + grantVersion=2. Grant antigo
exige Reconectar; consentimento/identidade/refresh token inválidos preservam
integralmente a credencial anterior. Reconexão válida mantém configurações, mas
exige Atualizar calendários para confirmar novamente o acesso.

Nova coleção `google_calendar_admin_calendars`: IDs SHA-256(accountKey + calendarId),
accountKey=SHA-256(sub OIDC verificado). Campos operacionais: connectionId=escola,
connectionType=secretaria, calendarId, displayName sanitizado, accessRole, primary,
accessStatus (accessible/no_permission/removed), teacherId, enabled, createdAt,
lastSeenAt, updatedAt, associationUpdatedAt/associatedByUid, enabledUpdatedAt/
enabledByUid e updatedByUid. Nenhum evento, descrição, location ou credencial.
Trocar conta central não reaproveita associações de outra identidade.

Rotas administrativas: GET /admin/google-calendar/central/calendars (somente
snapshot armazenado + professores ativos); POST .../calendars/refresh (paginação
Google CalendarList); PATCH .../calendars/{id-opaco} (teacherId e/ou enabled).
Conexão central conserva status/connect/callback/disconnect. Google recebe somente
GET CalendarList; fields reduzidos, showHidden/showDeleted, páginas completas.
Falha parcial não substitui a lista. Snapshot com no máximo 400 configurações
por conta é gravado atomicamente; acima do limite falha explícita, sem apagar.
Revision da conexão/lista bloqueia commits após desconexão/refresh concorrente.

Um calendário por professor nesta etapa, validado em transação; associação não
habilita, mudança de professor desabilita salvo pedido explícito. enabled é a
intenção salva; effectiveEnabled exige conexão/grant/acesso confirmados e professor
ativo. Perda de acesso/remoção preserva vínculo/intent, bloqueia uso e mostra aviso;
falha de refresh bloqueia effectiveEnabled até leitura completa bem-sucedida.
Nenhum destes campos alimenta Agenda/booking/sync nesta etapa.

UI Configurações → Google Calendar da Secretaria: conexão mascarada, aviso de
reautorização, Atualizar calendários, principal/próprio/compartilhado, acesso,
professor ativo + Salvar associação, Habilitado no FORJA e avisos de acesso perdido.
Ler a área não dispara refresh Google. Escopos solicitados conferidos também na UI.
Respostas/logs usam whitelist e erros fixos; tokens somente no backend.

Script/style centrais isolados; todo HTML pré-central, inclusive relatório,
permanece byte a byte igual. SHA-256 atual index.html: ecbbd77eeaea3b1511c13f70cc544406ce5b437f7b74dbb7195d1f7d7e890f77.
Marker frontend6.31.1 mantido; API oficial intacta.

Validação local: 96 testes backend unitários + 75 testes HTTP/Auth/Firestore
demo-forja; 23 testes pipeline frontend + 73 Chromium desktop/mobile.
Todos aprovados (267 ao todo). Checks dos PRs/Previews conferidos separadamente. Nenhum OAuth real ou
escrita no Firebase real executados. ETAPA1 consta como publicada pelo usuário.

## 04/10/2026 — Etapa 1 Google Calendar central, ainda não produção

### Etapa 1 — área Google Calendar da Secretaria

Configurações da Secretaria/Admin ativo ganhou um script final isolado
forja-google-secretaria-script. HTML anterior inteiro, inclusive relatório,
Agenda, drawer, telas pessoais e FORJA_API_URL oficial preservados byte a byte.
Marker de disponibilidade 6.31.1 mantido; feature marker separado
forjaGoogleSecretariaPolicy=identity-only-v1. Hash novo conscientemente fixado:
c9142dac5d0d0d8b8120e121e23406194ea44cb25cea988bde276e74940dd4da.

Área: Conectado/Não conectado, e-mail mascarado pelo backend, último status/data,
Conectar/Reconectar, Desconectar e Atualizar status. Carrega somente status central;
ações não chamam sync/watch/busy nem as rotas pessoais. Falha de status fica local,
com retry; resposta atrasada após troca de perfil é descartada. Callback usa aviso
próprio googleSecretaria e abre Configurações sem afirmar sincronização.

API central /admin/google-calendar/central/{status,connect,callback,disconnect}.
Cliente OAuth/secret/tokens nunca são configuração do frontend. Produção conserva
https://forja-api-m1kq.onrender.com; Preview substitui somente o artefato gerado com
URL Render do PR de backend. Gate requer googleSecretariaPolicy=identity-only-v1,
state-pkce-oidc-v1 e confirmed-week-v2 antes de publicar Preview.
Desconectar remove apenas credenciais centrais do FORJA; não revoga grant Google,
para preservar conexões pessoais do mesmo projeto. Sem Calendar API nesta etapa.

Testes isolados: backend unitários93 e integração64 (inclui12 centrais);
frontend pipeline23 e Chromium67 (inclui14 centrais desktop/mobile).
Assinatura OIDC real com chaves efêmeras/certificados simulados; Auth/Firestore demo-forja.
Regressões Google pessoal e6.31.1 preservadas. Não afirmar OAuth real validado.
PRs/CI/Previews devem ser conferidos separadamente; nenhum merge/produção autorizado.

# FORJA — frontend

## Revisão visual — eventos da Agenda da Secretaria (somente Preview)

Ajuste de apresentação autorizado, sem mudança de disponibilidade, publicação,
backend, dados ou regras. Botões/divs agora usam o mesmo layout no topo esquerdo:
professor primeiro; tipo/matéria e horário exato na segunda linha. Padding lateral,
borda/radius uniformes, overflow hidden e tipo truncado antes do horário.
Eventos curtos recebem compactação apenas visual, sem arredondar horários.
Hover não move eventos. Dia/Semana/Mês preservam legibilidade; Dia se adapta à
largura do celular. Fundo da grade agora usa48px/hora, mesma escala já existente
no posicionamento, em vez dos60px/hora herdados que causavam desalinhamento.

v621EventStyle e v629SlotStyle permanecem byte a byte iguais, inclusive altura
mínima existente; fontes/regras v621AvailabilityForDay e v629DayData e script
completo do drawer6.31.1 intactos. Horários12:33–13:00,14:00–14:44 e19:58–21:52
não foram arredondados. API oficial e backend03aa329 permanecem inalterados.

Chromium:18 novas regressões visuais (30min,60min,2h,4h, horários quebrados,
aula entre dois verdes, margens/cores, Dia/Mês, desktop/mobile). O teste4h
reproduziu a centralização vertical antes da correção. Após correção,21testes
pipeline e53Chromium passaram (20drawer,5publicação,10Agenda,18visuais).
Capturas geradas com fixtures locais, sem contato com banco/Auth/Google reais.
SHA-256 de origem atualizado conscientemente: f14755958947c9eb4742f35083ef75493cca1d15a11202608f4472571327b5ed.
Versão permanece6.31.1. Atualizar somente PR#2/Hosting Preview; sem merge/main
ou produção até confirmação final após validação manual.


## Revisão 6.31.1 — Agenda e booking com a mesma publicação (somente PR #2/Preview)

Leitura real antes/depois: runs37167019477 e37167340138 (SDK read-only),
profissional/aluno/matéria localizados sem UID manual. Após correção, Agenda
retornou publicationValid=false, disponibilidade vazia e confirmed-week-v2;
booking retornou publishedPeriods=[] e slots=[] para04/10/2026/60min.
Aula real13:00–14:00 permaneceu armazenada. Scripts/job/chave pública temporários
foram removidos do estado final do PR; nenhum caminho de diagnóstico permanece.


Causa confirmada por leitura real em 04/10/2026: a Agenda administrativa usava
professionalAvailabilityWeek no modo de rascunho, enquanto booking exigia
confirmed-week-v2. Semana de 28/09 sem publication válido contém domingo
12:33–14:44. Aula 13:00–14:00 e ocupado Google na mesma faixa deixam 27/44 min;
isso também não permite duração de 60 min, mesmo em fixture confirmada.
O documento real não foi alterado, confirmado, apagado ou migrado pelo diagnóstico.

Agora /admin/disponibilidades-semana usa publishedOnly:true e retorna
availabilityPolicy=confirmed-week-v2 e publicationValid por profissional.
Agenda, consultas administrativas antigas e booking usam a mesma validação
isPublishedAvailabilityWeek: source profissional sozinho nunca autoriza verde.
O editor profissional continua lendo rascunhos para revisão explícita.
O frontend administrativo recusa caches sem a política/recibo válidos ou de
outra semana; mantém aulas azuis e corta também ocupado Google de dia inteiro.
Não há publicação automática de legado nem filtro visual de horários específicos.
/health informa secretariaAvailabilityPolicy=confirmed-week-v2 para comprovar
que o Render Preview já possui o contrato unificado antes do Hosting Preview.

Verificação real: SDK get com facade que recusa operações de escrita e replay
exato das rotas sem iniciar servidor/Auth/Google. Não equivale a sessão HTTP
administrativa autenticada. Testes isolados cobrem domingos confirmados livres,
duração completa, aulas, Google, recibo invalidado e caches antigos.
Nenhum merge/main/produção autorizado. Publicação futura depende de validação
manual e confirmação final do usuário, inclusive PR #2 do backend.


### Validação read-only concluída; auditoria temporária removida

Run37165057555 passou em03/10/2026: leitura real localizou Carlos/Matemática/João
sem ambiguidade. Semana2026-09-28 mantém sábado19:58–23:58, source profissional,
publicationPresent=false, publicationValid=false. Reprodução interna do GET com
confirmed-week-v2 retornou status200, publishedPeriods=[] e slots=[] para
03/10/2026,60min. Sem PATCH, publicação da semana, criação de aula, migração,
Auth ou Google sync na validação. Distinguir replay com dados reais de chamada
HTTP autenticada ao Render; esta depende de Preview atualizado e sessão legítima.

Job read-only-firestore-audit, script de identidade, script de auditoria e chave
pública removidos do conjunto final do PR. Hosting Preview liberado novamente;
produção continua restrita a main, que não foi alterada. Backend final também
impede que sync de saída exporte rascunhos/legado como disponibilidade Google;
74+32 testes passaram localmente. Sem alteração manual do documento real.


## 03/10/2026 — 6.31.1-secretaria-drawer-fluido / publicação confirmada

Backend PR #2 c4397768afad8e273fb5a24501a57852e4478e41 exige
confirmed-week-v2. O drawer recusa published-week-v1; não filtra faixas de horário
no cliente. A fonte real de Carlos contém sábado19:58–23:58 com source profissional,
que sozinho deixa de autorizar marcação. Não alterado manualmente nenhum dado.

Backend confirma SHA-256 do JSON canônico {version:1,timeZone:"America/Sao_Paulo",
professionalId,weekStart,semana}, com receipt publication={version,fingerprint,
confirmedById,confirmedAt,action,copiedFrom}. Salvar sem confirmation é rascunho;
hash divergente é recusado; alteração Google invalida recibo; cópia de origem sem
recibo não pode publicar diretamente. GET e POST /aulas usam a mesma prova.

Os cinco chamadores existentes de PATCH /disponibilidade-semanal agora exibem
confirmação explícita com TODOS os períodos e respectivas datas da semana,
inclusive herdados. O hash enviado corresponde exatamente a essa configuração.
Cancelar não faz PATCH nem muda cache. Copiar orienta revisar/publicar e envia
somente rascunho. Alteração de UI limitada a essa confirmação de publicação;
sem reformulação da agenda de professor/aluno ou Google central.

Marker 6.31.1-secretaria-drawer-fluido e SHA-256 atualizado conscientemente no
validate.mjs. Fonte oficial mantém https://forja-api-m1kq.onrender.com; só artefato
Preview substitui URL pela descrição do PR. Firebase config/Auth/Rules intactos.
Validação exige health 6.31.1-secretaria-publicacao-confirmada no Render Preview.

20 testes pipeline,20 testes do drawer e5 testes da confirmação em Chromium
passaram localmente, além de74+32 backend. Atualização dos Previews/resultados
reais deve ser conferida pelo commit publicado. Sem merge/main/produção.
Instrumentação temporária read-only será removida após leitura de validação;
nenhum script de auditoria deve permanecer no conjunto final antes do merge.


## Revisão do PR #2 — horários publicados e CSS real (03/10/2026)

O CSS 6.31 estava indevidamente dentro da string de exportReport. A coleta por
regex dos testes incluía esse style de JavaScript, mascarando a ausência no portal.
A verificação visual anterior era um falso positivo. Agora o bloco inteiro está
no style real forja-v630-style, com escopo #v630BookingRoot, e foi removido do
relatório. Seu CSS de impressão original é validado separadamente sem alteração.

Os testes parseiam o HTML com DOMParser do Chromium e clonam somente styles
reais. Há um controle negativo: mover novamente o bloco para exportReport deve
produzir largura470/4 colunas, não a largura440/6 colunas correta. Testes reais
verificam desktop/mobile, padding, grid de seis passos, scroll, limite180px da
grade, overflow e cores/aria-pressed do slot selecionado. 20 testes passaram,
além de 17 proteções do pipeline. Fixtures são isoladas; não substituem login real.

Auditoria dos slots: v630LoadSlots usa /profissionais/disponibilidade. Não há
fallback visual gerando horários. No backend, professionalAvailabilityWeek podia
migrar disponibilidade recorrente do perfil para a semana atual durante o GET.
Sem publicação semanal, um legado de sábado20–22 reproduziu exatamente os três
slots relatados. O documento real do Carlos ainda não foi consultado de forma
autenticada; não afirmar que sua origem é essa sem resposta/semana sanitizada.

Correção da fonte em PR separado: gokuoficialbr123-gif/forja-backend #2,
fix/secretaria-slots-publicados-6.31.0, versão6.31.0-secretaria-disponibilidade-publicada.
Fonte explícita: disponibilidades_semanais, professionalId|segunda-feira em
base64url, semana[dia]. Exige origem de publicação válida e metadados corretos,
sem migrar legado ao consultar marcação. Slots derivam somente das janelas,
com duração completa e remoção por conflitos/bloqueios/locks. POST /aulas revalida
publicação dentro dos locks. Auth, professor/aluno, Calendar/sync e demais rotas
mantêm regras anteriores. Legados não são apagados; publicação pelo fluxo
existente é necessária para autorizar novas aulas.

O frontend exige availabilityPolicy=published-week-v1 e mostra erro explícito
se conectado a backend antigo; não inventa nem esconde slots com filtro de faixa
local. Preview deve usar Render Preview do PR backend, via comentário
FORJA_PREVIEW_API_URL da descrição do PR, alterando só o artefato gerado.
index.html continua com a API oficial; configuração Firebase não foi alterada.
O usuário forneceu Render Preview https://forja-api-pr-2.onrender.com.
A descrição do PR #2 aponta para ele via FORJA_PREVIEW_API_URL; o workflow
verifica health 6.31.0-secretaria-disponibilidade-publicada, CORS/Auth e HTML.
O acesso direto deste ambiente recebeu CONNECT403; a verificação pública ocorre
no runner GitHub. Nenhum merge ou produção autorizado; não tocar main.

Após a atualização do Preview: exigir sucesso da verificação de
hash/marker e CORS/Auth pelo workflow; testar manualmente Carlos, João, Matemática,
03/10/2026, 60min. Sem disponibilidade explicitamente publicada naquele dia,
nenhum slot deve aparecer. Dados de Preview continuam reais, sem criar aulas
nem ampliar permissões para teste automático.


## 03/10/2026 — 6.31.0-secretaria-drawer-fluido (em revisão)

- Secretaria → Marcar aula mantém drawer/campos montados e atualiza subseções.
- Fluxo Professor → Matéria → Aluno → Data/Duração → Horários → Confirmar.
- Preserva scroll, foco e valores compatíveis; loading só nos horários.
- Invalida respostas antigas e bloqueia fundo/body/calendário; auto sync continua.
- Filtra alunos pelas mesmas regras existentes de atividade, catálogo/série e
  pacote do backend, sem fallback por catálogo; pacotes relidos ao abrir.
- Confirmação e contrato /aulas preservados; locks e Calendar ficam no backend
  6.30.1 intacto. Nenhuma alteração em aluno/professor/Google central.
- 14 regressões em Chromium, 17 testes de pipeline e 57 regressões existentes
  do backend passaram; sintaxe/hash/artefato e actionlint passaram.
- Preview somente frontend seleciona explicitamente API oficial intacta; o
  Render Preview anterior responde 404 e não é necessário novo backend.
- Release/hash preparados para revisão. Sem merge ou publicação live.


## 03/10/2026 — deploy automático de produção habilitado

FIREBASE_HOSTING_ENABLED=true foi habilitado pelo usuário no repositório
forja-escola. Este commit somente de documentação em main dispara o workflow
Firebase Hosting FORJA para a primeira publicação automática autorizada.

A produção usa a geração sem --preview: index.html 6.30.0 permanece intacto,
com marker 6.30.0-bloco-a-secretaria-marcar-aula e API oficial
https://forja-api-m1kq.onrender.com. O /health oficial confirmou
6.30.1-cors-preview-forja-escola antes do acionamento. Nenhuma configuração
Firebase, URL da API ou lógica do portal foi alterada por este registro.
O resultado da publicação será confirmado pelo job production e leitura pública.

## 03/10/2026 — artefato Firebase Preview com backend temporário

- Fonte index.html preservada, inclusive URL de API oficial e hash 6.30.
- prepare-hosting.mjs ganha modo --preview; só o artefato gerado substitui a
  única declaração FORJA_API_URL pelo parâmetro temporário do PR.
- preview-config.mjs lê esse parâmetro da descrição do PR, restringe HTTPS e
  o padrão forja-api-pr-N.onrender.com; URL atual não é hardcoded no Git.
- Produção ignora o parâmetro e mantém os bytes/hash fixos originais.
- verify-hosting.mjs deriva o hash de Preview da transformação única validada;
  verify-preview-backend.mjs verifica health, versão, CORS, preflight e Auth.
- 16 testes passaram, zero falhas/skips; actionlint, sintaxe e diff check passaram.
  Testes incluem Preview/produção separados, fonte intacta, parâmetro obrigatório,
  URLs falsas, alteração adicional e rejeição de Preview pela validação produção.
- Verificador de Vary exige presença de Origin e permite o Accept-Encoding
  acrescentado pelo proxy Render; teste de regressão cobre tokens falsos/ausentes.
- Sem alterações de Auth, Firestore, Google Calendar, regras ou versão do portal.
  Sem merge, ativação ou produção. Publicação Preview e resultados no PR #1.
- O secret inicial foi corrigido pelo usuário; tentativa 3 de Hosting run
  37138923430 criou o primeiro Preview com sucesso. Registro anterior é histórico.

## 03/10/2026 — envio para revisão e tentativa de preview

O usuário autorizou commit/push da estrutura em `setup/firebase-hosting-6.30`,
PR para main e tentativa de Preview Channel com o secret já criado por ele.
Como o repo estava vazio, foi criada uma base main contendo somente README de
revisão, sem HTML ou workflows. Sua criação não executou deploy nem merge.

- Preview separado da variável de produção; mantém validação obrigatória e
  restrição a PRs confiáveis do próprio repositório.
- Job verifica somente a disponibilidade de FIREBASE_SERVICE_ACCOUNT_FORJA_ESCOLA.
- Não ativar FIREBASE_HOSTING_ENABLED, fazer merge ou publicar produção.
- Nenhuma alteração no HTML ou na lógica da aplicação.
- [PR #1](https://github.com/gokuoficialbr123-gif/forja-escola/pull/1) aberto;
  commit inicial `f50acde16b9111067a4e113235bb33934fb71066` publicado.
- Validação de push e PR passaram, incluindo os oito testes do pipeline.
- Hosting validou o artefato; preview falhou na checagem de presença do secret,
  antes da publicação. Produção skipped. Sem Preview Channel ou URL.
- Metadados de secrets: HTTP 403 pela integração. Secret recebido vazio no job;
  conferir a entrada em Repository secrets do frontend. IAM Firebase não testado.
- Registro detalhado dos runs e diagnóstico em DEPLOYMENT.md.

## 03/10/2026 — preparação de versionamento e Hosting, sem nova release

Referência preservada: **6.30.0-bloco-a-secretaria-marcar-aula**.
O usuário aprovou a auditoria e definiu este repositório como frontend oficial.

### Preparado localmente

- `index.html`: cópia byte a byte da 6.30 confirmada em produção.
- `firebase.json` / `.firebaserc`: projeto/site forja-escola e pasta isolada.
- `.gitignore`: artefatos, configurações locais e nomes de arquivos de credencial.
- `AGENTS.md` e três documentos de contexto, publicação e histórico.
- Workflow de validação e workflow Hosting, com deploy desativado por variável.
- Scripts sem dependências npm para release/hash/sintaxe, preparação e verificação pública.
- Oito testes que detectam marker/hash incorretos, configuração insegura,
  JavaScript inválido, arquivos indevidos no artefato e publicação divergente.

### Evidências

- HTML: 1.661.612 bytes; SHA-256
  `447bef249c8e4ea839b133739311fcf68d271c0c6d8b4c482a650fcf35a22868`.
- Marker ativo e dois scripts inline validados em Node.js 22.
- Oito testes passaram, sem testes skipped ou failed.
- Artefato repetível contém somente index.html; cópia sem transformação.
- Workflows passaram em actionlint 1.7.7, obtido com checksum oficial verificado.
- Verificação pública pelo script passou contra o Firebase atual, usando
  `NODE_USE_ENV_PROXY=1` no ambiente da nuvem; nenhum deploy foi executado.
- No backend, somente os quatro documentos foram commitados na branch
  `docs/forja-context-6-30`, commit `b75b7672bccfa901deeaed701d616bbd9098b9df`.
  Os oito arquivos funcionais ficaram intactos.

### Não executado / pendências na preparação inicial

Este registro descreve a etapa anterior à autorização de envio; o resultado da
continuação consta no início deste documento.

Nenhum commit do frontend, push, merge, deploy, criação de Preview Channel,
conta de serviço, chave, secret ou ativação da variável. Não alterada lógica do
FORJA, Firestore, Auth, Google, Render ou automação D-2.

Pendentes: autorização manual GitHub → Firebase pelo usuário, revisão da
configuração Hosting histórica e autorização para versionar/enviar o frontend
e ativar a publicação. CI real e autenticação de deploy ainda não foram testadas.
O sucesso dos testes locais não garante que a credencial de deploy funcione.

## 6.30.0 — base existente

Secretaria: disponibilidade multi-professor 6.29 preservada; drawer Professor →
Matéria → Aluno → Horário → Confirmar. Backend considera conflito do aluno e
valida a criação com locks. Google individual e agenda do professor preservados.

Bug prioritário ainda pendente: drawer volta ao topo por renderização integral.
Filtro de aluno pode divergir do pacote ativo exigido no backend. Nenhuma
correção funcional foi feita na preparação do GitHub/Firebase.

## História anterior, conforme backups

6.29: Secretaria multi-professor. 6.28: scroll do professor corrigido.
6.27: atualização silenciosa e fallback de cinco minutos. 6.26/6.25: refinamento
da agenda e ações diretas. 6.24: layout V2. 6.23.1: hotfix de montagem.
6.23/6.22/6.21: agenda e sincronização consolidadas. 6.20: integração bidirecional.

Entregas futuras devem registrar versão, arquivos, testes realmente executados,
commit, autorização, deploy real, validação pública, rollback e pendências.
