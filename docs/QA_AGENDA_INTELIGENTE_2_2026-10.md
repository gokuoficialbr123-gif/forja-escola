# QA local — Agenda Inteligente 2.0 — 20/10/2026

Código preparado, sem publicação. Bases e contrato em
`AGENDA_INTELIGENTE_2_2026-10.md`. Branch `codex/agenda-inteligente-2` nos dois
repositórios. Nenhum teste usou contas, credenciais ou dados reais da escola.

## Resultado final

| Suíte | Passaram | Falharam | Ignorados | Duração |
| --- | ---: | ---: | ---: | ---: |
| Backend unitários | 308 | 0 | 0 | 11,1s |
| Backend integração HTTP/Auth/Firestore + portal pareado | 265 | 0 | 0 | 488,3s |
| Frontend completo, incluindo navegador | 363 | 0 | 0 | 524,5s |

Total: **936 testes aprovados**. Contagens não somam reexecuções focadas.
Ambiente: Windows, Node22.23.3, Playwright1.56.1, Chrome155.0.8059.80 headless,
Firebase CLI15.32.1/Java21, Auth9099 e Firestore8081 em `127.0.0.1`, projeto
`demo-forja`. Google/token/certificados e fronteiras externas simulados.
O Chromium baixado não iniciou neste Windows; a execução local usou o Chrome
instalado. O workflow Linux continua configurado com Chromium/Node22.
As duas suítes completas podem executar lado a lado, mas somente um runner de
integração escreveu nos emuladores. Benchmark executado separadamente.

Comandos Node22 executados, com os paths locais de Playwright/Chrome e hosts
dos emuladores configurados nas variáveis das fixtures:

```text
backend: node --test --test-concurrency=1 --test-reporter=tap test/*.test.mjs
backend: node --test --test-concurrency=1 --test-reporter=tap test/integration/*.test.mjs
frontend: node --test --test-concurrency=1 --test-reporter=tap scripts/*.test.mjs
frontend: node scripts/validate.mjs
frontend: node scripts/prepare-hosting.mjs
ambos: git diff --check
```

Os dois últimos comandos frontend somente validam/preparam arquivos locais;
não executam Firebase deploy. Arquivos legais, imagens e prova Search Console
continuam validados. SHA256 do fonte `index.html`:
`cd9da89e5d563b24f0e846ce152f090f04c6baafc844d19f5baa6706d88bcc60`.
SHA256 do HTML no artefato local:
`c834232e2125d53a7188b6e0356dbfae5dc81c0a4d2fb8116d4850bdbbcdd1d5`.

## Cobertura específica da missão

- Google opaco de dia inteiro, incluindo página posterior e fim exclusivo;
  cor verde ocupada e evento vermelho transparente livre, sem criar publicação.
- Bloqueio escolar integral/parcial e legado com somente uma hora; bloqueios
  manuais, aulas e disponibilidade explicitamente publicada preservados.
- Fontes falhas, respostas parciais, dados vencidos e transporte lento sem
  reiniciar TTL; nenhuma falsa disponibilidade nem sucesso global falso.
- Cache busy órfão ou credencial inativa também mantém a consulta do próprio
  professor desconhecida; ausência limpa continua não aplicável, sem limpeza
  implícita por leitura.
- Ciclo20s, pausa/retorno da aba, tela fechada, timeout15s inclusive no token,
  backoff de rede/quota e atualização após mutações confirmadas.
- Dois professores com estados independentes, múltiplas abas, troca de sessão,
  UID, semana e descarte de respostas atrasadas; canal privado fechado na sessão.
- Permissões HTTP, gates de consentimento/revogação/desconexão, Preview bloqueado,
  concorrência limitada, quota central reservada, reserva dos60 requests globais,
  limite de seleção/período/payload e interrupção de novos trabalhos após10s.
- Polling sem eventos Google escritos, sem importar busy ou modificar conexão
  persistida; preservação dos testes de locks, fencing, reservas, recorrências,
  cancelamento e recuperação.
- Desktop/celular sem overflow horizontal, legenda/rótulos após renderização,
  preservação de scroll/filtros e conteúdo em edição no drawer.
- Guards de hash e reversão exata do main otimizado; CRLF/LF corrigido sem mudar
  digest esperado. Paths/junction Windows mantêm validação de arquivo regular.

## Login antes/depois

Referência: main frontend `86134148337c4dfa9d9979cee734d5bb48a2cd30`, já com
login otimizado. Três contextos novos por viewport, CPU/rede sintéticas descritas
nos JSONs. O fonte depois corresponde ao SHA acima. Não são medições de produção
ou evidência estatística de melhoria; não representam cold start no Render Free.

| Mediana | Antes | Depois |
| --- | ---: | ---: |
| Login desktop | 1190,0ms | 1180,4ms |
| Login celular | 1386,7ms | 1375,7ms |
| Navegação Agenda desktop | 639,1ms | 639,1ms |
| Navegação Agenda celular | 1228,1ms | 1255,1ms |
| GETs iniciais do login | 14 | 14 |

Não houve consulta Google/polling antes de abrir a Agenda. A pequena variação
observada não justifica afirmar ganho ou regressão de velocidade.

Evidências no frontend:

- [Quatro estados — desktop](evidence/agenda2/agenda2-four-colors-desktop.png).
- [Quatro estados — celular](evidence/agenda2/agenda2-four-colors-mobile.png).
- [Desktop com consulta confirmada](evidence/agenda2/agenda2-desktop.png).
- [Celular com consulta confirmada](evidence/agenda2/agenda2-mobile.png).
- [Benchmark antes](evidence/agenda2/login-before.json) e
  [depois](evidence/agenda2/login-after.json).

Os profissionais/valores das imagens são sintéticos. As capturas foram
inspecionadas visualmente. Neste relatório copiado ao backend, as imagens/JSONs
permanecem no repositório frontend para evitar duplicação.

## Limites restantes e revisão

Nenhum fluxo autenticado, quota, consentimento ou latência de produção foi
validado. Quotas e caches são por instância; muitas visões independentes podem
entrar em429/backoff. Coleta incompleta, expirada ou lenta aparece amarela.
O limite10s impede novos trabalhos, mas não cancela SDKs em andamento. Histórico
nativo acima dos limites exige futura paginação/índices; não há migração nesta
entrega. A confirmação final permanece indispensável, pois Google/Firestore não
compartilham transação. Não prometer propagação Google em20s.

Textos de PR permanecem locais em `PR_AGENDA_INTELIGENTE_2_DRAFT.md`. Nenhum push,
PR remoto, merge ou deploy foi executado; gatilhos de Preview Render precisam ser
verificados antes da futura criação remota. Aguardar revisão e autorização para
publicar. Os SHAs de commits locais são informados na entrega final.
