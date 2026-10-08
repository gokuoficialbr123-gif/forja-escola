## 08/10/2026 — Issue #6: Novo usuário (somente PR/Preview)

Base: main 81265f9, após publicação da Etapa 3. Branch feat/novo-usuario-quatro-perfis.
Mudança localizada em newUserModal() e stylesheet forja-new-user-style, escopo
#forjaNewUserDialog. Perfis e valores preservados: teacher, psychologist, student,
parent. Sem staff/admin novo. Campos, endpoints, disciplinaIds e vínculos FORJA
seguem o contrato anterior. Matérias: busca sem acentos, checkboxes, chips removíveis,
contador e limpar; select oculto conserva a serialização original. Seções por perfil
sem recriar controles, mantendo dados e turma quando compatível. Envio único com
feedback local, bloqueio durante request e mesmas ações de ativação/reload.

Sem mudança de backend/Auth/Rules/Google/Agenda/booking ou dados reais. Testes com
portal completo em Chromium e APIs/Firebase Auth simulados na borda, sem criar contas
reais. Screenshots antes/depois contêm somente dados fictícios dos testes. Hash
validado foi atualizado conscientemente. Marker de Agenda 6.31.1 permanece intacto.

Preview frontend-only opta explicitamente pelo backend oficial inalterado:
FORJA_PREVIEW_BACKEND=production-unchanged na descrição do PR. Verificador desse modo
corrigido da referência antiga 6.30.1 para a versão oficial constatada 6.31.1;
isolamento/versão obrigatórios para modo render-preview continuam intactos.
Preview não é um banco isolado. Testes automáticos sempre mocks; nenhuma conta real
foi criada. Sem merge/push main/produção até aprovação visual e funcional.

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

# FORJA Escola / Projeto Júlio — frontend oficial

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


## Estado atual — 6.31.0 preparada para revisão

Produção conferida antes da correção: frontend 6.30.0 com SHA-256
447bef249c8e4ea839b133739311fcf68d271c0c6d8b4c482a650fcf35a22868,
API oficial https://forja-api-m1kq.onrender.com e backend
6.30.1-cors-preview-forja-escola. Ambos os PRs anteriores foram integrados
pelo usuário; main frontend está em 4f03b7dea4b2646ab0887a51b3278882059110b6.
Produção automática foi habilitada na etapa anterior. Os registros abaixo
sobre restrições e PRs antigos são históricos.

O novo trabalho usa fix/secretaria-drawer-6.31.0, sem merge/push em main.
Alteração funcional exclusivamente no script final do drawer e CSS limitado
por #v630BookingRoot. O restante do frontend foi comparado byte a byte com main.
Backend, rotas, locks, Calendar, Auth, Rules e dados não foram modificados.

Causa: v630Render substituía drawer.innerHTML em seleções e em cada fase de
v630LoadSlots, recriando scroll/foco. Reset de dependências não invalidava toda
consulta pendente; respostas antigas podiam preencher filtros novos. O fallback
studentSubjects permitia catálogo/série sem vínculo de pacote. active !== false
permitia perfis sem active true, recusados pelo servidor.

A estrutura do drawer agora monta uma vez. Professor atualiza matérias/alunos/
horários; matéria atualiza alunos/horários; aluno, data e duração atualizam
horários. Resumo/estado dos passos atualizam localmente. Campos compatíveis ficam
selecionados; incompatíveis são limpos. Loading somente no bloco de horários,
respostas obsoletas descartadas, botões delegados, confirmação final preservada.
Pacotes são relidos ao abrir e o aluno fica bloqueado até validar a resposta.

Aluno elegível: student + active true; disciplina presente/ativa; seriesIds
normalizados sem restrição ou contendo a série do aluno; vínculo correspondente
em aluno_materias com status diferente de inativo. Mesmas condições dos helpers
assertDisciplineForStudent/assertStudentHasActiveSubject e da disponibilidade
6.30.1. O servidor continua autoridade final caso os dados mudem depois da leitura.

Scroll: body fixado conservando posição/largura, fundo inert e overscroll contido.
Área dos horários mantém sua altura durante troca/loading; grade tem altura
limitada. Renderizações da agenda são adiadas enquanto o drawer estiver aberto,
mas timer, consultas e sincronização de cinco minutos continuam executando.
Fechar libera o fundo, aplica atualização pendente e restaura scroll/foco.

