# Desconexão pessoal confiável — somente PR/Preview

Correção separada de consentimento e do frontend #8. Sem produção, usuários reais,
eventos reais, alteração de scopes/cliente/Google Cloud ou integração central.

## Resultado verdadeiro

DELETE /google/calendar/connection continua exclusivo do próprio teacher/psychologist
ativo autenticado. Ignora qualquer UID de body/query. Resultado whitelist:
ok, outcome (completed/partial/failed), retryable, code, local (busy/connection),
google (webhook/revocation). HTTP200 somente conclusão; 502 parcial; 503 falha de
início. Auth mantém os códigos existentes. Cliente antigo não recebe falso HTTP200
numa falha/pendência; cliente novo diferencia o resultado e explica a recuperação.

Antes da limpeza, transação marca somente google_calendar_connections/{uid} com
connected=false/status=desconexao_pendente/googleDisconnect (ID e lease90s).
Isso suspende novos sync/uso da credencial. Falha nessa transação retorna failed;
não afirma suspensão se a gravação não foi confirmada. Falha na limpeza/exclusão
mantém a credencial AES-GCM em quarentena para repetição explícita, sem sync ativo.
Não remover aulas, sessões, histórico, outros profissionais ou conexão central.

Fences de OAuth: reutilizar _google_oauth_states com documento privado
`personal-epoch-{sha256(uid)}` (uid/connectionEpoch/disconnectedAt/epochOnly), sem
token ou intervalo. A marca não expira como um state de10min. Start de disconnect
atualiza a geração na mesma transação que suspende a conexão. Connect grava state
com a geração atual em transação; callback valida a geração na transação de
instalação. Um callback iniciado antes da desconexão não recria a credencial após
o DELETE. Sem geração anterior, legacy-v1 conserva compatibilidade até uma
desconexão explícita; nenhuma conexão é promovida automaticamente. Não criar
coleção nova nem resolver geração a partir de body/query. Preservar as marcas
em rollback, sem restaurar credenciais a partir de backups automaticamente.
Se outra conexão substituir a operação, retornar failed/connection=changed e
recarregar status, sem afirmar que a nova conexão está suspensa.


Cache próprio apagado em transações <=400 docs, condicionadas ao ID da operação.
Delete da conexão também exige o ID atual. Coalescência por UID na instância, lease
no Firestore entre instâncias; lease vencido permite retry, finisher antigo não
apaga uma nova conexão. Sync/cache/metadados recebem fence transacional e geração
para não recriar conexão/cache já removidos. OAuth/connect/callback recusam conexão
em limpeza. UI mostra 'Tentar concluir desconexão' se a limpeza está pendente.
Sem migração/job de limpeza automática novo. Nunca exibir token ou erro Google bruto.

## Revogação e integrações compartilhadas

Documentação oficial OAuth web-server, seção Revoking a token:
https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke
"Revocation removes all OAuth 2.0 scopes previously granted to a project,
invalidating any issued access or refresh tokens for all clients registered
under that project."

Não é possível prometer revogação isolada do token pessoal e preservação de
Secretaria/Make/n8n para a mesma conta no mesmo projeto. Por isso a rota NÃO chama
revogação global automaticamente: google.revocation=deferred_shared_project,
outcome=partial, HTTP502 após limpeza local bem-sucedida. A interface explica que
FORJA deixou de usar a conexão pessoal, mas o grant no Google não foi revogado.
Confirmar com a escola o impacto antes de revogar permissões; não automatizar essa
operação, não modificar clientes ou criar projeto novo. Nenhum parâmetro público
habilita revogação global. A conexão central/grants dos demais clientes ficam intactos.

Helper existente de revogação continua testado com mocks para falha, timeout,
form-body sem token na URL e invalid_token (já inválido). Uma eventual habilitação
segura futura exige autorização/decisão institucional adicional, sem flag secreta
improvisada. Encerramento apenas do webhook pessoal identificado permanece, com
timeout15s por token/request; falha é explicitamente parcial e não impede limpeza
local. Operações Google já enviadas antes da suspensão podem terminar no provedor;
fences impedem reconstruir credencial/cache local. Nenhum teste usa Google real.

## Compatibilidade e ordem futura

PRs independentes a partir de main. Publicar par de consentimento primeiro:
backend PR9 → validar → frontend PR9 → regularização individual. Depois atualizar
(rebase/revisão/testes) o par de desconexão contra esse main, preservando ambos os
adapters/policies; há pontos comuns no server, HTML/hash e teste OAuth que requerem
reconciliação explícita. Preservar consentimento/oauthBinding ao combinar a
criação transacional de state com a geração de desconexão. Sem merge/rebase sobre produção nesta entrega.
Backend desconexão → validar → frontend desconexão. Não apagar receipts/credenciais
quarentenadas em rollback. Não restaurar o catch que ocultava falha local, nem
reativar revogação global para transformar partial em success.

Preview compartilhado continua somente leitura, sem desconexão/OAuth real.
Verificação completa HTTP/Auth/Firestore em demo-forja; Chromium usa respostas
mocks na borda. Conclusão de revisão não equivale a Google Limited Use integral.
