# Agenda — correção visual e revisão da sincronização — 20/10/2026

Preparado para revisão em `codex/agenda-visual-sync-review`. **Nenhum merge,
deploy, Preview, OAuth, alteração de infraestrutura/Rules ou dado real de QA.**
Esta correção ainda não está em produção.

Bases consultadas no GitHub e usadas nos checkouts existentes:
frontend `390cda1ae73d9f9c6b710beb096105d9aeff01bf` e backend
`36535c0c66ae7522fea162c22a2f6c8a38bacbf1`. Os dois diretórios estavam limpos.
O `/health` anônimo confirmou `releaseCommit=36535c0…`, Google configurado e
webhook configurado. O HTML público tem SHA256
`710b90dfaac08d814f88e97c6384e93ca40c7bfe6da1eafda92e80389c316f4c`, igual ao
artefato anterior. Isso comprova a versão e a configuração pública, **não** a
validade dos tokens, a entrega de webhooks ou a sincronização de contas reais.

## Causas confirmadas

- `forjaAgenda2Bands` desenhava verde/vermelho sob os cartões nativos de
  `v621Lane` e `v629Lane`. Google pessoal e central coincidentes também geravam
  cartões sobrepostos. Um intervalo Google coincidente com uma aula cobria a
  identificação azul sem comprovar que os eventos tinham a mesma identidade.
- A Secretaria mantinha altura de 960px, enquanto cartões, horas e indicador
  atual usavam 48px/h entre 07:00 e 22:00, isto é, 720px. O mínimo visual de
  24px também podia ampliar eventos curtos sobre o intervalo seguinte.
- Cabeçalho mantinha “2 vias · auto 5 min”, três acessos equivalentes ao drawer
  e um resumo que contava fontes coincidentes separadamente. No celular, o
  status inserido num flex em coluna criava outra coluna e excedia a largura.
- O snapshot backend removia `personal.busy` do próprio objeto compartilhado
  pelo cache/in-flight. Uma resposta podia apagar ocupações de outra sessão e
  ainda retornar sucesso. Reproduzido em HTTP e protegido por regressão com
  objeto imutável, dois atores e cinco ciclos.
- A exclusão Google confirmada não invalidava o cache pessoal de leitura:
  o intervalo antigo podia continuar vermelho até expirar. Leitura iniciada
  antes da escrita também precisava ser impedida de repovoar esse cache.
- Reagendamento exibia “sincronizada” mesmo com `googleSyncStatus=erro` no
  resultado. A aula salva e a pendência Google agora recebem feedback distinto.

## 1. Visual corrigido

A disponibilidade continua sendo calculada pelos cortes existentes. Verde é
somente o botão nativo de disponibilidade confirmada. Faixas de fundo agora
representam exclusivamente cinza (fora da publicação) e amarelo (não confirmado).
Sem nova interface de reserva ou controlador paralelo.

Ocupações coincidentes formam um cartão vermelho, com origem “Google pessoal”,
“Google central”, “Bloqueio FORJA” e/ou “Calendário escolar”. Títulos, descrição,
participantes e IDs Google não são exibidos. O bloqueio manual conserva seu
handler e período originais, inclusive se o cartão visível foi recortado.

Aulas ativas mantêm cartão azul e ação nativa de detalhes. Quando um ocupado
coincide, o azul tem prioridade **somente na apresentação** e informa a origem
coincidente. Nenhum intervalo é removido do cálculo ou da validação por simples
coincidência; não se infere propriedade/identidade de eventos Google.

Aulas canceladas continuam acessíveis no resumo do dia e no mês, rotuladas
“Cancelada”, sem cobrir de azul o horário liberado. Os filtros continuam ativos.

Há uma legenda de cinco estados, uma hora de última consulta completa separada
da última sincronização Google e uma ação principal de agendamento. A falsa aba
de modo e o botão flutuante redundantes deixam de disputar espaço. O drawer
continua sendo o oficial de `v630Open` e `v630BindAgendaSlots`.

As duas grades usam 720px/48px por hora. Intervalos curtos conservam a duração
real; o indicador atual é uma linha discreta atrás dos cartões. Dia ocupa a
largura disponível; semana mantém rolagem interna no celular. O mês usa rótulos
independentes por professor, sem pintar a célula inteira de verde. Contagens de
fontes ocupadas sobrepostas não são apresentadas como contagens de compromissos.

Repintura altera somente grade, resumo do dia, tags mensais e metadados de
cabeçalho. Não remonta drawer/modal ou controles em edição. O gerador oficial
continua restaurando exatamente o baseline auditado antes dos guards anteriores.
São 45 migrações reversíveis; nenhum hash/guard foi desativado.

Fonte frontend final testado: SHA256
`16e1ecbdb3ed0a973da72ff6bb66e3bf4ecb1890bbaf0a93a976c68ea79cf30b`.
CSS extraído para `scripts/agenda-intelligence-style.css`, incorporado pelo
gerador no mesmo artefato. Helpers, testes e relatórios não entram no Hosting.

