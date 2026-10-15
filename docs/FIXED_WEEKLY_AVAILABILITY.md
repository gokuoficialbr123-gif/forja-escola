## Revisão crítica de15/10/2026 — preparada, sem publicação

A precedência não mudou: documento semanal existente (inclusive vazio/rascunho)
impede herança automática. API agora informa hasSavedWeek/savedWeekEmpty também
à Secretaria; aviso na interface explica semana vazia/não publicada/publicada e
que o padrão não substitui esse registro. Leituras não apagam nem promovem legado.
Cancelamento implícito e classificação visual falsa identificados no main foram
corrigidos SEPARADAMENTE nos PRs17 backend/frontend. Devem ser compostos antes
da publicação da Missão1. Aulas antigas canceladas não foram restauradas.
Nenhum merge/deploy ou dado real utilizado.

# Missão 1 — disponibilidade semanal fixa (preparada, NÃO publicada)

Bases relidas em 15/10/2026: backend `1b4012d45ba3ae2d31c4214440307bff27564b4a`, frontend
`2d78aa0dd37e8db699d1b3e2f8cef9c1745f09de`. Branches próprias; PRs de rascunho.
Autorização somente implementação/testes. Sem merge, Firebase/Render deploy,
OAuth real, Google Cloud, DNS ou dados reais. PRs8–12 não são incorporados.

## Causa e escolha compatível

A fonte atual `disponibilidades_semanais/{base64url(uid|segunda)}` autoriza uma
semana concreta com receipt/hash. O campo de perfil legado `disponibilidadeSemanal`
não é prova de publicação. Copiar semanas automaticamente promoveria legado e
perderia a confirmação vinculada à data. Portanto, as semanas existentes são
reutilizadas como exceções explícitas, sem alteração/migração. O padrão é separado,
confirmado pelo dono, com resolução de datas somente na leitura. Não há expansão
em documentos semanais nem novos jobs/timers ou regras RRULE do Google.

## Modelo e confirmação

`disponibilidades_padroes/{uid}`: professionalId, revision, updatedAt.
Subcoleção `versoes/{revision}` imutável: professionalId, revision, enabled,
validFrom, validUntil|null, semana, exceptions, orderKey, publication.

`semana`: dias0–6, períodos inicio/fim HH:MM sem sobreposição, até12 por dia.
`exceptions`: até100 objetos kind=vacation|holiday|date, startDate/endDate inclusivos,
inicio/fim vazios para dia inteiro ou ambos preenchidos para subtrair intervalo.
Sem texto livre, motivo pessoal, eventos ou credenciais. Datas2000–2100.

`publication`: version1, fingerprintSHA256, confirmedById, confirmedAt servidor.
O hash cobre policy, America/Sao_Paulo, UID, revisão e configuração canonicalizada
completa. Aceite explícito, desmarcado inicialmente; editar remove o aceite.
O servidor exige accepted=true, UID autenticado e hash exato. Alterações diretas
sem receipt correspondente não autorizam períodos. Sem promoção de legado.

Transação compara expectedRevision, cria a versão e atualiza só o ponteiro. Escritas
concorrentes: um vencedor e409 para a revisão antiga. Nenhuma escrita retroativa:
validFrom deve ser hoje/futuro em São Paulo. Histórico anterior e aulas preservados.
Fim de vigência não reativa versões mais antigas.

Por data vale a versão com maior início efetivo, desempate por revisão. Uma versão
já programada para uma data futura continua valendo nessa data: editar uma versão
com início anterior não remove o agendamento futuro. Para substituí-lo, publicar
com o mesmo início. A UI informa essa regra e mostra as20 versões mais recentes;
todas permanecem armazenadas. Sem índice composto: consultas de campo único
orderKey=YYYY-MM-DD|revisão com12 dígitos. Máximo8 leituras de limite de versão
por semana, normalmente1; sem cache global compartilhado ou escritas na consulta.

## Precedência e significado

1. Semana explícita existente prevalece (inclusive semana vazia e rascunho).
   Legado/rascunho sem publicação não herda automaticamente o padrão e continua
   sem slots para novas aulas. Revisar/publicar a semana pelo fluxo existente.
2. Sem documento semanal: usar padrão confirmado, habilitado e vigente naquela data.
3. Exceções do padrão vigente subtraem períodos, inclusive numa semana explícita.
   Suspender/expirar o padrão não apaga nem suspende semanas explícitas existentes.
