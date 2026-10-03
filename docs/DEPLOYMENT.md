# FORJA — Firebase Hosting pelo GitHub

Preparação de 03/10/2026. Na etapa inicial não houve push, merge ou deploy.
Na continuação o usuário autorizou commit/push em `setup/firebase-hosting-6.30`,
PR para main e tentativa de Preview Channel. Merge, ativação e produção continuam
proibidos. A publicação de produção permanece bloqueada enquanto
`FIREBASE_HOSTING_ENABLED` estiver ausente ou diferente de `true` nas Variables.

## Configuração e artefato

- Repositório oficial: `gokuoficialbr123-gif/forja-escola`.
- Projeto e site Hosting: `forja-escola`.
- Produção: `https://forja-escola.web.app`.
- Fonte: `index.html` 6.30.0 intacto, na raiz do Git.
- Artefato: `.firebase-public/index.html`, gerado e ignorado pelo Git.
- Configuração: `firebase.json` e `.firebaserc` na raiz.

Somente o artefato isolado é enviado ao Hosting, nunca a raiz do checkout.
Headers/redirects personalizados da configuração histórica do Cloud Shell não
foram recuperados. A configuração nova explicita site, pasta e fallback para
index, reproduzindo o comportamento básico observado; comparar a configuração
histórica antes de habilitar publicação se houver personalizações.

## Workflows preparados

`validation.yml`: push, PR para main, execução manual e workflow_call. Usa
Node.js 22, verifica release ativa/hash/sintaxe, executa oito testes do pipeline
e gera o artefato. Não usa credenciais Firebase.

`firebase-hosting.yml`: usa a mesma validação como requisito. PR confiável do
próprio repo gera Preview Channel com expiração de sete dias e comentário,
independentemente da variável de produção. Push em main só publica o channel
live com `FIREBASE_HOSTING_ENABLED=true`.
PRs de forks e Dependabot continuam com validação, sem deploy com credenciais.
Não se usa pull_request_target. Actions estão fixadas por SHA; Firebase CLI por 15.32.1.

Após preview ou produção, `verify-hosting.mjs` consulta a URL realmente servida,
exige HTTP 200, marker esperado e hash idêntico ao artefato, com tentativas para
propagação. Uma versão diferente faz o workflow falhar, mesmo se o deploy retornou
sucesso. Isso não desfaz automaticamente a publicação: rollback é uma ação separada.

## Nomes de credenciais e ativação

| Nome | Tipo | Quem configura |
| --- | --- | --- |
| FIREBASE_SERVICE_ACCOUNT_FORJA_ESCOLA | Repository Actions Secret, chave JSON de conta dedicada | Usuário, configuração inicial |
| GITHUB_TOKEN | Secret automático do GitHub para comentário/check do preview | GitHub; não criar manualmente |
| FIREBASE_HOSTING_ENABLED | Repository Actions Variable, não é secret | Habilitar somente após aprovação explícita |

Não há FIREBASE_TOKEN, PAT pessoal ou credencial Render nessa integração.
O usuário confirmou a criação de `FIREBASE_SERVICE_ACCOUNT_FORJA_ESCOLA`.
A consulta de metadados pela integração ainda retorna HTTP 403. O job de preview
confere a disponibilidade do nome esperado, sem exibir o valor, antes de tentar
deploy. Não criar outro secret para contornar falta de leitura dos metadados.

## Única etapa manual: autorizar GitHub → Firebase

A execução abaixo é responsabilidade do usuário. Nenhuma conta/chave/secret foi
criada nesta tarefa. Preferimos configuração manual da conta dedicada para não
sobrescrever workflows e para não conceder permissões de Functions/Cloud Run
desnecessárias a um site estático. Não executar firebase init hosting:github
por cima destes arquivos.

