# FORJA — Firebase Hosting pelo GitHub

## Revisão visual — eventos da Agenda da Secretaria (somente Preview)

Ajuste de apresentação autorizado, sem mudança de disponibilidade, publicação,
backend, dados ou regras. Botões/divs agora usam o mesmo layout no topo esquerdo:
professor primeiro; tipo/matéria e horário exato na segunda linha. Padding lateral,
borda/radius uniformes, overflow hidden e tipo truncado antes do horário.
Eventos curtos recebem compactação apenas visual, sem arredondar horários.
Hover não move eventos. Dia/Semana/Mês preservam legibilidade; Dia se adapta à
largura do celular. Fundo da grade agora usa48px/hora, mesma escala já existente
no posicionamento, em vez dos60px/hora herdados que causavam desalinhamento.

v621EventStyle e v629SlotStyle permanecem byte a byte iguais, inclusive altura
mínima existente; fontes/regras v621AvailabilityForDay e v629DayData e script
completo do drawer6.31.1 intactos. Horários12:33–13:00,14:00–14:44 e19:58–21:52
não foram arredondados. API oficial e backend03aa329 permanecem inalterados.

Chromium:18 novas regressões visuais (30min,60min,2h,4h, horários quebrados,
aula entre dois verdes, margens/cores, Dia/Mês, desktop/mobile). O teste4h
reproduziu a centralização vertical antes da correção. Após correção,21testes
pipeline e53Chromium passaram (20drawer,5publicação,10Agenda,18visuais).
Capturas geradas com fixtures locais, sem contato com banco/Auth/Google reais.
SHA-256 de origem atualizado conscientemente: f14755958947c9eb4742f35083ef75493cca1d15a11202608f4472571327b5ed.
Versão permanece6.31.1. Atualizar somente PR#2/Hosting Preview; sem merge/main
ou produção até confirmação final após validação manual.


### Revisão Preview — contrato unificado da Secretaria

Manter 6.31.1. Render Preview deve retornar /health com
secretariaAvailabilityPolicy=confirmed-week-v2, além da versão esperada.
O workflow Hosting recusa backend antigo com a mesma versão antes do deploy.
Atualizar somente a branch/serviço Preview do PR #2; nunca main/produção.
Depois de CI passar, testar manualmente o domingo 04/10: legado sem recibo não
aparece verde, aula azul preservada, zero slots de 60min. Confirmação legítima
no fluxo profissional exige revisão de TODOS os períodos; o diagnóstico não
executa essa escrita. Fixtures isoladas comprovam períodos confirmados livres.


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


## Preview da correção 6.31 — sem publicação de produção

Branch fix/secretaria-drawer-6.31.0, PR para main. Não fazer merge/push em main:
FIREBASE_HOSTING_ENABLED já está true, portanto main publica o site live.
Configuração Firebase e FORJA_API_URL oficial continuam intactas.

Descrição deste PR: <!-- FORJA_PREVIEW_BACKEND=production-unchanged -->.
Workflow valida o modo explicitamente, prepara fonte integral e publica apenas
Preview Channel. Verifica marker/hash exatos, /health 6.30.1, CORS refletindo o
Origin Firebase, preflight 204 e /me sem token 401. Não realiza login/criação de
contas/aulas nem amplia permissões. Com backend modificado, continuar usando
FORJA_PREVIEW_API_URL com serviço Render Preview e --preview; os modos são
mutuamente exclusivos e falta de parâmetro não tem fallback automático.

A referência de marker/hash do validador foi atualizada conscientemente para a
release funcional 6.31 em revisão. A mesma proteção de integridade aplica-se ao
artefato e ao HTML servido; produção exige bytes oficiais e a API oficial.

Validação local/CI:

```bash
node scripts/validate.mjs
node --test scripts/pipeline.test.mjs
npm install --prefix /tmp/forja-browser-tests --cache /tmp/forja-npm-cache --no-save --package-lock=false playwright@1.56.1
/tmp/forja-browser-tests/node_modules/.bin/playwright install --with-deps chromium
FORJA_PLAYWRIGHT_MODULE=/tmp/forja-browser-tests/node_modules/playwright/index.mjs node --test scripts/secretaria-drawer.test.mjs
node scripts/prepare-hosting.mjs
```

Se Chromium do sistema já estiver instalado, pode-se usar FORJA_CHROMIUM_PATH
com seu caminho verificado. A execução local usou /usr/bin/chromium. Não adicionar
arquivos npm/dependências ao artefato Hosting. CI instala navegador isoladamente.

14 regressões em Chromium passaram: DOM/foco/scroll desktop/mobile, filtro de
alunos/pacotes falhos, seleções compatíveis, respostas antigas/fora de ordem,
loading localizado, horários livres, bloqueio/restauração do fundo, reabertura,
modalidade, foco de teclado e contrato/confirmação com conflito. 17 testes do
pipeline e 57 testes existentes do backend também passaram. Estes testes têm
fixtures locais isoladas e não comprovam login real nem sincronização Google.

Teste manual no Preview com administrador: abrir Secretaria → Marcar aula,
seguir os seis passos em desktop/celular, trocar filtros após rolar, checar
compatibilidade e fundo imóvel; fechar/reabrir e conferir restauração. Confirmar
aula somente com dados/horário de teste autorizados, pois o Preview usa serviços
reais. Conferir aula/Google, atualização automática e conflito concorrente.


