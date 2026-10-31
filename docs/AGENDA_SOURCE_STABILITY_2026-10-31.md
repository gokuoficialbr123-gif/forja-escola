# Agenda: estabilidade por fonte e apresentação — em preparação, não publicada

Bases: frontend `4f7c5f952c62b04fc7359a8dd2285e5687a2265a`, backend
`508c717ccb4f7ef5db40ed57296b458663254d8d`. Branch corretiva coordenada
`codex/agenda-source-stability`. Esta missão substitui a abordagem visual anterior.
Nenhum merge, Preview, deploy, OAuth ou acesso aos dados escolares reais nesta missão.

## Diagnóstico reproduzido antes de corrigir

| Caminho | Causa | Consequência |
| --- | --- | --- |
| Resposta parcial com uma fonte antiga | A apresentação usava `timely()` global; a menor idade de fonte determinava o estado de todas | Blocos nativos e Google central recém-consultados viravam históricos por falha Google pessoal |
| EOF/erro SSE institucional | `record.error` removia a confirmação visual de todas as fontes imediatamente | Reconexão breve produzia vermelho → cinza → vermelho antes de vencer a concessão original |
| Consulta com oito segundos de latência | Renovação iniciada sempre cinco segundos antes do vencimento | Resposta terminava depois dos25s, causando lacuna legítima de confirmação que o agendador podia evitar |
| Encerrar a última aba/reabrir watchers | Versão SSE derivada de contadores voláteis descartados ao fechar o último watcher | Mesmo conteúdo recebia outra versão, causando invalidação sem mudança de calendário |
| Sincronização do cache Google | Atualização apenas de `google_calendar_busy.syncedAt` era tratada como mudança de ocupação | Notificações e invalidações redundantes durante a atualização do cache |
| Mudança de uma fonte | SSE enviava apenas `changed/version`, sem categoria da fonte | Todas as fontes eram invalidadas, mesmo quando apenas uma tinha mudado |
| Renovação institucional | Próximo GET era agendado exatamente em `sourceExpiresAt` | Fonte saudável expirava antes de começar a leitura; regressão registrou duas transições históricas |
| Manutenção institucional | Lease e renovação sem mudança de bloqueios geravam invalidação | Uma operação interna de sincronização podia produzir o ciclo vermelho → cinza → vermelho |
| Visão mista institucional/legada | Prazo individual institucional não era transportado na resposta | A projeção podia tomar emprestada a validade de outra fonte; agora o prazo individual limita também o envelope legado |
| Aula recém-gravada com consulta nativa indisponível | O histórico de exibição não recebia a resposta canônica da gravação | A aula existia no servidor e no estado autorizado do portal, mas não aparecia na grade |
| Primeira consulta nativa indisponível/reload | `displayRow` transformava ausência de prova nativa em lista vazia, descartando o cache autorizado da conta | Aulas antigas desapareciam em vez de permanecerem identificadas como histórico |

Os casos anteriores falham no artefato publicado/base. Não é uma atribuição da
causa real a Julio ou a um reinício específico do Render. Não houve leitura de
contas reais nem de logs privados de produção. Um reinício foi considerado no
modelo de reconexão; não foi declarado culpado pelo comportamento observado.

## Correção técnica

O cliente mantém os prazos originais de cada fonte usando metadados já existentes:
`collectionStartedAt`, `personal.checkedAt`, `central.checkedAt`, `sourceExpiresAt`.
Falha parcial não envelhece uma fonte saudável. A validade para oferecer um horário
continua exigindo todas as fontes necessárias atuais; HTTP401/403 elimina os
resultados. Histórico nunca alimenta publicação, autorização de reserva ou locks.

O prazo de25s legado, prazo institucional e concessão SSE de45s foram preservados.
Perda de transporte suspende disponibilidade para agendar; informações ainda
válidas conservam seu prazo original. A concessão vencida fica invalidada até nova
consulta, sem ressuscitar verde apenas porque chegou um heartbeat.

