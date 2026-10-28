# Agenda FORJA — reformulação preparada para revisão

Missão de 28/10/2026. Nenhum merge, deploy ou Preview autorizado nesta missão.
Bases remotas/publicadas conferidas: frontend
`4261022212c0717054af8a16e61b5d429110d8f6`, backend
`3a70ce6fa6a2a7961accf7ca6990fdf0ba4ecb7f`.
Os checkouts anteriores estavam limpos e foram preservados. Nova branch nos dois
repositórios: `codex/agenda-premium-modalities`.

## Diagnóstico e reaproveitamento

O health público respondeu 200 com o SHA backend acima, também LIVE no Render.
Hosting oficial 40729223571: production success. O HTML público respondeu 200,
SHA256 `cfa705317584908ae5483ac981e6c2c266f25b577c6894cce801de0d28a023e8`,
igual ao artefato registrado pelo workflow. O HTML fonte mantém seu hash próprio;
o artefato oficial extrai os recursos estáticos antes de servir.

Reutilizar `v621Lane`, `v629Lane`, os calendários g/legados dos outros perfis,
`gLessonEvent`, listas de aulas, detalhes oficiais, `v630Open`/binding do drawer,
composição de disponibilidade, snapshot, SSE e geração reversível existente.
Aluno usa `studentAgendaG` com aulas próprias; responsável mantém o filtro do
dependente; psicólogo usa os compromissos operacionais existentes. Não criar
outro calendário, reserva, transporte ou armazenamento.

Causas visuais: cartões usam cor de status em vez de modalidade; o resumo mensal
administrativo agrega aulas de modalidades diferentes; o estado desconhecido
usa amarelo; o decorador institucional remove Conectar/diagnóstico, mas não a
ação individual de Sincronizar. As correções devem preservar os limites de
escopo, os cálculos de disponibilidade, o formulário aberto e a assinatura da grade.

## Carlos — diagnóstico limitado à evidência recebida

Registro profissional informado: `PRO-2026-000001`; não é UID Firebase.
Captura de 28/10/2026 às 14:06: Google Calendar HTTP 403, acesso recusado,
etapa API Google Calendar. Nenhuma sessão administrativa/UID foi disponibilizada.
Não consultar, modificar ou testar dados reais para preencher essa lacuna.

O caminho pessoal `googleApi` classificava todo HTTP 403 como `access_denied`;
o transporte institucional também descartava os motivos estruturados e ignorava
`Retry-After` em 403. Quatro regressões institucionais falharam antes da correção:
quota, escopo, configuração e prazo de espera. A classificação genérica não
comprova expiração, revogação ou qual permissão faltou.
A captura é compatível com o diagnóstico pessoal legado, mas não comprova o
modelo/vínculo efetivo da conta. Comparar metadados sanitizados na interface
administrativa e catálogo central antes de atribuir causa ou migrar.

As Rules publicadas continuam não verificadas; não há Rules versionadas nestes
checkouts. Preservar negação de acesso direto às coleções servidoras e registrar
essa pendência antes de qualquer publicação/ativação real.

Para Júlio/Roberta obterem a informação sanitizada indispensável, sem alterar nada:

1. Em **Administração → Usuários**, localizar Carlos pelo registro profissional
   informado, abrir os detalhes e copiar somente o texto de **Agenda institucional
   do professor**: sem vínculo, vínculo preparado ou fonte institucional selecionada.
2. Em **Configurações → Google Calendar da Secretaria**, informar se aparece
   **Eventos institucionais autorizados** e se a linha associada a Carlos está
   habilitada, acessível e com acesso `writer`/`owner`. Uma lista antiga não comprova
   acesso atual. Não clicar em autorizar, vincular, ativar ou sincronizar para QA.
3. Informar o rótulo atual da Agenda do professor e horário da observação. Se ainda
   faltar identificação técnica, o proprietário pode obter o UID pela conta
   correspondente no Firebase Authentication; o registro PRO não substitui o UID.
   Não enviar tokens, credenciais, títulos de compromissos ou dados de alunos.

Esses textos distinguem configuração legada/preparada/institucional. Somente um
motivo estruturado atual do Google pode comprovar quota, escopo ou configuração.
Um 403 genérico continua inconclusivo entre as causas de acesso. Nenhuma conta
real de Carlos foi consultada, migrada ou corrigida nesta missão.

## Implementação

O stylesheet existente da Agenda passa a ser dono da apresentação, com tokens
compartilhados de superfície branca, azul-marinho, espaçamento e estados. A
interpretação de `modalidade` está centralizada: `presencial` azul `#2563EB`,
`online` amarelo `#F59E0B`, ausente/desconhecida cinza `#64748B`. Título e status
não inventam modalidade. Disponível confirmado usa `#16A34A`; bloqueio/ocupado
externo usa `#DC2626`; falha e vencimento são neutros. Aulas mantêm sua modalidade.

Os renderizadores nativos `v621`/`v629`, `cal18` do aluno, listas do responsável,
cartões e detalhes oficiais reutilizam esse contrato. O mês administrativo deixa
de agregar aulas de modalidades diferentes num único marcador. Sete dias cabem
no celular; cartões preservam acesso a detalhes. Filtros ficam compactos em telas
menores e mantêm abertura explícita. Horários conservam a escala nativa de 48px/h.
Psicólogo mantém sessões e Google pessoal; disponibilidade não consultada fica
neutra. Nenhuma regra pedagógica ou permissão de perfil foi alterada.

