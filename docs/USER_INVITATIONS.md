# Convites de acesso — PR #7, somente revisão/Preview

Backend coordenado: branch feat/convites-firebase-automaticos, base e235544.
Contrato/detalhes: [backend USER_INVITATIONS](https://github.com/gokuoficialbr123-gif/forja-backend/blob/feat/convites-firebase-automaticos/docs/USER_INVITATIONS.md).

Novo cadastro conserva os quatro perfis e todos os campos/endpoints do Issue #6.
Após HTTP201, exibe "Conta criada · Convite de acesso". accepted/emailSent=true
significa que o Firebase aceitou a solicitação, sem confirmar caixa de entrada.
Falha/chave ausente: cadastro permanece, aviso e Copiar link de ativação quando o
backend conseguiu gerá-lo. Falha ao recarregar lista também não reabre cadastro:
confirmar a conta criada e orientar atualização. Reenviar convite fica no gerente
atual v616 → Acesso e segurança; usa reset-senha já existente e pode definir ou
redefinir senha. Não inventa estado de ativação. Pedidos para o mesmo UID bloqueiam
convite/reset enquanto pendentes; backend limita envios inclusive entre instâncias.
Redefinir senha/verificação/revogação/edição continuam com contratos anteriores.

## Preview seguro para aprovação

Metadado do PR: `<!-- FORJA_PREVIEW_BACKEND=invitation-demo -->`.
O workflow prepara somente `.firebase-public/index.html` via --invitation-demo:
retira os dois SDKs reais do Firebase e injeta double isolado antes da aplicação.
O HTML oficial/index.html e API oficial permanecem sem a simulação. Live não usa
variáveis/modo de Preview; hash/marker/sintaxe da produção continuam obrigatórios.
Somente Preview com metadado explícito do próprio repositório pode optar pelo demo.

Banner: "SIMULAÇÃO SEGURA DE CONVITES". Não precisa de login real. Cadastros/lista
são voláteis; envio/reenvio simulados. Nenhum fetch real, Auth/Firestore/e-mail,
XHR/WebSocket/EventSource/beacon. Apenas fontes/imagens públicas podem carregar;
nenhum link real de ativação. Modos: solicitação aceita, falha, chave ausente e
limite. Recarregar apaga cadastros fictícios. Não preencher dados pessoais reais.
É a UI real exercitada com mocks, não um banco de testes ou confirmação de entrega.

Roteiro: Cadastros → Novo usuário; conferir quatro perfis, matérias/vínculos,
selecionar resultado simulado no banner e criar com dados fictícios. Conferir
solicitação aceita/aviso/fallback sem duplicar conta. Depois Gerenciar → Acesso e
segurança → Reenviar convite. Conferir bloqueio durante pedido e Copiar link.
Desktop/celular. [Capturas](screenshots/user-invitations/README.md).

## Limitações/configuração/publicação futura

FIREBASE_WEB_API_KEY necessária somente no backend Render, nunca injetada neste
frontend. Ausente no workspace; presença real no Render não confirmada nesta tarefa.
Sem dependência/serviço de e-mail externo ou DNS novo. Firebase usa e-mail padrão
Password reset; remetente forjaescola.com.br fica fora deste escopo.
Teste emulado conclui senha e GET /me com login novo; envio/entrega real não testados
por proibição expressa. Links só em resposta/admin modal transitório, sem logs ou
armazenamento permanente. Não deduzir senha definida pela UI.

Somente após aprovação: merge/deploy backend primeiro, conferir health policy e
configuração de envio; merge frontend PR7 depois, validação/Hosting production;
conferir live sem forja-invitation-demo/banner, API oficial intacta. Teste real de
Júlio exige autorização separada. Recuperação por reenvio/link, nunca recriar conta;
rollback via PR/deploy autorizado sem apagar usuários. Nenhum merge executado aqui.