O Render Preview anterior /forja-api-pr-1 retorna 404. Como não há mudança de
backend, este PR opta explicitamente por production-unchanged e usa a API oficial
no Firebase Preview. Não precisa criar um novo serviço Render. Auth/Firestore
seguem serviços reais; automação verifica somente leituras/CORS/Auth sem token.
Fluxo real de login/confirmação Google continua exigindo teste manual autorizado.


Registro de 03/10/2026, fuso America/Sao_Paulo. O usuário definiu
`gokuoficialbr123-gif/forja-escola` como repositório oficial do frontend.
O código foi preparado no checkout `/workspace/forja-escola`. A continuação foi
autorizada em `setup/firebase-hosting-6.30`, com commit/push, PR e tentativa de
preview. Merge, ativação da variável e publicação em produção continuam proibidos.

## Atualização: Firebase Preview conectado ao Render Preview

O backend está em revisão no PR #1 de forja-backend, commit
849a16f16df1d6bb1c860730f85f0b4e96346e31. O usuário confirmou o serviço Preview
com /health 6.30.1-cors-preview-forja-escola; produção segue no backend original.
Esta etapa autoriza atualizar e republicar somente o Firebase Preview do PR #1
frontend. Sem merge, ativação da variável ou deploy de produção.

O index.html oficial continua byte a byte igual à base e com a API oficial.
Apenas .firebase-public/index.html gerado para Preview substitui a única declaração
FORJA_API_URL. A URL temporária é um parâmetro na descrição do PR, não um valor
permanente do portal ou do workflow. O parâmetro precisa corresponder ao padrão
HTTPS forja-api-pr-N.onrender.com; faltando ou inválido, Preview falha.

validate.mjs mantém o hash original fixo. O hash do Preview é derivado da fonte
validada com a única substituição permitida; não se aceita hash arbitrário nem
um arquivo gerado sem conferir sua origem. Produção ignora a variável temporária
e continua exigindo os bytes originais. Ambos mantêm o mesmo marker frontend.
Dezesseis testes locais passaram, incluindo artefatos separados e rejeição de
alterações adicionais; resultados de publicação e integração constam no PR.

Auth, Firestore, Google Calendar e regras de negócio não foram modificados.
O banco/Auth continuam configurados conforme a base; não declarar isolamento
completo só porque a API está em outro serviço. Verificação pós-Preview é somente
GET/OPTIONS: health/version, CORS, preflight e /me exigindo autenticação.

O bloqueio inicial do secret descrito abaixo é histórico: run 37138923430,
tentativa 3, passou e criou o primeiro Firebase Preview. Não pedir outro secret.

## Origem e versão preservadas

A base é exatamente o `index.html` do pacote
`FORJA_6.30.0_BLOCO_A_SECRETARIA_MARCAR_AULA.zip`, também presente em
`ULTIMA_VERSAO_6.30.0` no backup completo de 02/10. O arquivo foi comparado com
o HTML realmente servido por `https://forja-escola.web.app` e copiado byte a byte.

- Marker ativo: `6.30.0-bloco-a-secretaria-marcar-aula`.
- Tamanho: 1.661.612 bytes.
- SHA-256: `447bef249c8e4ea839b133739311fcf68d271c0c6d8b4c482a650fcf35a22868`.
- JavaScript inline: dois blocos, ambos aprovados em verificação de sintaxe.
- O HTML, CSS, JavaScript, URLs de API, Firebase web config e regras da aplicação
  não foram alterados para colocar o frontend sob versionamento.

O marcador e o hash estão fixados em `scripts/validate.mjs`. Eles impedem
publicar por engano um protótipo, versão antiga ou arquivo diferente da base.
Uma futura mudança funcional autorizada deve atualizar a referência e o changelog
conscientemente; não remover a validação para fazer uma falha passar.

## Arquitetura

| Componente | Local/serviço |
| --- | --- |
| Frontend | `index.html`, portal existente com HTML/CSS/JavaScript inline |
| Hosting oficial | Site e projeto Firebase `forja-escola`, `https://forja-escola.web.app` |
| Autenticação/banco | Firebase Authentication e Firestore |
| Backend | `gokuoficialbr123-gif/forja-backend` |
| API | `https://forja-api-m1kq.onrender.com` |
| Publicação proposta | GitHub Actions → Firebase Hosting |

