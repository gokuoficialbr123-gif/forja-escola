# Convites de acesso — capturas Chromium, dados fictícios

Geradas pelos testes new-user-modal.test.mjs e invitation-demo.test.mjs, no portal
real com APIs/Auth simulados. Não foi criado usuário real nem enviado e-mail real.
As URLs/códigos visíveis são falsos e não ativam conta. Preservado o layout aprovado
no Issue #6. O banner da demonstração não entra no HTML/artefato de produção.

| Cenário | Desktop | Celular |
| --- | --- | --- |
| Solicitação aceita, sem alegação de entrega | [Ver](desktop-invitation-accepted.png) | [Ver](mobile-invitation-accepted.png) |
| Falha de envio, cadastro preservado e link manual | [Ver](desktop-invitation-unavailable.png) | [Ver](mobile-invitation-unavailable.png) |
| Reenviar convite em Acesso e segurança | [Ver](desktop-resend-action.png) | [Ver](mobile-resend-action.png) |
| Preview seguro com banner e fallback simulado | [Ver](desktop-safe-preview-fallback.png) | [Ver](mobile-safe-preview-fallback.png) |

Testes também cobrem chave ausente, limite de reenvio, falha/retry sem nova conta,
concorrência com Redefinir senha, quatro perfis e ausência de chamadas reais de
API/Auth/e-mail no artefato da demonstração.
