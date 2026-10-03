# FORJA — frontend oficial

Leia os três documentos em `docs/` antes de trabalhar. Este checkout é
`gokuoficialbr123-gif/forja-escola`; o backend permanece em `forja-backend`.

- Trabalhe no checkout existente; não crie worktrees sem solicitação.
- A base é o `index.html` 6.30.0 idêntico à produção em 03/10/2026. Não recrie o
  portal, use mocks nem altere o HTML nesta etapa de infraestrutura.
- Preserve Firebase Hosting/Auth/Firestore, backend Render e dados reais.
- Perfis: admin, teacher, psychologist, student, parent. Nunca crie staff.
- Agenda: azul Aula, verde Disponível, vermelho Ocupado. Eventos pessoais Google
  são privados. Preserve sync de cinco minutos e conexões individuais.
- O próximo bug funcional é o drawer Secretaria → Marcar aula voltar ao topo.
  Sua correção não foi autorizada nesta etapa. Não amplie o escopo ao aluno.
- Não publique produção, faça merge ou push sem autorização. Produção está
  bloqueada enquanto `FIREBASE_HOSTING_ENABLED` não for `true` nas variables.
  PRs confiáveis do próprio repositório podem gerar Preview Channel; isso não
  depende da variável de produção. Commit/push da branch de preparação e PR
  foram autorizados nesta etapa; merge, ativação e produção continuam proibidos.
- Não crie service accounts, chaves ou secrets sem a autorização necessária;
  o usuário realizará a configuração inicial. Nunca copie valores para o Git.
- Não dispare D-2/WhatsApp, altere Rules, banco ou autenticação para testar UI.
- O workflow Preview pode substituir somente FORJA_API_URL no artefato gerado.
  A URL temporária vem do comentário FORJA_PREVIEW_API_URL na descrição do PR,
  nunca do index.html oficial. Use --preview explicitamente; sem ele a geração
  e verificação exigem os bytes originais de produção.
- Auth/Firestore continuam conforme o HTML original; Render Preview não comprova
  isolamento de dados. Teste somente leituras/CORS, sem dados falsos em produção.
- Execute `node scripts/validate.mjs` e `node --test scripts/pipeline.test.mjs`.
  Antes de deploy, gere `.firebase-public/` com `node scripts/prepare-hosting.mjs`.
- A pasta publicada deve conter somente `index.html`. Documentação, scripts,
  configurações e credenciais nunca pertencem ao artefato Hosting.
- A URL temporária deve corresponder a HTTPS forja-api-pr-N.onrender.com. Não
  hardcode a URL do PR atual no portal, scripts ou workflow. Um Preview sem esse
  parâmetro deve falhar, sem recorrer à API de produção.
- O workflow pós-Preview exige /health 6.30.1-cors-preview-forja-escola, CORS
  refletindo a origem Firebase, preflight 204 e /me sem token retornando 401.
- A release inicial tem marker e SHA-256 fixados no validador. Em uma alteração
  funcional futura autorizada, atualize a referência conscientemente e registre
  versão, diff, testes, publicação e validação pública no changelog.
- Um workflow aprovado não comprova o fluxo autenticado. Após deploy autorizado,
  confira a versão realmente servida e teste o comportamento afetado.
