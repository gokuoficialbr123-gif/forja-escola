# Consentimento pessoal versionado — preparação, sem produção

Base: main 3c816cf. Não alterar scopes, cliente, segredo, criptografia ou integrações
centrais. PR de consentimento coordenado com frontend; separado de desconexão e
frontend #8 (Privacidade/Termos). Testes somente mocks e projeto demo-forja.

## Contrato

Versão `personal-busy-secretaria-v1`, texto canônico e SHA-256 em
src/google-personal-consent.js. O frontend apresenta o texto devolvido pelo servidor
em modal existente, checkbox inicialmente desmarcado. Recusa/fechar não envia POST.
POST /google/calendar/connect exige {consent:{accepted:true,version}}.
O UID vem exclusivamente do Firebase Auth/perfil ativo teacher ou psychologist.

State de uso único contém personalConsent (version/textHash/acceptedById/acceptedAt)
e binding HMAC do UID/cliente/callback/versão. Assinatura, transação atômica, PKCE e
OIDC continuam obrigatórios. Callback vincula o aceite à identidade OIDC verificada
(sub/issuer/audience/email via hash privado), nonce de autorização e confirmedAt;
instala recibo e refresh token AES-GCM na mesma transação do documento pessoal.
OIDC inválido, conta diferente, recusa e falta de refresh token não substituem a
conexão anterior. Estados antigos em trânsito devem ser reiniciados, sem migração.

Documento existente google_calendar_connections/{uid}: authorizationId e
personalConsent adicionados SOMENTE após aceite explícito. Nada é promovido em jobs.
Conexão/status públicos expõem apenas accepted/version/requiresReconnect.
Status pessoal também fornece o texto e um challenge HMAC opaco, sem identidade,
token ou recibo completo. POST /google/calendar/consent valida o challenge dentro
da transação e regulariza somente a conexão OIDC atual do próprio profissional.
Troca de UID, identidade ou autorização invalida o challenge/recibo anterior.

## Regularização e indisponibilidade

Nenhuma migração, revogação ou exclusão automática. Conexões antigas continuam
sincronizando para o titular; sua publicação semanal, aulas e conflitos permanecem.
Sem recibo atual, consultas administrativas de ocupado e disponibilidade derivada
ficam unavailable (não livre): /google/calendar/busy, /professores/disponibilidade,
/profissionais/disponibilidade e /admin/disponibilidades-semana. Consulta de booking
específica retorna 503; consulta ampla identifica o profissional pendente, sem slots
nem períodos verdes. Sem conexão nem cache Google, agenda FORJA continua normal.
Cache órfão e falha de sync/Firestore não concedem disponibilidade. Nenhum ocupado
é apagado para contornar a permissão. Validação de conflitos dentro dos locks continua.

Após publicação futura, avisar individualmente os profissionais. OIDC existente:
'Revisar e autorizar' registra explicitamente sem trocar token. Sem OIDC: aceite +
OAuth novo, mantendo a conexão anterior se a autorização falhar. Recusa mantém a
consulta da Secretaria indisponível apenas para esse profissional. Um período sem
bloco visual não comprova horário livre. A Secretaria recebe aviso no portal.

## Ordem futura e limites

Backend primeiro; validar policy no health, estado legado e proteção das consultas.
Frontend imediatamente depois, permitindo regularização. Entre implantações, novas
conexões pelo frontend antigo são recusadas, e acesso administrativo de profissionais
pendentes é suspenso; sincronização pessoal e histórico não são apagados.
Não desativar enforcement para resolver compatibilidade. Coordenar a janela e
comunicar pendências à escola. Reverter UI se necessário sem excluir recibos/dados;
reverter backend removeria a proteção e exige decisão explícita de segurança.

Preview Render preserva o bloqueio pessoal: não conectar/sync/desconectar contas
reais em Firebase compartilhado. HTTP completo validado em emuladores, UI em Chromium
com mocks de fronteira. Preview não prova OAuth real. Sem novos secrets/scopes.
Google Limited Use continua pendente de verificações institucionais de IA, terceiros,
acesso humano, exclusão/backups. Não há TTL novo, retenção ou conformidade inventados.

Firebase Preview para revisão: artefato aponta ao Render Preview do PR backend,
nunca à API oficial. O gate existente exige isolamento de namespace e somente
leitura. Por compartilhar Firebase, rotas pessoais permanecem bloqueadas. O card
oferece revisão do texto/checkbox SEM salvar/OAuth; nenhuma autorização é gravada.
Testes completos usam mocks/emuladores. Produção apresenta texto/status do backend.