Revisão retomada em 21/10/2026 sem descartar alterações locais. No mês móvel,
as sete colunas cabem no calendário; o título quebra em uma linha própria e a
barra deixa de herdar o `flex-basis:60px` legado que sobrepunha os dias da semana.
A regressão permanente mede a largura interna e a separação título/dias nos dois
papéis, além de conferir a ausência de overflow da página.

Comparação com a main, no mesmo portal e dados simulados:

| Cenário | Antes | Correção |
|---|---|---|
| Professor, desktop/dia | [Antes](evidence/agenda-review/before-teacher-desktop-day.png) | [Depois](evidence/agenda-review/after-teacher-desktop-day.png) |
| Professor, celular/dia | [Antes](evidence/agenda-review/before-teacher-mobile-day.png) | [Depois](evidence/agenda-review/after-teacher-mobile-day.png) |
| Secretaria, desktop/semana | [Antes](evidence/agenda-review/before-admin-desktop-week.png) | [Depois](evidence/agenda-review/after-admin-desktop-week.png) |
| Secretaria, celular/semana | [Antes](evidence/agenda-review/before-admin-mobile-week.png) | [Depois](evidence/agenda-review/after-admin-mobile-week.png) |

Há também capturas finais de dia/semana/mês nos dois tamanhos, para os dois
papéis, em `docs/evidence/agenda-review/`. O print de produção mencionado não foi
anexado nesta conversa; a comparação é com o artefato da main, não com esse print.

## 2. Sincronização existente e comprovada

| Caminho | O que o código faz | Prova segura desta revisão |
|---|---|---|
| A — interface | `GET /agenda/snapshot` após 20s de uma resposta completa, apenas Agenda aberta/visível; TTL 25s, pausa, cancelamento e backoff | Navegador: cinco ciclos, leitura única por ciclo, sem `/sync`, sem GET adicional de `/me` |
| B — Google pessoal | Backend lê `events.list` no calendário pessoal configurado; trata opaco/transparente/cancelado/dia inteiro, nunca usa cor como livre | HTTP real local + Google simulado, evento verde opaco e múltiplos dias; cache <15s e in-flight compartilhado |
| B — Google central | Adaptador central existente consulta FreeBusy dos vínculos explícitos habilitados; não cria, importa ou edita eventos centrais | Suítes HTTP/integração centrais, permissões, fonte incompleta e quotas preservadas |
| C — FORJA → Google pessoal | Criação e PATCH chamam `syncForjaEntityGoogle`; cancelamento usa entrega/lease/retentativa existentes e verifica propriedade antes de DELETE | Criação + replay: uma aula e um insert; remarcação: PATCH do evento; cancelamento: um DELETE, cache invalidado |
| D — Google → ocupação | Leitura vê eventos externos opacos como “Ocupado”, sem criar aula | Duas sessões após 20s reais veem o evento externo; remoção refletida no próximo ciclo, sem importação/escrita |
| D — Google → aula gerenciada | Webhook validado dispara pull incremental; `applyGoogleManagedEvent` só aplica referência FORJA válida, com verificações e locks existentes | Watch/canal/token simulados; token errado não altera; webhook válido remarca a aula e libera o lock |
| E — professor/Secretaria | Mesmo compositor, com autorização e projeção de dados por papel; nenhuma transferência entre UIDs no navegador | Assinaturas de intervalos iguais nas duas grades; HTTP de dois atores preserva todos os ocupados compartilhados |

Consulta **não é** reconciliação de aulas. Antes de webhook/job aplicar uma
alteração gerenciada, a consulta pode mostrar o novo ocupado Google enquanto o
registro nativo ainda aguarda reconciliação. Uma conexão central não fornece
sincronização bidirecional de aulas. Eventos externos sem referência FORJA não
viram aulas por coincidência de horário.

A fonte pessoal cobre o `calendarId` da conexão (fallback `primary`), não todos
os calendários da conta. A central cobre somente associações explícitas
habilitadas. Ausência pessoal limpa é `not_applicable`; conexão inválida,
quarentenada ou busy órfão permanece desconhecido. Verde não comprova ausência
de compromissos em calendários que não fazem parte das fontes autorizadas.

Agenda 2.0 desativou os disparos frontend `v627AutoSyncTeacherAgenda`, a carga e
os timers de `v629RefreshSecretaryAgenda` e a leitura semanal/central paralela
substituída por `v621EnsureVisibleWeeks`. O botão Atualizar consulta consulta o
snapshot; o comando pessoal Sincronizar continua sendo explícito e pode escrever.

O backend mantém webhook, renovação de watches (startup 30s/12h) e reconciliação
(startup 60s; fallback configurável 5–60min, padrão 5min), registrados apenas no
ambiente com Google pessoal habilitado. D-2 e extensão de recorrências não foram
alterados nem acionados. Disponibilidade/publicação, consentimento, scopes,
sessões, locks, recibos e confirmação final permanecem nos mecanismos existentes.

## 3. O que depende de contas reais autorizadas

Nenhum OAuth, token, grant, calendário ou dado escolar real foi usado. Portanto
permanecem sem comprovação nesta rodada: validade das conexões/consentimentos,
acesso aos calendários associados, entrega real de webhook, renovação efetiva
dos watches, quotas da conta e reflexo Google ponta a ponta com contas da escola.
Os timers existem no código; isso não garante execução pontual em serviço Free
adormecido. O health configurado não substitui essas provas.

