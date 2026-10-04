# FORJA — frontend

### Validação read-only concluída; auditoria temporária removida

Run37165057555 passou em03/10/2026: leitura real localizou Carlos/Matemática/João
sem ambiguidade. Semana2026-09-28 mantém sábado19:58–23:58, source profissional,
publicationPresent=false, publicationValid=false. Reprodução interna do GET com
confirmed-week-v2 retornou status200, publishedPeriods=[] e slots=[] para
03/10/2026,60min. Sem PATCH, publicação da semana, criação de aula, migração,
Auth ou Google sync na validação. Distinguir replay com dados reais de chamada
HTTP autenticada ao Render; esta depende de Preview atualizado e sessão legítima.

Job read-only-firestore-audit, script de identidade, script de auditoria e chave
pública removidos do conjunto final do PR. Hosting Preview liberado novamente;
produção continua restrita a main, que não foi alterada. Backend final também
impede que sync de saída exporte rascunhos/legado como disponibilidade Google;
74+32 testes passaram localmente. Sem alteração manual do documento real.


## 03/10/2026 — 6.31.1-secretaria-drawer-fluido / publicação confirmada

Backend PR #2 c4397768afad8e273fb5a24501a57852e4478e41 exige
confirmed-week-v2. O drawer recusa published-week-v1; não filtra faixas de horário
no cliente. A fonte real de Carlos contém sábado19:58–23:58 com source profissional,
que sozinho deixa de autorizar marcação. Não alterado manualmente nenhum dado.

Backend confirma SHA-256 do JSON canônico {version:1,timeZone:"America/Sao_Paulo",
professionalId,weekStart,semana}, com receipt publication={version,fingerprint,
confirmedById,confirmedAt,action,copiedFrom}. Salvar sem confirmation é rascunho;
hash divergente é recusado; alteração Google invalida recibo; cópia de origem sem
recibo não pode publicar diretamente. GET e POST /aulas usam a mesma prova.

Os cinco chamadores existentes de PATCH /disponibilidade-semanal agora exibem
confirmação explícita com TODOS os períodos e respectivas datas da semana,
inclusive herdados. O hash enviado corresponde exatamente a essa configuração.
Cancelar não faz PATCH nem muda cache. Copiar orienta revisar/publicar e envia
somente rascunho. Alteração de UI limitada a essa confirmação de publicação;
sem reformulação da agenda de professor/aluno ou Google central.

Marker 6.31.1-secretaria-drawer-fluido e SHA-256 atualizado conscientemente no
validate.mjs. Fonte oficial mantém https://forja-api-m1kq.onrender.com; só artefato
Preview substitui URL pela descrição do PR. Firebase config/Auth/Rules intactos.
Validação exige health 6.31.1-secretaria-publicacao-confirmada no Render Preview.

20 testes pipeline,20 testes do drawer e5 testes da confirmação em Chromium
passaram localmente, além de74+32 backend. Atualização dos Previews/resultados
reais deve ser conferida pelo commit publicado. Sem merge/main/produção.
Instrumentação temporária read-only será removida após leitura de validação;
nenhum script de auditoria deve permanecer no conjunto final antes do merge.


## Revisão do PR #2 — horários publicados e CSS real (03/10/2026)

O CSS 6.31 estava indevidamente dentro da string de exportReport. A coleta por
regex dos testes incluía esse style de JavaScript, mascarando a ausência no portal.
A verificação visual anterior era um falso positivo. Agora o bloco inteiro está
no style real forja-v630-style, com escopo #v630BookingRoot, e foi removido do
relatório. Seu CSS de impressão original é validado separadamente sem alteração.

Os testes parseiam o HTML com DOMParser do Chromium e clonam somente styles
reais. Há um controle negativo: mover novamente o bloco para exportReport deve
produzir largura470/4 colunas, não a largura440/6 colunas correta. Testes reais
verificam desktop/mobile, padding, grid de seis passos, scroll, limite180px da
grade, overflow e cores/aria-pressed do slot selecionado. 20 testes passaram,
além de 17 proteções do pipeline. Fixtures são isoladas; não substituem login real.

Auditoria dos slots: v630LoadSlots usa /profissionais/disponibilidade. Não há
fallback visual gerando horários. No backend, professionalAvailabilityWeek podia
migrar disponibilidade recorrente do perfil para a semana atual durante o GET.
Sem publicação semanal, um legado de sábado20–22 reproduziu exatamente os três
slots relatados. O documento real do Carlos ainda não foi consultado de forma
autenticada; não afirmar que sua origem é essa sem resposta/semana sanitizada.

