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

Fonte HTML SHA256: `ba74193627434d2da4be99d3fafb8718a8ae301659023f621992845f98a07c51`.
Artefato preparado SHA256: `05c272c5f9350503a5f9b7f8ec11c6298544f48b15efb4f19532c934f45e7c86`.
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