Após aprovação específica, a escola precisará definir contas/eventos autorizados
e casos de verificação controlada. Esta revisão não os executa e não amplia
scopes nem cria outra sincronização para contornar consentimentos.

## 4. Testes e evidências

Node 22.23.3, Playwright 1.56.1/Chrome no Windows; CI usa Chromium/Node 22.
Auth 9099 e Firestore 8081 locais, exclusivamente `demo-forja`. Provedor Google
simulado na borda; chamadas externas dos navegadores são interceptadas.

Rodadas finais completas em 21/10/2026, no fonte SHA256 registrado acima:

| Suíte | Aprovados | Falhas / ignorados | Duração local |
|---|---:|---:|---:|
| Frontend completo (`node --test --test-concurrency=1 scripts/*.test.mjs`) | 387 | 0 / 0 | 619,60s |
| Backend (`node --test test/*.test.mjs`) | 310 | 0 / 0 | 4,74s |
| Integração pareada, via `firebase emulators:exec`, frontend corrigido | 275 | 0 / 0 | 510,72s |

Total: **972 testes aprovados**. Os 18 cenários novos de apresentação, os 28 da
Agenda/drawer e os dez contratos HTTP novos estão incluídos nesses totais.
Os emuladores encerraram normalmente após sucesso. As rodadas interrompidas
e as repetições focadas não entram na contagem.

[Resumo verificável](evidence/agenda-review/validation-summary.json), com hash
dos 16 PNGs (quatro antes e doze depois), versões, tempos e hashes do artefato.
As capturas finais foram inspecionadas; nos cenários de grade testados não há
cartões sobrepostos, nem verde sobre ocupação, bloqueio ou fonte desconhecida.
O mês móvel passa também nas medições internas de largura e título/dias.

O gerador oficial foi reexecutado após as suítes e reproduziu o mesmo fonte:
45 migrações, baseline `96437490…`, scripts íntegros. `prepare-hosting.mjs` gerou
somente o diretório local ignorado; SHA256 do HTML derivado:
`5da10123f591bc37a6a4abdb1e40b5e9d8df18f673f181d37a3b2755b6944ca9`.
Isso é preparação local, sem publicar Firebase ou Preview.

[Comparação de login](evidence/agenda-review/login-comparison.json) entre o
artefato da main e a correção, com três contextos novos por variante/tamanho,
execução intercalada e APIs simuladas: **14 GETs iniciais em todas as amostras**.
Medianas de login desktop: 1169 → 1174ms; celular: 1329 → 1335ms. Acesso à
Agenda: 625 → 624ms e 1194 → 1241ms, respectivamente. Celular simula CPU 4× e
rede 1,6Mbps. A amostra pequena não indica degradação relevante de login, mas
não mede contas reais, cold start Render nem estabelece garantia de latência.

Cobertura: papéis × três visões × desktop/celular; cinco ciclos e repinturas;
dia inteiro/múltiplos dias, transparência/cor, fontes vencidas/falhas; mês com
livre/ocupado/desconhecido; formulário/scroll/filtros/foco; uma abertura/um POST
no clique duplo; bloqueio manual e drawer oficiais; feedback parcial honesto;
duas sessões, objeto compartilhado imutável e leitura atravessando DELETE;
quotas/isolamento, locks, idempotência e regressões de login.

A fixture visual fixa tanto o relógio quanto a data selecionada em 20/10/2026;
os eventos sintéticos não dependem da data do computador. Os contratos HTTP
aguardam a conclusão assíncrona do webhook e respeitam os limites existentes;
nenhuma quota ou validação funcional foi relaxada para acomodar o teste.

## 5. Riscos restantes para produção

- Atualização de 20s é consulta após resposta, não SLA de propagação Google ou
  reconciliação. Falhas/429 entram em backoff e deixam fontes desconhecidas.
- Cache pessoal/central e quotas continuam por instância; não há quota global
  distribuída. A invalidação pessoal é por UID, sem remover leituras pendentes
  da contagem de concorrência. O cache central permanece com TTL próprio <15s.
- Muitos filtros/períodos/sessões independentes podem esgotar os limites e ficar
  amarelos. Fonte incompleta nunca autoriza verde; reservar continua exigindo a
  validação fresca dentro dos locks existentes.
- Mantidos limites da implementação publicada: 42 dias/50 profissionais,
  tamanhos/paginação e grade horária de 07:00–22:00. Não foram criados índices,
  migrações, Rules, jobs ou recursos novos.
- Intervalos muito curtos usam apresentação compacta e rótulos/tooltip; o mês é
  um resumo por profissional. A conferência operacional final permanece no dia
  e no drawer; não se inventa confirmação ou publicação de disponibilidade.
- Publicação precisa de revisão e autorização próprias, coordenando a correção
  backend do snapshot/cache com o frontend. Nenhum deploy é autorizado por este
  relatório. Os PRs devem permanecer Draft.