Foi reproduzido um defeito adicional no perfil psicológico: o wrapper de
`forjaAgendaPage` da camada de consentimento não repassava `scope`, acionando o
padrão administrativo. Desktop e celular exibiam quatro controles/seções da
Secretaria (criação de aula/sessão, filtro global e overview). Duas regressões
falharam antes da correção. O wrapper agora repassa os argumentos ao renderizador
oficial; sessões e operações próprias permanecem, sem dar novas permissões.
O backend continua aplicando a autorização existente independentemente da UI.

A regressão visual também verifica o `body`, além do elemento raiz: o indicador
de consulta não pode formar uma segunda coluna flex fora da tela do professor.
O cabeçalho usa uma única composição flex com quebra de linhas.

A detecção institucional usa perfil/conexão ou snapshot atual cercado por sessão;
remove todos os controles pessoais e avisos herdados nesse contexto, inclusive
Sincronizar. Metadados pessoais antigos não comprovam sincronização institucional.
O legado permanece disponível aos perfis que o utilizam.

O backend classifica apenas motivos estruturados conhecidos: quota 403/429,
`ACCESS_TOKEN_SCOPE_INSUFFICIENT`, `SERVICE_DISABLED`/`accessNotConfigured` e
acesso genérico. Quota institucional compartilha o cooldown da conta central e
persiste o prazo entre instâncias. Nenhuma mensagem bruta do Google sai da API.
Não foram alterados OAuth, escopos solicitados, locks, reservas ou Rules.

Geração: `node scripts/agenda-intelligence-build.mjs`, incluindo as camadas
posteriores de navegação e integração institucional; hashes e manifests são
regenerados pelo procedimento oficial. `index.html` não foi editado isoladamente.

## Consulta e sincronização preservadas

Snapshot é leitura de disponibilidade; SSE `/agenda/changes` invalida a consulta
após alterações FORJA. No modelo institucional confirmado não foi introduzido
polling fixo de 20s. O mirror Google usa o sincronizador existente, watch/webhook,
cursor incremental, leases, recuperação e validade limitada. Webhook/SSE não
garantem instantaneidade. Falha ou vencimento não produz verde.

FORJA → Google continua pelo caminho nativo de criação/remarcação/cancelamento;
Google → FORJA continua pelo webhook e reconciliação institucional autenticada,
com ETag/If-Match, idempotência e locks existentes. Testes simulados comprovam
esses contratos; não comprovam o grant ou ACL reais da escola.

## Evidências e validação

[Reprodução contra a main](evidence/agenda-premium/reproduction-before.json),
usando somente dados sintéticos: professor institucional com **1 botão pessoal
Sincronizar** herdado; aula online com fundo azul legado; mês do aluno com borda
direita em **835px numa tela de 390px**. As regressões permanentes exigem a
remoção do controle, modalidade real e grade mensal dentro da tela.

As imagens `before-*` registram a base publicada com dados sintéticos. A matriz
final usa `{perfil}-{day|week|month|list}-{largura}.png`, nos tamanhos 1920, 1366,
768, 390 e 360. Responsável preserva sua lista nativa, sem inventar calendário.
Todas as capturas são do Chromium real, com APIs simuladas.

QA local já concluído: 33/33 verificações de pipeline/recursos; matriz de 42/42
antes do ajuste de escopo; 9/9 verificações focadas de escopo psicológico e
institucional após esse ajuste; 4/4 avisos institucionais de quota/consentimento/
acesso/configuração; e 10/10 verificações emuladas de permissões e login. O backend
aprovou 355 verificações unitárias após a proteção final do cooldown e uma rodada
completa de 284 integrações antes desse último ajuste. A rodada completa final de
integração e a suíte frontend integral estão em execução ao preparar o Draft.

A suíte oficial inclui as regressões de login, navegação, aluno sem semáforo,
disponibilidade, dia inteiro/múltiplos dias, forms/drawer, locks, idempotência,
sessão/UID, SSE e integração institucional. Os resultados completos e SHAs exatos
serão registrados nos checks e em comentário técnico dos PRs; não considerar
uma rodada ainda em execução como aprovada. Nenhum código desta missão foi
publicado. Artefato local: fonte SHA256
`bdfe6a94a68d074bbc6417bb17ea96d49370bb21ec1ea8ed2fb2a00414a3bbb1`,
HTML preparado `1ae1c7b9fe4d3f162f32b5937eb89e266cf8a08cd8db2833faaacf0279c32b9d`.

## Pendências e plano de publicação — não executado

Antes de publicação/ativação real, Júlio/Roberta precisam conferir as Rules
publicadas e negar acesso direto às coleções internas, inclusive
`google_calendar_admin_calendars_state` e `_channels`; confirmar grant central
efetivo e ACL writer/owner dos calendários; e verificar o vínculo de Carlos.
Scopes existentes: openid, email, calendar.calendarlist.readonly,
calendar.events.freebusy e calendar.events. Calendar ID não é senha; access e
refresh tokens permanecem no backend. Sync token é cursor; channel token verifica
notificações. Não copiar tokens para o portal.

Após aprovação específica: backend primeiro, validar SHA/health e serviço; em
seguida frontend pelo pipeline oficial e comparar HTML/recursos com o artefato.
O frontend atual aceita o backend novo; clientes antigos mostram diagnóstico
genérico para o novo enum de escopo, sem liberar horários. O frontend novo também
aceita o backend anterior. Sem migração ou mudança de dados/credenciais nesta
entrega. Rollback de código coordenado aos SHAs de base acima, sem reverter dados
ou configurações sensíveis. Não há autorização de publicação nesta missão.

Limitações: Google real, consentimento efetivo, ACL, Rules publicadas, entrega do
webhook e SSE autenticado pelo Render continuam dependendo de validação controlada
autorizada. O emulador de QA não possui Rules e não comprova essa proteção.
