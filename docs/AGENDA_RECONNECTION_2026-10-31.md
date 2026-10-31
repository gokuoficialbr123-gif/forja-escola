# Agenda: reconexão SSE e histórico de ocupações — somente Draft

Base frontend: `471429518213dc3e450263ba07eb82eb03e4d150` (main remota,
PR34 incorporado). Backend de referência: `508c717ccb4f7ef5db40ed57296b458663254d8d`.
O checkout backend tem o mesmo conteúdo funcional e testes dessa main; não foi
modificado. Branch frontend `codex/agenda-reconnection-history`.
Não houve consulta autenticada à escola nem publicação desta correção.

## Causas reproduzidas

1. `handleChange(ready)` chamava `changed()` mesmo com a mesma versão. Isso
   incrementava `revision`, marcava `record.error` e retirava ocupações/verdes
   ainda válidos antes de receber outra consulta. Também descartava uma resposta
   completa que estivesse pendente durante esse handshake. Reconexão não é uma
   mutação; versão diferente ou evento `changed` continuam invalidando os dados.
2. A renderização de ocupações exigia `timely()`. Falha, expiração ou resposta
   parcial removia a representação anterior. O estado seguro para **agendar**
   estava correto, mas apagava informação útil para **consultar**.
3. O nome do professor ocupava a primeira linha de cada bloqueio administrativo;
   em cartões curtos, o horário desaparecia. Agora o horário vem primeiro, com
   origem compacta; profissional, origem completa e período ficam no nome
   acessível e tooltip. Fontes sobrepostas continuam unidas apenas na apresentação.

## Correção e limites de segurança

`agenda-intelligence-client.js` mantém uma única última informação confirmada
por fonte/profissional, apenas em memória e no contexto atual. Não é cache de
disponibilidade e não alimenta `Periods`, `cuts` ou autorização de reserva.
Sucesso vazio/not_applicable limpa a ocupação antiga da respectiva fonte.
Falha parcial conserva somente a informação anterior da fonte indisponível;
uma aula, bloqueio manual ou escolar confirmado de forma independente permanece
confirmado. Expiração/falha global deixa as ocupações históricas cinza tracejado,
com “Histórico” e descrição “Última informação conhecida”, sem ações de reserva.
O mês também identifica ocupações históricas e respeita o filtro Ocupado.

401/403 da **FORJA** e SSE `unauthorized` apagam o histórico Google. Broadcasts
não restabelecem uma consulta recusada; é necessária nova resposta HTTP válida
da própria sessão. Isso é distinto de HTTP200 parcial informando falha **Google**.
Trocar conta, geração, perfil, período, professor ou sair da Agenda elimina o
histórico do contexto anterior. Nenhum dado vencido produz verde.

O TTL legado de25s, validade institucional, backoff, Retry-After, Web Locks,
quota, fluxo oficial do drawer, edição, filtros e scroll foram preservados.
Heartbeat sem alteração não repinta a grade. `index.html` foi regenerado por
`agenda-intelligence-build.mjs`, incluindo camadas posteriores e hashes/guards.

Fonte HTML SHA256: `6bee41d5aba0dda2213077a2830c3cc5b451e9f9d6ede35f0d458f0a6e43c179`.
Artefato preparado SHA256: `52eb71a9e3bf39f4b383f0d079baa5110f9761d77c74e5336058cb92d8b01e75`.
O nome técnico target=production do gerador apenas prepara bytes localmente;
não executa deploy. Testes, fixtures e documentos não integram o Hosting.

## QA isolado e evidências

Node22.23.3, Playwright1.56.1 e Chrome real em modo headless. As identidades,
eventos, calendários e tokens usados nos testes são fictícios. O portal completo
é exercitado com as fixtures existentes, sem outra implementação de Agenda.

`scripts/helpers/qa-isolation-guard.mjs` recusa credenciais herdadas, projetos
reais e endpoints de teste externos. Aceita somente metadados estritos demo-forja
do Firebase CLI. Bloqueia fetch e HTTP/HTTPS Node fora de loopback. Há testes
negativos permanentes. A fixture intercepta APIs/SDKs e aborta tráfego não tratado,
inclusive novas páginas/WebSockets. As URLs lógicas oficiais do portal são
respondidas por mocks; não são acessadas na rede real.