O backend e o `/health` público informavam 6.30.0 na auditoria. Os arquivos
`src/server.js` e `src/firebase.js` eram idênticos aos do ZIP 6.30.
`main` do backend estava em `d019898ccbdd598fc06b6df03fda4474eb5cdfb7`.
Os quatro documentos do backend foram commitados localmente em
`docs/forja-context-6-30`, commit `b75b7672bccfa901deeaed701d616bbd9098b9df`,
sem modificar os oito arquivos funcionais existentes. Não houve push ou merge.

## Contexto e regras de produto

Fontes: backup completo de 02/10, backup mestre e Firestore de 01/10, prompts
de continuidade/automação e documentação das versões 6.20–6.30. Conteúdo antigo
de 5.6/6.20 ou fallback de 15 minutos é histórico, não o estado atual.

- Preservar o projeto existente; não reconstruir, usar mocks ou recriar banco.
- Roles oficiais: admin, teacher, psychologist, student, parent. Nunca staff.
- Azul = Aula; verde = Disponível; vermelho = Ocupado.
- Eventos pessoais Google aparecem somente como Ocupado, sem título/descrição.
- Conexões Google individuais dos professores e webhook devem ser preservados.
- Fallback e refresh silencioso: cinco minutos. Scope atual: calendar.events.owned.
- Secretaria: disponibilidade multi-professor da 6.29 e drawer de marcação 6.30.
- Professor: base visual 6.28 com scroll corrigido e sync da 6.27.
- Aluno/responsável não recebem telefone pessoal do professor; não expor detalhes clínicos.
- Preservar correção de participação/remarcação com lessonShouldAutoCancel no backend.
- Não alterar Firestore, Rules, IDs, forjaId, disponibilidade ou dados legados nesta etapa.
- D-2/WhatsApp permanece preservado. Existe workflow D-2 ativo no backend;
  ele não faz parte da publicação do frontend e não foi executado por esta tarefa.
- OTP não deve ser ativado nesta etapa.

## Bug prioritário, ainda sem correção

O drawer Secretaria → Marcar aula volta ao topo após cada seleção.
`v630Render()` substitui o HTML inteiro do drawer, recriando seu contêiner de
scroll. A carga de horários também chama essa renderização no início e no fim.

O filtro de alunos pode recorrer ao catálogo/série quando faltam vínculos,
enquanto o backend exige matéria liberada em `aluno_materias`. O bloqueio de
scroll do body já existe; o movimento do fundo precisa ser reproduzido nos
contêineres reais antes de mudar CSS.

Uma futura correção deve manter o drawer montado, atualizar subseções, preservar
seleção/foco/scroll e alinhar o filtro com o backend. Preservar locks de agenda,
conflitos e sincronização Google. Nenhuma dessas alterações foi feita aqui.

Depois da Secretaria: Google central da escola, mediante análise dos scopes;
depois treinamento genérico baseado em Matemática Básica I, nivelamento adaptativo,
acompanhamento, cronograma e financeiro com requisitos confirmados.

## Infraestrutura preparada nesta etapa

`firebase.json` aponta explicitamente para o site `forja-escola` e para a pasta
gerada `.firebase-public/`. O artefato contém exclusivamente `index.html`.
A configuração aplica fallback de rotas para esse HTML, compatível com o
comportamento observado de uma rota pública arbitrária. A configuração antiga
do Cloud Shell não foi recuperada: headers/redirects personalizados ainda devem
ser conferidos antes de ativar o deploy. Nenhuma configuração publicada foi mudada.

O workflow de validação é reutilizado pelo workflow Hosting. Preview só recebe
credenciais em PR do próprio repositório; produção só em push de main.
Somente produção depende de `FIREBASE_HOSTING_ENABLED=true`; não ativamos essa
variável. O usuário informou a criação do secret Firebase. No primeiro job do
PR #1, ele veio vazio; a checagem de presença falhou, sem exibir seu valor e
antes de qualquer publicação. A leitura de metadados por API recebeu HTTP 403.
O PR e a branch foram publicados, sem merge. Ver diagnóstico em DEPLOYMENT.md.

Preview Channel publica uma cópia do HTML, mas continua usando os serviços reais
configurados no arquivo. Não equivale a um banco ou backend de testes.

Validados localmente e no GitHub Actions: marker/hash/sintaxe, oito testes do
pipeline e geração do artefato. Actionlint também passou localmente. O Hosting
validou o artefato, mas preview falhou na presença do secret. Não executados:
autenticação Firebase, publicação de Preview Channel, deploy live e fluxo
autenticado da Secretaria. Ver DEPLOYMENT.md para resultados e desbloqueio.
