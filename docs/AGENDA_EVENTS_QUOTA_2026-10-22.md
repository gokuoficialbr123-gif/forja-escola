# Agenda: eventos nativos e revalidação com quota

Código preparado para revisão, **não publicado**. Bases: frontend
`8d7c3cee3a07acd7a9b543a6df1f5077b873bfef`, backend
`d1483037be294428ab1af7788311f42389790c1a`.
Branch coordenada: `codex/agenda-events-quota`. Não repetir nem substituir os
PRs 29–31. Nenhuma mudança em Rules, OAuth, DNS, infraestrutura ou dados reais.

## Defeitos reproduzidos antes da correção

- ADM consultando uma semana ampla e Professor consultando um dia do mesmo
  calendário consumiam duas coletas por ciclo. Em três ciclos de 20s, o teste
  `quota regression` falhou com `CENTRAL_FREEBUSY_RATE_LIMIT`: excedia quatro
  inícios/minuto, mesmo sendo possível compartilhar a consulta Google.
- O Chromium executando o cliente publicado anterior enviou três requisições
  quando deveria manter apenas a primeira durante `Retry-After: 75`.
  A regressão permanente executa essa comparação com
  `FORJA_AGENDA_EVENT_BASELINE=1`, usando apenas o script histórico extraído do Git.
- O terceiro snapshot concorrente era recusado imediatamente. Erros internos
  de fonte eram convertidos em HTTP 200 parcial sem motivo/prazo de recuperação.
- Cache com idade próxima de 15s conserva menos de 25s de validade. Agendar
  outra consulta 20s após recebê-lo criava uma lacuna evitável de confirmação.

Isso reproduz caminhos compatíveis com o 429 observado. Sem os headers/códigos
das requisições da gravação não é possível atribuir cada 429 histórico ao limite
por IP, à concorrência ou à quota Google. Consentimento ausente é outra causa.

## Correção existente, sem sincronização paralela

`GET /agenda/changes` transmite somente tipo de aviso e uma versão opaca do
contexto. Usa listeners read-only do Admin SDK Firestore já existente, autenticação
Bearer no header, validação backend e `Cache-Control: no-store`. Não envia aulas,
nomes, títulos de eventos, busy, tokens ou calendários privados. Não cria coleções
ou escreve eventos. Aulas, disponibilidade publicada/fixa, bloqueios, calendário
escolar e mudanças de conexão invalidam a consulta; as integrações atuais seguem
sendo as responsáveis pelas escritas e pelo webhook Google.

O cliente agrupa avisos por 250ms, cerca respostas anteriores à alteração e usa
a versão opaca também para rejeitar broadcasts atrasados. Não remonta a página,
o drawer, os filtros ou formulários. O canal só abre dentro da Agenda visível;
troca de UID/geração/perfil/período, saída, offline e aba oculta cancelam transportes.
`navigator.locks` e BroadcastChannel privados por contexto compartilham um stream
e uma consulta simultânea entre abas da mesma sessão. Payloads de sessões/contas
diferentes não são compartilhados. Sem Web Locks continua havendo limites backend.

Google continua exigindo revalidação: o timer segue a **validade restante da fonte
menos 5s**, não um novo intervalo fixo após cada entrega. Dados novos com 25s de
validade normalmente geram consulta em cerca de 20s; eventos FORJA não aguardam
esse relógio. Há recuperação periódica se o canal falhar. Nenhuma alegação de
Google instantâneo: webhook e reconciliação existentes continuam com seus contratos.

O provider agrupa admissões simultâneas por 25ms, compartilha somente busy anônimo
compatível com credencial/fingerprint e projeta o resultado para cada período e
professor solicitado. As permissões são relidas. Aulas nativas continuam sendo
lidas e projetadas por ator/perfil em cada snapshot. Cache de fonte permanece
15s; TTL público permanece **25s originais**, sem prorrogação na entrega ou entre abas.

## Proteções e limites mantidos

- HTTP: 300/IP/5min, 90 consultas de Agenda/IP/5min e reserva dos últimos 60
  requests globais para comandos. O prazo de `Retry-After` reflete o reset real.
- Snapshot: duas coletas ativas; fila curta de até oito, no máximo duas esperas
  por UID e até 3s. Excesso continua retornando 429.
- Google pessoal: dois leitores ativos, fila de oito por até 2s, quatro inícios
  por professor/minuto; cache/coletas limitados a 32 entradas.
- Central: quatro coletas de tela dentro dos dez inícios/minuto por conta/provider;
  continuam reservados seis para verificações finais. Não aumentar quotas.
- Streams: até quatro por UID, 64 por processo, 1.024 watches compartilhados;
  heartbeat/autorização a cada 15s, expiração em quatro minutos, backpressure e
  reconexão limitada. A união de consultas simultâneas permanece limitada a
  42 dias e 50 professores; cada resposta contém somente seu escopo autorizado.
- HTTP 429 e respostas parciais com quota preservam prazo de recuperação. Google
  429 não provoca retries rápidos de tela; `Retry-After` também é respeitado nas
  falhas transitórias que o fornecem. Erros não viram busy vazio bem-sucedido.

Verde exige publicação e fontes necessárias confirmadas; vermelho mantém ocupações
confirmadas; amarelo representa consulta, erro, falta de consentimento ou vencimento;
cinza permanece fora da publicação; azul continua identificando aulas FORJA.
Locks, validação final, idempotência e integração de escrita não foram substituídos.

## QA e revisão

Node 22.23.3; Chromium desktop/celular; Auth/Firestore **demo-forja**; Google simulado.
Regressões: eventos/duas sessões/abas, cinco ciclos sem multiplicar handlers,
formulário preservado, 429 completo e parcial, consentimento central e pessoal,
offline/online, snapshot atrasado e ocupações de dia inteiro/múltiplos dias.
As suítes existentes cobrem confirmação, duplo clique, conflitos e locks.

Evidências sintéticas em [evidence/agenda-events-quota](evidence/agenda-events-quota/).
Resultados finais e comandos em `AGENDA_EVENTS_QUOTA_QA_2026-10-22.md`.
O gerador oficial e os hashes/guardas reversíveis permanecem obrigatórios.

## Limitações e publicação futura

Não houve OAuth, consulta autenticada à escola ou escrita Google real. É necessária
validação real autorizada do stream através do proxy Render, inclusive cold start,
reconexão e múltiplas instâncias. Coalescimento, quotas e watches são locais ao
processo; não representam quota distribuída. Muitas janelas sem cobertura comum,
ou uma quota Google efetivamente esgotada, podem continuar desconhecidas. Isso
não autoriza mostrar verde. Monitorar consumo de leituras/watches antes de ampliar
a quantidade de profissionais simultaneamente visíveis.

O amarelo inicial até a primeira confirmação é correto. Consentimento pendente
continua exigindo ação autorizada da instituição/profissional; esta correção apenas
o diferencia de quota e rede. Uma conexão de avisos caída usa recuperação segura,
sem prometer entrega instantânea ou sem perdas.

Preparar somente PRs Draft. Publicação futura coordenada requer aprovação,
backend compatível primeiro e frontend depois. Draft pula Preview Firebase;
Render está com previews manuais/desativados para criação automática. Não fazer
merge, Ready for review, deploy ou alterações de configuração nesta missão.
