# PR #30 — continuidade da consulta e vencimento da Agenda

Revisão autorizada em 22/10/2026, na branch existente
`fix/agenda-snapshot-yellow-flicker`. Base publicada:
`eb977f5482ba47d687046f8b49801dbe13876667`. Commit preparado recebido:
`3131e6c8230abe391aa757f06081263812e443a5`. Backend preservado em
`d1483037be294428ab1af7788311f42389790c1a`.

Código preparado não comprova publicação. O parecer final, checks do SHA exato,
merge, `production: success` e hash público serão registrados no PR antes de
considerar a entrega publicada. Nenhuma mudança backend, Rules, OAuth, DNS ou
configuração Google faz parte desta correção.

## Reprodução e revisão do código

Os dois testes originais foram executados contra o HTML histórico da main,
servido em loopback com identidades e APIs sintéticas. O SHA256 do fonte foi
conferido: `6b73c39bccd72d4c7e28ec15cd8443ff11393e7a6b551fc9ad66c74036f7fdb7`.
Ambos falharam: renovação retirava a confirmação antes do vencimento e a
remontagem apagava a última consulta completa. As asserções finais também
falharam nesse mesmo artefato histórico.

A revisão encontrou duas lacunas adicionais no commit preparado, embora sua CI
estivesse aprovada. Oito casos (admin/professor, desktop/celular) reproduziram:

1. **Verde vencido no DOM durante renovação.** A consulta automática começa em
   aproximadamente 20s. O timer antigo deixava de observar o vencimento enquanto
   o GET estava em voo. Com a resposta retida, os cartões ainda estavam verdes
   depois dos 25s originais. O prazo não foi ampliado: o mesmo controlador agora
   mantém o timer de expiração durante a consulta. Ao vencer, repinta desconhecido
   sem iniciar outro GET e sem criar um loop de timers.
2. **Resposta completa descartada durante desmontagem real.** Preservar o record
   em lifecycle não bastava: current/accept ainda dependiam da presença do cartão
   no DOM. O contexto existente agora vem do estado lógico da Agenda, não do nó
   visual. Assim a resposta da mesma sessão, papel, seleção, período e visão é
   aceita mesmo com o calendário temporariamente removido. A remontagem reaproveita
   essa resposta, sem consulta duplicada. O reset estrito quando não há contexto
   válido continua preservado.

O teste original de remontagem agora aguarda a promessa efetiva da consulta,
mantendo a exigência de confirmação completa. Os novos testes removem o nó real,
retêm a resposta, devolvem o nó e verificam o bloqueio novo na data correspondente;
não confundem esse bloqueio com disponibilidade válida nos outros dias.

## Segurança e estados

- Verde permanece somente enquanto o resultado daquele profissional é confirmado
  e ainda válido. O horário da última consulta completa não é reiniciado por
  remontagem nem por uma renovação pendente.
- Vencimento, erro de rede, resposta inválida, fonte incompleta e HTTP 403 não
  são convertidos em confirmação. Profissionais confirmados e desconhecidos
  continuam independentes em respostas parciais.
- UID/geração, perfil ativo, papel, período, profissionais e visualização fazem
  parte da propriedade existente da leitura. Trocas e saída da Agenda descartam
  respostas anteriores, inclusive quando o calendário está removido.
- Aba oculta continua suspendendo a leitura; múltiplas abas usam os mesmos locks
  do navegador e BroadcastChannel privados, com TTL restante, sem extensão.
- Intervalo normal de 20s, TTL máximo original de 25s, timeout e backoff originais
  preservados. O vencimento pode produzir amarelo legitimamente se uma fonte
  demorar mais que o restante do prazo. Não se prolonga verde para esconder atraso.
- Polling permanece GET somente leitura. Reservas, confirmação final, locks,
  idempotência e sincronizações de escrita nativas não foram modificados.

**Secretaria toda amarela também pode ser um estado legítimo.** Consentimento
Google pessoal ausente, conexão indisponível ou fonte central incompleta mantêm
o diagnóstico sanitizado existente e os horários desconhecidos. A revisão não
acessou contas reais e não determina a causa de um caso específico da escola.
As orientações de autorização continuam na interface; nenhum consentimento ou
scope foi contornado ou alterado.

## Testes e arquivos

Node 22.23.3, Playwright/Chromium, Auth e Firestore `demo-forja` emulados, Google
simulado. Os 21 casos focados e a suíte completa de 50 testes do controlador
passaram, sem falhas, cancelamentos ou testes ignorados. Quatro verificações
adicionais confirmaram explicitamente verde e vermelho durante a renovação,
desconhecido no vencimento e ausência de GET duplicado. A validação completa cobre todos os
`scripts/*.test.mjs` (distribuídos entre o controlador e os demais arquivos,
sem exclusões) e todos os `test/integration/*.test.mjs`. A integração completa
passou em 275/275 casos, com encerramento normal dos emuladores e sem falhas,
cancelamentos ou testes ignorados. Os demais 412 testes frontend também passaram:
**462/462 frontend** no total, sem exclusões, falhas, cancelamentos ou ignorados.
[Resumo dos resultados](evidence/agenda-yellow-flicker/validation.json).
Os checks do novo SHA e a prova de publicação serão anexados ao PR antes de
concluir a entrega.

Regressões permanentes: renovação dentro do TTL, vencimento com GET pendente sem
duplicar consulta, resposta durante remoção real, cinco ciclos após remontagem,
troca de período/profissional/perfil/conta/rota durante desmontagem, consentimento
ausente, HTTP 403, múltiplas abas, pausa, backoff e preservação do drawer.

Arquivos funcionais: `scripts/agenda-intelligence-client.js` e o hook de contexto
em `scripts/agenda-intelligence-build.mjs`. O teste existente é ampliado em
`scripts/agenda-intelligence.test.mjs`. `index.html`, os dois manifests e os pins
de validação/reversão são regenerados pelo procedimento oficial. Sem edição
manual do HTML e sem desativar hashes ou guardas.

[Prova de integridade](evidence/agenda-yellow-flicker/integrity.json): restaurar
apenas as mudanças de freshness e scheduling reproduz literalmente o cliente
da main; no gerador, somente o hook de contexto difere. CSS, script do drawer
e script de navegação são idênticos. A reversão completa continua terminando
no hash histórico obrigatório; backend e seu checkout permanecem intactos.

Fonte preparado SHA256:
`658a3a4f28baff5edb03379c94d2abbd394c162ad2186016748e43c34c23d511`.
Artefato Hosting preparado SHA256:
`7a7726639908ba650daa4830055dae3a641cd5b8285d83940939c3090d1403da`.
Preparação local não executa deploy; documentação e ferramentas QA ficam fora
do artefato público.
