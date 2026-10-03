# FORJA — frontend

## 03/10/2026 — artefato Firebase Preview com backend temporário

- Fonte index.html preservada, inclusive URL de API oficial e hash 6.30.
- prepare-hosting.mjs ganha modo --preview; só o artefato gerado substitui a
  única declaração FORJA_API_URL pelo parâmetro temporário do PR.
- preview-config.mjs lê esse parâmetro da descrição do PR, restringe HTTPS e
  o padrão forja-api-pr-N.onrender.com; URL atual não é hardcoded no Git.
- Produção ignora o parâmetro e mantém os bytes/hash fixos originais.
- verify-hosting.mjs deriva o hash de Preview da transformação única validada;
  verify-preview-backend.mjs verifica health, versão, CORS, preflight e Auth.
- 15 testes passaram, zero falhas/skips; actionlint, sintaxe e diff check passaram.
  Testes incluem Preview/produção separados, fonte intacta, parâmetro obrigatório,
  URLs falsas, alteração adicional e rejeição de Preview pela validação produção.
- Sem alterações de Auth, Firestore, Google Calendar, regras ou versão do portal.
  Sem merge, ativação ou produção. Publicação Preview e resultados no PR #1.
- O secret inicial foi corrigido pelo usuário; tentativa 3 de Hosting run
  37138923430 criou o primeiro Preview com sucesso. Registro anterior é histórico.

## 03/10/2026 — envio para revisão e tentativa de preview

O usuário autorizou commit/push da estrutura em `setup/firebase-hosting-6.30`,
PR para main e tentativa de Preview Channel com o secret já criado por ele.
Como o repo estava vazio, foi criada uma base main contendo somente README de
revisão, sem HTML ou workflows. Sua criação não executou deploy nem merge.

- Preview separado da variável de produção; mantém validação obrigatória e
  restrição a PRs confiáveis do próprio repositório.
- Job verifica somente a disponibilidade de FIREBASE_SERVICE_ACCOUNT_FORJA_ESCOLA.
- Não ativar FIREBASE_HOSTING_ENABLED, fazer merge ou publicar produção.
- Nenhuma alteração no HTML ou na lógica da aplicação.
- [PR #1](https://github.com/gokuoficialbr123-gif/forja-escola/pull/1) aberto;
  commit inicial `f50acde16b9111067a4e113235bb33934fb71066` publicado.
- Validação de push e PR passaram, incluindo os oito testes do pipeline.
- Hosting validou o artefato; preview falhou na checagem de presença do secret,
  antes da publicação. Produção skipped. Sem Preview Channel ou URL.
- Metadados de secrets: HTTP 403 pela integração. Secret recebido vazio no job;
  conferir a entrada em Repository secrets do frontend. IAM Firebase não testado.
- Registro detalhado dos runs e diagnóstico em DEPLOYMENT.md.

## 03/10/2026 — preparação de versionamento e Hosting, sem nova release

Referência preservada: **6.30.0-bloco-a-secretaria-marcar-aula**.
O usuário aprovou a auditoria e definiu este repositório como frontend oficial.

### Preparado localmente

- `index.html`: cópia byte a byte da 6.30 confirmada em produção.
- `firebase.json` / `.firebaserc`: projeto/site forja-escola e pasta isolada.
- `.gitignore`: artefatos, configurações locais e nomes de arquivos de credencial.
- `AGENTS.md` e três documentos de contexto, publicação e histórico.
- Workflow de validação e workflow Hosting, com deploy desativado por variável.
- Scripts sem dependências npm para release/hash/sintaxe, preparação e verificação pública.
- Oito testes que detectam marker/hash incorretos, configuração insegura,
  JavaScript inválido, arquivos indevidos no artefato e publicação divergente.

### Evidências

- HTML: 1.661.612 bytes; SHA-256
  `447bef249c8e4ea839b133739311fcf68d271c0c6d8b4c482a650fcf35a22868`.
- Marker ativo e dois scripts inline validados em Node.js 22.
- Oito testes passaram, sem testes skipped ou failed.
- Artefato repetível contém somente index.html; cópia sem transformação.
- Workflows passaram em actionlint 1.7.7, obtido com checksum oficial verificado.
- Verificação pública pelo script passou contra o Firebase atual, usando
  `NODE_USE_ENV_PROXY=1` no ambiente da nuvem; nenhum deploy foi executado.
- No backend, somente os quatro documentos foram commitados na branch
  `docs/forja-context-6-30`, commit `b75b7672bccfa901deeaed701d616bbd9098b9df`.
  Os oito arquivos funcionais ficaram intactos.

### Não executado / pendências na preparação inicial

Este registro descreve a etapa anterior à autorização de envio; o resultado da
continuação consta no início deste documento.

Nenhum commit do frontend, push, merge, deploy, criação de Preview Channel,
conta de serviço, chave, secret ou ativação da variável. Não alterada lógica do
FORJA, Firestore, Auth, Google, Render ou automação D-2.

Pendentes: autorização manual GitHub → Firebase pelo usuário, revisão da
configuração Hosting histórica e autorização para versionar/enviar o frontend
e ativar a publicação. CI real e autenticação de deploy ainda não foram testadas.
O sucesso dos testes locais não garante que a credencial de deploy funcione.

## 6.30.0 — base existente

Secretaria: disponibilidade multi-professor 6.29 preservada; drawer Professor →
Matéria → Aluno → Horário → Confirmar. Backend considera conflito do aluno e
valida a criação com locks. Google individual e agenda do professor preservados.

Bug prioritário ainda pendente: drawer volta ao topo por renderização integral.
Filtro de aluno pode divergir do pacote ativo exigido no backend. Nenhuma
correção funcional foi feita na preparação do GitHub/Firebase.

## História anterior, conforme backups

6.29: Secretaria multi-professor. 6.28: scroll do professor corrigido.
6.27: atualização silenciosa e fallback de cinco minutos. 6.26/6.25: refinamento
da agenda e ações diretas. 6.24: layout V2. 6.23.1: hotfix de montagem.
6.23/6.22/6.21: agenda e sincronização consolidadas. 6.20: integração bidirecional.

Entregas futuras devem registrar versão, arquivos, testes realmente executados,
commit, autorização, deploy real, validação pública, rollback e pendências.
