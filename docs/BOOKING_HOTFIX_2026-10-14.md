# Hotfix Secretaria — marcação segura (14/10/2026)

Status: preparado em branches isoladas, NÃO publicado. Bases pós-PR13:
backend `af31d453671361ad54effbeaac7ce296fdd9eccc`, frontend
`5296596ae052e40bb082e0fd5582936c91539b2f`. Não incorporar PR8–12.

## Causas verificadas no código publicado

1. A consulta do drawer não comparava o início do slot com o instante atual.
2. A consulta usava cache `google_calendar_busy`, enquanto POST /aulas consultava
   ao vivo a conexão PESSOAL do professor selecionado, em
   `google_calendar_connections/{professorId}`. A conexão central não participa
   deste fluxo publicado; este hotfix não implementa Etapa4.
3. `googleTokenRequest` agrupava rede e respostas HTTP em GOOGLE_TOKEN_FALHOU;
   a mensagem antiga não permite concluir que o refresh token foi revogado ou
   expirou. A descriptografia possui falha distinta, antes também apresentada
   como necessidade genérica de reconexão.
4. Aula, histórico e Google eram etapas separadas; falhas depois da primeira
   escrita podiam produzir erro apesar de existir uma aula. O frontend também
   tratava falha de reload como falha da marcação e afirmava sincronização sem
   conferir o resultado.

Não houve leitura de tokens Google reais nem teste com contas/aulas reais.
Tentativa read-only com projeção de metadados: Firestore PERMISSION_DENIED,
código7 (workflow frontend38465870579). Nenhum metadado pessoal foi obtido;
nenhuma mudança IAM foi feita. A causa específica da credencial real do Carlos
permanece NÃO comprovada. Não afirmar invalid_grant sem evidência do provedor.

## Contrato preparado

Policy `bookingSafetyPolicy: future-live-google-v1` em health e consulta scoped
admin+teacher+professor+matéria+aluno. Slots mantêm `confirmed-week-v2` e recebem
`startAt`; resposta tem `serverNow` UTC. Comparação estrita início>agora, conversão
America/Sao_Paulo. POST revalida antes da consulta e dentro da transação final.

A consulta scoped verifica Google pessoal ao vivo antes de oferecer slots, com
paginação completa limitada (20 páginas de250) e deadline10s. Cancelados e
transparentes não bloqueiam; demais eventos opacos mantêm as regras existentes,
sem isenção geral por rótulo FORJA. Resposta incompleta/erro/paginação excedida
nunca vira calendário livre. Nenhum título, descrição ou participante é devolvido
na disponibilidade. Sem conexão pessoal legítima continua permitido; cache de
ocupados existente é conservado nesse caso. Não exige novo consentimento.

Falhas são whitelisted: authorization_invalid (invalid_grant/401), configuração
OAuth, credencial ausente/descriptografia, acesso403, quota429, rede, timeout,
5xx, resposta inválida. invalid_grant NÃO distingue revogação de expiração por si
só. Mensagem informa professor, administração ou tentativa posterior. Erro de
fonte configurada retorna503 sem slots. Campos e scroll do drawer são mantidos.
Google OAuth continua sujeito a Testing/testadores; este código não libera contas
no Google e não ignora conflitos para contornar restrições externas.

POST aceita `bookingRequestId` UUID opcional para compatibilidade. Novo drawer
usa chave em memória vinculada ao UID e corpo imutável. Documento determinístico
`aulas/booking_{sha256(uid|uuid)}` conserva o fingerprint da solicitação; replay
confere UID/corpo e retorna aula existente, inclusive após o início, sem refazer
Google. Campo adicional `bookingFingerprint`; nenhum documento legado é migrado.
Histórico inicial/auditoria/aula são atômicos. Transação confere dono e validade
dos locks antes de criar; aquisição/liberação do PR13 permanece idêntica.

Depois do commit, falha de sync/leitura é aviso separado com bookingState=created,
nunca instrução para criar outra aula. Falha de transporte/commit ambíguo conserva
UUID para recuperar a mesma tentativa. 409 de conflito definitivo permite revisar
a seleção. Botão e campos ficam protegidos durante envio; resultado atrasado de
outra sessão não altera a sessão atual. Falha de reload mantém aula confirmada em
memória e avisa para recarregar. UUID não persiste após F5/logout: consultar Agenda
antes de começar nova marcação; conflitos continuam sendo revalidados no servidor.

## Validação e limitações

Executar npm test e npm run test:integration no backend usando SOMENTE emuladores
Auth9099/Firestore8081 demo-forja e Google simulado na borda. A fixture substitui
somente bookingClock; relógio dos locks/Auth continua real. Fault injection é
importado exclusivamente pela fixture isolada, sem flags HTTP/env de produção.
Executar scripts/*.test.mjs no frontend com Chromium desktop/mobile e o ensaio
pareado que envia POST real ao backend local autenticado pelos emuladores.

Cobertura: passado/exato início/virada SP, Google válido/inválido/rede/timeout/
401/403/429/5xx/cripto, paginação/evento dia inteiro, conflito, locks concorrentes,
lease perdida, histórico abortado atomicamente, sync/leitura pós-commit falhos,
replay sem duplicar, formulário preservado, single flight, reload falho e resposta
atrasada de outra sessão. Regressões existentes Google/central/cadastros mantidas.

Google não participa de uma transação Firestore: alterações externas posteriores
à verificação permanecem risco temporal conhecido; não prometer atomicidade entre
os dois serviços. Falhas desconhecidas bloqueiam a marcação. Paginação/deadline
excedidos também bloqueiam conservadoramente; não truncar para produzir livre.

## Publicação futura — depende de aprovação explícita

PRs DRAFT, sem merge nem deploy. O gate do workflow Firebase impede publicação
Preview em PR draft. Nenhuma API temporária aponta o portal para outro backend.
Não executar OAuth ou QA mutável em produção. Revisar ambos os SHAs e checks.

1. Backend primeiro; validar health/policy e contratos sem dados reais.
2. Frontend depois, hash/marker/API oficial. Frontend novo recusa backend antigo.
3. Pessoa autorizada da escola valida no ambiente aprovado: futuro, erro antes da
   confirmação, aula realmente gravada e visível, repetição sem duplicação.
4. Se conexão Google real estiver inválida, titular/admin resolve a causa indicada;
   Testing pode impedir reconectar e exige ação externa autorizada no Google.

Recuperação: parar e pedir autorização. Reverter frontend ao SHA5296596 antes de
reverter backend ao SHAaf31d453 se necessário. Não excluir aulas, recibos,
históricos, usuários ou conexões. Campos novos são tolerados pelo código anterior.
Não alterar Google Cloud, scopes, central, Make/n8n ou visual aprovado.

Resultados locais registrados: backend180 unitários,133 integrações HTTP/Auth/
Firestore (incluindo Chromium pareado), frontend194 testes de regressão/Chromium.
Sem falhas/cancelados/skips na execução aprovada; novos checks do PR devem
confirmar novamente os commits publicados na branch. Nenhum teste de produção.
