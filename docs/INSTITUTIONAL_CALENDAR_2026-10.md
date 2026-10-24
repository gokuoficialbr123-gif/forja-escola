# Agenda institucional — frontend para revisão

Branch `codex/institutional-calendar-sync`, base publicada
`051c711f24aa62d1048fb5f18a68828b2d3546ad`. Backend coordenado na mesma branch.
Sem merge, Preview, deploy, OAuth real ou alteração em dados escolares.

## Comportamento

O cadastro de professor oferece calendários autorizados por nome e ID, ocultando
os já vinculados a outro professor. A criação reserva o vínculo; ativação e
autorização de eventos continuam explícitas na Secretaria. Sem calendário, o
cadastro fica pendente e seus horários institucionais não são confirmados.
Os demais perfis conservam seus campos e payloads. O gerenciamento existente do
professor permite preparar o vínculo posteriormente, sem trocar eventos antigos.

Professor institucional usa login FORJA. Cabeçalhos e painel informam que a
Secretaria gerencia o calendário e não exigem conexão Google individual.
Legado e psicólogo conservam a integração pessoal.

Com `refreshMode: events` confirmado pelo backend, a consulta deixa de depender
dos 20 segundos: usa o SSE existente, expiração original da fonte e recuperação.
Cada evento de alteração desencadeia leitura limitada e autorizada, sem chamada
a sincronização de escrita. O legado conserva seu comportamento seguro.

Ausência de SSE recente, EOF inesperado, fonte vencida/incompleta, falta de
autorização ou falha não produz verde. Respostas atrasadas continuam cercadas
por UID, geração, perfil, seleção e período. O drawer oficial e seus campos,
filtros, formulários e scroll são preservados. Nenhum fluxo novo de reserva.

## Construção e regressões

`agenda-intelligence-build.mjs` regenera o HTML pelas camadas oficiais, incluindo
`institutional-calendar-build.mjs`. Hash e guardas reversíveis permanecem ativos;
`institutional-calendar-scope.mjs` verifica a camada nova. Nunca editar o HTML
gerado isoladamente nem atualizar hashes para encobrir divergências.

Regressões permanentes: quatro combinações Secretaria/professor e desktop/celular,
100 segundos simulados sem consultas fixas, cinco eventos com cinco leituras,
formulário do drawer preservado, ausência de erro JS, encerramento do SSE
retirando verde, seletor institucional sem exposição de calendários alheios,
campos dos outros perfis e integridade da geração.

Capturas sintéticas em `docs/evidence/institutional-calendar/`:
`agenda-admin-desktop.png`, `agenda-admin-mobile.png`,
`agenda-teacher-desktop.png`, `agenda-teacher-mobile.png`.
Não representam sessão de usuário real.

## Pendências reais e limites

Testes simulados não comprovam consentimento, ACLs, entrega de webhook pelo
Render ou latência Google real. É necessária autorização institucional explícita
com `calendar.events`, além dos escopos centrais anteriores. Não houve mudança
de escopos pessoais, OAuth no Console, Firebase Rules ou infraestrutura.

A ativação recusa aulas já vinculadas a outro calendário/modelo; exige plano
de migração específico, preservando eventos e histórico. A fonte tem janela e
capacidade limitadas; vencimento sempre fica desconhecido. Ver o documento
homônimo backend para os limites, contrato bidirecional e ordem futura de
publicação. PR Draft não autoriza publicação nem ativação real.
