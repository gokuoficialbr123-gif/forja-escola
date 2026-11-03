# Agenda: continuidade ao trocar Dia/Semana/Mês — correção em revisão

Branch `codex/agenda-view-continuity`. Base frontend
`e4d1aeb1aef2835a145b01ce2c2a3f7e91408ff9`; backend
`6da85c3963d373a44e09949b59078548c32a3dbf`. Mains reconferidos em
03/11/2026. Sem redesign, merge, Preview ou publicação nesta missão.

## Causas reproduzidas

1. `forjaAgenda2Context()` inclui visualização e período. `capture()` usa esse
   contexto na chave; `lifecycle()` chamava `reset()` em qualquer mudança dessa
   chave, apagando `record`, `knownRows` e `lastSuccess`. `row()`/`displayRow()`
   dependiam exclusivamente do snapshot da nova consulta. Na Semana → Mês com
   latência e HTTP 409 → Semana, as ocupações já conhecidas desapareciam até o
   próximo sucesso. A regressão falhou no HTML publicado, com dados fictícios,
   ao exigir ocupações na interseção enquanto a leitura mensal estava pendente.
2. `authorizeAgendaSnapshot()`, `readAgendaPersonal()` e
   `collectAgendaPersonal()` comparavam todo o documento da conexão Google.
   Um teste HTTP real, com Auth/Firestore emulados e Google retido por um gate,
   mudou somente `lastSyncAt` durante a leitura: recebeu HTTP 409
   `AGENDA_QUERY_CHANGED`. A alteração de credencial foi um controle negativo
   e permanece rejeitada. Não se atribui ao caso real da escola uma causa sem
   acesso aos respectivos metadados; o caminho defeituoso foi comprovado no QA.
3. Com a mesma versão SSE, um broadcast ainda válido, porém coletado antes de
   uma ocupação Google recém-confirmada, substituía o snapshot novo por dados
   antigos. Duas regressões (Secretaria/Professor) falharam antes da correção.
   Versão SSE sozinha não ordena alterações externas do Google.
4. Os caches pessoais e centrais escolhiam a primeira janela compatível. Uma
   leitura antiga estreita/livre podia reaparecer depois de uma nova janela
   ampla/ocupada. Também foram reproduzidas janelas parcialmente sobrepostas
   e uma leitura antiga em voo concluída depois da nova.

## Correção mínima

O cliente mantém a evidência de exibição por dia, limitada a 42 dias e à mesma
combinação UID/geração/perfil/seleção de professores. Cada linha mantém sua prova
e os prazos monotônico e de relógio originais. O novo período consulta normalmente;
nenhuma linha empresta confirmação a datas não consultadas. Uma troca de conta,
perfil, seleção, sessão ou saída da Agenda elimina o histórico.

A prova preservada serve à continuidade das ocupações e aulas. Enquanto o novo
snapshot não estiver confirmado, ela não autoriza disponibilidades verdes.
Vencimento, invalidação SSE e perda da concessão institucional continuam sendo
verificados por fonte. O histórico vencido tem identificação existente e não
habilita reserva. Resposta nova autoritativa vazia substitui a informação anterior.
Respostas tardias continuam cercadas pela chave, sequência e revisão SSE.
Broadcasts da mesma revisão também são ordenados pela entrega, início da coleta
e timestamps das fontes confirmadas; uma fonte antiga não substitui prova nova.
O descarte não dispara outra consulta nem prolonga a validade.

HTTP 429 mantém o mesmo `Retry-After`, inclusive ao mudar de visualização ou
pressionar Atualizar. O refresh manual compartilha a requisição em andamento.
Nenhum TTL, quota, consentimento ou contrato de reserva foi aumentado/relaxado.

No backend, uma versão canônica comum à leitura e ao SSE ignora exclusivamente
`lastSyncAt`, `lastSyncAttemptAt`, `lastSyncSource` e `updatedAt` da conexão
pessoal. Credenciais, identidade, autorização, calendário, consentimento,
desconexão, falhas, estado de sincronização e sincronização inicial permanecem
significativos. Os outros tipos de documento preservam a política anterior.
Os caches existentes passam a selecionar a prova mais nova e a aposentar provas
anteriores sobrepostas quando uma nova coleta completa tem sucesso. Uma leitura
em voo superada só pode entregar a prova substituta quando ela cobre todo o
pedido; sobreposição parcial exige nova consulta. Um 429 tardio ainda conserva
o cooldown da conta. O caminho fresco da confirmação de reservas não mudou.

## QA e evidências

Somente Node 22, portal real servido em loopback, identidades fictícias,
`demo-forja`, Auth/Firestore locais e Google simulado. Guard de ambiente/rede
carregado antes das suítes; configuração herdada de credenciais não é repassada.
O navegador intercepta SDK/API e bloqueia o restante; nenhuma consulta real é
necessária para reproduzir o defeito. A telemetria de transição existe apenas
nos artefatos instrumentados de QA, sem IDs pessoais, títulos privados ou tokens.