1. Abrir [Service Accounts do projeto forja-escola](https://console.cloud.google.com/iam-admin/serviceaccounts?project=forja-escola).
   Confirmar **forja-escola** no seletor. Clicar **Create service account**.
   Nome/ID sugerido: **github-forja-hosting**. Reutilizar uma conta dedicada
   equivalente se já existir; não usar a conta Admin do backend.
2. Em **Grant this service account access to project**, adicionar:
   - **Firebase Hosting Admin** — `roles/firebasehosting.admin`;
   - **Firebase Authentication Admin** — `roles/firebaseauth.admin`, para
     registrar os domínios dos Preview Channels no Auth;
   - **API Keys Viewer** — `roles/serviceusage.apiKeysViewer`;
   - **Service Usage Consumer** — `roles/serviceusage.serviceUsageConsumer`.
   Não conceder Owner/Editor, Functions Developer ou Cloud Run Viewer para esta
   configuração estática. Finalizar a criação, sem conceder acesso a terceiros.
3. Abrir essa conta → **Keys** → **Add key** → **Create new key** → **JSON**.
   O navegador baixa o arquivo. Não enviá-lo ao chat, checkout ou Git.
4. Abrir [Actions Secrets do frontend](https://github.com/gokuoficialbr123-gif/forja-escola/settings/secrets/actions)
   → **New repository secret**. Nome:
   **FIREBASE_SERVICE_ACCOUNT_FORJA_ESCOLA**. Colar o conteúdo do JSON
   exclusivamente no campo seguro Secret e salvar. Tratar a cópia baixada como
   credencial e guardá-la em local seguro, fora do projeto.

Esses passos constituem uma única configuração inicial de autorização; não se
repetem a cada entrega. Se a organização proibir chaves JSON, interromper essa
configuração e planejar Workload Identity Federation, sem contornar a política.

Referências oficiais:
[integração Hosting GitHub](https://firebase.google.com/docs/hosting/github-integration),
[conta de serviço da action](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md)
e código de configuração da Firebase CLI. Os nomes de roles adicionais foram
conferidos no código da CLI; nenhum valor de credencial foi copiado.

## Ativação futura, somente depois da aprovação

1. Revisar estes arquivos e autorizar o commit/push inicial do frontend. Eles
   ainda estão locais em uma branch sem commits; main do GitHub continua vazio.
2. Versionar a base em main com publicação ainda desativada. Isso permite criar
   PRs depois; um repo vazio não oferece comparação de PR contra main.
3. Completar a autorização manual acima. Revisar a configuração Hosting histórica.
4. Quando o usuário autorizar ativação, definir `FIREBASE_HOSTING_ENABLED=true`
   em [Actions Variables](https://github.com/gokuoficialbr123-gif/forja-escola/settings/variables/actions).
   A configuração da variável não dispara deploy por si só; o próximo evento elegível dispara.
5. Recomenda-se proteger main com revisão e check de validação obrigatório.
   PR confiável: validação → preview verificado. Merge/push autorizado em main:
   validação → live → verificação pública.

Um commit/push em branch de preparação não publica produção. Sem ativação,
o job production é skipped; validação e preview de PR continuam. Sem secret
válido, autenticação/deploy do preview falham; não desabilitar checks para contornar.

Para abrir o primeiro PR contra main no repo sem refs, foi criada uma base com
somente README de revisão, sem HTML ou workflows. O Git nativo recebeu HTTP 401;
a rota HTTPS da API do GitHub aceitou a criação da base com a autenticação existente.
A estrutura inteira permanece na branch de preparação. Essa base não publica
nem antecipa o merge da aplicação.

Caso o frontend passe a depender de uma versão nova do backend, incluir um
requisito de health dessa versão antes do deploy. A 6.30 já foi confirmada no
backend; esta etapa não altera Render nem a lógica da aplicação.

## Validação local e leitura pública

Com Node.js 22, sem dependências npm do frontend:

```sh
node scripts/validate.mjs
node --test scripts/pipeline.test.mjs
node scripts/prepare-hosting.mjs
FORJA_VERIFY_URL=https://forja-escola.web.app node scripts/verify-hosting.mjs
```

Na máquina da nuvem, que usa proxy de saída, prefixar a última chamada com
`NODE_USE_ENV_PROXY=1`. Essa opção de Node 22 foi testada: a consulta pública
passou com o mesmo marker e hash da base. Sem usar o proxy, a resolução DNS
direta falhou; não se desabilitou verificação TLS para corrigir isso.

O último comando somente consulta a produção, sem publicar. Para servir localmente,
após preparar o artefato: `python3 -m http.server 8082 --directory .firebase-public`.
Não usar esse servidor ou Preview Channel para criar dados falsos em produção.

## Rollback após publicação futura

Guardar commit/hash/release anteriores. Se a validação pública falhar, considerar
a entrega falha e investigar antes de publicar outra versão. Rollback autorizado
pode usar **Firebase Console → Hosting → histórico de releases → rollback**,
ou reverter o commit e publicar pelo pipeline. Nenhuma dessas ações foi executada.
