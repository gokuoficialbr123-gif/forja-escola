# Evidências mobile — antes/depois

Chrome real, 360×640 e 390×844, toque simulado, portal real e dados fictícios.
Antes: frontend `2f34b2d3`. Depois: correção mobile `71ed83f` (mesmo HTML nas
revisões posteriores que acrescentam somente documentação/testes).

| Cenário | Antes | Depois |
|---|---|---|
| Secretaria, mês 360 | [captura](before/admin-month-360-card.png) | [captura](after/admin-month-360-card.png) |
| Professor, mês 360 | [captura](before/teacher-month-360-card.png) | [captura](after/teacher-month-360-card.png) |
| Aluno, mês 360 | [captura](before/student-month-360-card.png) | [captura](after/student-month-360-card.png) |
| Aluno, detalhe 360 | [captura](before/student-detail-360-top.png) | [captura](after/student-detail-360-top.png) |
| Responsável, detalhe 360 | [captura](before/parent-detail-360-top.png) | [captura](after/parent-detail-360-top.png) |
| Psicólogo, detalhe 360 | [captura](before/psychologist-detail-360-top.png) | [captura](after/psychologist-detail-360-top.png) |
| Responsável, menu 360 | [captura](before/parent-menu-360.png) | [captura](after/parent-menu-360.png) |
| Professor, mês 390 | [captura](before/teacher-month-390-card.png) | [captura](after/teacher-month-390-card.png) |
| Responsável, detalhe 390 | [captura](before/parent-detail-390-top.png) | [captura](after/parent-detail-390-top.png) |

[Medições anteriores](before/audit.json): 216 verificações, 16 ocorrências dos
problemas reproduzidos. [Medições finais](after/audit.json): 216 verificações,
26 combinações de perfil/visualização, zero falhas. O conjunto completo de
capturas de todas as combinações está preservado localmente em
`forja-backend/.qa-tools/agenda-mobile-final/`, sem dados ou credenciais reais.

Nomes longos continuam abreviados no resumo mensal, com texto e intervalo
completos no rótulo acessível e modal. Os horários compactos não perdem minutos:
13h00 aparece como 13h; 13h30 permanece 13h30. Cores e lógica de disponibilidade
continuam as mesmas. A barra inferior é fixa; as capturas selecionadas são de
viewport, e a acessibilidade de todas as datas é comprovada por hit-tests.
