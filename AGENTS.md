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

## Etapa 2 — descoberta/associação CalendarList central (somente PR/Preview)

Autorização atual: ETAPA 0 e ETAPA 1 publicadas. Trabalhar na branch
`feat/secretaria-calendar-list-etapa-2`, sem merge/main nem produção.
Conexão central: scopes somente `openid email` mais
`https://www.googleapis.com/auth/calendar.calendarlist.readonly`.
Não alterar scopes/conexões pessoais, Agenda, booking, publicação, locks ou sync.
Não consultar busy/eventos, criar webhooks, importar ou escrever eventos centrais.
Somente admin ativo pode descobrir e configurar calendários. Associação explícita
somente a usuários teacher ativos; nunca inferir pelo título/e-mail. Novos registros
sem associação e desabilitados. Troca de professor desabilita por padrão.
Testes somente mocks/emuladores demo-forja, sem OAuth/Google/Firebase reais.
Preview compartilha Firebase real: não executar ações mutáveis para teste automático.
Credenciais AES-GCM/backend, PKCE, state atômico e OIDC mantidos.
Os registros das etapas anteriores abaixo são históricos; esta seção prevalece.
Ler o topo dos três documentos em docs antes de continuar.

## Etapa 1 — Google Calendar central da Secretaria (somente PR/Preview)

Autorização atual: conexão central separada, somente admin ativo; status, OIDC,
conectar/reconectar/desconectar. Sem Calendar API, lista de calendários, busy,
webhook, importação, escrita de eventos ou alterações Agenda/booking/disponibilidade.
ETAPA 0 já publicada. Instruções anteriores abaixo são históricas; preservar a
produção 6.31.1 e trabalhar em feat/secretaria-google-central-etapa-1, sem merge/main.
Não testar OAuth/sync reais nem escrever em Firebase real: somente demo-forja.
Central usa cliente OAuth próprio + openid/email; scopes pessoais intactos.
Credenciais AES-GCM só no backend, nunca no HTML/respostas/logs. Disconnect central
remove apenas a credencial central local, sem revogar grant Google do projeto.
Ler a atualização no topo dos três documentos.

# FORJA — frontend oficial

Etapa atual: APENAS apresentação dos eventos na Agenda da Secretaria autorizada.
Não alterar regras/publicação/booking/horários/backend/dados. Escopo CSS e conteúdo
visual v629; funções de geometria e fontes v621/v629DayData preservadas. Executar
21pipeline e53Chromium, incluindo scripts/secretaria-agenda-visual.test.mjs.
Mesmo PR#2/branch de revisão. Sem merge/main/produção.

Escopo atual autorizado: unificar disponibilidade da Agenda da Secretaria e
Marcar aula, mantendo publicação confirmed-week-v2 e legado não confirmado
sem slots/verdes. Não confirmar/modificar Carlos para testes. Sem merge/main ou
produção até validação manual e confirmação final. Testes: backend 74+37;
frontend pipeline21 e Chromium35 (drawer20, publicação5, Agenda10).
Leia a revisão no topo de docs/FORJA_PROJECT_CONTEXT.md.

CORREÇÃO ATUAL:6.31.1-secretaria-drawer-fluido; backend
6.31.1-secretaria-publicacao-confirmada. Exigir confirmed-week-v2, jamais source
ou published-week-v1 como prova. Cinco salvamentos só publicam após confirmação
visível da semana inteira. Cópia é rascunho. Alterar exclusivamente publicação,
sem ampliar outras telas/regras. Dados de Carlos permanecem preservados.
Auditoria temporária removida: nenhum job/script/chave de auditoria no PR final.
Validação real read-only confirmou zero slots para o período não confirmado.
Preview Hosting restaurado; exigir health atualizado antes de publicar.
Não usar Auth/Google/escritas reais para testes. Sem merge/main/produção.

Revisão atual do PR #2: CSS real forja-v630-style e fonte de disponibilidade
publicada corrigida no PR #2 separado do backend. Não usar mais o modo de Preview
production-unchanged para esta versão: o drawer exige confirmed-week-v2 e health
6.31.1-secretaria-publicacao-confirmada no Render Preview.
URL fornecida: https://forja-api-pr-2.onrender.com, configurada na descrição do
PR #2 para substituir somente o artefato Preview. Exigir checks públicos aprovados;
nunca copiar temporária para index.html.
Testes de CSS devem usar parser HTML/DOM real, nunca regex que extraia style de
strings JavaScript. Execute 20 testes drawer + 5 publicação Chromium e 20 testes pipeline. Relatório
exportReport deve manter seu CSS original sem #v630BookingRoot. Preservar demais
áreas, locks, sync, Auth e Firestore. Sem merge/main/produção.


