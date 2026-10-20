# Agenda Inteligente 2.0 — implementação local de 20/10/2026

Preparado para revisão. Nenhum merge, push, deploy, OAuth real, mudança de Rules,
infraestrutura, credencial ou dado escolar foi executado por esta implementação.
Bases auditadas: backend `32b4a0854d53c35853d0a9614727b5dfaa8d56ed`, frontend
`86134148337c4dfa9d9979cee734d5bb48a2cd30`. Branch local coordenada
`codex/agenda-inteligente-2` nos dois repositórios. A documentação histórica que
diz “preparado” não é prova da versão atualmente servida.

## Consulta de tela, separada da sincronização

`GET /agenda/snapshot?from=YYYY-MM-DD&to=YYYY-MM-DD&professionalId=UID`
aceita parâmetros `professionalId` repetidos para IDs diferentes. Máximo 42 dias
inclusivos e 50 professores. Admin ativo pode consultar professores ativos;
teacher ativo somente seu próprio UID. Token/revogação, perfil e OTP seguem o
middleware existente. Perfil e vínculos das credenciais são relidos antes/depois.
Perfis e vínculos dos profissionais são obtidos em lote. Preview compartilhado
recusa a rota antes de consultar fontes pessoais/nativas (`AGENDA_ENVIRONMENT_BLOCKED`).
Resposta `no-store`, policy `agenda-readonly-v1`, sem títulos/detalhes de eventos
Google, calendário bruto, token ou credencial. Não executar `/me` neste polling.

Composição: disponibilidade efetivamente publicada (semana/padrão/exceções),
aulas com projeção por papel, bloqueios manuais, calendário escolar e Google.
Leituras não publicam/migram disponibilidade e não atualizam histórico ou busy
Firestore. Eventos Google são consultados com `events.list`/FreeBusy nos scopes
já existentes. Cancelled/transparent não bloqueiam; cor nunca decide ocupação.
Eventos opacos gerenciados também continuam ocupados: não deduplicar por simples
coincidência de horário ou remover a fonte central por haver aula FORJA.

Google pessoal: leitura ao vivo, sanitizada, até 20 páginas de 250 itens,
timeout 8s, cache em memória por vínculo exato/período por menos de 15s e
compartilhamento pendente. Até quatro coletas/minuto/profissional, duas em voo.
Consentimento administrativo e desconexão continuam respeitados. Falha nunca
vira `busy: []` confirmado. Ausência legítima de conexão continua not_applicable.
Credencial inativa/quarentenada ou cache busy órfão sem conexão fica desconhecido
também para o próprio professor; somente a ausência limpa das duas fontes é
not_applicable. A consulta não limpa nem reconstrói esses documentos.

Central reutiliza o adaptador existente. A janela privada de tela pode abranger
42 dias; os endpoints públicos anteriores conservam 31 dias. Cache específico
de polling <15s, fingerprint/in-flight iguais às proteções existentes. Polling
usa no máximo quatro das dez novas partidas/minuto/conta/instância e só inicia
quando há menos de duas chamadas em voo. Restam seis partidas e oito slots para
checagens finais; nenhum limite de booking foi ampliado. O limite total continua
10/minuto, e reservas também podem consumir sua própria capacidade.

O polling tem teto adicional de 90 requests/IP/5min e é recusado antes de consumir
as últimas 60 requisições do limite global de 300. Esses limites são locais à
instância e conservam espaço para os comandos; muitas visões independentes no
mesmo IP podem receber 429 e entrar em backoff.

Agregação: duas consultas de tela globais simultâneas, dois profissionais sendo
lidos por consulta; consultas idênticas pendentes do mesmo ator compartilham
resultado. Não há cache de resultado dos dados nativos. As queries existentes por
professor são limitadas a 2000 aulas/2000 bloqueios; acima disso o profissional
fica desconhecido. Calendário escolar limitado a 400 registros no período.
Essa escolha evita exigir índices/configuração novos de produção. Crescimento
do histórico pode exigir posteriormente índices e paginação autorizados.
Depois de 10s a coleta deixa de iniciar novos profissionais; os ainda não lidos
ficam desconhecidos. Chamadas SDK já iniciadas podem terminar depois desse prazo.
Payload acima de 1,8MB também torna a linha excedente explicitamente desconhecida.
O cliente limita sua espera a 15s, inclusive se a obtenção do token ficar pendente.

`checkedAt` preserva a coleta mais antiga necessária, `deliveryStartedAt` é próprio
de cada chamada mesmo com coleta compartilhada, `servedAt` identifica a entrega,
`expiresAt = checkedAt + 25s`. O frontend usa a diferença servidor-servidor
e relógio monotônico, deduzindo transporte/Auth além da idade no servidor.
Transferências entre abas preservam o TTL restante e usam canal privado por
UID/geração/papel/período/seleção. Não renovam a idade de um cache na entrega. Um atraso maior
que a validade não pode produzir verde. Latência/429/timeout permitem amarelo;
não há promessa de propagação Google em 20s ou de cold start no Render Free.

## Frontend coordenado

