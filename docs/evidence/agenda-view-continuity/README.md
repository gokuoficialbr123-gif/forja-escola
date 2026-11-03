# Comparação com dados sintéticos

Código anterior: frontend `e4d1aeb1aef2835a145b01ce2c2a3f7e91408ff9`, extraído
diretamente do Git, sem acessar o site de produção. Código posterior: branch
`codex/agenda-view-continuity`. Portal real, fixtures existentes, semana fictícia
19–25/10/2026 com 56 compromissos curtos e sobrepostos. `manifest.json` registra
tamanho e SHA-256 dos arquivos visuais selecionados.

| Momento | Antes | Depois |
| --- | --- | --- |
| Retorno à Semana, nova leitura retida | [Desktop](before-admin-desktop-04-return-week.png), [celular](before-admin-mobile-04-return-week.png): cartões somem | [Desktop](after-admin-desktop-04-return-week.png), [celular](after-admin-mobile-04-return-week.png): ocupações e aulas preservadas com os prazos originais |
| Nova visão com parte das datas ainda não consultadas | Sem prova completa | [Mês pendente no celular](after-admin-mobile-02-month-pending.png): apenas a interseção comprovada é reutilizada, sem oferecer novos horários livres |
| Vencimento original durante falha/latência | Sem confirmação | [Histórico identificado](after-admin-desktop-05-original-expiry.png), nenhuma disponibilidade verde |
| Nova resposta comprova remoção | — | [Remoção autoritativa](after-admin-desktop-07-real-removal.png): cartões antigos eliminados |

Gravações completas da sequência Semana → Mês/HTTP 409 → Semana → vencimento →
recuperação → remoção: [antes desktop](before-admin-desktop.webm),
[depois desktop](after-admin-desktop.webm), [antes celular](before-admin-mobile.webm),
[depois celular](after-admin-mobile.webm). O GitHub pode oferecer download do WebM;
o arquivo pode ser aberto no Chrome. O vencimento é exercitado pelo relógio
controlado do Playwright; não se confunde com duração real da gravação.

O roteiro reexecutável é `scripts/agenda-view-evidence.test.mjs`. Para comparação
local, `FORJA_VIEW_BASELINE=1` usa exclusivamente o commit anterior indicado.
`FORJA_VIEW_EVIDENCE` seleciona um diretório local para capturas, vídeos e JSON de
transições sanitizadas. `FORJA_VIEW_SOAK=1` habilita a sessão adicional de pelo
menos dez minutos reais com duas abas, trocas de visão, foco, SSE, latência e
falha/recuperação de fonte. A sessão longa e a telemetria integral são entregues
no pacote local de evidências; não são dados de produção.

[Resumo da sessão final](soak-summary.json): 604.497 ms reais, 86 ciclos,
sete `changed` e sete `reconnect` recebidos na aba atual; sete novos `ready`
após fechamento do transporte e liberação do Web Lock. Uma única conexão
substituta compartilhada foi exigida em cada reconexão. Os relógios simulados
das duas abas foram alinhados sem relaxar as guardas de idade em produção.

Não há redesign ou modificação de CSS nesta correção. Os dados, contas,
calendários, SDK/API e respostas são sintéticos. Os testes usam bloqueio de rede
externa e não executam operações reais de agendamento ou sincronização.