Regressões permanentes: `agenda-view-continuity.test.mjs`,
`agenda-view-evidence.test.mjs`, integração `agenda-snapshot-http.test.mjs` e
versões em `agenda-changes.test.mjs`. O caso antigo de fallback nativo agora
estabelece indisponibilidade real da fonte antes de esperar histórico: trocar
a visão deixou de ser motivo válido para perder uma prova nativa ainda atual.

31 regressões focadas aprovadas na retomada, incluindo histórico nativo,
cancelamentos, detalhe canônico, troca de período, invalidação por fonte,
vencimento e `Retry-After`. Os casos novos cobrem as duas agendas em desktop e
celular; os testes permanentes também verificam explicitamente datas não
consultadas e troca de sessão com evidência previamente preenchida.

Comparação visual: quatro cenários anteriores e quatro corrigidos aprovados,
com capturas e gravação de todo o roteiro. Veja o
[índice de imagens, vídeos e hashes](evidence/agenda-view-continuity/README.md).

Sessão prolongada final aprovada: **604.497 ms reais**, 86 ciclos Dia/Semana/Mês, duas
abas, 496 transições e 115 GETs concluídos na página instrumentada durante
navegação deliberada, renovação e recuperação. A aba secundária é exercitada
pelos mesmos Web Locks/BroadcastChannel oficiais. Não se interpreta o total de
GETs desse roteiro de navegação como uma frequência de polling parado.
O relógio Playwright avança seletivamente para exercer a reconexão; a duração
de dez minutos foi medida pelo relógio real do processo Node.

O checkpoint exige recebimento na aba atual: sete eventos `changed`, sete
`reconnect`, sete novos `ready` após liberação do Web Lock/conexão anterior e
uma única conexão substituta compartilhada entre as abas. A análise das 496
transições encontrou zero disponibilidades verdes sem prova atual de todas as
fontes. Falha e recuperação central, troca de foco e atraso da API foram
registrados. CDP observou somente `127.0.0.1` como endereço remoto real.

O primeiro roteiro exploratório não exigia receipt dos frames; ele não foi usado
como prova final de SSE. A instrumentação mostrou relógios Playwright defasados
entre abas e broadcasts com idade negativa (recusados corretamente). O roteiro
final alinha os relógios como a regressão de handoff existente, sem mudar a
guarda temporal de produção, e confirma cada frame efetivamente recebido.
Provedores e contas são simulados; isso não prova autenticação ou disponibilidade
de uma conta Google real. Os resultados integrais ficam vinculados ao SHA nos
checks e no relatório final de validação do PR.

A revisão final acrescentou oito regressões unitárias dos caches (371 aprovadas)
e duas regressões de broadcast, cada uma com três variantes. As 74 integrações
afetadas e os 35 testes de isolamento/pipeline passaram no código final. Os
roteiros visuais finais (quatro cenários e sessão longa) passaram: 5/5.
O teste de navegação agora pausa o relógio antes de coletar qualquer prova, e
aguarda a conclusão da resposta obsoleta antes de avançar o retry da revisão
atual. Esses checkpoints corrigem corridas do QA, mantendo os mesmos deadlines,
asserts de remoção autoritativa e cobertura. As execuções anteriores com falha
permanecem registradas; não representam aprovação da versão final.

O teste legado de backoff também foi instrumentado em cópia isolada: mesmo uma
rodada aprovada avançava o relógio durante HTTP pendente e terminava com timeout
artificial. Os timestamps da resposta vinham do Node, enquanto o navegador já
estava 40s adiante. A fixture agora compartilha o relógio sintético, congela antes
da coleta e aguarda cada resposta. Exige duas tentativas completas, nenhuma antes
do prazo, nenhuma duplicada e nenhum timeout artificial: 20s para resultado
parcial com fonte independente saudável; 40s/80s para falhas de transporte,
autorização ou quota sem Retry-After explícito. Esses são os prazos já existentes
no cliente, sem mudança funcional. O trecho final usa `runFor` para não coalescer
o timer de vencimento e seu piso de 20ms no endpoint de `fastForward`.
A desmontagem dessa fixture usa o mesmo fechamento offline/unrouteAll já
adotado pela fixture de apresentação, para descartar callbacks pendentes somente
durante o encerramento. Isso evita avaliar o relógio de uma página já fechada;
erros de rota durante o teste continuam visíveis e nenhuma asserção foi removida.

## Limites, riscos e reversão

- Informação histórica pode estar diferente do Google atual; é identificada e
  bloqueia a oferta de novos horários até confirmação, não oculta uma falha real.
- A retenção é limitada; navegar além dos 42 dias preservados exige nova leitura.
- Trocar visualização ainda exige uma consulta do respectivo período e nova
  assinatura SSE; não há promessa de instantaneidade ou aumento de quotas.
- Reprodução sintética comprova os caminhos descritos, não identifica eventuais
  condições adicionais específicas de contas Google reais ou do Render.
- Locks, validação final no backend, OAuth, Rules, credenciais, calendários,
  vínculos, recorrência e contratos de criar/remarcar/cancelar permanecem intactos.
- Não há migração nem transformação de dados. Uma eventual reversão futura seria
  somente de código, coordenada e mediante autorização; não executar rollback,
  merge ou deploy nesta missão. Os componentes mantêm o contrato HTTP existente.