Correção da fonte em PR separado: gokuoficialbr123-gif/forja-backend #2,
fix/secretaria-slots-publicados-6.31.0, versão6.31.0-secretaria-disponibilidade-publicada.
Fonte explícita: disponibilidades_semanais, professionalId|segunda-feira em
base64url, semana[dia]. Exige origem de publicação válida e metadados corretos,
sem migrar legado ao consultar marcação. Slots derivam somente das janelas,
com duração completa e remoção por conflitos/bloqueios/locks. POST /aulas revalida
publicação dentro dos locks. Auth, professor/aluno, Calendar/sync e demais rotas
mantêm regras anteriores. Legados não são apagados; publicação pelo fluxo
existente é necessária para autorizar novas aulas.

O frontend exige availabilityPolicy=published-week-v1 e mostra erro explícito
se conectado a backend antigo; não inventa nem esconde slots com filtro de faixa
local. Preview deve usar Render Preview do PR backend, via comentário
FORJA_PREVIEW_API_URL da descrição do PR, alterando só o artefato gerado.
index.html continua com a API oficial; configuração Firebase não foi alterada.
O usuário forneceu Render Preview https://forja-api-pr-2.onrender.com.
A descrição do PR #2 aponta para ele via FORJA_PREVIEW_API_URL; o workflow
verifica health 6.31.0-secretaria-disponibilidade-publicada, CORS/Auth e HTML.
O acesso direto deste ambiente recebeu CONNECT403; a verificação pública ocorre
no runner GitHub. Nenhum merge ou produção autorizado; não tocar main.

Após a atualização do Preview: exigir sucesso da verificação de
hash/marker e CORS/Auth pelo workflow; testar manualmente Carlos, João, Matemática,
03/10/2026, 60min. Sem disponibilidade explicitamente publicada naquele dia,
nenhum slot deve aparecer. Dados de Preview continuam reais, sem criar aulas
nem ampliar permissões para teste automático.


## 03/10/2026 — 6.31.0-secretaria-drawer-fluido (em revisão)

- Secretaria → Marcar aula mantém drawer/campos montados e atualiza subseções.
- Fluxo Professor → Matéria → Aluno → Data/Duração → Horários → Confirmar.
- Preserva scroll, foco e valores compatíveis; loading só nos horários.
- Invalida respostas antigas e bloqueia fundo/body/calendário; auto sync continua.
- Filtra alunos pelas mesmas regras existentes de atividade, catálogo/série e
  pacote do backend, sem fallback por catálogo; pacotes relidos ao abrir.
- Confirmação e contrato /aulas preservados; locks e Calendar ficam no backend
  6.30.1 intacto. Nenhuma alteração em aluno/professor/Google central.
- 14 regressões em Chromium, 17 testes de pipeline e 57 regressões existentes
  do backend passaram; sintaxe/hash/artefato e actionlint passaram.
- Preview somente frontend seleciona explicitamente API oficial intacta; o
  Render Preview anterior responde 404 e não é necessário novo backend.
- Release/hash preparados para revisão. Sem merge ou publicação live.


## 03/10/2026 — deploy automático de produção habilitado

FIREBASE_HOSTING_ENABLED=true foi habilitado pelo usuário no repositório
forja-escola. Este commit somente de documentação em main dispara o workflow
Firebase Hosting FORJA para a primeira publicação automática autorizada.

A produção usa a geração sem --preview: index.html 6.30.0 permanece intacto,
com marker 6.30.0-bloco-a-secretaria-marcar-aula e API oficial
https://forja-api-m1kq.onrender.com. O /health oficial confirmou
6.30.1-cors-preview-forja-escola antes do acionamento. Nenhuma configuração
Firebase, URL da API ou lógica do portal foi alterada por este registro.
O resultado da publicação será confirmado pelo job production e leitura pública.

## 03/10/2026 — artefato Firebase Preview com backend temporário

- Fonte index.html preservada, inclusive URL de API oficial e hash 6.30.
- prepare-hosting.mjs ganha modo --preview; só o artefato gerado substitui a
  única declaração FORJA_API_URL pelo parâmetro temporário do PR.
- preview-config.mjs lê esse parâmetro da descrição do PR, restringe HTTPS e
  o padrão forja-api-pr-N.onrender.com; URL atual não é hardcoded no Git.
- Produção ignora o parâmetro e mantém os bytes/hash fixos originais.
- verify-hosting.mjs deriva o hash de Preview da transformação única validada;
  verify-preview-backend.mjs verifica health, versão, CORS, preflight e Auth.
- 16 testes passaram, zero falhas/skips; actionlint, sintaxe e diff check passaram.
  Testes incluem Preview/produção separados, fonte intacta, parâmetro obrigatório,
  URLs falsas, alteração adicional e rejeição de Preview pela validação produção.
- Verificador de Vary exige presença de Origin e permite o Accept-Encoding
  acrescentado pelo proxy Render; teste de regressão cobre tokens falsos/ausentes.
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
