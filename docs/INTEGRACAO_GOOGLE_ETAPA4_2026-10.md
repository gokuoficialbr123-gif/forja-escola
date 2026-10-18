# Integração Google Calendar sobre o main atual — 18/10/2026

Código preparado em `integration/google-central-booking-current-main`, sem merge,
deploy, OAuth real, migração ou QA com dados da escola. Os PRs antigos são fontes
para reconciliação, não um pacote a ser integrado cegamente.

## Base preservada e investigação dos oito PRs

Backend main `fc2621281de411ec13808f569daa17507ae03360`; frontend main
`8861f3a63be7ce90389eecb99d93526823837702`. GitHub confirmou essas referências.
O `/health` público confirmou o mesmo SHA backend, confirmação administrativa e
hotfix/diagnóstico publicados, sem a nova capability central de booking. O HTML
público tem SHA256 `7f6cdaf67e06c4306fed8b43a7ab04bba4da25c4d87cf38adec0cd0aa1bdd43f`,
igual ao frontend de base, com API oficial. Essas consultas não autenticadas não
criaram ou alteraram dados.

| Repo / PR | HEAD auditado | Base / decisão |
|---|---|---|
| Backend9 |346182ee0e0c783da46ae570324fd64337299609|main antigo3c816cf; consentimento ainda necessário, portado com diagnóstico atual|
| Backend10 |71777db245b436c3a48ac434fb9dab8b58bc4a4f|mesma base antiga; falso sucesso local parcialmente corrigido depois, mas epoch/quarentena/fences ainda necessários|
| Backend11 |d86f153987f57d7df326099799c7913de8275f05|base integrada383cdbe; liberação de locks já portada para produção por13 e preservada, sem reaplicar a branch|
| Backend12 |04f1990bb6875102d8d51d25ff5512fb4169c077|depende de11 e da integração9/10; portado adaptador central, sem substituir o servidor atual|
| Frontend9 |56fef600f8164c1e34c100b8b5a8cf67c79796f7|main antigo959b72f; aceite afirmativo/regularização portados|
| Frontend10 |5170c8c7b1e4d29fcef3a12bb4ee85ed8c0377fd|mesma base antiga; estados reais/retentativa portados com isolamento UID/geração|
| Frontend11 |a1fc2538ccc97da9eecb57c0aedb7754a9c76513|base integrada2d9d21b; isolamento já portado por13 e ampliado na produção atual, sem importar snapshots antigos|
| Frontend12 |e9f3a7c80489fcd5f843fda90b2f6e2098cd96cc|depende de11; portadas apresentação central e prova para slots, sem agenda-demo/localStorage/doubles no artefato|

Os oito PRs antigos estavam abertos, não mergeados. O estado aberto não significa
que todas as linhas estejam ausentes do main. Nenhum PR antigo foi alterado.

## Reconciliação e conflitos

A reconciliação do servidor produziu23 conflitos de conteúdo; o double Google
precisou de mais dois. Foram resolvidos por área, sem escolher globalmente uma
branch. Preservados: `newLessonRecord` confirmado; idempotência/resultado pós-commit;
locks e teste de owner/TTL; `updateLessonSnapshot` e histórico transacional;
cancelamento do aluno; leases Google e propriedade dos eventos; cache completo
antes da substituição; retry410 correto; timeout e categorias de diagnóstico.

Não restaurar o `status: agendada` antigo nem gravações cegas de metadados que
reativam conexões ou aulas. A desconexão antiga usa o novo fencing; a recuperação
Google da produção continua operando com o mesmo armazenamento durável.

No frontend,19 mudanças reversíveis de apresentação/fluxo preservam o portal
atual. `scripts/google-integration-changes.json` e o guard de revisão restauram
exatamente o HTML de produção antes dos guards anteriores, sem enfraquecer seus
hashes. O snapshot e testes não entram na allowlist de Hosting.