A renovação usa a latência observada para antecipar a consulta, dentro da janela
existente de cache de15s. Não aumenta validade nem quotas. HTTP429 continua
suspendendo todas as requisições até Retry-After. Em HTTP200 parcial, o backend
continua aplicando o cooldown Google enquanto o cliente pode atualizar fontes
nativas saudáveis. Não há escrita Google no ciclo de consulta.

O backend usa uma versão opaca determinística do conteúdo dos watchers. Todos os
campos de permissão, consentimento, credencial e dados continuam significativos.
A versão ignora somente `syncedAt` no cache `google_calendar_busy` e
`leaseId/leaseUntil` no estado institucional: nenhum desses campos altera o
resultado da leitura de disponibilidade. Inclusão, alteração e remoção de
intervalos continuam invalidando. Renovação institucional com conteúdo, vínculo,
status e versões dirty/handled idênticos, e prazos não decrescentes, envia
`refreshOnly:true`. O cliente consulta novamente sem revogar a prova anterior;
somente a resposta pode conceder novo prazo. Erro, webhook, vínculo, permissão,
ocupação ou prazo reduzido continuam revogando. Eventos SSE acrescentam somente
categorias `native/personal/central` e esse booleano, sem IDs ou conteúdo.
Clientes anteriores continuam aceitando o contrato; eventos antigos
sem categoria continuam provocando invalidação conservadora no cliente novo.

No modo institucional a leitura começa antes do prazo original. Se a projeção
ainda não foi renovada no servidor, o cliente aguarda seu vencimento original,
evitando um ciclo de consultas a cada segundo. Não existe polling de20s nesse
modo. Uma prova vencida nunca é recuperada por heartbeat ou por `refreshOnly`.

O renderizador oficial reconcilia os filhos da grade por identidade, preservando
cartões que não mudaram. Não substitui formulários, drawer, filtros ou contêineres
de scroll, e mantém os bindings oficiais idempotentes.

O hook de mutação existente recebe também a resposta canônica já validada pelo
fence de sessão de `api()`. Recibos de aulas pertinentes ao profissional
selecionado atualizam somente o conjunto histórico existente; não concedem prazo,
verde ou autorização de reserva. A próxima prova nativa substitui o conjunto
inteiro. No primeiro erro nativo, o cache autorizado da conta pode aparecer como
histórico; uma resposta nativa vazia é respeitada como vazia e impede posterior
ressurreição desse cache. HTTP401/403 e troca de sessão continuam eliminando tudo.

As quatro regressões novas desses caminhos falharam antes e passaram depois.
A reprodução HTTP/emulada registrou `stateHasLesson:true`,
`displayHasLesson:false`, período/profissional corretos e motivo sanitizado
`personal_sync_unavailable`, sem registrar identidade ou conteúdo. O backend
funcional de criação/remarcação/cancelamento não precisou ser modificado.

## Apresentação em avaliação visual

- Hora vem primeiro em aulas, ocupações e disponibilidade. Uma única escala liga
  rótulos, cartões, grade e indicador da hora atual.
- Intervalos Google contíguos são unidos apenas na apresentação, preservando todos
  os cortes usados pela disponibilidade e pela confirmação final no backend.
- Espaços vazios usam fundo neutro e descrição acessível; não repetem frases por
  toda a grade. Cabeçalho informa as fontes pendentes e o histórico.
- Cartões curtos exibem o horário legível; os detalhes completos permanecem no
  nome acessível e no fluxo oficial de abertura. O mês resume excesso com botão
  para o dia, sem eliminar os compromissos.
- Controles existentes são reorganizados; a disponibilidade fixa e o diagnóstico
  Google permanecem acessíveis, sem ocultar diagnósticos de erro.
- A regressão completa encontrou corte de `13h30` no mês do professor em360px:
 32px internos para texto de aproximadamente35px. Apenas o padding horizontal
 mensal até400px foi removido; fonte de12px preservada, client/scroll agora36px.
 A asserção de minutos foi fortalecida para nenhuma diferença de scroll/client,
 sem tolerância adicional. [Antes](evidence/agenda-source-stability/before-month-360-minutes.png)
 e [depois](evidence/agenda-source-stability/after-month-360-minutes.png).

