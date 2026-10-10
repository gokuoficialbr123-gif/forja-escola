# Novo usuário — evidências visuais da issue #6

Capturas do Chromium com o portal completo, Firebase Auth e APIs simulados na
borda. Não representam dados/contas reais e não foram realizadas escritas no FORJA.
Base anterior: main 81265f9. Desktop: 1280 × 1000; celular: 390 × 844.

| Perfil | Desktop | Celular |
| --- | --- | --- |
| Antes | [Captura](desktop-before.png) | [Captura](mobile-before.png) |
| Professor | [Captura](desktop-teacher.png) | [Captura](mobile-teacher.png) |
| Psicólogo | [Captura](desktop-psychologist.png) | [Captura](mobile-psychologist.png) |
| Aluno | [Captura](desktop-student.png) | [Captura](mobile-student.png) |
| Responsável | [Captura](desktop-parent.png) | [Captura](mobile-parent.png) |

O celular captura o início do conteúdo; o corpo possui scroll interno, com
cabeçalho e rodapé disponíveis. A lista de matérias possui scroll próprio limitado.

Regeneração local opcional: definir FORJA_USER_SCREENSHOTS para a pasta desejada
antes de node --test scripts/new-user-modal.test.mjs. FORJA_USER_BASELINE_HTML
pode apontar ao index.html original para capturar também o visual anterior.
Os testes não dependem de screenshots ou de acesso Google/Firebase reais.
