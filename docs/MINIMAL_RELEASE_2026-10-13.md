# Opção B — release mínima da Agenda, 13/10/2026

Preparação autorizada; sem merge, deploy de produção, dados reais ou Google Cloud.
Esta opção substitui o pacote amplo para a próxima publicação, não apaga seus PRs.

## Bases e dependências

- Backend main:3c816cf3080f3fddd77ea9913a3f36419ae3baf3.
- Frontend main:959b72f6d5a398fa3c1f0fbc79a3ce0b2436f580.
- Backend branch:release/minimal-agenda-locks-2026-10-13.
- Frontend branch:release/minimal-availability-session-2026-10-13.

Não houve cherry-pick dos commits inteiros #11, cujas bases incluem consentimento,
desconexão e páginas legais. Backend importa SOMENTE releaseAgendaLocks de d86f153.
Seu corpo anterior coincidia exatamente com main. Todo o restante de src/server.js,
reposto o corpo original, mantém SHA256
b5d8cce0f3ac8512de21bad29cde2eebb7581aebbc42e3a67456f9d62f382848.

Frontend adapta SOMENTE o patch de sessão de a1fc253. Três contextos foram
separados das mudanças9/10: tratamento especial de desconexão na api e indicação
complete/unavailable de ocupado nos refreshes pessoais/administrativos. Nenhuma
dessas novas semânticas foi importada. Os41 passos revisados do patch de sessão,
invertidos, reconstituem byte a byte o index original com SHA256
3d6908cd807c5b2abf3a7620b2d4275738bb28931478e4340fe84c4557e6cf1f.

Não entram Etapa4, consentimento pessoal-v1, desconexão-v2 nem páginas legais8.
Scopes, clientes, PKCE/state/OIDC/AES-GCM, permissões, cadastros, convites,
disponibilidade confirmada e Google central existentes mantêm seu comportamento.
Não é necessário aceite novo ou reconexão por causa desta release.

## Alterações funcionais e regressões

Backend: todas as leituras transacionais dos locks antecedem os deletes.
Somente ownerToken correspondente é apagado. Aquisição/TTL45s/validação de conflitos
não mudam. Falha de cleanup fica visível por código estático sem dados privados;
resultado já confirmado é preservado para evitar duplicação por repetição.

Frontend: caches/estado privado pertencem ao UID e à geração da sessão; troca de
conta/logout limpam dados e abortam chamadas pendentes. Token tardio não envia uma
escrita usando outra identidade; respostas/erros tardios não repovoam caches,
inclusive logout/login do mesmo UID. Seleção antiga de semana não sobrescreve a
seleção nova. Campos, CSS, layout, endpoints e semântica Google são preservados.

159 unitários backend,111 HTTP/integrados e186 frontend passaram localmente,
sem falhas ou skips. O ensaio pareado está incluído nos111 testes HTTP. Fixtures compartilham o helper
original do booking, sem substituir servidor, Auth ou Firestore por respostas fake.
Emuladores somente loopback/demo-forja, child processes sem credenciais herdadas;
SDK do navegador redireciona login ao Auth emulator e API ao servidor HTTP local.
Google/e-mail externos continuam nos mocks de borda das regressões existentes.
Nenhum e-mail real foi enviado e nenhuma operação real foi executada.

Ensaio: legado sem nova exigência de consentimento nas consultas; criação sequencial
não sobreposta; concorrência com um vencedor; rejeição de conflito; remarcação,
cancelamento e persistência. Chromium: editor Disponível/Ocupado do professor,
formulário semanal do psicólogo, consultas administrativas e reload. Desktop/mobile,
UID/geração/token/respostas tardias cobertos na suíte completa do frontend.

Testes integrados usam arquivos em série para evitar disputa entre fixtures;
a concorrência real das marcações continua exercitada com requisições simultâneas.
CI backend faz checkout de um SHA imutável do frontend coordenado para o ensaio.
Não registrar skip como aprovação do teste pareado.

## Artefato, compatibilidade e limites

Hosting normal contém apenas index.html original com isolamento de sessão;
SHA256 novo:dc2feb95c6d056dceb25bb0864e5702d01281dc87765d83939debd63b3221d34.
API:https://forja-api-m1kq.onrender.com; Firebase:forja-escola.
Nenhum demo, usuário fictício ou armazenamento de demonstração é publicado.
A fonte funciona com o backend main atual; o backend corrigido mantém o mesmo
contrato. Não existem variáveis/configurações Google novas.