Leia os três documentos em `docs/` antes de trabalhar. Este checkout é
`gokuoficialbr123-gif/forja-escola`; o backend permanece em `forja-backend`.

- Trabalhe no checkout existente; não crie worktrees sem solicitação.
- Base publicada: 6.30.0; release preparada neste PR:
  `6.31.1-secretaria-drawer-fluido`. Correção autorizada exclusivamente em
  Secretaria → Marcar aula, testes e infraestrutura necessária ao Preview.
  Não reconstruir o portal nem alterar aluno, professor ou Google central.
- Preserve Firebase Hosting/Auth/Firestore, backend Render e dados reais.
- Perfis: admin, teacher, psychologist, student, parent. Nunca crie staff.
- Agenda: azul Aula, verde Disponível, vermelho Ocupado. Eventos pessoais Google
  são privados. Preserve sync de cinco minutos e conexões individuais.
- Branch de revisão: `fix/secretaria-drawer-6.31.0`. Commit/push, PR e Firebase
  Preview autorizados. Não fazer merge nem push em main. A produção automática
  já está habilitada; um push em main publicaria produção e não está autorizado.
- Drawer: manter estrutura e campos montados; atualizar apenas dependências,
  invalidar consultas antigas, preservar foco/scroll e seleções compatíveis.
- Elegibilidade reproduz /profissionais/disponibilidade e POST /aulas:
  role student, active === true, matéria existente e active !== false,
  série compatível quando restrita, vínculo aluno_materias status !== inativo.
  Pacotes não carregados/falhos nunca autorizam fallback pelo catálogo.
- Preservar validação final, locks e sincronização existentes do backend.
- Não crie service accounts, chaves ou secrets sem a autorização necessária;
  o usuário realizará a configuração inicial. Nunca copie valores para o Git.
- Não dispare D-2/WhatsApp, altere Rules, banco ou autenticação para testar UI.
- O workflow Preview pode substituir somente FORJA_API_URL no artefato gerado.
  A URL temporária vem do comentário FORJA_PREVIEW_API_URL na descrição do PR,
  nunca do index.html oficial. Use --preview explicitamente; sem ele a geração
  e verificação exigem os bytes originais de produção.
- Auth/Firestore continuam conforme o HTML original; Render Preview não comprova
  isolamento de dados. Teste somente leituras/CORS, sem dados falsos em produção.
- Execute `node scripts/validate.mjs` e `node --test scripts/pipeline.test.mjs`.
  Execute também `node --test scripts/secretaria-drawer.test.mjs scripts/availability-publication.test.mjs`, usando
  Playwright 1.56.1 e Chromium. Para instalação isolada e comandos, ver DEPLOYMENT.
  Os testes executam o código real do drawer com fixtures isoladas, sem rede
  de produção; não confundir isso com uma sessão administrativa autenticada.
  Antes de deploy, gere `.firebase-public/` com `node scripts/prepare-hosting.mjs`.
- A pasta publicada deve conter somente `index.html`. Documentação, scripts,
  configurações e credenciais nunca pertencem ao artefato Hosting.
- A URL temporária deve corresponder a HTTPS forja-api-pr-N.onrender.com. Não
  hardcode a URL do PR atual no portal, scripts ou workflow. Um Preview sem esse
  parâmetro deve falhar, sem recorrer à API de produção.
- PR somente frontend pode declarar exatamente o comentário
  `<!-- FORJA_PREVIEW_BACKEND=production-unchanged -->` na descrição.
  Nesse modo explícito, o artefato e a verificação usam a fonte integral e a
  API oficial, sem substituição. Ausência/conflito de parâmetro deve falhar.
  Um PR que altera backend continua exigindo seu Render Preview via comentário
  FORJA_PREVIEW_API_URL. Nunca presumir isolamento de Auth/Firestore.
- O workflow pós-Preview exige /health da versão esperada para o modo: novo
  backend Preview 6.31.0-secretaria-disponibilidade-publicada; histórico modo
  production-unchanged 6.30.1-cors-preview-forja-escola, CORS
  refletindo a origem Firebase, preflight 204 e /me sem token retornando 401.
- A release inicial tem marker e SHA-256 fixados no validador. Em uma alteração
  funcional futura autorizada, atualize a referência conscientemente e registre
  versão, diff, testes, publicação e validação pública no changelog.
- Um workflow aprovado não comprova o fluxo autenticado. Após deploy autorizado,
  confira a versão realmente servida e teste o comportamento afetado.
