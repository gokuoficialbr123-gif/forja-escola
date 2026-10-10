# Google OAuth Branding — páginas públicas para revisão

Preparação em 10/10/2026. **Rascunhos somente em PR/Preview; não fazer merge ou
publicar em produção nesta etapa. Não alterar OAuth, backend, dados ou DNS.**

## Estado auditado

- Frontend main: `959b72f6d5a398fa3c1f0fbc79a3ce0b2436f580`.
- Backend main: `3c816cf3080f3fddd77ea9913a3f36419ae3baf3`.
- O portal oficial é público, explica a finalidade educacional e não tinha links
  de privacidade/termos. A única página HTML versionada era `index.html`.
- GET público `/privacidade/` e `/termos/` respondia 200 com **o mesmo SHA-256 da
  página inicial** (`3d6908cd…`). Isso é fallback da SPA, não políticas existentes.
- O domínio institucional `forjaescola.com.br`, vinculado no rodapé, não pôde ser
  consultado neste ambiente. Não se afirma que inexistam documentos nesse domínio.
- O estado Testing/Branding incompleto é informação do proprietário. Não houve
  acesso ao Console Google, credenciais ou OAuth real durante esta tarefa.

## O que o código realmente faz

| Fluxo | Escopos atuais | Uso observado |
| --- | --- | --- |
| Professores e psicólogos | `openid`, `email`, `calendar.events.owned` | OIDC identifica a conta; backend lê eventos, calcula ocupado e sincroniza eventos FORJA em calendário próprio, normalmente primary. |
| Central, CalendarList | `openid`, `email`, `calendar.calendarlist.readonly` | Lista identificadores, nomes de calendários e acesso; admin associa explicitamente a professores ativos. |
| Central, consulta de ocupado autorizada | anteriores + `calendar.events.freebusy` | `freeBusy.query`: somente intervalos/status; não usa `events.list`, não escreve eventos/intervalos no Firestore. |

Todos os nomes Calendar acima têm prefixo
`https://www.googleapis.com/auth/`. Nenhum scope foi alterado por este PR.

Evidências backend (main, leitura de código):

- `src/server.js`: `GOOGLE_OAUTH_SCOPES`, `upsertGoogleBusy`,
  `createOrUpdateGoogleEvent`, `createOrUpdateGoogleAvailabilityEvent`,
  `syncGoogleCalendar`, `/google/calendar/disconnect`, `/google/calendar/busy`.
- O cache pessoal `google_calendar_busy` guarda intervalos e metadados, sem
  título/descrição/participantes. A resposta do portal rotula `Ocupado`.
- Isso não significa que o backend nunca recebe eventos completos: a conexão
  pessoal usa a API de eventos para sincronização. A política explicita isso.
- A escrita FORJA no Google pode conter nome do aluno, matéria/indicação de
  atendimento, local, horário e Meet. Não afirmar que todos os eventos escritos
  são anônimos ou privados independentemente dos compartilhamentos Google.
- `src/google-admin-calendars.js`, `src/google-secretaria.js`,
  `src/google-central-freebusy.js`: catálogo central separado, associações
  explícitas, cache temporário freeBusy <=60s, erros nunca significam livre.
- Tokens persistidos AES-256-GCM/backend; OIDC/PKCE/state atômico existentes.
  Desconexão pessoal revoga credencial e limpa cache local. Desconexão central
  remove sua credencial local, preserva configurações e não revoga grant global.
- Histórico escolar/eventos Google existentes não são apagados automaticamente
  por toda desconexão. Não prometer prazo de exclusão não comprovado.
- Consulta central ainda não integra Agenda/booking. Este PR não inicia Etapa 4.

## Arquivos e URLs propostos

Páginas estáticas sem login, JavaScript, Auth SDK, trackers ou chamadas à API:

- `privacidade/index.html` → `/privacidade/`.
- `termos/index.html` → `/termos/`.
- `assets/forja-legal.css` → stylesheet compartilhado, sem recursos externos.
- `index.html`: somente descrição pública da integração e links no rodapé.
  Removendo o bloco exato `forja-public-legal`, o arquivo inteiro mantém o hash
  do main publicado. Scripts, formulário aprovado, Agenda e Google intactos.

Depois da revisão **e de futura publicação autorizada**, configurar em Branding:

| Campo | URL definitiva proposta |
| --- | --- |
| Página inicial | `https://forja-escola.web.app/` |
| Política de Privacidade | `https://forja-escola.web.app/privacidade/` |
| Termos de Serviço | `https://forja-escola.web.app/termos/` |

Não configurar o Preview temporário como identidade pública definitiva. As URLs
acima ainda retornam o portal antigo até publicação autorizada deste conteúdo.
Não enviar rascunhos incompletos para verificação.

## Confirmações pendentes da escola

O proprietário confirmou o nome público **FORJA Escola** e, em 10/10/2026,
`adm@forjaescola.com.br` como contato oficial ativo de suporte e privacidade,
autorizado pela escola. O endereço foi incluído nas duas páginas com link mailto.
Ainda não confirmou razão social/CNPJ ou política formal de retenção/exclusão.
A declaração Limited Use e demais condições institucionais continuam pendentes.

Antes da versão definitiva, confirmar:

1. Identificação da entidade responsável; o contato de privacidade/suporte já está confirmado.
   Não criar CNPJ, encarregado, endereço ou e-mail fictícios. CNPJ não é um campo
   obrigatório do Branding Google; a identificação institucional precisa refletir
   a escola real, conforme a revisão aplicável.
2. Finalidades/bases legais, tratamento de menores e dados de atendimentos,
   responsáveis e quais registros são efetivamente utilizados pela escola.
3. Retenção por categoria, exclusão, backups e canal/procedimento de solicitações.
   Não estabelecer prazos arbitrários ou apagamento automático inexistente.
4. Prestadores efetivos, armazenamento/transferências e acesso humano de suporte.
5. Adesão institucional ao Google API Services User Data Policy/Limited Use:
   uso limitado às funcionalidades divulgadas; restrições de transferência,
   venda/publicidade/leitura humana; procedimentos da equipe e terceiros.
   Não afirmar adesão, proibição de treinamento de IA ou prática fora do código
   sem confirmação. O texto atual aponta a obrigação e sua aprovação pendente.
6. Condições de uso propostas e compatibilidade com os contratos educacionais.
   Nenhum foro, penalidade, cessão de direitos ou promessa de uptime foi inventado.

## Passos manuais posteriores no Google — não executados

1. Selecionar o **projeto Google Cloud dos clientes OAuth efetivamente usados**.
   Firebase `forja-escola` não comprova, sozinho, que todo cliente OAuth pertença
   ao mesmo projeto; confira pessoal e central sem trocar client IDs/segredos.
2. Google Auth Platform → **Branding**: nome, e-mail de suporte válido, contatos
   do desenvolvedor, homepage e privacidade definitivas; termos se utilizados;
   logo representativo se configurado. Salvar o Branding e revisar os avisos.
3. Conferir **Authorized domains** para homepage/políticas, origens e callbacks
   já existentes. Google exige domínio registrável apropriado e propriedade
   verificada no Search Console por conta associada ao projeto.
   Não presumir que ter Firebase Hosting ou Render comprova domínio. Validar a
   aceitação/forma de prova dos subdomínios compartilhados `web.app`/`onrender.com`
   no Console. Nunca tentar registrar/alegar propriedade de `web.app` inteiro.
   Se Google exigir domínio institucional próprio, confirmar propriedade e plano
   separado com a escola antes de alterar URLs ou DNS. Não modificar callbacks.
4. Revisar **Audience**: contas pessoais externas exigem público External.
   Internal só atende usuários da organização Workspace elegível. Concluir
   requisitos de Branding mostrados, **Verify Branding** quando exigido e
   publicar Branding após status Ready to publish, conforme a interface atual.
   Alterar publishing status de Testing para In production quando habilitado.