Preview frontend pode validar bytes/CORS com production-unchanged explícito:
aponta à API oficial existente, não é homologação física separada. NÃO usar esse
Preview para QA de escritas ou contas fictícias. Toda QA mutável desta preparação
foi local nos emuladores. Não criar serviço Render nem executar OAuth para testar.

Erro real de Firestore na limpeza ainda pode conservar lock até TTL45s: recuperação
existente, não defeito de leitura após escrita mascarado. Watch/sync/Google Testing,
problemas preexistentes de desconexão/consentimento e integração central ainda não
ligada ao booking não são resolvidos por esta opção. Não declarar Limited Use concluído.

## Publicação futura e rollback

Após aprovação explícita dos SHAs/checks:
1. Conferir main inalterado e Render oficial configurado para Auto-Deploy main.
2. Merge do PR mínimo backend→main; aguardar Render. Conferir SHA efetivamente
   implantado no painel e /health. O marker6.31.1 permanece e não prova sozinho o fix.
3. Merge do PR mínimo frontend→main; aguardar Firebase Hosting production success.
   Conferir hash exato/API oficial e carregar portal/login sem regressão.
4. Aceitação por operador autorizado, sem criação automática de usuários: horários,
   aulas consecutivas, conflito recusado, edição/cancelamento e troca de conta.
5. Parar e registrar resultado. Não aplicar automaticamente PRs8–12 antigos;
   deverão ser reconciliados com o novo main antes de qualquer publicação futura.

Rollback mediante autorização: revert dos commits/merges mínimos ou retorno às
versões/deployments anteriores, com fonte/hash do main acima. Nada apaga usuários,
aulas, disponibilidade, tokens ou associações. Como contratos não mudam, os dois
lados podem ser recuperados separadamente. Reverter fixes reintroduz os bugs de
locks/cache: usar como contingência explícita, não recuperação silenciosa.

## OAuth403 — auditoria separada, somente leitura

O código pessoal pede calendar.events.owned +openid/email. A central preserva
openid/email/CalendarList readonly e freebusy quando autorizado. Nenhum scope novo.
O403 access_denied na tela Google com aviso Testing para não testadores é compatível
com restrição de Audience, antes do callback FORJA. Estes dois fixes não a removem.

Não há credencial de controle Google Cloud neste ambiente: não foi inspecionado o
Console ao vivo. Estado Testing e erro atual são evidências informadas pelo
proprietário; código/documentação pública foram lidos, sem contas Google reais.
Make/n8n externos não podem ser auditados integralmente pelo repositório.

Caminho oficial para acesso sem cadastrar cada professor como testador:
- Projeto correto, Google Auth Platform→Branding: nome, contatos elegíveis,
  homepage pública, política de privacidade real, Authorized domains e propriedade
  requerida via Search Console. Não presumir propriedade dos domínios compartilhados.
- Páginas futuras:https://forja-escola.web.app/privacidade/ e /termos/. Hoje são
  fallback da SPA; PR8 está separado e não é publicado nesta opção.
- Escola confirmar práticas IA, transferências/prestadores e acesso humano, controles
  operacionais de retenção/exclusão/backups e declaração afirmativa Limited Use.
  Nome/contato/textos temporários/finalidade agenda/não venda/publicidade já confirmados.
  Consentimento explícito9 e desconexão10 continuam pendentes de publicação própria.
- Data Access/Verification Center: revisar classificação dos scopes EXISTENTES,
  cumprir verificação/justificativas/vídeo/exceções que Google efetivamente exigir.
  Não ampliar ou remover permissões dos clientes externos por suposição.
- Branding: concluir verificação e publicar branding; Audience: External→In production
  via Publish app quando habilitado e conforme exigências do Console. Marca e
  publicação de Audience são etapas distintas; não prometer ausência de avisos
  ou revisão de scopes apenas ao sair de Testing.
- Mudança de Audience é do projeto e pode afetar Backend, Secretaria, Make e n8n.
  Preservar IDs, segredos, URIs e grants. Inventariar clientes e coordenar testes;
  não recriar clientes/chaves. Tokens emitidos em Testing não são renovados pelo
  mero clique de publicação; conexões expiradas podem exigir reconexão pelo titular.

CNPJ não é campo obrigatório de Branding; Termos são opcionais no formulário
Google. Não substituem a política fiel ao tratamento real. Marca pode levar2–3 dias
úteis para verificação; escopos têm revisão própria. Não garantir liberação hoje.
Tudo acima é orientação; nenhuma configuração foi alterada.

Fontes oficiais consultadas em13/10/2026:
https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
https://developers.google.com/workspace/calendar/api/auth
https://developers.google.com/workspace/workspace-api-user-data-developer-policy
