# Google pessoal — diagnóstico e reconexão mínimos (14/10/2026)

Status: somente branches e PRs em rascunho. Não publicado, sem OAuth real,
contas reais, alterações de Google Cloud, scopes, IAM ou dados da escola.
Bases publicadas: backend 444b35c160645356b5303cec3119a6b18ea1a1e0;
frontend 4a72cc6bda9b1556d0ba19923da8ff0e521be4a9 (PR14 já publicado).

## Problema e comportamento

O diagnóstico anterior agrupava autorização inválida, erro de configuração e
falha de rede na obtenção de token na mesma indicação de reconexão. A Agenda
não oferecia Reconectar para conexões registradas como connected=true, ainda
que estivessem com erro. Em celular o CSS também escondia o diagnóstico.

Policy nova: personal-google-diagnostics-v1, exposta no health como
`googlePersonalDiagnosticsPolicy` e no status/diagnóstico como diagnosticsPolicy.
Não altera a versão/capacidade de booking future-live-google-v1.

GET /google/calendar/diagnostics continua autenticado e somente para o próprio
teacher/psychologist ativo; não grava Firestore, não sincroniza, não cria watch,
não desconecta e não devolve eventos. Sucesso preserva o contrato anterior e
acrescenta googleDiagnosis com status verified e checkedAt. Isso não significa
que a sincronização anterior passou ou que uma janela específica está livre.

Falhas conhecidas em diagnóstico, sync e renovação manual recebem googleDiagnosis:
policy, source=professional_personal, status=unavailable, failureKind, resolution,
reconnectRequired, message estática, stage, checkedAt e providerHttpStatus opcional.
Nunca conteúdo privado, URL Google, mensagem bruta, token, ID token ou credencial.
HTTP409/GOOGLE_RECONNECT_REQUIRED somente para autorização inválida/credencial
ausente; demais falhas conhecidas: HTTP503/GOOGLE_PERSONAL_UNAVAILABLE. Auth/roles
e erros que não são do Google mantêm o tratamento existente. Respostas no-store.

| Categoria | Responsável/ação |
|---|---|
| authorization_invalid / credential_missing | Titular reconecta a mesma conta |
| server_configuration / credential_decryption / provider_request_rejected | Administração revisa backend; não recomendar desconectar |
| access_denied | Titular e administração revisam acesso |
| network / timeout / rate_limited / provider_unavailable / invalid_response | Nova tentativa posterior; administração se persistir |

invalid_grant não distingue sozinho expiração de revogação ou outras causas.
Um erro legado genérico não é promovido a invalid_grant. Não se comprovou a causa
real da credencial Carlos: metadados reais anteriormente negados código7.

Sincronizações futuras podem guardar somente a projeção operacional lastFailure
em google_calendar_connections/{UID}, junto do status/erro sanitizado existentes;
sucesso limpa lastFailure. Não há migração ou alteração automática de legados.
Status passa lastFailure por whitelist novamente. Erros não reconhecidos não
recebem classificação fabricada. O GET de diagnóstico não persiste esse campo.

## Interface e segurança

Mensagens/diagnóstico ficam acessíveis na agenda e conta do profissional; no
celular são apresentados fora da barra escondida pelo CSS antigo. Reconectar
aparece somente para categorias explicitamente recuperáveis por autorização.
A ação usa o POST /google/calendar/connect existente. Não há DELETE prévio.
A resposta e o redirecionamento pertencem ao UID/geração da sessão que iniciou
a operação; respostas atrasadas não alteram a sessão seguinte. Consultas de
diagnóstico concorrentes da mesma sessão compartilham uma única chamada.

State atômico, PKCE, OIDC, criptografia e proteção de troca de identidade permanecem.
Recusa Google/Testing, PKCE/OIDC inválido e outra identidade não sobrescrevem a
conexão anterior. A reconexão da mesma conta não exige desconectar. Uma autorização
válida seguida de falha de sincronização ainda pode ter atualizado a credencial;
não afirmar que toda falha pós-callback significa consentimento recusado.

Sem novas rotas/scopes/clientes OAuth. Integração central, Make/n8n e PRs8–12
não são incorporados. A correção de desconexão PR10 permanece separada e não
é requisito para este fluxo de reconexão. Não anunciar o DELETE antigo como corrigido.

Booking permanece fail-closed: erro Google não cria slots livres, POST e PATCH
mantêm conflitos, locks, relógio America/Sao_Paulo e idempotência do PR14.
Profissional legitimamente sem conexão continua com a regra anterior.

## Validação e publicação futura

Testes somente demo-forja/Auth/Firestore locais, provedor Google interceptado e
Chromium com identidade sintética. Cobrem classificação, privacidade, recusa,
PKCE/OIDC, mesma/outra conta, conexão legada, sync, status, falha/êxito, UID/sessão,
concorrência, desktop/mobile e regressões completas. Resultados finais nos PRs.

PR frontend deve permanecer draft: workflow Hosting valida, mas o job Preview
exige draft=false e o job production exige push main. Não solicitar Render Preview
ou usar o marcador [render preview] nesta etapa. Nenhum deploy está autorizado.

Após aprovação específica: backend primeiro; validar health/policy/Auth/CORS;
frontend depois. Frontend anterior funciona com erros estáticos novos; frontend
novo trata ausência de diagnóstico estruturado como inconclusivo sem exigir
reconexão. Rollback por código anterior sem apagar usuários/conexões/dados; o campo
aditivo lastFailure pode permanecer armazenado. Não executar rollback sem autorização.

A confirmação de agendamento real para Carlos depende de diagnóstico autorizado
na versão futura e da correção efetiva da causa identificada. OAuth403 por Testing
continua bloqueio externo: não foi corrigido nem contornado por este código.