## QA e evidências

Somente Node22, projeto demo-forja, Auth/Firestore locais emulados,
provedores Google simulados e identidades fictícias. Fixtures de navegador usam o
portal real e interceptam todos os provedores. O guard recusa configuração de
produção/credenciais e bloqueia rede externa. A gravação prolongada precisa ter
pelo menos600s de relógio real; avançar apenas o relógio de teste não é suficiente.

As transições registram motivos fixos, idade, validade restante por fonte, estado
de rede, versão SSE opaca, prazo de retry e conclusão HTTP. Não registram nomes,
IDs pessoais, títulos/conteúdo de eventos, tokens ou credenciais.

Validação local até este checkpoint: backend362 verificações unitárias e64 de
integração afetadas aprovadas; frontend35 verificações de pipeline e
[15 novas regressões funcionais/visuais](evidence/agenda-source-stability/focused-tests.tap)
aprovadas, com capturas de Dia/Semana/Mês em desktop e mobile.
Adicionalmente: [quatro regressões nativas](evidence/agenda-source-stability/native-four-regressions.tap),
[61 verificações de apresentação/mobile](evidence/agenda-source-stability/mobile-premium.tap)
e [15 de diagnóstico Google](evidence/agenda-source-stability/personal-controls.tap)
aprovadas. Os quatro casos nativos falharam antes da correção:
[carregamento inicial](evidence/agenda-source-stability/initial-outage-before.tap),
[recibo de gravação](evidence/agenda-source-stability/receipt-before.tap).
Os dois fluxos de integração pareada que falharam na CI passaram nos24 testes
locais do conjunto afetado após correção e navegação pelos controles oficiais.
A suíte frontend completa e as CIs ainda estão em execução/preparação; seus
resultados finais serão registrados no PR sem presumir aprovação.