Integração usa Auth127.0.0.1:9099, Firestore127.0.0.1:8081, projeto demo-forja,
HOME/APPDATA de QA vazios, ambiente filho por allowlist e Google simulado antes
de importar o servidor. Não se usa `.env`, service account ou token real.
Tentativas de descoberta automática de metadados pelo SDK foram bloqueadas pelo
guard, sem requisição externa. As Rules permissivas do emulador **não** comprovam
as Rules publicadas. Os testes unitários CORS também usam o projeto sintético
demo-forja-cors-test com os mesmos emuladores.

Resultados já observados durante a preparação:

- 15 cenários específicos falham na main original: handshake, resposta pendente,
  histórico, vencimento, erros e mês; recuperação segura coberta nos dois perfis.
- 355 regressões unitárias backend aprovadas;4 combinações sintéticas de cor
  verde/vermelha e opaque/transparent aprovadas, sem acesso a Google.
- 63 verificações HTTP/Auth/Firestore pareadas aprovadas, incluindo SSE, criação,
  remarcação, cancelamento, conflitos, idempotência, replay institucional e quota.
- 35 verificações de pipeline, isolamento e recursos aprovadas.
- 8 cenários visuais,24 combinações de perfil/tamanho/visão: ADM e Professor,
 1366/1920/360/390px, Dia/Semana/Mês, horários completos e sem overflow da página.
- A suíte frontend completa e a repetição final são registradas no comentário
  técnico do PR com SHAs e execuções, sem considerar execução pendente aprovada.

Na preparação, os testes detectaram prioridade insuficiente do CSS histórico e
marcação histórica indevida de bloqueios nativos confirmados numa falha parcial;
ambas corrigidas com asserções permanentes. A regressão de perda de autorização
também falhou antes da proteção e passou depois. O checkpoint de logout usa
`executeLogout()` e verifica tanto descarte lógico quanto ausência visual; chamar
somente `forjaEndSession()` não representa o fluxo completo de saída.
As quatro regressões antigas de vencimento foram adaptadas ao requisito novo:
zero verde e zero vermelho confirmado, mantendo a ocupação somente como histórico
cinza identificado. Continuam exigindo vencimento no prazo original e exatamente
uma renovação pendente, sem consulta duplicada. As quatro passaram após o ajuste;
não houve alteração funcional adicional nem mudança de TTL.

A execução local completa também revelou uma corrida de teardown no novo
firewall de QA: depois de os9 cenários institucionais passarem, uma rota já
cancelada recebia outro abort e gerava rejeição assíncrona. A fixture agora fica
offline antes de remover as rotas de contexto e, depois, as rotas da página.
Erros durante testes ativos continuam falhando; somente o encerramento usa a
política de descarte do Playwright. A validação repetida desse arquivo e os
resultados da CI final constam no comentário técnico. Nenhum código funcional,
timeout, guarda de integridade ou proteção contra rede real foi relaxado.

Galeria: [antes/depois com dados fictícios](evidence/agenda-reconnection-2026-10-31/README.md).

## Google: conclusão comprovada e pendência real

