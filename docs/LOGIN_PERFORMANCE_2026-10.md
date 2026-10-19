# Login e Agenda: caminho crítico — 19/10/2026

Preparação em rascunho. Sem merge, deploy, contratação, dados reais, OAuth,
alteração de plano, DNS ou permissões. O hotfix #23 já está na produção e é
preservado. Bases: frontend `9df471b0433e296dae990a16cb8a21fca8e149ef`, backend
`47de323460fb8f037a29b7257be9e4f5fd94b09b`.

## O que foi comprovado

O login administrativo fazia 33 GETs e aguardava a composição de todos os módulos:
catálogos, base operacional, Google pessoal, pedagógico, relatórios/auditoria,
famílias, pacotes e semana. Paralelizar loaders anteriormente não eliminou esse
acoplamento. A Central usa apenas parte dessas fontes. O freeBusy central já
era sob demanda na Agenda; não foi atribuído a ele o atraso de login.

No servidor, `/me` verificava token com revogação/conta desabilitada, consultava o
perfil, buscava novamente a conta Auth para metadados e abria uma transação de
Registro FORJA até quando o perfil já continha esse ID. A implementação instalada
do Admin SDK chama `getUser()` dentro de `verifyIdToken(token, true)` para verificar
revogação/disabled. Não remover essa verificação ou trocar `true` por `false`.

## Correções

Frontend: 14 GETs até a Central, com dados completos das seções que ela realmente
exibe. Auditoria, relatórios, treinamentos, famílias e Google são carregados na
entrada das áreas que os usam. A Agenda exige seus dados e preserva a consulta
central nativa antes de reconhecer disponibilidade. Perfis não administrativos
mantêm os loaders anteriores. Modais/ações carregam suas dependências antes de
executar o código existente; nenhum fluxo de criação, locks ou recorrência é
reescrito. A navegação não precisa esperar outra área mais lenta.

Cada leitura é vinculada a UID, geração, papel e contexto, com apenas uma Promise
pendente por fonte. Há cache de leitura local por até 30s entre entradas de tela;
a semana também compõe a identidade da leitura. Logout, troca de conta, refresh
explícito e mutações confirmadas invalidam o contexto. Respostas atrasadas não
podem preencher outro contexto. Não há cache novo de POST/reserva ou do conflito
final. Não há polling nem ping para manter Render acordado.

Uma fonte essencial com erro, timeout ou formato inválido bloqueia somente a
área com mensagem e retry; arrays vazios não fingem sucesso. O limite das leituras
é de 20s para recuperação, sem encurtar os 20s × 2 de `/me` do hotfix #23.
O ganho vem da remoção de dependências, não de declarar sucesso antes de ter dados.

Backend: `GET /me?view=portal` retorna somente `ok`, `uid` e `profile`. Continua
executando verificação fresca de token/revogação, perfil, ativo, papel e OTP.
A vista explícita dispensa somente a segunda busca de metadados Auth que o portal
não utiliza. `/me` sem esse parâmetro mantém `auth` e o contrato anterior. Perfil
com Registro FORJA já existente evita a transação redundante; ausência de ID
preserva a alocação transacional e falhas. Preview readonly não cria ID.

`Server-Timing` acrescenta durações numéricas com nomes fechados: `firebase_auth`,
`profile_read`, `account` (vista antiga), `registry` e o total `forja`. Não há
logs, UID, e-mail, token, payload, URL dinâmica nem novo serviço de telemetria.
O tempo antes do Node/rede/TLS não entra no total do handler.

## Medições e limites

Resultados e amostras sanitizadas: `login-performance-2026-10-results.json`.
O benchmark Chromium mede desde o clique real no botão, incluindo SDK Auth/token
sintéticos, `/me`, dados essenciais, montagem e entrada na Agenda. Usa o portal
integral e os mesmos bytes de imagens; 10 contextos novos por desktop/celular e
versão. Rede móvel 1,6Mbps, CPU 4x; Auth 400ms, primeiro token 100ms, `/me` 350ms,
outras rotas 250ms e fontes secundárias lentas 2500ms. Esses atrasos são um modelo
controlado de dependências, não um diagnóstico de Google/Firestore da escola.

O benchmark backend usa Auth/Firestore realmente emulados e o servidor Node,
10 processos novos por versão e a segunda consulta de cada processo. Mede TTFB,
tempo total, startup até listen, tamanho e Server-Timing. Frio aqui significa
**processo Node novo com clientes SDK novos**, não suspensão do Render. Firebase
Auth local não representa o tempo do Firebase Auth em produção.

As consultas públicas são anônimas: health e `/me` 401. O primeiro health observou
12,8s até headers para 0,8ms no handler; portanto a espera dessa amostra ocorreu
majoritariamente antes do handler. Sem telemetria Render não se distingue cold
start de fila/proxy/rede. Não foi forçada suspensão de produção. `/me` 401 não
mede verificação de perfil ou Firestore de um usuário autenticado. Não houve
login real nem benchmarking de dados escolares. A meta real de 10–20s precisa
ser validada por pessoa autorizada após uma publicação futura.

p95 usa ordem empírica mais próxima; com 10 amostras corresponde ao maior valor.
Não constitui SLO, teste de carga, garantia de latência ou inferência estatística
de produção. Outliers e eventuais pioras ficam nos resultados.

## Render Free versus instância ativa