Duas incompatibilidades exigiram tratamento específico: a limpeza de conflitos
pessoais depois de uma consulta ao vivo não pode apagar a fonte central; e os
resultados atrasados de consentimento/desconexão não podem alterar outra sessão.
A fonte central recebe proveniência própria no cálculo; a UI valida UID e geração
antes de feedback, fechamento de modal, redirecionamento ou atualização de estado.
Mutações na configuração central invalidam o cache local e incrementam uma revisão;
uma resposta anterior à alteração não pode repovoá-lo, mesmo para o mesmo admin.

## Consentimento e regularização

`personal-busy-secretaria-v1` exige caixa inicialmente desmarcada e ação afirmativa.
O backend registra texto/hash/versão, UID autenticado, timestamps e identidade
OIDC da autorização correspondente. State de uso único, HMAC do cliente/callback,
PKCE, nonce e validação OIDC permanecem. Epoch impede callback anterior à
desconexão de reinstalar a credencial. Nenhum token passa ao frontend.

Legado não é apagado nem recebe aceite automático. Continua conectado para seu
próprio titular, mas a Secretaria não recebe busy ou disponibilidade derivada sem
recibo válido. Isso é uma mudança operacional relevante do PR9: antes de publicar,
a escola precisa planejar a regularização dos profissionais. Com OIDC verificado,
'Revisar e autorizar' preserva a credencial; sem identidade verificável, é necessária
nova autorização. OAuth Testing/403 pode impedir essa ação e não é resolvido por
esta integração. Não desativar o controle para contornar o bloqueio.

## Desconexão pessoal

Suspende a conexão e avança epoch atomicamente; faz limpeza local condicionada
à operação e não permite sync/cache/metadados recriarem uma conexão removida.
Resultados distinguem completed/partial/failed, retentativa e conexão substituída.
Falha local não vira sucesso. Aulas, atendimentos e histórico não são apagados.

A revogação global Google NÃO é feita automaticamente: pode atingir todos os
clientes do mesmo projeto para a mesma conta, incluindo Secretaria/Make/n8n.
A limpeza local pode terminar com HTTP502/partial e revocation=deferred_shared_project;
a UI explica o resultado e não confunde essa pendência com aula ativa ou conexão
local existente. Nova revogação institucional exige decisão específica. Nenhum
cliente OAuth ou integração central foi modificado nesta rodada.

## Disponibilidade e decisões de reserva

`src/google-central-booking.js` reutiliza freeBusy da Etapa3. Só utiliza calendário
associado explicitamente a teacher ativo, habilitado, acessível e vinculado à conta
central/namespace e chave corretos. Não associa por nome/e-mail. Calendários de
outro professor, desabilitados/removidos/sem acesso registrado são ignorados;
configuração habilitada desconhecida, grant inválido, erro, timeout ou resposta
incompleta recusam uma declaração de livre. Associação central continua teacher-only;
a integração pessoal de psicólogos não é substituída.

- GET `/admin/agenda/google-central-busy`: admin, janela pública inclusiva até31dias;
  apenas UID operacional e intervalos rotulados Ocupado. Sem conteúdo de eventos.
- Disponibilidade/slots: central só retira períodos publicados, com
  `centralBookingPolicy=central-booking-fail-closed-v1` junto das policies existentes.
  Falha não apaga aulas nem produz verde/livre; a UI mantém seleção e mostra aviso.
- Aula única e remarcação HTTP: consulta final nova dentro dos locks; não reutiliza
  um resultado antigo como confirmação. Edição histórica sem mudança de horário
  mantém o comportamento da produção.
- Semanal por período e fixo contínuo: o adaptador comum valida as duas fontes no
  preflight, na confirmação dentro dos locks e na extensão automática. Mantém
  todas-ou-nenhuma,53 ocorrências/366dias,12 iniciais/84dias, cursor, recibos, IDs,
  bloqueio explícito na data conflitante e encerramento não destrutivo.

### Horizonte privado das recorrências

O PR12 antecede as recorrências atuais. Validar53 datas por chamadas individuais
estouraria o limite de dez consultas por minuto; particionar366dias em31 também
exigiria13 consultas por validação. A adaptação mínima é UMA consulta interna
limitada ao horizonte da recorrência já validada (até366dias). Ela não é um endpoint
público nem aceita parâmetro de janela vindo do cliente. Rotas públicas freeBusy e
Agenda continuam limitadas a31dias; body desconhecido é rejeitado. Permanecem os
limites de resposta/intervalos, lote de50, rate limit, deadlines e fingerprints.
Os testes exigem uma chamada para53 datas e rejeitam janela pública excedente.