Um único controlador consulta enquanto Agenda admin/teacher está aberta e
visível. Espera 20s após resposta completa, sem sobreposição; depois de falha usa
40/80/120s. Expiração pinta desconhecido mesmo durante backoff. Fecha/oculta,
muda sessão, papel, semana, visualização ou seleção: aborta e descarta respostas
anteriores. Voltar à aba e mutações confirmadas provocam nova consulta. Web Locks
e BroadcastChannel compartilham coletas simultâneas entre abas do mesmo contexto,
sem persistir payload em storage. Falta dessas APIs mantém a proteção no servidor.

Os timers antigos de sync deixam de executar nas duas agendas. Webhook e jobs
nativos do backend permanecem. Sincronizar explicitamente continua uma ação
distinta e não é chamado por polling. O refresh de tela não chama backfill nem
atualização da CalendarList; não invalida a autorização para contornar erros.

Verde exige publicação e fontes necessárias confirmadas; vermelho representa
ocupação/bloqueio; amarelo representa consulta pendente, falha ou vencimento;
cinza é exterior à publicação confirmada. Aulas mantêm identificação própria.
Ocupações de dia inteiro e bloqueios escolares são descontados. Grade atualiza
seus conteúdos e rótulos sem substituir scroll containers, toolbar, modais ou
drawer. Nenhum array nativo de aulas é apagado pelo polling. Refresh parcial
mostra aviso, nunca toast de sucesso global.

## Preservações e QA

Locks, commit fencing, confirmação final fresca pessoal/central, idempotência,
recorrências e recuperação de resultado não são substituídos pela consulta de
tela. Login compacto e 14 GETs iniciais continuam; a nova rota só começa na Agenda.
O guard do hash de locks normaliza somente CRLF→LF antes de calcular o mesmo
digest esperado; todas as asserções de proprietário/TTL/fencing permanecem.

QA usa Node 22.23.3, Auth `127.0.0.1:9099`, Firestore `127.0.0.1:8081`, projeto
`demo-forja`, Google simulado e Chrome headless. Sem credenciais herdadas nos
servidores das fixtures. Testes não representam validação de Rules/quotas reais,
conexão institucional ou latência de produção. Cada suíte de integração deve
executar serialmente, sem outro runner escrevendo no mesmo emulador.

Testes novos: `test/agenda-snapshot.test.mjs`, quota reservada em
`test/google-central-freebusy.test.mjs`, cores Free/Busy em
`test/booking-safety.test.mjs`, HTTP em `test/integration/agenda-snapshot-http.test.mjs`.
Aceitação pareada: `scripts/agenda-intelligence.test.mjs` no frontend.
Resultados finais e SHAs são registrados na entrega e no texto de PR local.

## Mapa dos arquivos e funções

Backend:

- `src/agenda-snapshot.js`: `agendaWindow`, `createAgendaSnapshot`, composição,
  autorização dupla, concorrência, validade e limites de resposta.
- `src/server.js`: `authorizeAgendaSnapshot`, `readAgendaNative`,
  `readAgendaPersonal`, `readAgendaCentral`, rota GET e orçamento HTTP reservado.
- `src/google-central-booking.js`: `query`, `queryAgenda`, seleção privada de
  profissionais e propagação da hora de coleta; `assertFree` permanece fresco.
- `src/google-central-freebusy.js`: `query`, cache separado e quota de polling.
- `test/agenda-lock-release.test.mjs`: canonicalização restrita CRLF/LF.

Frontend:

- `scripts/agenda-intelligence-client.js`: controlador, validação, sessão,
  fontes/cores, TTL, cancelamento, backoff e coordenação entre abas.
- `scripts/agenda-intelligence-build.mjs`: aplica 25 alterações exatas sobre o
  main auditado e gera `index.html`; não editar o HTML gerado manualmente.
- `scripts/agenda-intelligence-changes.json` e `agenda-intelligence-scope.mjs`:
  reversão exata até o hash auditado, sem remover os guards anteriores.
- `scripts/agenda-intelligence.test.mjs`: aceitação nos dois perfis, viewport
  desktop/celular, cenários de erro, polling, sessão, abas e preservação da edição.
- `scripts/helpers/performance-portal-fixture.mjs`: fronteiras simuladas;
  `scripts/login-benchmark.mjs`: comparação com o login otimizado já publicado.

Os testes existentes alterados acompanham o contrato de consulta da nova tela,
datas sintéticas futuras e diferenças de paths/symlinks Windows. Não relaxam
hashes, propriedade de locks, publicação explícita ou isolamento de sessão.

## Publicação futura

Somente após revisão e autorização específica. Backend primeiro, SHA/health e
rotas autenticadas comprovados, depois artefato oficial frontend. Backend antigo
ou rota ausente produz desconhecido, jamais disponibilidade falsa. Frontend pode
ser revertido sem migração de dados. Não configurar keepalive nem mudar plano.
PR Draft não autoriza Preview; confirmar os gatilhos Render antes de qualquer
push/PR remoto. Nenhum deploy foi solicitado nesta rodada.
