# Google OAuth Branding — páginas públicas para revisão

Preparação em 10/10/2026. **Política e Termos temporários aprovados pela escola,
complementações pendentes; somente PR/Preview. Não fazer merge ou
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

O proprietário informou **FORJA Escola** como identificação registrada e confirmou
`adm@forjaescola.com.br` como contato oficial ativo de suporte e privacidade,
autorizado pela escola. O endereço foi incluído nas duas páginas com link mailto.
O CNPJ ainda não foi conferido. Júlio confirmou a finalidade de uso dos dados
Google Calendar exclusivamente nas funcionalidades de agenda do FORJA Escola
e aprovou a Política de Privacidade temporária, incluindo a proposta anterior
de retenção/exclusão. Júlio aprovou também os Termos atuais para uso temporário.
A escola confirmou que não vende dados Google Calendar nem os usa para publicidade.
Não há comprovação de todos os procedimentos operacionais ou de conformidade
integral Limited Use. As páginas separam os fatos do código,
as orientações aprovadas e os procedimentos ainda propostos; evidências em
`docs/RETENCAO_EXCLUSAO_PROPOSTA.md`. Nenhuma rotina de exclusão foi implementada.
A conformidade integral com Limited Use e demais condições institucionais
continuam pendentes. Aprovação do texto não autoriza merge/deploy ou mudanças OAuth.

Antes da versão definitiva, confirmar:

1. Conferência do CNPJ e dados cadastrais complementares da identificação
   registrada informada: FORJA Escola. O contato já está confirmado.
   Não criar CNPJ, encarregado, endereço ou e-mail fictícios. CNPJ não é um campo
   obrigatório do Branding Google; a identificação institucional precisa refletir
   a escola real, conforme a revisão aplicável.
2. Finalidades/bases legais, tratamento de menores e dados de atendimentos,
   responsáveis e quais registros são efetivamente utilizados pela escola.
3. Critérios concretos de retenção/exclusão por categoria e obrigações
   efetivamente aplicáveis; equipe e procedimento de solicitações; inventário real
   de backups/exportações/versões, recursos de exclusão e cuidados em restauração.
   Não estabelecer prazos arbitrários ou apagamento automático inexistente.
4. Prestadores efetivos, armazenamento/transferências e acesso humano de suporte.
5. Conformidade integral com Google API Services User Data Policy/Limited Use:
   finalidade exclusiva, ausência de venda pela escola e de uso publicitário
   confirmadas institucionalmente. Ainda verificar treinamento de IA,
   compartilhamento/transferências e acesso humano, incluindo equipe e terceiros.
   Não presumir que as confirmações da escola auditem os prestadores. Não declarar
   ausência de uso para IA ou adesão integral sem evidência.
6. Detalhes institucionais/operacionais e compatibilidade com os contratos
   educacionais; texto atual dos Termos aprovado somente para uso temporário.
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
- `legal-pages.test.mjs`: aprovação temporária de ambos os documentos, rejeitando
  promoção a aprovação definitiva, Chromium desktop/mobile, links do DOM real,
  navegação sem JavaScript/login, overflow, whitelist e rejeição do falso 200 SPA.
- Workflow de validação executa os testes novos e todas as regressões anteriores.
- `verify-legal-pages.mjs` verifica por GET não autenticado o conteúdo/hash de
  cada página e CSS no mesmo domínio, depois do deploy Preview e, futuramente,
  live. Nenhum OAuth, criação de conta, sync ou ação no banco é executado.
- PR somente frontend declara `FORJA_PREVIEW_BACKEND=production-unchanged`.
  A API oficial permanece no HTML. O Preview não é banco isolado; revisar
  somente páginas legais, sem cadastros ou ações reais nesta tarefa.
- Não fazer merge/publicar live sem autorização. A aprovação dos textos
  temporários não confirma CNPJ, procedimentos ou conformidade integral
  Limited Use, e não autoriza mudanças no Google OAuth.

## Limited Use: limite da confirmação e da revisão técnica

Em 10/10/2026 foi consultada novamente a Google API Services User Data Policy.
Ela restringe uso às funções divulgadas, admite transferências e leitura humana
apenas nas hipóteses previstas e proíbe usos como venda a plataformas de anúncios
e uso publicitário. A página não transforma essas exigências em declarações de
que todas as práticas da escola e dos prestadores foram auditadas.

