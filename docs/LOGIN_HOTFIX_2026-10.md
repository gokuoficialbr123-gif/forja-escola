# Login: recuperação de falha do perfil — 19/10/2026

Preparado para revisão; sem merge ou deploy. Bases verificadas:
frontend `ac0bb3b499d07837e2105d0dea96aab3adb82255` e backend
`47de323460fb8f037a29b7257be9e4f5fd94b09b`.

## Causa reproduzida

No login manual, `manualLoginInProgress` faz o observador Auth ignorar o
callback de `signOut()`. Depois de uma falha de `/me`, o catch aguardava esse
logout e mostrava a mensagem, mas `auth.currentUser` já era nulo. Assim,
`forjaSessionCurrent(session)` era falso e o finally não encerrava o overlay
nem `state.loading`. Não é necessário mudar a geração para reproduzir: o UID
atual nulo já invalida a condição. No login automático, o callback nulo pode
chamar `forjaEndSession()` e esconder o overlay; não são caminhos equivalentes.

Chromium, portal integral da main: `Failed to fetch`, HTTP 503 e JSON inválido
deixaram a mensagem atrás do overlay; fetch sem resposta ficou sem prazo limite.
O teste positivo mantém essa reprodução executável usando a reversão exata da
main. Isso comprova a falha de recuperação da interface, sem identificar o
motivo de uma falha de rede específica de usuários reais.

## Correção e limites

- `/me`, incluindo obtenção do token e leitura da resposta, recebe limite de
  20 segundos por tentativa, no máximo duas tentativas e intervalo de 1 segundo
  para erros transitórios. Limite de espera desta validação: 41 segundos, sem
  polling. 401, 403, 429 e perfil inválido não geram repetição automática.
- O limite se aplica somente à validação de perfil; não muda os prazos de
  reservas, Google, recorrências ou operações mutáveis. Não altera Render Free.
- Uma falha de perfil não executa logout Auth. O portal fica fechado, perfil e
  dados da sessão são descartados e requisições antigas são abortadas. O erro
  usa mensagens locais, sem devolver payload bruto da API.
- `Tentar novamente` valida `/me` usando a mesma autenticação, sem armazenar a
  senha. O usuário também pode entrar com outra conta. 401/403 pedem novo login
  ou contato com a Secretaria; 429 pede espera, sem botão de repetição imediata.
- Cada ativação tem proprietário próprio, além do UID/geração existentes.
  Respostas antigas, inclusive do mesmo UID, não alteram o perfil ou loading de
  outra tentativa. Timeout também encerra esperas que não respeitam abort.
- O portal só é exibido após perfil ativo, função conhecida e coerência da
  identidade retornada. A autorização do servidor continua sendo a autoridade.

O cold start real do Render não foi provocado ou medido nesta missão. Se exceder
o limite, há erro recuperável e nova tentativa explícita, sem liberar o portal.
Não houve login real, OAuth, alteração de contas nem leitura de dados escolares.

## Verificação e integridade

`login-profile.test.mjs`: reprodução da main; rede/500/502/503, JSON e perfil
inválidos, conta inativa, papel desconhecido, identidade divergente, 401/403/429,
token/fetch sem resposta, recuperação, logout, troca de usuário, nova sessão do
mesmo UID, resposta/erro atrasados e duplo Enter. Chromium desktop e celular;
relógio controlado para percorrer integralmente as duas janelas de timeout.

`login-profile-emulator.mjs`: SDK de transporte controlado, mas autenticação,
HTTP `/me`, permissões e Firestore reais dos emuladores `demo-forja`. Nenhum
serviço Google ou dado de produção participa. Exige hosts locais e projeto demo.

Comandos (Node 22, Playwright 1.56.1/Chromium e ferramentas já preparadas):

```sh
# Frontend
node scripts/validate.mjs
node --test --test-concurrency=1 scripts/*.test.mjs
node scripts/prepare-hosting.mjs
# Backend, sem mudanças de código
npm test
firebase emulators:exec --only auth,firestore --project demo-forja \
  --config test/emulators/firebase.json \
  'node --test /workspace/forja-escola/scripts/login-profile-emulator.mjs && npm run test:integration'
```

O runner integrado exige `FORJA_FRONTEND_DIR`, `FORJA_PLAYWRIGHT_MODULE`,
`FIREBASE_PROJECT_ID=demo-forja` e os hosts locais de Auth/Firestore. O diretório
do backend pode ser informado por `FORJA_BACKEND_DIR`.

A guarda `login-profile-scope.mjs` desfaz somente as alterações revisadas e
exige o SHA-256 publicado `d95d470c…341`, antes das guardas anteriores. A allowlist
do Hosting, imagens, páginas legais, configurações Firebase e API oficial são
preservadas. Testes e scripts de diagnóstico ficam fora do artefato publicado.

PR em rascunho para executar CI sem disparar Firebase Preview. Nenhum deploy
está autorizado. Após aprovação futura, validar o erro/recuperação também com
uma pessoa autorizada; os testes locais não comprovam uma conta real.