5. **Data Access / Verification Center**: declarar somente scopes existentes e
   conferir sua classificação atual no Console. Os acessos Calendar podem exigir
   revisão de scopes sensíveis; preparar justificativa por scope, explicação de
   por que permissão mais estreita não basta e vídeo completo do fluxo/consentimento.
   As referências Calendar descrevem os escopos; a classificação efetiva do
   projeto deve ser confirmada no Console. Não adicionar scopes amplos por conveniência.
6. Distinguir publicação para público externo, verificação de Branding e
   verificação de acesso a dados: publicar não garante remoção do alerta
   de app não verificado ou dos limites aplicáveis. A decisão é do Google.
   Não prometer aprovação imediata nem exigir avaliação paga sem fundamento.
7. Revalidar com a escola a política final e o consentimento mostrado. Somente
   após autorização, testar conexão real de profissional sem lista de testadores,
   identidade correta, sync e privacidade. Nenhuma conta real foi usada aqui.

Em Testing, projetos External que pedem acesso Calendar emitem refresh tokens
com expiração de sete dias (exceção: somente scopes básicos de identidade).
Sair de Testing não deve ser tratado como renovação automática de token antigo:
se uma credencial já expirou, diagnosticar e reconectar apenas quando necessário.
Isso é uma possível causa geral de falha de token pessoal, não diagnóstico do Carlos.

## Hosting, testes e publicação futura

- `firebase.json` e `.firebaserc` permanecem iguais. Firebase serve arquivos
  estáticos existentes antes do rewrite SPA. Caminhos terminam em `/`.
- `prepare-hosting.mjs` copia explicitamente portal + os três arquivos legais;
  limpa a pasta gerada e nunca publica docs, scripts ou credenciais.
- `validate.mjs` mantém marker/hash obrigatório e verifica o hash integral do
  main sem o único bloco de rodapé autorizado. As proteções anteriores continuam.
- `legal-pages.test.mjs`: Chromium desktop/mobile, links públicos do DOM real,
  navegação sem JavaScript/login, overflow, whitelist e rejeição do falso 200 SPA.
- Workflow de validação executa os testes novos e todas as regressões anteriores.
- `verify-legal-pages.mjs` verifica por GET não autenticado o conteúdo/hash de
  cada página e CSS no mesmo domínio, depois do deploy Preview e, futuramente,
  live. Nenhum OAuth, criação de conta, sync ou ação no banco é executado.
- PR somente frontend declara `FORJA_PREVIEW_BACKEND=production-unchanged`.
  A API oficial permanece no HTML. O Preview não é banco isolado; revisar
  somente páginas legais, sem cadastros ou ações reais nesta tarefa.
- Não fazer merge/publicar live enquanto a revisão dos rascunhos e as demais
  informações institucionais estiverem pendentes. Confirmar o contato não aprova
  automaticamente o restante do conteúdo nem autoriza mudanças no Google OAuth.

## Fontes oficiais consultadas

Consulta em 10/10/2026, acesso HTTP público. Requisitos podem mudar; conferir avisos
atuais do projeto no Console antes de submissão.

- [Brand verification: homepage, privacidade, domínios e Branding](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).
  Homepage pública, explicação do app, link privacidade; termos são opcionais.
- [Sensitive scope verification: justificativas e demonstração](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).
- [Escopos oficiais Calendar API](https://developers.google.com/workspace/calendar/api/auth).
- [Google API Services User Data Policy e Limited Use](https://developers.google.com/terms/api-services-user-data-policy).
- [OAuth 2.0: expiração de refresh tokens em Testing](https://developers.google.com/identity/protocols/oauth2#expiration).
- [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies).

Não foram alterados Console Google, Search Console, Firebase, Render, domínios,
usuários ou credenciais durante a preparação.