O job anterior [124603630093](https://github.com/gokuoficialbr123-gif/forja-escola/actions/runs/41223796053)
foi cancelado após45min15s. O orçamento do workflow passou de45 para60min, com
cobertura integral e sem ampliar timeouts internos dos testes ou da aplicação.
Testes antigos agora abrem filtros/diagnóstico pelo controle oficial e verificam
a escala de96px/h, o resumo mensal com acesso a todas as aulas no dia e o nome
acessível dos estados compactos. Nenhuma exigência de cinco consultas, ausência
de sobreposições, permissão, isolamento ou confirmação final foi removida.

### Sessão prolongada e interpretação das transições

[Registro integral sanitizado](evidence/agenda-source-stability/soak-report.json):
**601596ms reais de exercício**, além da preparação,17 fases,37 snapshots no
servidor administrativo compartilhado,5 conexões SSE acumuladas, no máximo1
simultânea entre as abas administrativas. São56 compromissos sintéticos por
semana, incluindo21 aulas,28 ocupações Google e7 bloqueios curtos/sobrepostos.
Há também uma sessão independente do professor mobile. As bordas de provedor
desse ensaio são simuladas; a integração com Firebase emulado foi testada à parte.

- Renovação normal e reconexão com a mesma versão não geraram histórico.
- Falha pessoal de75s preservou FORJA/Google central, suspendeu verde e tornou
  somente os dados pessoais antigos históricos.
- Voltar à aba após mais de25s exige nova prova: histórico antes dessa resposta
  é correto. O resultado vencido não foi reaproveitado como confirmado.
- A primeira latência inesperada de8s excedeu o prazo: a transição ocorreu com
  idade maior que25000ms, e nenhum verde. Depois da medição, a leitura seguinte começou
  com margem baseada na latência medida e terminou antes do vencimento. Não se mascara esse
  primeiro vencimento real nem se promete continuidade em atrasos arbitrários.
- Rede offline deixou expirar os prazos originais, removeu verde e preservou
  histórico identificado. Recuperação exigiu nova resposta completa.
- Cancelamento sintético invalidou a fonte nativa, mantendo Google saudável.
- Uma resposta POST inteiramente simulada durante falha nativa manteve o recibo
  no histórico existente, sem verde. A recuperação nativa confirmou a aula.
- Não houve transição registrada com verde e alguma fonte necessária não atual.

As37 consultas incluem preparação e a última leitura. Não são37 chamadas Google:
no ensaio o provedor é simulado e na integração real emulada o cache/limites do
backend foram exercitados. Não extrapolar esse número para carga escolar real.

### Capturas e gravações sintéticas para revisão

| Cenário | Evidência |
| --- | --- |
| Semana antes | [Desktop](evidence/agenda-source-stability/before-admin-week.png), [mobile](evidence/agenda-source-stability/before-teacher-mobile-week.png) |
| Semana corrigida e cheia | [Desktop](evidence/agenda-source-stability/after-initial-confirmed-calendar.png), [mobile](evidence/agenda-source-stability/after-teacher-week-calendar.png) |
| Dia mobile | [Captura](evidence/agenda-source-stability/after-teacher-day-calendar.png) |
| Mês mobile | [Antes](evidence/agenda-source-stability/before-teacher-mobile-month.png), [professor após](evidence/agenda-source-stability/after-teacher-mobile-month.png), [Secretaria após](evidence/agenda-source-stability/after-admin-mobile-month.png) |
| Renovação normal | [Captura](evidence/agenda-source-stability/after-normal-renewal-calendar.png) |
| Reconexão SSE | [Captura](evidence/agenda-source-stability/after-SSE-reconnected-calendar.png) |
| Fonte pessoal indisponível | [Captura](evidence/agenda-source-stability/after-personal-rate-limit-calendar.png) |
| Recibo nativo durante falha | [Histórico claramente identificado](evidence/agenda-source-stability/after-native-receipt-history-calendar.png) |
| Vencimento real e recuperação | [Histórico](evidence/agenda-source-stability/after-really-expired-calendar.png), [recuperação](evidence/agenda-source-stability/after-network-recovered-calendar.png) |
| Vídeos antes | [Desktop](evidence/agenda-source-stability/before-admin-desktop.webm), [mobile](evidence/agenda-source-stability/before-teacher-mobile.webm) |
| Vídeos após, Dia/Semana/Mês e estados | [Desktop](evidence/agenda-source-stability/after-admin-desktop.webm), [mobile](evidence/agenda-source-stability/after-teacher-mobile.webm) |
| Sessão final após correção | [Gravação contínua](evidence/agenda-source-stability/after-admin-10min-2fps.webm) |

A cópia longa do PR está reduzida a2fps/1280px para tamanho de revisão, mantendo
o tempo real, sem acelerar. Originais locais em1920px e vídeo mobile contínuo
foram preservados. A aprovação visual pertence ao proprietário; a suíte verde
não substitui essa revisão nem um teste posterior em aparelho físico autorizado.

## Limites, riscos e reversão futura

Uma fonte realmente vencida ou indisponível deve aparecer não confirmada. Não há
promessa de disponibilidade contínua em cold start ou outage superior à validade.
Consentimento ausente continua bloqueando a confirmação; não foi desativado.
Validação real com contas Google/perfis da escola depende de autorização específica.

Não houve mudança de dados, Rules, Auth, OAuth, credenciais, calendário, vínculo,
infraestrutura, plano Render, backfill ou migração. A publicação futura exige
revisão do proprietário e ordem coordenada backend/frontend. Reversão seria
somente de código, após autorização, sem reversão de dados.

Plano de reversão, caso uma publicação futura seja autorizada: interromper a
promoção; se necessário, restaurar primeiro o frontend anteriormente publicado
(`4f7c5f9`) pelo pipeline oficial. O backend novo aceita esse cliente. Reverter
backend para `508c717` somente se também necessário e autorizado, preservando
dados e configurações. Isso restaura comportamentos anteriores, inclusive seus
defeitos; não existe rollback automático nem operação de limpeza de calendários.
