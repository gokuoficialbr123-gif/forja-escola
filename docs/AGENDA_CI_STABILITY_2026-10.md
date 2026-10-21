# Agenda — estabilização dos ensaios e da CI — 21/10/2026

Complemento do PR Draft #26, coordenado com o pin frontend do PR backend #24.
Esta rodada altera somente testes, helpers de QA, orçamento da CI e documentos.
Não altera o controlador, HTML/CSS servido, reservas, locks ou código backend.
Não publicado; nenhum merge, deploy, Preview ou dado real usado em QA.

## Hipótese e evidência antes/depois

`ready()` verificava somente o prefixo do status e aguardava 20ms. Não recebia
identidade de requisição. `cycles()` avançava o relógio e usava esse status;
`fiveAutomaticReads()` no teste do drawer tinha a mesma lacuna. O erro registrado
na CI anterior ocorreu neste segundo helper, na visão mensal desktop.

Dois cenários permanentes, desktop e celular, conservam a confirmação mensal
anterior na tela, preparam a próxima consulta automática e retêm sua resposta
no mock de rede. A regressão foi executada primeiro com o helper antigo:

| Fase | Helper antigo | Helper corrigido |
|---|---|---|
| Antes da nova requisição, duas consultas na fixture | Espera já concluída | Espera pendente |
| Nova requisição iniciada, resposta retida | Espera já concluída | Espera pendente |
| Resposta liberada e interface confirmada | Não distinguia a consulta anterior | Espera concluída, terceira consulta |

Antes: **0/2 aprovados**, falha esperada `previous confirmed status cannot finish
the next cycle`. Depois: **2/2 aprovados**. Isso comprova a ausência da barreira
no helper antigo; não demonstra que essa era a única influência sobre todas as
variações de duração da CI histórica.

## Correção restrita

- A espera é registrada **antes** de avançar o relógio ou iniciar a ação.
- `ready(page, {request})` aguarda a resposta dessa requisição, HTTP 200,
  término do corpo e status concluído da interface. Texto antigo sozinho não
  satisfaz a espera de um novo ciclo.
- `automaticCycle()` é usado nos dois helpers de cinco ciclos. Cada iteração
  exige exatamente mais uma consulta; o total continua exatamente cinco.
- O avanço de teste permanece `fastForward(20010)`. Nenhuma consulta manual é
  chamada pelo helper; nenhum intervalo, quota, backoff ou prazo da aplicação
  foi alterado. A carga inicial e mudanças de contexto da fixture também usam
  a requisição correspondente.
- A confirmação atual sem ação nova pode ser inspecionada sem `request`;
  isso não é usado como evidência de que uma consulta nova terminou.

## Orçamento da CI

O job frontend passa de 10 para **20 minutos**, incluindo instalação do browser,
pipeline, suíte integral, preparação do artefato e limpeza. A segunda tentativa
anterior concluiu 33 testes de pipeline e 354 de navegador sem falhas, mas foi
cancelada na finalização. O novo teto dá margem à variação dos runners sem
remover testes, paralelizar operações mutáveis ou alterar cobertura.

Node 22, dependências, comandos, gates de publicação e permissões permanecem.
O workflow Hosting continua exigindo PR não Draft para Preview e push na main
para produção. Render acompanha main; Preview automático não foi habilitado.

## Validação

Três rodadas focadas mensais: **10/10 aprovados em cada rodada**, sem falhas ou
ignorados (112,80s; 110,27s; 108,10s), executadas junto da suíte completa para
exercitar a espera também sob carga concorrente de navegador. Repetições são
subconjuntos da suíte completa; não são contadas como casos únicos adicionais.

Suíte frontend completa: **389/389 aprovados**, zero falhas/ignorados, em
740,27s. Os dois casos novos estão incluídos no total; as repetições focadas não
são somadas. Comando: `node --test --test-concurrency=1 --test-reporter=tap scripts/*.test.mjs`.
Node 22.23.3, Playwright 1.56.1/Chrome reais e APIs simuladas.

[Resumo verificável](evidence/agenda-stability.json) registra a reprodução
antes/depois, as três rodadas, a suíte completa e a comparação dos arquivos
funcionais com `b1bc02d77aa49385d9023567de1c35f54d4fbb10`. O HTML de Hosting
derivado também permanece byte a byte idêntico, SHA256
`5da10123f591bc37a6a4abdb1e40b5e9d8df18f673f181d37a3b2755b6944ca9`.

A integração pareada backend em CI usa Auth/Firestore demo-forja e Google
simulado; seu checkout será fixado no novo commit frontend. A CI e os jobs
ignorados de publicação devem ser conferidos nos checks dos dois PRs Draft.

Fonte funcional preservado, SHA256 do `index.html`:
`16e1ecbdb3ed0a973da72ff6bb66e3bf4ecb1890bbaf0a93a976c68ea79cf30b`.

## Limites para publicação

A reprodução e as novas barreiras eliminam a aceitação da confirmação anterior
no ensaio. Não constituem teste com contas reais da escola, nem garantia de
latência em produção. Permanecem as limitações documentadas de fontes Google
autorizadas, quotas por instância, backoff e webhooks/jobs. Publicação depende
de revisão e autorização específica; ambos os PRs devem permanecer Draft.