[`transparency`](https://developers.google.com/workspace/calendar/api/v3/reference/events)
define se um evento bloqueia; a cor não determina disponibilidade.
[`freeBusy.busy`](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
é tratado como ocupado, com término exclusivo. O institucional filtra
transparent/cancelled em `institutionalInterval`; o legado também filtra
transparency; o central utiliza os intervalos freeBusy, sem inferir pela cor.
Os vínculos autorizados determinam o Calendar ID no servidor, não nomes do evento.

Não foi conferido o calendário real de Julio, seu UID/vínculo nem o evento de
30/10/2026,10:30–11:30. Não é possível atribuir-lhe uma causa específica por cor.
Essa confirmação depende de autorização específica e auditoria prévia dos
efeitos da operação escolhida. Nenhum GET foi presumido seguro. Tampouco foram
testados OAuth, grant, ACL ou sincronização em contas reais.

## Risco restante e rollback

Carregamento inicial, consentimento ausente, falha Google e vencimento continuam
sem oferecer reserva até confirmação. O histórico pode estar desatualizado e
é explicitamente apresentado dessa forma; não é prova de ocupação atual.
Responsividade foi validada em navegador com viewport mobile, sem aparelho físico.

Rollback proposto, não executado: reverter somente o commit frontend desta
correção sobre a main então vigente, revalidar geração/guards e publicar pelo
pipeline oficial **apenas após autorização**. Sem migração nem reversão de dados.

Intocados: aulas e compromissos reais, IDs/vínculos, eventos Google, credenciais,
OAuth, Firestore/Auth reais, Rules, DNS e infraestrutura. Nenhum POST/PATCH/DELETE,
backfill, migração, sincronização manual ou manutenção foi dirigido à produção.
PR Draft; sem merge, Preview ou deploy.

## Revisão complementar — aulas nativas históricas

Reproduzido no head anterior b37580b: `displayRow` recuperava aulas da última
consulta nativa, mas `forjaAgenda2Lessons` não levava a qualidade dessa informação
ao renderizador. Doze cenários ADM/Professor, desktop/mobile e Dia/Semana/Mês
falharam por exibir a aula retida sem indicação histórica.

A correção acrescenta qualidade **somente de apresentação**, derivada de
`nativeStatus` e da validade original. O getter devolve cópias com esse marcador;
não modifica o snapshot, a aula canônica, o Firestore ou payloads de reserva.
Aula retida fica cinza tracejado, com “Histórico” visível e descrição acessível
“Última informação conhecida · Aula não confirmada”. Modalidade, aluno e horário
continuam identificados. O posicionamento também usa as aulas retidas, evitando
perder o layout de sobreposição durante uma falha. Cancelamentos preservam a
distinção entre cancelamento conhecido e histórico sem confirmar disponibilidade.
Sucesso nativo posterior limpa o marcador; fonte vazia remove a aula antiga.

Falha **apenas Google**, com fonte nativa ainda confirmada, não converte a aula
nativa em histórica. Já a expiração do snapshot não prolonga a validade nativa
nem fornece horários de reserva. Os checkpoints usam um relógio de teste pausado
com avanço explícito, sem mudar TTL,20s, timeout ou backoff do produto.

**Ações já protegidas por outra camada:** o fluxo oficial `openLesson` consulta
a aula canônica, histórico e materiais antes de montar as ações. Os quatro
cenários de ADM/Professor desktop/mobile já passaram nessa proteção antes da
correção visual: pendência ou falha do detalhe não usa ações da aula retida.
Essa camada não foi substituída nem ganhou outro fluxo de edição. Leitura nativa
canônica bem-sucedida preserva as ações permitidas; cancelamento canônico prevalece
sobre um cartão antigo. Resposta atrasada após logout não pode reabrir o detalhe
nem popular a sessão anterior. Abrir o cartão só executa leituras.

Outros quatro casos reproduziram um fallback sem prova: na ausência de uma linha
do snapshot, os renderizadores podiam recuperar `state.lessons` sem marcador,
inclusive após HTTP403. Agora o getter identifica o cache legado como histórico
enquanto aguarda a consulta; recusa de autorização devolve lista vazia. Uma fonte
nativa confirmada vazia continua prevalecendo sobre o cache. Não se estende TTL.
Os dois cenários de leitura pendente também reproduziram erro de renderização
quando o cache legado não tinha `horaFim`. A apresentação mantém o horário
conhecido e o layout nativo, sem inventar duração nem chamar o cálculo de
sobreposições com um intervalo incompleto.

O rótulo compacto mensal foi conferido também em360px: herda a tipografia do
componente para mostrar “Histórico” inteiro, com a mesma asserção de ausência de
corte e sem criar rolagem horizontal da página.

Regressão permanente: `scripts/agenda-native-history.test.mjs`,20 cenários cobrindo
indisponibilidade nativa, vencimento durante renovação, recuperação, cancelamento,
remoção, falha Google independente, detalhe canônico, cache legado, HTTP403 e
troca de sessão. Os20 passaram localmente com Node22.23.3 e Chrome/Playwright.
Os testes
de criação/locks/idempotência/validação final continuam usando os endpoints nativos
nos emuladores. Nenhuma mudança de backend, arquitetura, OAuth, Rules ou dados.
As contagens finais e os SHAs efetivamente testados ficam no comentário técnico
atualizado do PR. As evidências da primeira galeria correspondem à primeira fase;
ver também a [comparação de aulas nativas](evidence/agenda-native-history/README.md).
