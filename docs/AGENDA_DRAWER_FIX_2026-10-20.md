# Agenda 2.0 — correção local do binding do drawer — 20/10/2026

Correção autorizada somente localmente, na branch `codex/agenda-inteligente-2`,
sobre frontend `7e45c44d44d728ee1967ebf405fc28f59e53cada`. Sem push, merge, deploy,
Preview, operação Google real, infraestrutura ou dados escolares reais nesta
rodada. PR25 frontend e PR23 backend permanecem Draft. O commit backend continua
`a471873e446b38be2822dcb21327b35ec3921d00`, sem arquivos versionados alterados.

## Problema e correção

`forjaAgenda2Paint` recriava os botões verdes e `v621Bind` aplicava o handler
legado `v619BookProfessional`. O binding para `v630Open` era aplicado somente
durante `v630Mount`, fazendo o clique voltar ao modal antigo após a consulta.

O binding oficial foi extraído para `v630BindAgendaSlots`, na mesma closure de
`v630Open`, e reutilizado por `v630Mount` e pelo hook
`forjaAgenda2BindBooking`, executado depois dos binds genéricos da repintura.
Ele atribui somente `onclick`, com o mesmo professor/data/início/duração e
`preventDefault`/`stopPropagation` existentes. Repetir o binding substitui a
mesma propriedade; não acumula listeners nem cria outro fluxo de agendamento.

A repintura não chama `v630Mount`, `v630Update` ou `v630Render`. Não remonta a
raiz, não altera inputs ou dispara leituras/pedidos de reserva ao reassociar
handlers. `v630Open`, preflight, validação futura, confirmação/idempotência e
recuperação continuam nas implementações oficiais existentes.

## Geração e integridade

Alteração feita em `scripts/agenda-intelligence-build.mjs`; `index.html`,
`scripts/agenda-intelligence-changes.json` e o hash de `scripts/validate.mjs`
foram regenerados pelo procedimento oficial. Agora são 27 alterações reversíveis
até o mesmo main auditado, cujo hash permanece
`9643749053f34ab0213512a724fb3949fabc5ae33b6bfdc33056f8f2a3d9234a`.
Todos os guards anteriores permanecem ativos e seus digests não foram relaxados.

A substituição do gerador usa callback para inserir texto literal: o seletor
`$$` não pode ser interpretado como token especial de String.replace. O guard
detectou essa diferença na primeira geração e a geração final foi corrigida.
Duas regenerações consecutivas produziram o mesmo SHA256 do fonte:
`ba538ceaf6d305030b468e7cf697d49aa313ac87f19c10346c3c3d2cf3aaf082`.

## Regressão permanente

Adicionada a `scripts/agenda-intelligence.test.mjs`, já incluída na CI frontend.
Matriz de seis cenários: desktop/celular × dia/semana/mês. O mês passa pelo
cartão nominal do professor até a grade diária, preservando a navegação oficial.

O teste usa o portal integral, APIs simuladas, pacotes obtidos pela UI e preflight
com os contratos/políticas e horários futuros reais exigidos pelo cliente. Não
injeta estado de reserva para pular seus gates. O relógio de navegador avança
cinco intervalos de 20s antes do segundo clique e outros cinco com o formulário aberto.

Asserções:

- Clique verde antes/depois dos cinco ciclos abre somente o drawer oficial;
  nenhum `newLessonModal`, uma abertura por clique e uma leitura de pacotes.
- Professor, data futura, hora preferida e duração corretos; o preflight valida
  e seleciona o horário. Cenários de 30min e 60min.
- Inputs e seus nós DOM, foco, filtros, seleção, contexto/semana, scroll,
  UID/papel e slot escolhido permanecem após polling e 20 repinturas extras.
- Listeners estáveis e um único POST `/aulas` diante de dois eventos click;
  bookingRequestId e campos enviados corretos. Nenhum endpoint sync por polling.
- Os casos Google de dia inteiro usam fim exclusivo à meia-noite seguinte,
  mantendo as verificações de ausência de falso verde na suíte existente.

Antes da correção, o cenário desktop/semana falhou exatamente com
`before: green slot must open current drawer` (`false !== true`). Depois da
correção, os seis cenários passaram (45,8s), sem testes ignorados. As reexecuções
de diagnóstico ajustaram somente a fixture para não selecionar novamente o aluno
já selecionado, o que corretamente dispara outro preflight nativo e limpa o slot.

## Validação final executada

Todas as execuções usaram Node 22.23.3. Resultados finais, sem falhas, cancelados
ou ignorados:

| Execução | Aprovados | Duração |
|---|---:|---:|
| Regressão focada desktop/celular × dia/semana/mês | 6 | 45,8s |
| Suíte frontend completa (`scripts/*.test.mjs`) | 369 | 484,9s |
| Integração backend completa pareada ao frontend corrigido | 265 | 485,7s |

Os seis casos focados já fazem parte dos 369; o total das duas suítes completas
é 634. A integração preserva locks, conflitos atuais, confirmação/idempotência,
recorrência e isolamento; o frontend inclui login e falhas/expiração/bloqueios
sem falso verde. Não foi necessário reexecutar unitários backend sem alteração.

Comandos principais (Node 22 no PATH; Playwright/Chrome locais configurados):

```powershell
# No frontend:
node --test --test-concurrency=1 --test-reporter=tap scripts/*.test.mjs
node scripts/validate.mjs
node scripts/prepare-hosting.mjs
git diff --check
# No backend, com Auth/Firestore demo-forja emulados e FORJA_FRONTEND_DIR
# apontando explicitamente para o frontend local corrigido:
node --test --test-concurrency=1 --test-reporter=tap test/integration/*.test.mjs
```

Geração repetível e validação aprovadas, 11 scripts inline válidos. Artefato
Hosting gerado somente em disco, sem publicação: SHA256
`710b90dfaac08d814f88e97c6384e93ca40c7bfe6da1eafda92e80389c316f4c`.
Fontes, prova Google e páginas legais passam pelos guards existentes. Logs
locais ignorados em `forja-backend/.qa-tools/drawer-fix-{red,green,frontend-full,paired-integration}.tap`.

Leitura final do GitHub confirmou PR25 e PR23 abertos e Draft nos SHAs anteriores
`7e45c44d44d728ee1967ebf405fc28f59e53cada` e
`a471873e446b38be2822dcb21327b35ec3921d00`. Nenhum push ou alteração remota.

## Limites e revisão

Ambiente local: Node 22.23.3, Playwright 1.56.1 e Chrome instalado no Windows,
em desktop e viewport celular. A CI Linux permanece configurada com Chromium;
nenhuma execução remota nova foi disparada. Auth e Firestore usam somente
`demo-forja` nos emuladores locais (9099/8081), e Google é simulado.

O backend não precisou ser modificado. Sua CI remota continua pinada no frontend
anterior, pois não foi autorizado alterar o backend nesta rodada; a integração
local usa o diretório frontend corrigido explicitamente. A regressão nova já
entra na CI frontend quando houver futura autorização de push. Não houve
disparo de nova CI remota nesta correção local.

Não foram alterados cores, regras Google, caches/quotas, locks, permissão,
confirmação final ou fluxos de reserva do servidor. Permanecem os limites
documentados em `AGENDA_INTELIGENTE_2_2026-10.md`. Nenhum teste substitui revisão
e autorização específica para publicar. Aguardar autorização antes de enviar o
commit corretivo ao GitHub.
