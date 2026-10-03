# FORJA — frontend oficial

INVESTIGAÇÃO ATUAL: o teste real ainda falha. Não concluir que source da semana
comprova confirmação de cada período. Auditoria temporária scripts/temporary-*
somente nesta branch, job manual read-only-firestore-audit na validação.
Hosting Preview está suspenso por false && durante esta auditoria; produção não
foi alterada. Remover job/scripts/chave pública e restaurar o gate original antes
de qualquer merge futuro. Não enviar este script ao backend: redeploy inicia
maintenance/sync. Nenhuma escrita em Firestore/Auth/Google autorizada.

Revisão atual do PR #2: CSS real forja-v630-style e fonte de disponibilidade
publicada corrigida no PR #2 separado do backend. Não usar mais o modo de Preview
production-unchanged para esta versão: o drawer exige published-week-v1 e health
6.31.0-secretaria-disponibilidade-publicada no Render Preview.
URL fornecida: https://forja-api-pr-2.onrender.com, configurada na descrição do
PR #2 para substituir somente o artefato Preview. Exigir checks públicos aprovados;
nunca copiar temporária para index.html.
Testes de CSS devem usar parser HTML/DOM real, nunca regex que extraia style de
strings JavaScript. Execute 20 testes Chromium e 17 testes pipeline. Relatório
exportReport deve manter seu CSS original sem #v630BookingRoot. Preservar demais
áreas, locks, sync, Auth e Firestore. Sem merge/main/produção.


Leia os três documentos em `docs/` antes de trabalhar. Este checkout é
`gokuoficialbr123-gif/forja-escola`; o backend permanece em `forja-backend`.

- Trabalhe no checkout existente; não crie worktrees sem solicitação.
- Base publicada: 6.30.0; release preparada neste PR:
  `6.31.0-secretaria-drawer-fluido`. Correção autorizada exclusivamente em
  Secretaria → Marcar aula, testes e infraestrutura necessária ao Preview.
  Não reconstruir o portal nem alterar aluno, professor ou Google central.
- Preserve Firebase Hosting/Auth/Firestore, backend Render e dados reais.
- Perfis: admin, teacher, psychologist, student, parent. Nunca crie staff.
- Agenda: azul Aula, verde Disponível, vermelho Ocupado. Eventos pessoais Google
  são privados. Preserve sync de cinco minutos e conexões individuais.
- Branch de revisão: `fix/secretaria-drawer-6.31.0`. Commit/push, PR e Firebase
  Preview autorizados. Não fazer merge nem push em main. A produção automática
  já está habilitada; um push em main publicaria produção e não está autorizado.
- Drawer: manter estrutura e campos montados; atualizar apenas dependências,
  invalidar consultas antigas, preservar foco/scroll e seleções compatíveis.
- Elegibilidade reproduz /profissionais/disponibilidade e POST /aulas:
  role student, active === true, matéria existente e active !== false,
  série compatível quando restrita, vínculo aluno_materias status !== inativo.
  Pacotes não carregados/falhos nunca autorizam fallback pelo catálogo.
- Preservar validação final, locks e sincronização existentes do backend.
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
  Execute também `node --test scripts/secretaria-drawer.test.mjs`, usando
  Playwright 1.56.1 e Chromium. Para instalação isolada e comandos, ver DEPLOYMENT.
  Os testes executam o código real do drawer com fixtures isoladas, sem rede
  de produção; não confundir isso com uma sessão administrativa autenticada.
  Antes de deploy, gere `.firebase-public/` com `node scripts/prepare-hosting.mjs`.
- A pasta publicada deve conter somente `index.html`. Documentação, scripts,
  configurações e credenciais nunca pertencem ao artefato Hosting.
- A URL temporária deve corresponder a HTTPS forja-api-pr-N.onrender.com. Não
  hardcode a URL do PR atual no portal, scripts ou workflow. Um Preview sem esse
  parâmetro deve falhar, sem recorrer à API de produção.
- PR somente frontend pode declarar exatamente o comentário
  `<!-- FORJA_PREVIEW_BACKEND=production-unchanged -->` na descrição.
  Nesse modo explícito, o artefato e a verificação usam a fonte integral e a
  API oficial, sem substituição. Ausência/conflito de parâmetro deve falhar.
  Um PR que altera backend continua exigindo seu Render Preview via comentário
  FORJA_PREVIEW_API_URL. Nunca presumir isolamento de Auth/Firestore.
- O workflow pós-Preview exige /health da versão esperada para o modo: novo
  backend Preview 6.31.0-secretaria-disponibilidade-publicada; histórico modo
  production-unchanged 6.30.1-cors-preview-forja-escola, CORS
  refletindo a origem Firebase, preflight 204 e /me sem token retornando 401.
- A release inicial tem marker e SHA-256 fixados no validador. Em uma alteração
  funcional futura autorizada, atualize a referência conscientemente e registre
  versão, diff, testes, publicação e validação pública no changelog.
- Um workflow aprovado não comprova o fluxo autenticado. Após deploy autorizado,
  confira a versão realmente servida e teste o comportamento afetado.