Preparação de 03/10/2026. Na etapa inicial não houve push, merge ou deploy.
Na continuação o usuário autorizou commit/push em `setup/firebase-hosting-6.30`,
PR para main e tentativa de Preview Channel. Merge, ativação e produção continuam
proibidos. A publicação de produção permanece bloqueada enquanto
`FIREBASE_HOSTING_ENABLED` estiver ausente ou diferente de `true` nas Variables.

## Preview por PR: API temporária somente no artefato

A URL do Render Preview é fornecida na descrição do PR frontend em um comentário
HTML com o campo FORJA_PREVIEW_API_URL. A URL real permanece fora do Git; não há
valor temporário hardcoded no index.html, workflow ou scripts. preview-config.mjs
lê o evento GitHub, exige PR do próprio repo e exatamente um comentário válido.
Aceita somente HTTPS no formato forja-api-pr-N.onrender.com, sem path, porta,
userinfo, query, fragmento ou normalização.

O workflow exige esse parâmetro antes do deploy. Não há fallback para produção
quando o Preview está sem configuração. Eventos edited permitem atualizar o
parâmetro sem alterar o portal. Não usar pull_request_target.

Geração Preview: FORJA_PREVIEW_API_URL fornecida ao comando
node scripts/prepare-hosting.mjs --preview. Primeiro validate.mjs confere o hash
original fixo; somente então a única declaração FORJA_API_URL é substituída no
artefato .firebase-public/index.html. A fonte permanece intacta. O artefato tem
somente index.html, com sintaxe validada e hash calculado para seus bytes exatos.

Geração/validação de produção: comandos sem --preview. Uma variável de Preview
presente no ambiente não altera produção. O hash fixo original não foi trocado.
verify-hosting.mjs --preview deriva os bytes esperados a partir da fonte validada
e do parâmetro, sem confiar em um hash externo ou arquivo alterado manualmente.
verify-hosting.mjs sem --preview exige a fonte original validada.

Após publicar Preview, verify-preview-backend.mjs verifica, com Origin Firebase:
/health 200 e versão 6.30.1-cors-preview-forja-escola; ACAO igual à origem e Vary;
OPTIONS /me 204 e headers Authorization/Content-Type/X-FORJA-OTP; GET /me sem
token 401, preservando Auth. Não é teste de login completo nem escrita no banco.
A checagem deve passar antes de considerar a conexão Preview → Render validada.

A rede desta nuvem pode bloquear o host temporário com CONNECT 403. As checagens
do workflow GitHub não dependem desse proxy; registrar os resultados reais do
run, sem desabilitar assertions para contornar falhas.

O secret inicial foi corrigido pelo usuário: Hosting run 37138923430 tentativa
3 passou. As falhas iniciais registradas neste documento são históricas.

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
Node.js 22, verifica release ativa/hash/sintaxe, executa dezesseis testes do pipeline
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
A consulta de metadados pela integração retorna HTTP 403 (Resource not accessible
by integration), inclusive ao listar nomes. Isso não prova a ausência do secret.
No PR #1, porém, o job recebeu esse secret vazio e falhou na checagem de
presença, antes da action Firebase. Nenhum valor foi exibido.

O PR é do próprio repositório, aberto pelo proprietário, e não é Dependabot.
A API de Environments retornou uma lista vazia. Portanto, não há evidência de
restrição de fork ou de um Environment existente que precise ser associado ao
job. A configuração usa exatamente o nome informado pelo usuário.

Para desbloquear, conferir no frontend **Settings → Secrets and variables →
Actions → Secrets → Repository secrets** se o nome exato aparece nessa seção.
Uma entrada em Variables ou em outro repositório não atende a expressão secrets
usada pelo workflow. Se já estiver na seção correta, revisar/atualizar essa
entrada pelo campo seguro do GitHub e reexecutar o job de preview. Não enviar o
valor ao chat e não criar credenciais duplicadas para contornar o HTTP 403.
A integração precisa de leitura de metadados de Actions secrets somente para
confirmar nomes via API; o próprio job pode confirmar disponibilidade sem isso.

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

1. Revisar o [PR #1](https://github.com/gokuoficialbr123-gif/forja-escola/pull/1),
   aberto de `setup/firebase-hosting-6.30` para main. A base main contém somente
   README de revisão; toda a estrutura do frontend está na branch do PR.
2. Conferir o secret já funcional e obter Preview verificado com o backend temporário.
   Nenhum merge foi autorizado nesta etapa.
3. Revisar a configuração Hosting histórica e aprovar explicitamente a entrega.
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

## Resultados reais de CI — PR #1

Commit inicial publicado: `f50acde16b9111067a4e113235bb33934fb71066`.

- [Validação do push](https://github.com/gokuoficialbr123-gif/forja-escola/actions/runs/37138397582): passou.
- [Validação do PR](https://github.com/gokuoficialbr123-gif/forja-escola/actions/runs/37138442852): passou, incluindo oito testes e preparação do artefato.
- [Hosting do PR](https://github.com/gokuoficialbr123-gif/forja-escola/actions/runs/37138442978): validação passou; preview falhou na presença do secret; publicação e verificação do preview não executadas; produção skipped.

Preview não criado, sem URL. Ainda não é possível validar as permissões IAM da
conta Firebase: a autenticação sequer foi tentada. Merge e ativação da variável
não foram executados. Novas execuções devem ser conferidas no GitHub; esta seção
registra as execuções identificadas, sem presumir o resultado de tentativas futuras.

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
