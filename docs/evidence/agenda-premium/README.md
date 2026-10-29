# Evidências sintéticas — Agenda FORJA

Chromium real, Node22, identidades e respostas de API simuladas. Nenhuma captura
contém contas, tokens ou aulas reais. Não confundir estes cenários com validação
de OAuth, ACL, webhook ou Rules publicados.

`before-*`: fonte da main `4261022212c0717054af8a16e61b5d429110d8f6`, antes da missão.
[Reprodução mensurável anterior](reproduction-before.json): botão pessoal no
contexto institucional, aula online azul e mês do aluno excedendo o celular.

`{perfil}-{view}-{width}.png`: candidato desta missão. A matriz cobre 1920×1080,
1366×768, 768×1024, 390×844 e 360×800, Dia/Semana/Mês nos calendários existentes.
O responsável conserva a lista nativa autorizada do dependente.

| Perfil | Desktop | Celular | Mês no celular |
|---|---|---|---|
| Secretaria | [Dia 1366](admin-day-1366.png) | [Dia 390](admin-day-390.png) | [Mês 360](admin-month-360.png) |
| Professor | [Semana 1920](teacher-week-1920.png) | [Dia 390](teacher-day-390.png) | [Mês 360](teacher-month-360.png) |
| Aluno | [Semana 1366](student-week-1366.png) | [Dia 390](student-day-390.png) | [Mês 360](student-month-360.png) |
| Responsável | [Lista 1366](parent-list-1366.png) | [Lista 390](parent-list-390.png) | Lista preservada |
| Psicólogo | [Semana 1366](psychologist-week-1366.png) | [Dia 390](psychologist-day-390.png) | [Mês 360](psychologist-month-360.png) |

Os cartões incluem presencial, online e modalidade ausente. O título “Online no
nome não define modalidade” é deliberadamente sintético e permanece neutro.
Sessão psicológica continua sessão, sem modalidade de aula inventada. A matriz
do professor inclui o legado; testes institucionais separados exigem ausência de
Conectar/Sincronizar/Diagnóstico pessoais mesmo com metadados herdados.

As capturas `agenda-events-*` complementam a evidência do transporte existente.
O cenário institucional está nas capturas
[desktop](../institutional-calendar/agenda-teacher-desktop.png) e
[celular](../institutional-calendar/agenda-teacher-mobile.png) da suíte própria,
com fonte institucional e transporte por eventos simulados.
Os testes verificam cinco ciclos, reconexão, múltiplas abas, isolamento,
validade, drawer e retenção de formulários; imagens isoladas não provam esses
comportamentos. Os controles de disponibilidade e os detalhes permanecem nativos.

## Revisão complementar de 29/10/2026

Capturas Chromium sintéticas após correção da compactação mensal psicológica,
cabeçalhos dos dias e limites dos rótulos do eixo:

- [Psicologia, mês 360px](review-2026-10-29/psychologist-month-360.png).
- [Psicologia, mês 390px](review-2026-10-29/psychologist-month-390.png).
- [Secretaria, dia 390px](review-2026-10-29/admin-day-390.png).
- [Professor, dia 390px](review-2026-10-29/teacher-day-390.png).

Disponibilidade não confirmada permanece neutra. A barra inferior é fixa no
viewport; numa captura de página inteira ela aparece na posição da primeira
tela. Os testes verificam por hit-test que a última data pode ser rolada para
cima dessa barra e acionada. Texto operacional completo permanece em aria-label
e title; no mês estreito, "Disp." não significa confirmação de disponibilidade.