A leitura do código existente confirma os fluxos pessoais/centrais descritos,
incluindo escrita de eventos FORJA e seus compartilhamentos determinados pelo
Google Calendar. Não comprova contratos, usos externos ao código, acesso das
equipes ou tratamento por terceiros. A ausência de venda pela escola e de uso
publicitário foi confirmada institucionalmente, não auditada em contratos ou
nos sistemas dos prestadores. A página
também solicita verificação específica de treinamento de IA e sua compatibilidade
com a finalidade exclusiva e as políticas aplicáveis; não inventa uma auditoria
de IA nem presume práticas fora do sistema. A revisão complementar de 11/10,
abaixo, inclui as exigências específicas das APIs Google Workspace.

Assim, registram-se finalidade, ausência de venda pela escola e de uso publicitário
confirmadas institucionalmente e mantém-se pendente
a declaração de conformidade integral. Nenhuma integração, scope ou prática
técnica foi alterada por esta atualização documental.

## Auditoria final de páginas públicas e Branding — 10/10/2026

Fontes oficiais foram novamente consultadas; não houve acesso ao Console ou
configuração de cliente OAuth. O status Testing/Branding incompleto continua
sendo evidência informada pelo proprietário, não uma inspeção do Console.
O endpoint de ajuda `support.google.com` não ficou acessível neste ambiente;
as páginas oficiais `developers.google.com` abaixo foram consultadas normalmente.

### Evidências das páginas e da preservação do portal

- Produção continua sem as páginas do PR: GET público `/`, `/privacidade/` e
  `/termos/` retornou HTTP 200 e o mesmo SHA-256 `3d6908cd…` da SPA. Portanto
  ainda não usar essas URLs como documentos publicados no Branding.
- PR contém páginas estáticas próprias, sem scripts, forms, iframes, Auth SDK,
  chamadas API ou recursos externos em CSS. Nenhum token OAuth, credencial ou
  documento interno entra no artefato. Publicação usa allowlist e verificação
  exata do conteúdo por GET público; falso 200 da SPA é recusado.
- Links públicos e âncoras são testados em Chromium desktop/mobile sem login.
  O único mailto é o contato autorizado. Links externos são explicativos, não
  callbacks ou pedidos OAuth. O site conserva APIs, scripts e funcionalidades
  existentes por hash integral, descontando somente o rodapé legal autorizado.
- Não foram acrescentados headers globais/CSP: o portal tem scripts inline e
  alterar a política global exigiria avaliação própria. Nos documentos estáticos
  desta tarefa não há código executável, credenciais ou sessão autenticada.

### Checklist curto: obrigatórios, condicionais e complementares

| Tipo | O que falta / ação | Responsável |
| --- | --- | --- |
| Obrigatório: uso fiel e políticas Google | Verificar treinamento de IA, terceiros/transferências e acesso humano, incluindo equipe/prestadores, antes de declarar conformidade integral; registrar práticas reais de armazenamento/compartilhamento. Uso exclusivo de agenda, ausência de venda pela escola e de uso publicitário já confirmados. | Escola |
| Obrigatório: URLs públicas | Após autorização de publicação futura, servir homepage com descrição do app e link para Política acessível no mesmo domínio; verificar que `/privacidade/` é a política, e não a SPA. Preview temporário não é URL definitiva. | Proprietário + publicação autorizada |
| Obrigatório: identidade/contatos | No projeto efetivamente usado pelos clientes OAuth pessoal e central: Google Auth Platform → Branding; conferir nome real, suporte e contatos do desenvolvedor. Verificar se o contato autorizado é selecionável no campo Google; receber e-mail não comprova elegibilidade nesse campo. Logo, se informado, deve representar o app. | Proprietário, no Google Cloud |
| Obrigatório para verificação de marca: domínios | Conferir Authorized domains e a prova de propriedade pelo Search Console/conta associada ao projeto para as URLs efetivamente usadas. Aceitação dos subdomínios `web.app`/`onrender.com` ainda não comprovada; não presumir propriedade dos domínios dos provedores nem alterar DNS/callbacks. | Proprietário, Google Cloud/Search Console |
| Branding / saída de Testing | Corrigir avisos exatos do Console; executar Verify Branding quando exigido; após Ready to publish, Publish branding. Em Audience, confirmar External e executar Publish app / In production quando habilitado. As duas publicações têm finalidades distintas. | Proprietário, no Google Cloud |
| Condicional: verificação de acesso a dados | Data Access/Verification Center: conferir classificação dos scopes já usados, declarar somente esses scopes e, se exigido, enviar justificativas e demonstração em vídeo. O Google exige Branding publicado antes da solicitação de verificação de dados. Publicar app não garante remoção do alerta não verificado ou de limites. | Proprietário + avaliação Google |
| Complementar ao formulário OAuth | Conferir CNPJ e identificação cadastral. CNPJ não é campo obrigatório listado nos requisitos de Branding; Termos são opcionais para Branding, embora já preparados/aprovados temporariamente pela escola. Isso não dispensa obrigações legais institucionais. | Escola |
| Operacional / exatidão da política | Definir critérios concretos de conservação, equipe e atendimento de solicitações; levantar backups, recursos de exclusão, representação de menores e bases legais. Não são campos específicos do Branding, mas práticas reais precisam corresponder ao texto publicado. | Escola |