A consulta Google não é transação distribuída com Firestore: uma alteração externa
posterior à verificação continua sendo risco residual. Locks, precondições e a
releitura da configuração durante a consulta protegem as decisões locais, sem
prometer congelar o Google.

## Limites reais antes de considerar produção irrestrita

1. **Evento próprio no central:** freeBusy não fornece IDs/proveniência por evento.
   Remarcar sobre o intervalo do próprio evento pode continuar bloqueado. Não
   subtrair busy por coincidência: isso ocultaria um compromisso pessoal sobreposto.
   O teste mantém o bloqueio e permite destino realmente livre. Resolver esse caso
   exige desenho de proveniência/segregação e aprovação própria; sem scopes novos.
2. Edições recebidas pelo sync pessoal preservam os controles publicados e não
   são anunciadas como submetidas à nova validação central dos agendamentos HTTP.
3. Contas legadas podem exigir regularização explícita; Testing/403, grants reais
   e acesso efetivo precisam de validação autorizada pela escola antes da liberação.
4. Erro Google é desconhecido, não livre. Rate limits/deadlines podem impedir novas
   reservas temporariamente; não devem ser desativados. Google nunca cria disponibilidade.
5. Não foram acessadas Rules reais, eventos privados, tokens ou configurações secretas.
   Emuladores comprovam autorização da API; não certificam Rules de produção nem
   práticas institucionais/Google Limited Use.

## QA e evidências

Auth/Firestore locais `demo-forja`, HTTP real, Chromium desktop/celular, Google
simulado estritamente na fronteira. Nenhuma conta/aula/evento real de QA. O cenário
atual comprova53 datas, todas-ou-nenhuma com novo conflito após preflight, doze
reservas contínuas, extensão bloqueada sem pular data, retomada e reinício, aula
única concorrente, liberação dos locks e cancelamento próprio idempotente.

O portal integrado consulta ocupado central e confirma uma reserva em Chromium
com a mesma API/Firestore locais. Guards/casos adicionais preservam campos, scroll,
minutos reais, elegibilidade, isolamento e comportamento após respostas atrasadas.
Testes antigos de cache foram atualizados para ter autorização sintética explícita
e resposta Google válida; cache órfão não é promovido a grant. Os asserts de duração,
conflitos e privacidade permanecem.

Comandos: `npm test`; `firebase emulators:exec --only auth,firestore --project demo-forja
--config test/emulators/firebase.json 'npm run test:integration'`; no frontend
`node scripts/validate.mjs`, `node --test --test-concurrency=1 scripts/*.test.mjs` e
`node scripts/prepare-hosting.mjs`. Resultados finais e SHAs são registrados no
fechamento dos PRs; não somar grupos-pai nem reruns como testes independentes.

## Preview e publicação futura

A instrução desta rodada proíbe deploy. Nenhum Firebase/Render Preview novo foi
publicado, nem o canal live. Preview existente em Firebase compartilhado não é
prova de isolamento Auth/Firestore e não deve receber escritas/OAuth de QA.
A validação isolada desta integração é local/emulada e na CI. Criar/atualizar
um Preview externo requer autorização posterior e comprovação de isolamento.
Não importar agenda-demo nem chamar demonstração de teste Google real.

Antes de qualquer merge: revisar os SHAs e CI dos novos Drafts, os limites acima
e o plano de regularização. Registrar deployments anteriores. Backend primeiro;
Render LIVE no SHA exato, health com as policies novas e antigas, Auth/CORS;
frontend depois pelo workflow oficial, hash/API oficial/allowlist/legais íntegros.
Aceitação operacional por pessoa autorizada com conta/calendário de teste adequados.
Rollback apenas após autorização: reverter código não apaga aulas, histórico,
recibos, epochs, consentimentos ou filas. Voltar o backend pode retirar proteções
ou parar recuperação de pendências; não restaurar credenciais de backup automaticamente.
