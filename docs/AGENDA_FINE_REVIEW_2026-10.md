# Pente-fino da Agenda — 21/10/2026

Escopo: Agenda da Secretaria/admin e Agenda do professor. Código preparado em
`codex/agenda-fine-review`; publicação condicionada à aprovação dos testes e da
CI do SHA exato, conforme autorização específica do proprietário. O resultado
da publicação deve ser confirmado pelo job `production` e pelo HTML servido;
este documento de preparação não substitui essa prova.

## Base e reprodução

Os dois checkouts estavam limpos. Frontend main
`5a29e325cc938185ad02082b3e0d52dc4f479c5e` incorporou o PR #28. O workflow
[39661872712](https://github.com/gokuoficialbr123-gif/forja-escola/actions/runs/39661872712)
teve `production: success`. O HTML público às 19:54 UTC tinha SHA256
`700f4949cce5892ecdae7612acec1dc9c645496e0357a2f754a4529bf4ae97ae`,
exatamente o artefato dessa main. Backend main e `/health`:
`d1483037be294428ab1af7788311f42389790c1a`, sem alterações nesta missão.

Os screenshots **antes** usam esse HTML publicado, servido em loopback, com os
mesmos dados sintéticos dos screenshots **depois**. Não houve login em conta
real, teste mutável em produção ou acesso a eventos Google reais. Playwright
1.56.1 usa o motor Chromium pelo Chrome instalado no Windows; CI usa o Chromium
instalado pelo Playwright. Node 22.23.3, Auth/Firestore `demo-forja` e Google
simulado na borda HTTP.

## Problemas confirmados e correções

| Perfil | Reprodução / causa | Correção e regressão |
| --- | --- | --- |
| Ambos | Aulas 10:00–11:00 e 10:30–11:30 usam a mesma largura; o segundo cartão intercepta o clique no centro do primeiro. | Grupos de sobreposição ganham colunas por profissional. Aulas consecutivas voltam à largura completa; horários e cortes não mudam. |
| Secretaria | Cartão azul identifica só o professor, repetido em várias aulas. | Aluno no título visível; nome completo, professor, disciplina e horário no nome acessível/tooltip. Detalhe oficial preservado. |
| Ambos | Uma aula descoberta pelo snapshot não está em `state.lessons`; Cancelar abre nada porque a ação nativa procura nessa lista. | O GET autorizado dos detalhes atualiza o registro local antes de habilitar as ações existentes. Testes de cancelamento único, inclusive clique duplo, após cinco ciclos. |
| Ambos | Fechar o carregamento não impede o GET atrasado de reabrir a janela ou substituir outro formulário. | Resposta exige mesma sessão, página e nó de diálogo. Resposta descartada não atualiza o registro local. |
| Ambos | Aula agendada mostra duração “—”, pois o renderizador só considera término real. | Horário inicial/final gera duração **prevista**; duração realizada continua usando o contrato anterior. |
| Ambos | Carregamento → detalhe troca a referência de foco; polling substitui o cartão original. Escape deixa o foco perdido. | Preservação do acionador e procura do cartão atual ao fechar, somente na Agenda. Regresso após cinco consultas exatas. |
| Professor | Handler mensal ignora qualquer `.v621-month-tag`, inclusive disponibilidade e “+N”. | Só o botão de aula intercepta a abertura dos detalhes; demais indicadores abrem o dia oficial. Números dos dias são botões com rótulo e foco preservado. |
| Ambos | No mês móvel, nome do professor ocupa toda a tag e esconde seu significado. | Palavra de estado explícita antes do texto, rótulo acessível e tooltip completo. Célula não recebe estado agregado de todos os professores. |
| Secretaria | Lateral inteira antecede o calendário no celular, consumindo mais de uma tela. | Painel nativo `details` recolhível até 900px, mantendo busca, seleção, filtros e calendário. Estado de abertura preservado. |
| Professor | Regra móvel `display:none` torna os três filtros inacessíveis. | Filtros e calendário ficam no painel recolhível; a ação original de disponibilidade fixa permanece visível. Filtros continuam funcionando após polling e navegação. |
| Secretaria | Seleção de 50 professores produz cartões de apenas 16px e texto ilegível. | Mínimo de 112px por coluna de profissional, rolagem **interna**, cabeçalho e corpo com a mesma largura. Sem extrapolar a página. |
| Ambos | Regra global `height:100dvh` disputa com o padding do modal: topo em y=-6px no celular. | Limite de altura desconta as margens somente com a Agenda aberta; cabeçalho/rodapé ficam dentro da tela e ações são alcançáveis pela rolagem do corpo. |
| Ambos | Polling mantém a rolagem, mas filtrar e sair/voltar recriam o calendário em 0/0. | Posição interna guardada no estado existente da Agenda, por sessão/profissionais/período/visualização, limitada a oito contextos e apagada pela troca de sessão. Quatro regressões permanentes cobrem filtros, retorno, cinco ciclos e isolamento. |

Na Secretaria, o acesso à disponibilidade fixa move o **mesmo nó**, com seus
handlers, para o painel da Agenda. No professor, preserva a ação original visível
mesmo com filtros recolhidos. Não se recria o select durante o polling. A nota lateral
explica a consulta de ocupações e deixa de prometer sincronização de ida e volta.

## Preservação dos contratos

[Prova de integridade](evidence/agenda-fine/integrity.json): comparação literal
com a main confirma que permaneceram idênticos o núcleo de disponibilidade e
ocupações, validação fail-closed, ciclo de 20s, expiração, quotas, cache, sessão,
`v621Lane`, `v629Lane`, `v623CutAvailability`, script oficial do drawer v630,
script de navegação e as 15 substituições da neutralização do aluno.

O polling continua sendo `GET /agenda/snapshot`, somente leitura. Verde exige
fontes confirmadas; desconhecido/erro/vencido não vira livre. Cor de evento Google
não decide Free/Busy. O layout não remove conflitos, encurta compromissos ou
deduplica aulas por coincidência de horário. Origem Google continua sanitizada.

Criação, remarcação e cancelamento seguem os endpoints nativos, incluindo locks,
confirmação final e idempotência. A integração emulada cobre esses contratos,
webhook, invalidação após escrita e ocupação externa em duas sessões. Isso
comprova os caminhos com Google simulado; não comprova tokens, consentimento,
entrega de webhooks ou disponibilidade das contas reais.

Não houve mudança funcional backend, Rules, scopes OAuth, credenciais, DNS,
infraestrutura, páginas públicas, dados pedagógicos ou demais perfis.

## Arquivos e geração

- `scripts/agenda-intelligence-client.js`: apresentação das colisões, rótulos,
  duração prevista, retorno de foco e localização dos controles existentes.
- `scripts/agenda-intelligence-style.css`: regras restritas às Agendas.
- `scripts/agenda-intelligence-build.mjs`: migrações reversíveis dos detalhes,
  mês e filtros; reaplica a navegação publicada.
- `index.html`, manifests `agenda-intelligence-changes.json` e
  `navigation-student-changes.json`, pins em `navigation-student-scope.mjs` e
  `validate.mjs`: regenerados, sem editar o HTML à mão.
- `navigation-student-build.mjs`: usa a entrada restaurada pelo hash exato,
  permitindo regenerar a camada anterior da Agenda sem perder a navegação. Não
  modifica seu comportamento. Guardas e reversão continuam obrigatórios.
- `helpers/agenda-presentation-fixture.mjs`: transformação opcional de dados
  sintéticos; as fixtures anteriores mantêm o mesmo comportamento.
- `agenda-fine.test.mjs`: 30 regressões novas, incluídas em `validation.yml`.
  Testes antigos do drawer/disponibilidade abrem o painel recolhível pelo
  controle visível antes de usar seus filtros, mantendo todas as asserções.
  O workflow de Hosting e seus gates de publicação permanecem intactos.

Regeneração repetida produz o mesmo hash, com todos os guards anteriores ativos.
Fonte SHA256: `fc0250d76f1d89dc6d8bdb573db7099065928870093e9d747040f3a1508eccb6`.
Artefato Hosting preparado: `83ed7ffc1233136161288293a05e4c1fa7332927f70550c436fb6d6d0f40d693`.
Preparar `.firebase-public` não executa deploy. Documentação, screenshots e
ferramentas de QA não entram no artefato público.

## Evidências visuais

Matriz completa: 1920×1080, 1366×768, 768×1024, 390×844 e 360×640, nas duas
agendas e em dia/semana/mês. `baseline-capture.json` enumera os 30 screenshots
antes com a versão publicada. Os 30 arquivos correspondentes `after-*` usam
datas, aulas e intervalos equivalentes. Todos os nomes e registros são fictícios.

| Caso | Antes | Depois |
| --- | --- | --- |
| Secretaria, notebook, aulas sobrepostas | [Antes](evidence/agenda-fine/before-admin-notebook-day.png) | [Depois](evidence/agenda-fine/after-admin-notebook-day.png) |
| Professor, notebook, aulas sobrepostas | [Antes](evidence/agenda-fine/before-teacher-notebook-day.png) | [Depois](evidence/agenda-fine/after-teacher-notebook-day.png) |
| Secretaria, mês móvel | [Antes](evidence/agenda-fine/before-admin-mobile-month.png) | [Depois](evidence/agenda-fine/after-admin-mobile-month.png) |
| Professor, celular pequeno | [Antes](evidence/agenda-fine/before-teacher-small-day.png) | [Depois](evidence/agenda-fine/after-teacher-small-day.png) |
| Detalhes e ações móveis | [Antes](evidence/agenda-fine/before-teacher-mobile-detail.png) | [Depois](evidence/agenda-fine/after-teacher-mobile-detail-actions.png) |

[Geometria de 10 janelas](evidence/agenda-fine/dialog-geometry.json): limites
das duas agendas nas cinco resoluções, ações não cobertas pelo rodapé e rascunho
do drawer preservado durante cinco ciclos em cada resolução da Secretaria.
Screenshots de página inteira costuram conteúdo rolável; a barra de navegação
fixa pode aparecer no meio dessa imagem. As capturas `*-detail-actions.png` e
`*-drawer.png` são de viewport e comprovam os limites reais das janelas.

[Reprodução complementar da rolagem](evidence/agenda-fine/before-scroll.json),
no candidato inicial: polling preservava 80px, mas filtro e retorno zeravam os
dois eixos. A revisão adiciona quatro testes de retenção e limpeza por sessão;
o adaptador de navegação publicado permanece literalmente idêntico.

## Validação e limites

O parecer final dos testes completos e da CI, com SHA e links, será registrado
no PR antes de qualquer merge. Os comandos finais cobrem todos os arquivos
`scripts/*.test.mjs` (30 novos testes mais a suíte anterior), backend unitário
e todos os `test/integration/*.test.mjs` com emuladores. A suíte local é
distribuída entre o arquivo novo e os demais arquivos; nenhum teste foi excluído.

As verificações intermediárias interrompidas após encontrar defeitos adicionais
não contam como aprovação. As asserções de cinco ciclos continuam exatas;
reservas/cancelamentos usam apenas simulação e os fluxos oficiais.

Limites mantidos: muitas seleções usam rolagem interna; o mês é resumo e o dia
abre os detalhes completos. Intervalos de 15 minutos conservam 12px na escala
real e texto compacto, com identificação completa ao abrir/usar o rótulo
acessível. O backend pode responder desconhecido sob quota, atraso ou falha;
não há garantia de propagação Google em exatamente 20s. Validação de integrações
com contas reais exige operação consciente do proprietário; não foi feita nesta
rodada. Nenhum bloqueador conhecido pode ser ignorado para publicar.
