# Navegação, painel do aluno e domínio — 21/10/2026

Código preparado para revisão; este trabalho não publica o site, Preview, DNS ou configurações.

## Bases verificadas e isolamento

- Frontend main publicada: `8def27cccc429f01ee29dd9230466693f4331aad` (merge #26).
- Backend publicado no início: `239e4ec51eac85fb1911e6c8a917ffbc133d92a4` (merge #24). Durante a pausa por limite de uso, uma publicação externa avançou o backend para `d1483037be294428ab1af7788311f42389790c1a` (merge #25, diagnóstico seguro de consentimento na Agenda), confirmado no health em 21/10 às 17:41 UTC. Esta missão não executou essa publicação.
- Em 21/10, o HTML público do Hosting tinha SHA-256 `5da10123f591bc37a6a4abdb1e40b5e9d8df18f673f181d37a3b2755b6944ca9`.
- O checkout backend anterior foi preservado. A branch local de validação `codex/navigation-backend-validation` aponta para a nova main `d148303`, sem alterações ou commits próprios. Nenhum arquivo rastreado backend foi alterado nesta missão.
- Branch nova frontend: `codex/navigation-student-review`, baseada diretamente nessa main.
- Testes de navegador usam o portal completo, Chrome/Playwright, cinco perfis sintéticos e interceptação de todo tráfego externo. A integração usa somente Auth/Firestore `demo-forja` emulados e Google simulado. Consultas externas desta missão se limitam a metadados públicos/configuração de domínio, sem dados de alunos ou Google pessoal.

## Bugs reproduzidos e correções

1. **Voltar sai do portal em vez de retornar à tela anterior.** Nos cinco perfis, desktop e celular, `inicio → perfil` deixou `history.length` em `2 → 2`; Voltar chegou a `about:blank` no cenário isolado. Todos os wrappers finais de `navigate` apenas renderizavam. Não havia `popstate` para essas telas.
2. **Overlays/etapas não participavam do histórico.** Login, seções públicas, pré-matrícula e modais não tinham uma entrada correspondente para o botão do navegador. Os botões próprios de voltar etapa/fechar já existiam; foram preservados e integrados ao histórico, sem substituição dos formulários.
3. **Escape fecha duas camadas.** No HTML publicado, Escape no campo de um modal sobre o login resultou em `modalVisible=false`, `loginVisible=false`, `publicVisible=true`. O handler do modal fechava a janela e o mesmo evento chegava ao handler global. Agora ele interrompe a propagação.
4. **Aluno recebe classificação por semáforo.** Reproduzido com três tópicos nos três estados: início, Meu aprendizado, nivelamento, resultado de listas e renderizador compartilhado de treinamento. Contadores, classes, pontos, chips e legendas equivalentes foram retirados da renderização do aluno; tópicos e observações continuam como **Conteúdo para praticar**. Resultados numéricos, frequência, dados e ações pedagógicas permanecem.

O adaptador de histórico chama os renderizadores e permissões oficiais. Não cria outra autenticação, agenda ou fluxo de reserva. Entradas contêm somente rotas; campos e posições ficam em memória, limitados a 32 entradas, e são apagados na troca de UID/geração/perfil. Senhas e arquivos não entram nos snapshots de campos. Histórico antigo não reabre um portal depois do encerramento da sessão. Repetir o mesmo menu não cria entradas extras e restaura seus campos. Filtros de listas usam somente seus handlers locais conhecidos, sem reproduzir eventos de salvamento.

O drawer usa `v630Open`/`v630Close`; dois hooks opcionais comunicam apenas sua abertura/fechamento. Voltar fecha pelo controle oficial e mantém o rascunho já administrado pelo drawer. Não altera criação, locks, recuperação, idempotência ou confirmação de reservas. Modais genéricos com campos editados pedem confirmação ao sair pelo histórico; cancelar mantém a mesma janela. Avançar para uma entrada de modal já fechada retorna à tela subjacente, sem reexecutar ações antigas. Abas dentro de um acompanhamento continuam locais; Voltar fecha a janela que as contém.

## Professor, Admin e demais perfis

`studentMathDataB` e cálculos/diagnósticos não foram alterados. As funções compartilhadas mudam **somente a apresentação quando o perfil é student**; Professor e Admin conservam os três rótulos, classes e ações. O treinamento compartilhado também mantém a legenda completa para os outros perfis. Não há migração, escrita de notas, exclusão de histórico ou mudança de Rules/permissões.

Os testes percorrem todos os menus dos cinco perfis e verificam bloqueio de `usuarios` para perfis não administrativos. Isso comprova a regressão da interface com identidades simuladas; não substitui a autorização do backend, preservada e testada separadamente.

## Antes e depois (dados sintéticos)

| Evidência | Antes | Depois |
|---|---|---|
| Aluno desktop | [Captura](evidence/navigation-student/student-before-desktop.png) | [Captura](evidence/navigation-student/student-after-desktop.png) |
| Aluno celular | [Captura](evidence/navigation-student/student-before-mobile.png) | [Captura](evidence/navigation-student/student-after-mobile.png) |

Semáforo profissional: [Professor](evidence/navigation-student/teacher-semaphore-desktop.png), [Admin](evidence/navigation-student/admin-semaphore-desktop.png). Capturas anteriores são renderizações do HTML exato da main publicada, com o mesmo cenário fictício. Não são imagens de contas reais.

## Domínio: diagnóstico somente leitura

Observação pública em 21/10/2026, aproximadamente 14:44–14:52 UTC. Evidências: [DNS do sistema](evidence/navigation-student/dns-system.json), [consulta ao nameserver autoritativo](evidence/navigation-student/dns-authoritative.json), [HTTP/TLS/Auth/CORS](evidence/navigation-student/domain-public.json).

| Consulta | Resultado observado | Consequência |
|---|---|---|
| `forjaescola.com.br A` | `199.36.158.100`, TTL 3600 | Aponta para Hosting; nenhum IP de outro provedor foi observado nesse registro. |
| Apex AAAA / CNAME | Sem resposta do tipo solicitado; SOA de autoridade | Não foi observado IPv6 ou CNAME antigo concorrente. |
| Apex NS | `a.sec.dns.br`, `b.sec.dns.br` | Delegação pública ao Registro.br; não modificar. |
| Apex TXT | `hosting-site=forja-escola`, TTL 3600 | Associação pública ao site. Não remover. |
| `www` A/AAAA/CNAME/NS/TXT | Nome inexistente (NXDOMAIN no resolvedor utilizado) | `www` não chega ao Hosting; não é uma falha de SSL já comprovada. |
| Apex HTTPS | 200; certificado autorizado Google Trust Services, válido de 17/10/2026 até 15/01/2027 | O domínio principal funciona nesta observação. |
| Apex HTTP | Redireciona para HTTPS | HTTPS funcional. |
| Apex vs `web.app` | Mesmo SHA-256 de HTML, indicado acima | A diferença de conteúdo alegada não foi reproduzida no apex nesta consulta. |
| Auth, configuração pública | `forjaescola.com.br` e `www.forjaescola.com.br` ausentes de `authorizedDomains` | Pendência para operações Auth que validam a origem, como redirecionamentos/links. Não prova isoladamente falha de senha/e-mail. |
| OPTIONS `/me`, Origin apex e www | 403, sem `Access-Control-Allow-Origin` | O backend rejeita essas origens. A tela pública pode abrir enquanto as chamadas autenticadas do portal ficam bloqueadas pelo navegador. Nenhum login real foi executado. |
| Mesmo preflight, Origin `web.app` | 204 e allow-origin correspondente | Confirma a diferença de CORS entre as origens. |

A configuração local do Hosting aponta ao site `forja-escola`, projeto `forja-escola`, pasta isolada `.firebase-public` e rewrite SPA para `/index.html`. Não existe configuração DNS no repositório que publique um `www` automaticamente.

As APIs administrativas de Hosting e Auth responderam **403** à sessão CLI existente. A lista Auth acima veio do endpoint público usado pelo SDK, sem consultar usuários. Não foi possível ler a associação de `www`, o estado de provisionamento ou os valores **específicos do assistente Firebase deste domínio**. Não foram inventados valores de TXT nem tratado um exemplo documental como prova do console. A consulta direta ao nameserver autoritativo a.sec.dns.br confirmou o A/TXT do apex e o nome inexistente para www. Tentativas DoH dos provedores externos não resolveram nesta sessão; não são tratadas como confirmação independente.

### Mudanças propostas para aprovação futura — nenhuma aplicada

1. Ler no console **Hosting → site forja-escola → domínios personalizados** o cadastro atual e o assistente de `www.forjaescola.com.br`. Associar `www` ao mesmo site (ou configurar redirecionamento para o apex, se o proprietário preferir uma única origem canônica). Isso é mudança de infraestrutura e exige aprovação.
2. Proposta documental para DNS: **adicionar `A`, host `www`, valor `199.36.158.100`, TTL 3600**, depois de conferir que o assistente desse domínio exige exatamente esse valor. Manter o A e TXT existentes do apex. Adicionar qualquer TXT de verificação somente com nome/valor copiados do assistente e apresentados antes ao proprietário. Nenhum valor específico adicional está comprovado nesta auditoria. Não criar um CNAME em paralelo ao A.
3. Proposta Auth: acrescentar `forjaescola.com.br` e `www.forjaescola.com.br` à lista atual de domínios autorizados, preservando todas as entradas existentes. Se `www` apenas redirecionar no Hosting antes de carregar o app, pode ser desnecessário autorizar uma segunda origem operacional; definir a opção antes de aplicar.
4. Proposta CORS: acrescentar `https://forjaescola.com.br` e `https://www.forjaescola.com.br` à allowlist efetiva existente, preservando as origens atuais. O default no código backend contém somente `web.app` e `firebaseapp.com`; `ALLOWED_ORIGINS` pode substituí-lo. A configuração efetiva deve ser conferida antes de escolher entre alteração de código e variável. Nenhuma variável foi alterada ou credencial lida para essa finalidade.
5. Depois de autorização/publicação coordenada: verificar DNS, certificado, redirecionamentos, preflight das origens e um fluxo autenticado expressamente autorizado. Não assumir que copiar o HTML corrige Auth/CORS.

Não modificar NS, MX, SPF, DKIM, DMARC, outras verificações TXT, scopes, consentimentos ou credenciais. A integração Google usa callbacks do backend e URLs de retorno configuradas; o default de retorno pessoal no código permanece `https://forja-escola.web.app`. Não foi comprovada a configuração OAuth efetiva de produção e nenhum OAuth/sync real foi executado. Eventual troca de origem de retorno exige proposta separada; não faz parte deste PR.

Referências oficiais: [Hosting: domínio personalizado](https://firebase.google.com/docs/hosting/custom-domain), [recurso administrativo com DNS necessário](https://firebase.google.com/docs/reference/hosting/rest/v1beta1/projects.sites.customDomains), [domínios autorizados de Auth](https://firebase.google.com/docs/auth/web/email-link-auth).

## Regeneração e validação

- `node scripts/navigation-student-build.mjs`: migração reversível sobre a main publicada exata, com fronteiras únicas e SHA integral.
- `node scripts/agenda-intelligence-build.mjs`: preserva e reaplica a camada nova; regeneração foi executada nos dois sentidos. Os 45 ajustes da Agenda e todos os guards anteriores continuam verificáveis.
- `node scripts/validate.mjs`: valida hash, restauração, sintaxe e allowlist do artefato; hashes/guardas não foram desativados.
- `scripts/navigation-student.test.mjs`: regressões permanentes incluídas no workflow Node 22, mantendo o orçamento de 20 minutos e os gates de deploy existentes.

Node local: **22.23.3**. Resultados antes do envio do PR:

| Verificação executada | Resultado |
|---|---|
| Suíte frontend completa local | 409/410; única falha era a expectativa textual do teste do guard, que continuou rejeitando uma alteração indevida corretamente. |
| Reexecução após ajustar a expectativa, sem alterar o guard | **47/47**, incluindo toda a suíte de perfil/login e as **21 regressões novas** de navegação/aluno. |
| Drawer oficial, rodada dedicada | **2/2**, desktop e celular; rascunho preservado e zero POST provocado por Voltar/reabrir. |
| Filtro/scroll, rodada dedicada | **2/2**, conteúdo filtrado e posições restaurados. |
| Backend na base inicial | **310/310** unitários e **275/275** integração emulada. |
| Backend publicado na retomada, `d148303` | **311/311** unitários; a suíte emulada está sendo repetida sobre essa base. |

A asserção do guard agora aceita também a mensagem exata da nova camada reversível. Continua exigindo o hash da base restaurada e uma exceção para edição indevida; nenhum hash, guarda ou validação foi desativado. A suíte completa de **410 testes** será novamente exigida pelo workflow Node 22 no SHA do PR. Os resultados finais da CI e da repetição emulada atual serão vinculados ao PR; não são presumidos por este registro anterior ao push. Execuções interrompidas não contam como aprovação.

## Riscos e revisão

- O adaptador toca um fluxo global: revisar Voltar/Avançar, retorno de overlays e transições de sessão antes de publicar; a suíte completa inclui login, Agenda, cinco ciclos de polling, drawers, reservas e isolamento existentes.
- Rascunhos são memória da aba e sessão, não armazenamento durável após fechar/recarregar o navegador. Entradas antigas além do limite de 32 podem voltar sem campos em memória.
- Testes automatizados usam Chrome desktop/celular simulado e Chromium na CI; navegador móvel físico/Safari e validação humana de usabilidade continuam recomendados.
- O domínio não está corrigido por este código. `www`, Auth e CORS precisam das aprovações específicas acima. A associação/valores exatos do assistente Firebase continuam pendentes de leitura autorizada no console.
- Nenhum merge, deploy/Preview, Google real, dado escolar, DNS, Rules, OAuth ou infraestrutura foi alterado nesta missão.