4. Calendário escolar, bloqueios manuais, Google pessoal, compromissos FORJA,
   conflitos do aluno, duração integral, futuro e locks continuam restringindo.

GET semanal preserva `items` para editar sem apagar períodos cortados por exceção.
`effectiveItems` é a configuração confirmada após exceções, ainda sujeita aos demais
conflitos; NÃO é confirmação de horário livre. `origins` por dia e `fixedRevisions`
identificam semana/padrão/nenhum. Secretaria usa os mesmos effectiveItems. Slots
realmente livres continuam sendo calculados SOMENTE pelo backend na consulta de
booking e revalidados dentro dos locks ao criar/remarcar.

## API e UI

- GET `/disponibilidade-padrao`: próprio professor/psicólogo ativo; admin ativo usa
  professionalId explícito somente para consultar. Cache-Control:no-store.
- PATCH mesma rota: somente próprio profissional ativo; expectedRevision,
  configuração e confirmation{version:1,accepted:true,fingerprint}. Admin não escreve
  como profissional. Aluno/responsável/inativo recusados.409 preserva formulário.
- GET `/disponibilidade-semanal`, GET `/admin/disponibilidades-semana`, consulta
  de slots e validação final usam o resolvedor comum. Contratos antigos preservados.
- Health: fixedAvailabilityPolicy=confirmed-recurring-week-v1. Policies de booking,
  OAuth/diagnóstico e central continuam intactas.

Agenda do professor/Disponibilidade do psicólogo: botão Disponibilidade fixa.
Editor com múltiplos períodos, vigência, exceções, histórico e confirmação.
Secretaria: consultar padrão de professor/psicólogo ativo, sem editar como outro UID.
Mapa de períodos efetivos tem UID+generation, revisão local e ordem das respostas;
respostas atrasadas não repovoam outra sessão. Sem localStorage/timer/polling novo.
CSS apenas #forjaFixedForm, stylesheet real; restante do portal preservado por hash
inverso estrito. API oficial e configuração Firebase não são trocadas na fonte.

## Google e limites reais

O padrão não cria séries infinitas de eventos Google. O espelhamento transparente
já existente de semanas explicitamente salvas e a sincronização de aulas continuam
inalterados. Ocupado pessoal só remove horários. Live check do hotfix14 permanece:
credencial inválida, rede/API/timeout geram indisponibilidade de consulta; nunca livre.
Não há nova exigência de consentimento pessoal/scopes, reconexão ou Etapa4 central.
Erro real do Carlos e OAuth403/Testing continuam dependentes de diagnóstico/ação
legítima do titular; esta missão não os corrige nem os presume resolvidos.

Não se pode validar escrita em Render Preview compartilhando produção. O bloqueio
somente leitura existente permanece, inclusive para a nova rota. Não foi criado
Preview nem alterado IAM/Rules; teste interativo nesta rodada somente local/demo-forja.
A proteção de Rules do projeto real precisa continuar negando acesso direto às
coleções internas; não é substituída por uma regra permissiva de emulador.

## Ensaios e publicação futura

Testes de unidade, HTTP real+Auth/Firestore demo-forja, Google simulado na borda e
Chromium desktop/celular. Ensaio pareado: profissional confirma no formulário,
psicólogo tem configuração própria, Secretaria consulta semana futura, drawer
cria aula real no emulador e a encontra novamente após reload. Nenhum usuário,
e-mail, aula, sync ou token real foi usado. Resultados finais nos PRs/changelog.

Publicação exige nova autorização: backend primeiro, health/API/contratos e SHA
LIVE verificados; frontend depois, validar hash/artefato oficial e jobproduction.
Nenhuma configuração Google nova. Habilitar padrão apenas após ambos publicados.
Recuperação deve preservar os documentos/aulas, sem exclusão automática; rollback
não está autorizado. Código antigo não entende o padrão: avaliar impacto antes
qualquer reversão após profissionais começarem a utilizá-lo.

## Achado fora do escopo (Missão3, não alterado)

`lessonShouldAutoCancel` atual cancela aula não iniciada após fim+15min, inclusive
confirmada; não depende somente da resposta do aluno. Reproduzido com quatro casos
sintéticos da função. GET aulas pode acionar a reconciliação existente. Não chamar
essa leitura autenticada real para QA. Regra não foi modificada nesta Missão1.
Recorrência de AULAS, cancelamentos por link e WhatsApp não foram implementados.