URLs futuras: `https://forja-escola.web.app/`,
`https://forja-escola.web.app/privacidade/` e, se incluído,
`https://forja-escola.web.app/termos/`. Não foram configuradas no Google.

Sair de Testing permite público externo além de testadores quando o Google
habilitar a publicação; não equivale a ter marca/scopes verificados. Com scopes
Calendar em Testing, a documentação OAuth informa refresh tokens de sete dias;
não contar com renovação automática de uma credencial já expirada ao publicar.
Depois de futura autorização, o teste de aceitação será uma conexão de professor
sem lista de testadores, verificando consentimento, identidade e privacidade.
Nenhum OAuth real ou conta real foi usado nesta auditoria.

## Fontes oficiais consultadas

Consulta em 10/10/2026, repetida em 11/10/2026 para Branding, verificação de scopes,
Calendar e User Data Policy, por acesso HTTP público. Requisitos podem mudar; conferir avisos
atuais do projeto no Console antes de submissão.

- [Brand verification: homepage, privacidade, domínios e Branding](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification).
  Homepage pública, explicação do app, link privacidade; termos são opcionais.
- [Sensitive scope verification: justificativas e demonstração](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification).
- [Escopos oficiais Calendar API](https://developers.google.com/workspace/calendar/api/auth).
- [Google API Services User Data Policy e Limited Use](https://developers.google.com/terms/api-services-user-data-policy).
- [Google Workspace APIs User Data and Developer Policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy).
- [OAuth 2.0: expiração de refresh tokens em Testing](https://developers.google.com/identity/protocols/oauth2#expiration).
- [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies).

Não foram alterados Console Google, Search Console, Firebase, Render, domínios,
usuários ou credenciais durante a preparação.

## Revisão final de fluxos, prestadores e acesso — 11/10/2026

Frontend main `959b72f6d5a398fa3c1f0fbc79a3ce0b2436f580` e backend main
`3c816cf3080f3fddd77ea9913a3f36419ae3baf3` foram atualizados por fetch e relidos.
A árvore local do backend é idêntica ao main. Revisão somente de código,
documentos e metadados públicos do PR: sem banco, contas, tokens, Console ou
operações Google reais. Aprovações institucionais temporárias permanecem;
esclarecimentos técnicos não são novas regras institucionais.

### Mapa verificado no código

| Fluxo | Processamento / armazenamento | Acesso ou compartilhamento observado |
| --- | --- | --- |
| Google pessoal | `server.js`: `syncGoogleCalendarForProfessionalUnlocked` recebe eventos para sincronização; `upsertGoogleBusy` grava intervalos/metadados em `google_calendar_busy`, sem campos de título, descrição ou participantes no escritor atual. | `GET /google/calendar/busy`: profissional autenticado consulta seus próprios intervalos; admin consulta os profissionais. Aluno/responsável não acessa essa rota. Resposta rotulada Ocupado. Isso não audita dados legados nem ACLs reais do banco. |
| Eventos FORJA no Google | `createOrUpdateGoogleEvent` envia nome do aluno, matéria/atendimento, datas, local e IDs operacionais; pode criar Meet. `syncForjaEntityGoogle` grava `googleCalendarEventId` e, quando aplicável, `meetLink` em aulas/atendimentos/bloqueios. | Compartilhamentos do calendário Google controlam visibilidade externa. `lessonItemForRole` permite Meet ao admin, professor e aluno vinculado; o serializer de responsável não inclui esse campo. Não afirmar que compromissos pessoais viram aulas ou que todos os perfis recebem todos os links. |
| Google central | `google-secretaria.js` guarda credencial criptografada e identidade; `google-admin-calendars.js` guarda catálogo e associação explícita. `google-central-freebusy.js` consulta apenas start/end/Ocupado/status, sem persistência de intervalos ou eventos; cache em memória até 60s. | Rotas centrais verificam admin ativo; professores associados precisam ser teacher ativos. Nomes/IDs dos calendários são metadados administrativos, não conteúdo de eventos. A consulta central continua fora da Agenda/booking. |
| Infraestrutura | Firebase Authentication, Firestore e Storage; Firebase Hosting; API no Render; Google Calendar/Meet. | Render executa o código que recebe eventos pessoais completos e usa credenciais em memória. Criptografia da credencial persistida não significa ausência de processamento pelos provedores. Regiões, contratos, acesso de operadores e backups não foram inspecionados. |
| E-mail opcional | `server.js`, `sendLoginEmailCode`: Resend recebe destinatário, saudação/primeiro nome e mensagem com código, somente quando configurado. Convite/reset de senha usa Firebase, não esse fluxo. | Não foi consultada a configuração oficial para afirmar que Resend esteja ativo. O payload desse caminho não contém eventos Google. |
| WhatsApp opcional | `index.html`, `openActivityWhatsapp` e `openTherapyRequestWhatsapp`: ação do usuário abre wa.me com telefone e mensagem escolar, incluindo contexto de atividade/atendimento e eventualmente link de arquivo. `src/whatsapp.js` recebe telefone e envia template/idioma para Meta; `d2.js` contém o chamador de lembretes. | Abertura de link não é entrega de mensagem. Payload Meta inspecionado não inclui eventos Google, Meet ou conteúdo escolar dinâmico; configuração/execução real desse lembrete não foi comprovada. Dockerfile inicia `server.js`; não presumir que o job legado esteja em execução. |

Somente arquivos de código e manifests foram pesquisados: não foi encontrado SDK
ou endpoint de provedor externo de IA no frontend/backend auditados. As referências
a treinamentos no sistema são registros educacionais, não prova de treinamento
de modelos. Essa ausência não comprova práticas fora do código, uso manual de
ferramentas ou políticas dos prestadores. A escola ainda deve confirmar eventual
treinamento de IA e transferências relacionadas.

O frontend não recebe refresh/access token Google nas respostas de conexão;
as respostas centrais usam whitelist e e-mail mascarado. State consumido em
transação, PKCE, validação OIDC e AES-256-GCM continuam no backend existente.
Nenhum fluxo foi alterado por este PR. A presença desses controles no código
não substitui auditoria de permissões reais, contratos ou práticas de suporte.

### Limited Use e acesso humano: limite importante

A política específica Workspace foi consultada em 11/10. Além das restrições
gerais, exige declaração afirmativa de adesão a Limited Use no aplicativo/site.
Essa declaração ainda não consta, intencionalmente, pois as práticas não foram
comprovadas. É um bloqueio real para concluir a política destinada à submissão
Google, e não algo a preencher automaticamente. A mesma fonte restringe uso para
criar/treinar/melhorar IA além do modelo personalizado do próprio usuário para
a função apropriada; não afirmar uma proibição geral de toda IA nem presumir
conformidade dos fornecedores. Deve-se verificar equipe, agentes e contratados.

A fonte Google consultada restringe transferências e leitura humana inclusive
de dados derivados dos scopes. A visualização de intervalos por administradores
é um acesso humano a dado derivado; a permissão de role no FORJA, sozinha, não
comprova a hipótese admitida pela política Google. Não foi comprovado acordo
afirmativo do usuário para esse acesso específico, nem outra exceção aplicável.
A escola deve confirmar quem acessa, finalidade, autorização/consentimento e
controles; se a divulgação ou autorização existente for insuficiente, isso exige
uma correção própria antes de afirmar conformidade, não uma promessa nesta página.

Também faltam evidências operacionais de prestadores/transferências, uso externo
de IA, pessoas com acesso técnico e execução de pedidos de exclusão. A política
descreve essas pendências em vez de afirmar que contratos ou práticas foram
verificados. O Google exige política fiel e abrangente, não apenas nomear serviços.
Não enviar uma declaração integral Limited Use enquanto essas questões estiverem
sem comprovação. Confirmações de finalidade exclusiva, ausência de venda e
publicidade pela escola permanecem registradas, sem estendê-las aos fornecedores.

A política Workspace também trata de cópias permanentes e de limites de cache.
No código pessoal, a janela de consulta exibida não é uma rotina de exclusão por
idade: o cache é removido na desconexão, em certos resyncs e ao receber remoções.
Não foi demonstrado TTL geral desse cache nem verificado o cabeçalho de respostas
reais do Google. Avaliar as regras específicas de sincronização/armazenamento
aplicáveis antes de afirmar conformidade de retenção; não concluir violação
definitiva sem essa verificação e não inventar uma limpeza automática existente.

### Resultado e sequência para futura publicação

- **Tecnicamente preparado para revisão de publicação**, condicionado à validação
  dos testes e Preview do HEAD atual. Portal, API, CSS, workflows e scopes não
  foram modificados nesta revisão; Termos temporários foram preservados.
- **Ainda não pronto para submissão final ao Google:** confirmar os pontos Limited
  Use acima, validar retenção/cache e completar a divulgação das práticas
  operacionais aplicáveis. Só então aprovar a declaração afirmativa exigida.
  Depois, obter autorização de publicação das páginas, conferir GET público
  distinto da SPA e configurar URLs definitivas. O Preview não é o endereço final.
- No Google Cloud, o proprietário deve conferir Branding/contatos, domínios
  autorizados/prova de propriedade, avisos de Verify Branding, Audience e
  classificação/justificativas dos scopes existentes. Não se comprovou o estado
  desses campos; não acrescentar scopes nem alterar callbacks por suposição.
- CNPJ não é requisito técnico listado para Branding; conferir a identificação
  institucional continua pendência da escola. Termos são opcionais no formulário
  Google. Critérios de retenção, responsáveis, exclusão e inventário de backups
  precisam refletir práticas reais, mas não exigem inventar prazos ou implementar
  uma nova rotina automática para preencher o Branding.
- `googleTokenRequest()` e `googleApi()` pessoais não têm timeout explícito:
  risco residual de espera/disponibilidade existente, recomendado para hardening
  separado. Não foi encontrado nexo com exposição nas páginas públicas ou com o
  erro pessoal de Carlos; não executar OAuth real para diagnosticá-lo aqui.
- CSP global e outras melhorias do portal exigem escopo/testes próprios. As
  páginas legais são estáticas, sem código executável ou credenciais; não alterar
  a política de scripts do portal para concluir esta revisão documental.

Nenhum merge, deploy live, alteração de backend, Google Cloud, banco ou conta
foi executado. A atualização autorizada limita-se ao mesmo PR frontend #8 e Preview.

Validação local em 11/10: 187 testes frontend aprovados (Chromium real desktop e
mobile, navegação pública sem JS/login, links, hash/marker, artefato e regressões),
e 70 testes Google backend com mocks aprovados. Zero falhas/skips em ambas as
execuções. `validate.mjs`, `prepare-hosting.mjs` e `git diff --check` aprovados.
Código backend, index do portal, Termos, CSS, config Firebase e workflows intactos.

## Preparação controlada da publicação e diagnóstico do 403

Continuação autorizada a partir de `c38cbaf` no mesmo PR #8. HEADs relidos:
frontend main `959b72f`, backend main `3c816cf`; nenhuma mudança nesses main.
A escola aprovou que profissionais controlem sua disponibilidade e a Secretaria
consulte ocupado sem detalhes pessoais. Código confirma: PATCH de disponibilidade
semanal apenas teacher/psychologist, professionalId extraído do usuário autenticado,
publicação com fingerprint e confirmação do próprio profissional. A resposta
`/google/calendar/busy` é whitelist de intervalos/metadados, rotulada Ocupado.

### 403: separar a origem antes de escolher a correção

O proprietário relatou Testing e Branding incompleto. Não houve acesso ao Console,
à conta de Júlio ou ao consentimento real; o texto atual do erro foi solicitado
sem e-mail/URL/parâmetros. Não se confirma uma causa só pelo status HTTP.

| Evidência que deve aparecer | Interpretação / ação futura, após autorização |
| --- | --- |
| Tela Google: access_denied e mensagem de app em testes, conta fora da lista | Testing é a hipótese prioritária no contexto informado. Publicar corretamente o app External pode remover essa restrição; não adicionar testadores como solução definitiva. Branding/URLs/políticas precisam estar completos. |
| Tela Google: admin_policy_enforced | Política do administrador Workspace bloqueia o cliente/scope. Branding ou Publish app não substitui essa autorização; tratar o cliente específico com o administrador da conta. |
| Tela Google: org_internal | Projeto limita acesso à organização. Conferir Audience no projeto do cliente efetivamente usado; não trocar cliente, credencial ou audiência sem aprovação. |
| Portal/API: PERSONAL_GOOGLE_PREVIEW_DISABLED | Bloqueio intencional de integração pessoal no Render Preview. Preservar; não remover a proteção para testar professores reais. |
| Portal/API: conta inativa ou operação não permitida | `/google/calendar/connect` exige autenticação e teacher/psychologist ativo. Admin não usa essa rota para conectar a conta pessoal de um professor. Não alterar role/conta real automaticamente. |
| Google: redirect_uri_mismatch | Callback não coincide com o cadastrado; é problema distinto de Testing e não é prova de erro 403. Conferir URI exata sem alterar clientes. |

O callback atual sanitiza falhas e redireciona para googleCalendar=error; esse
resultado genérico não identifica a política Google que originou a negativa.
Não relacionar automaticamente o antigo GOOGLE_TOKEN_FALHOU HTTP400 de Carlos
ao 403 de autorização ou ao PR de páginas públicas.

### Consentimento: aprovado institucionalmente, lacuna individual

O botão Conectar é uma ação afirmativa para iniciar OAuth; o Google apresenta
scopes e o backend usa state de uso único, PKCE, nonce/OIDC e credencial nova.
Isso comprova controles do fluxo técnico, não um aceite específico/documentado
para leitura humana dos intervalos pela Secretaria. O painel atual descreve
sincronização e proteção dos detalhes, mas não registra versão/aceite dessa
divulgação na conexão. Não foi comprovada autorização externa documentada.

A política Workspace exige divulgação no fluxo, antes do consentimento, e
não apenas em Privacidade/Termos. Para leitura humana, exige consentimento
documentado ou exceção admitida. A aprovação de Júlio da regra institucional
não é tratada como consentimento de todos os profissionais.

**Proposta mínima, não implementada; exige aprovação antes de alterar backend:**

1. Exibir divulgação específica imediatamente antes de Conectar: processamento
   pessoal no backend, criação/sync de eventos FORJA, intervalos visíveis à
   Secretaria, detalhes pessoais ocultos e meios de desconexão/solicitação.
   Solicitar aceite explícito; não presumir consentimento por navegação ou login.
2. Backend validar uma versão fixa desse aceite e vinculá-la ao usuário e ao
   state/nonce criado. Persistir o recibo na conexão somente após callback válido,
   vinculado à identidade OIDC verificada; não incluir tokens, eventos ou e-mails
   em logs. Reusar `_google_oauth_states` e `google_calendar_connections`, sem
   misturar documentos centrais ou recibos de publicação de disponibilidade.
3. Não promover conexões legadas automaticamente. Antes de ampliar acesso,
   definir obtenção de consentimento dos profissionais existentes ou comprovar
   uma hipótese admissível já documentada. Não revogar/desconectar todos nem
   reaproveitar consentimento de outra identidade.
4. Mapear também respostas derivadas em `/professores/disponibilidade` e
   `/profissionais/disponibilidade`, não só a rota busy. Uma ausência de aceite
   nunca pode transformar ocupado em livre. Preservar o cálculo interno de
   conflitos, locks, publicação e dados; qualquer mudança de exposição exige
   aprovação específica, testes e mensagem de consulta indisponível.

Riscos: impedir novas conexões se frontend/backend forem publicados fora de
ordem; afetar consultas de conexões legadas sem plano; consentimento inadequado
ao trocar identidade ou reutilizar state. Testes necessários: aceite ausente/
inválido, versão, recusa, vínculo state/UID/OIDC, reutilização, reconexão,
legados, exposição derivada e preservação de conflitos. Nenhum campo foi criado.

**Falha adicional reproduzida com mocks — confirmação da desconexão pessoal:**
DELETE `/google/calendar/connection` aguarda a remoção da conexão com
`.delete().catch(()=>{})` e depois retorna `{ok:true}`. Executando somente esse
handler extraído, com Firestore em memória recusando a exclusão, a resposta
continuou HTTP200. Zero chamadas Google/banco reais. O erro de revogação Google
também é capturado separadamente; se revogação e exclusão local falharem, não
há comprovação de encerramento da conexão apesar da resposta de sucesso.

Proposta antes da liberação, não implementada: não engolir falha de exclusão
local; devolver erro sanitizado/resultado parcial correto, confirmar o estado
final e preservar tentativa segura de revogação. Testar falha local, falha de
revogação, combinação, repetição e ausência de tokens nas respostas/logs. Não
revogar em massa, apagar dados ou alterar conexão central. Risco da correção:
frontend precisa diferenciar desconexão concluída de falha parcial; excluir
somente a credencial/cache pessoais autorizados. Essa falha é distinta do 403
e recomenda-se corrigi-la antes de liberar professores reais ao novo fluxo.

### Retenção: o que existe e o que depende de decisão

Calendar recomenda armazenamento local para sync incremental e remoção dos
eventos cancelados; HTTP410 deve limpar o store e iniciar novo full sync. O
backend implementa remoção por cancelamento, full sync/410 e desconexão.
Portanto existência de cache, sozinha, não demonstra infração. Porém a janela
45 dias passados/180 futuros de consulta não comprova expurgo por idade:
não foi demonstrado TTL geral nem inspeção dos cabeçalhos reais Google.

Antes da declaração integral, justificar retenção/minimização desse cache e
avaliar regras específicas e cabeçalhos aplicáveis. Se for necessária limpeza,
apresentar patch separado para aprovação: remover somente ocupado antigo cuja
janela inteira terminou, respeitar all-day/timezone e sync incremental,
sem apagar aulas, disponibilidade, tokens ou documentos reais durante auditoria.
Não adotar TTL sobre início de evento que ainda dure vários dias; não escolher
prazo arbitrário nem alterar booking. Esta é proposta, não rotina existente.

Exclusão: desconexão pessoal limpa cache/conexão e solicita revogação; não é
exclusão integral do histórico escolar/arquivos/backups. Central preserva
associações ao desconectar. Escola precisa designar atendimento e inventariar
backups/exports reais; não é obrigatório inventar automação para o Branding.
Um pedido real de exclusão precisa de execução/limitações fiéis à política.

### Ordem exata proposta — nenhum passo de produção executado

1. Confirmar o texto/local do 403, o projeto Google do cliente pessoal e as
   evidências de consentimento, prestadores/IA, retenção e acesso humano.
   Finalidade agenda, ausência de venda/publicidade pela escola já aprovadas;
   código não mostrou provedores de IA ou transferência de eventos pessoais
   para Resend/Meta, mas não audita operações externas/contratos.
2. Aprovar separadamente as correções mínimas necessárias, caso a lacuna não
   esteja suprida por uma hipótese válida documentada. Implementar/testar somente
   após essa aprovação. Backend não foi modificado nesta preparação.
3. Concluir a política fiel às práticas e, só com comprovação, aprovar a declaração
   afirmativa Limited Use. Páginas/testes/Preview do PR8 permanecem revisáveis;
   não substituir pendências por promessas ou declarar conformidade agora.
4. Solicitar confirmação de execução do merge/publicação do PR8. Após autorizado,
   aguardar Firebase Hosting production e verificar páginas reais, links e login.
   URLs definitivas: `https://forja-escola.web.app/`,
   `https://forja-escola.web.app/privacidade/`,
   `https://forja-escola.web.app/termos/`. Hoje páginas live retornam a SPA.
5. Obter confirmação específica para Google Cloud: selecionar projeto(s) dos
   clientes existentes Backend, Secretaria, Make e n8n. Inventariar somente nomes,
   projetos, URIs e scopes; não exportar segredos. Make/n8n não foram identificados
   no código auditado: não presumir clientes/projetos/fluxos inexistentes.
6. Branding: preencher URLs oficiais, nome/contatos elegíveis, conferir Authorized
   domains e propriedade Search Console exigida. Não presumir propriedade de
   web.app/onrender.com ou trocar DNS/callback para contornar verificação.
   Executar Verify Branding; Ready to publish → Publish branding. Resultado de
   verificação de marca tem validade de 7 dias segundo documentação atual.
7. Data Access/Verification Center: conferir classificação real dos scopes
   Calendar existentes: events.owned pessoal; calendarlist.readonly e
   events.freebusy central, com openid/email preservados. Não adicionar/remover
   scopes de outros clientes Make/n8n sem inventário e autorização. Preparar
   justificativas/vídeo se Google exigir; não presumir que toda revisão ou
   avaliação de segurança seja obrigatória para todos os scopes.
8. Audience: External → Publish app / In production quando habilitado e aprovado.
   Se o Console exigir conclusão de verificação antes dessa ação, cumprir esse
   bloqueio; não prometer liberação apenas com marca publicada. Publicação de
   projeto afeta seus clientes, mesmo preservando IDs/segredos/URIs. App publicado
   não significa scopes verificados ou ausência de alertas/limites.
9. Com autorização e Júlio presente, confirmar professor ativo, usar navegador
   comum e conta Google correta, conferir divulgação e consentir nos scopes
   pessoais existentes. Não cadastrar como testador para mascarar o resultado.
   O callback pessoal executa sync/backfill e pode criar/atualizar eventos FORJA
   no calendário conectado: o teste real não é read-only e não foi executado.
10. Confirmar conexão/status, sync e visibilidade apenas Ocupado na Secretaria;
    sem compartilhar tokens/títulos. Preservar conexão central e Make/n8n.
    Não testar desconexão/reconexão indiscriminadamente; token Testing já expirado
    não é renovado automaticamente pela publicação. Se falhar, interromper a
    sequência e diagnosticar código sanitizado; não apagar dados ou recriar chaves.

### Bloqueios e melhorias posteriores

- Bloqueios para a conclusão Google: divulgação/consentimento compatíveis,
  práticas Limited Use comprovadas e declaração afirmativa, retenção/cache
  justificáveis, URLs públicas definitivas, campos/avisos reais de Branding,
  domínio e verificações que o Console exigir. Não afirmar que todos foram
  inspecionados; não confundir a lista com causa comprovada do 403.
- Bloqueio técnico recomendado antes da liberação: confirmação falsa de
  desconexão pessoal quando a exclusão local falha, reproduzida com mocks;
  proposta acima exige aprovação específica do backend.
- Complementos: CNPJ não é campo obrigatório de Branding; Termos são opcionais
  no formulário Google. Critérios legais/operacionais reais continuam da escola.
- Hardening posterior: timeouts pessoais explícitos e avaliação de CSP global.
  Não corrigem Testing por si sós e não justificam reconstrução ou novo scope.

Fontes oficiais adicionais relidas: [OAuth web-server, erros e callbacks](https://developers.google.com/identity/protocols/oauth2/web-server)
e [Calendar sync incremental](https://developers.google.com/workspace/calendar/api/guides/sync),
além das fontes de Branding, Data Access, OAuth e Workspace acima. Google Cloud
não foi acessado/modificado, nenhum profissional real foi usado nos testes.
