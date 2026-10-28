# Transferência do SSE entre abas — revisão do Draft #33

Correção sobre frontend `a883c4ec6b6653efcf0945f4f26f8754d3db16f9`.
Somente frontend, testes e geração oficial. Sem merge, Preview, deploy, dados
reais, OAuth, Rules ou alteração de permissões Google.

## Evidências e causa

CI frontend [40066020673](https://github.com/gokuoficialbr123-gif/forja-escola/actions/runs/40066020673),
job 120789337797: a expectativa de duas conexões acumuladas encontrou uma.
O Hosting [40066020604](https://github.com/gokuoficialbr123-gif/forja-escola/actions/runs/40066020604)
passou no mesmo SHA. O teste original passou em oito repetições locais, portanto
o log antigo, sem estados do Web Lock, não permite atribuir aquela ocorrência
exclusivamente ao backoff ou à espera fixa de rede.

Uma reprodução controlada confirmou um defeito funcional: a aba seguidora
recebeu duas recusas normais de `ifAvailable`, enquanto a proprietária continuava
visível. O cliente contou essas recusas como falhas de transporte e agendou
4s, depois 8s. Após ocultar a proprietária, o servidor confirmou o encerramento
da conexão e o navegador confirmou o lock livre. Mesmo assim não houve nova
tentativa dentro do orçamento de seis segundos. Evidência antes da correção:

```text
connections: 1; active: 0
contended → retry 4000ms → contended → retry 8000ms
Web Locks: held [], pending []
```

A sequência podia aumentar o backoff até 60s sem qualquer falha de rede. Não
era um lock preso nem uma conexão anterior que precisava continuar aberta.

## Correção mínima

O estado da tentativa registra se a aba realmente adquiriu o lock e entrou no
transporte. Recusa normal de uma seguidora visível agenda nova eleição em 5s,
sem incrementar o contador de falhas. Essa eleição é local, não uma consulta
HTTP ou escrita Google. Somente uma aba com lock pode abrir o stream.

O proprietário conserva o backoff existente e `Retry-After` quando há tentativa
real de transporte. Pausa, abort, liberação do lock, validade da fonte, UID,
geração, perfil, período e proteção contra respostas/broadcasts antigos não
foram removidos. Não há novo protocolo de eleição ou sincronização paralela.

`index.html` foi regenerado por `agenda-intelligence-build.mjs`, incluindo as
camadas posteriores. Os metadados/hashes foram regenerados pelo procedimento
oficial, sem desativar guardas.

## Regressão permanente

O teste mantém exatamente duas conexões acumuladas e um único stream ativo.
Também mantém uma só consulta concorrente e a rejeição do snapshot antigo após
uma alteração. Foram acrescentados a disputa repetida e o modelo institucional.

A seguidora é pausada antes da ocultação para observar separadamente: fechamento
HTTP anterior, Web Lock livre, aquisição única e reconexão. Só depois seu relógio
avança os mesmos 6000ms. O teste espera o evento real de conexão do servidor,
com limite local de 5s, em vez de supor que fetch/Web Locks terminaram após
150ms. O relógio permanece pausado; essa espera não concede tempo adicional à
eleição. Ao ocultar a nova proprietária, confirma também fechamento e liberação.

O relógio do Playwright 1.56.1 é compartilhado pelo BrowserContext
(`Page.clock = BrowserContext.clock`). O teste anterior o reinstalava ao abrir
a segunda aba, alterando também o relógio da primeira. O teste agora conserva
o relógio herdado e pausa as duas abas no mesmo instante absoluto antes dos
broadcasts, evitando diferenças artificiais nos timestamps e no agendamento.

O caso institucional espera a confirmação efetiva após heartbeat, sem exigir
uma consulta extra: a consulta inicial ainda em andamento pode ser aproveitada
legitimamente. Isso preserva a redução de consultas e a asserção de coalescimento.
Para a leitura concorrente, a primeira resposta fica retida até a seguidora
tentar o Web Lock. Duas avaliações disparadas por Promise.all podiam, na prática,
chegar sequencialmente ao navegador e produzir duas leituras legítimas. A barreira
garante sobreposição real e mantém a exigência de exatamente um GET.

QA somente Node 22.23.3, Playwright 1.56.1, Chrome real, Auth e fontes simuladas.
As três regressões finais passaram em dez execuções consecutivas: 30
verificações, sem alterar a expectativa de duas conexões ou o orçamento de
6000ms. Antes de acrescentar o caso institucional, as duas regressões legadas
também passaram em oito execuções consecutivas (16 verificações).
Pipeline e recursos estáticos: 33 aprovados; validação do HTML e dos treze
scripts inline aprovada. Hash do HTML regenerado:
`febb6991aed004e7f9478e1d9e599002c0f33abe49b964fae407cc6dfd2a6884`.
Depois das repetições, os arquivos completos de eventos e institucional foram
executados novamente: 21 aprovados, incluindo falhas/429, offline, formulário
aberto, ausência de polling institucional e proteção de snapshots.
Resultados finais constam do PR #33 e dos checks da revisão correspondente.

## Relação com o backend

O Draft [backend #27](https://github.com/gokuoficialbr123-gif/forja-backend/pull/27)
permanece em `5d5649a6dbcc20aa2e327e1ecd7ca2b744340717`; sua CI
[40065994028](https://github.com/gokuoficialbr123-gif/forja-backend/actions/runs/40065994028)
foi conferida como aprovada, sem reexecutar auditoria ou suítes backend.
API, autenticação do SSE e payloads não mudam nesta correção. O pin de frontend
desse workflow backend continua em `a883c4e`; não há alegação de nova validação
pareada emulada com o SHA corretivo. Ambos os PRs permanecem Draft.