Documentação oficial consultada em 19/10/2026:
[Free](https://render.com/docs/free), [preços](https://render.com/pricing).
Free suspende após 15 minutos sem tráfego e descreve retomada de cerca de um
minuto; 750 horas gratuitas mensais por workspace, 0,1 CPU/512MB. Portanto não há
garantia de login em até 20s após suspensão, mesmo com código otimizado.

A instância paga `0.5c-512mb` (antiga Starter) custa US$7/mês na tabela consultada,
com 0,5 CPU e 512MB. Remove a suspensão por inatividade e oferece mais CPU; rede,
serviços externos e reinícios/deploys ainda têm latência. Não é promessa de login
em 10s. O preço não inclui impostos/conversão, eventuais excedentes nem outros
serviços. A página pode mudar: confirmar antes de contratar. Trocar só o plano
do workspace não remove a suspensão de uma instância Free. Nada foi contratado.

## Testes e publicação futura

Frontend: integridade reversível sobre a main exata, hotfix anterior, carregamento
por área, fonte essencial indisponível, recuperação, deduplicação, mutação,
logout/UID/geração, virada de semana, Google desconhecido e Chromium desktop/móvel.
Backend: perfis compacto/antigo, IDs existentes/novos, falhas, permissões, Auth
disabled, timings sem dados privados e suite completa em emuladores.

A fixture da Etapa4 usava 19/10/2026 13h como futuro e passou a falhar pelo relógio.
Recebeu relógio explícito só no bootstrap de teste, sem alterar expectativas ou
produção. Os testes específicos de horários passados continuam ativos. O mock de pausa Google também passa a sair do modo de bloqueio ao receber release: leituras repetidas da mesma operação não ficam presas após a recuperação simulada, sem alterar as verificações Google da aplicação.

Comandos: `node scripts/login-benchmark.mjs [--baseline]` no frontend, com
`FORJA_LOGIN_RUNS=10` e `FORJA_LOGIN_OUTPUT=/tmp/resultado.json`.
Backend: `firebase emulators:exec --only auth,firestore --project demo-forja
--config test/emulators/firebase.json 'node test/benchmarks/portal-login.mjs'`,
com as mesmas variáveis e hosts locais. Não executar regressões pesadas em paralelo
às medições. Os benchmarks nunca entram na allowlist do Firebase Hosting.

Publicação futura: backend, validar health/Auth/CORS e `/me` legado/compacto;
depois frontend, verificar artefato/API e testar a Agenda com titular autorizado.
O frontend novo é compatível com o backend anterior: o parâmetro desconhecido
era ignorado e retornava o perfil completo. Nenhum deploy está autorizado aqui.

## Resultados (ms; mediana / p95)

10 amostras por versão e viewport, modelo sintético descrito acima:

|Métrica|Desktop antes|Desktop depois|Móvel antes|Móvel depois|
|---|---:|---:|---:|---:|
|Clique → Central utilizável|3721 / 3738|1194 / 1218|3887 / 4098|1369 / 1837|
|Clique → Agenda verificada|4099 / 4175|1842 / 1954|4680 / 4885|2422 / 3038|
|Navegação para Agenda, após Central|378 / 449|647 / 732|779 / 811|1047 / 1475|
|Navegação para Cadastros, após Agenda|23 / 41|284 / 331|90 / 118|350 / 437|
|Dados essenciais + render (residual)|2870 / 2887|343 / 368|3034 / 3245|516 / 983|
|Tempo em tarefas longas no login|0 / 0|0 / 0|152 / 267|152 / 305|

Auth e primeiro token simulados permanecem aproximadamente400/100ms; /me simulado350ms em ambas as versões. O ganho deste cenário está nas dependências dos dados após o perfil. Os14GETs iniciais incluem /me; antes eram33. Agenda e Cadastros pagam uma pequena carga ao entrar porque não estão mais todos pré-carregados. O tempo desde o clique inicial cai; não afirmar que toda navegação isolada ficou mais rápida. Os valores de tarefas longas e demais eventuais pioras permanecem nas amostras.

Auth/Firestore reais emulados,10 processos e10 leituras aquecidas por versão:

|/me TTFB|Antes|Depois|
|---|---:|---:|
|Primeira consulta do processo|296.2 / 392.3|269.1 / 1263.4|
|Segunda consulta|27.4 / 43.3|12.6 / 15.8|

O p95 da primeira consulta piorou por um outlier mantido na amostra; o ganho em processo aquecido não comprova redução de cold start Render. O tempo da autenticação REST no emulador foi cerca de4ms, sem representar Firebase real. Corpo compacto796→503bytes no perfil sintético.

Medições públicas reais, pelo proxy do ambiente; campanha finita, sem keepalive periódico:

- Duas observações iniciais separadas, estado térmico desconhecido: n=2, mediana 13256ms, p95 empírico 13708ms.
- Health, dez consultas consecutivas após resposta do serviço: n=10, mediana 305ms, p95 empírico 503ms.
- /me sem autenticação, sempre401: n=11, mediana 168ms, p95 empírico 428ms.

As duas observações lentas foram12,8s e13,7s; seus handlers permaneceram abaixo de1ms. São compatíveis com espera anterior ao handler, sem comprovar cold start do provedor. O p95 com n=2 não tem robustez estatística. Não há medição real autenticada de Firebase Auth, /me com perfil ou Agenda escolar. Os50s relatados não foram reproduzidos com contas reais, que não participaram dos testes. O modelo atinge10s, mas não permite garantir10–20s em produção no Render Free.
