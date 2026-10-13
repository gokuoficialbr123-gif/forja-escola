# Isolamento de disponibilidade por sessão — 13/10/2026, somente revisão

Base: frontend integration/google-agenda-2026-10-12 (2d9d21b). Branch própria
fix/availability-session-isolation; PR com base no ensaio, sem main/produção.
Apenas proteção de ciclo de sessão e caches; sem visual, regras de agenda,
Google OAuth/consentimento, Firestore, endpoints novos ou timers.

## Correção

Caches pertencem a UMA sessão ativa, com UID Firebase autenticado e geração
monotônica em memória. Logout ou troca de identidade invalida a geração,
cancela requests antigos, encerra modal/drawer/loading antigo e limpa dados e
rascunhos. Valores iniciais de runtime são capturados antes de carregar dados
privados; períodos/seleções de um usuário não são defaults para o próximo.
Logout/login com o mesmo UID também invalida a geração anterior.

API captura o ator antes de aguardar getIdToken, valida novamente antes de fetch,
e depois de decodificar a resposta. Resposta tardia é rejeitada mesmo se abort
não puder cancelá-la. Escrita que já chegou ao servidor pode concluir legitimamente
para seu ator original; não é desfeita nem aplicada à interface de outra sessão.
Escrita ainda esperando token/confirmacao não é enviada sob a nova identidade.
Sem alteração de autorização ou contrato de consentimento no backend.

Leituras/salvamentos semanais, caches teacher/admin, refresh e loaders validam UID
E geração antes de aplicar dados, erros e finalmente/loading. Carregamento antigo
de perfil não pode deslogar o usuário novo. Seleção de semanas tem sequência local:
resposta anterior na mesma sessão não troca a semana mais recente. Não há polling
ou persistência extra, migração de dados ou mudança de disponibilidade publicada.

## Provas

9 novos casos Chromium, HTML completo com fronteiras Auth/API sintéticas:
- desktop/mobile professor→psicólogo→admin→outro professor, sem F5;
- resposta e erro antigos não canceláveis depois de trocar UID;
- resposta antiga após sair/entrar novamente com o mesmo UID;
- perfil antigo falhando não desloga a nova sessão nem mantém overlay antigo;
- token atrasado não dispara PATCH sob outro ator;
- refresh administrativo antigo não repovoa caches de professor;
- seleção de semana antiga não substitui a seleção mais recente.

Regressões totais frontend:218 aprovadas, incluindo visual/scroll/drawer,
publicação, convites, Google pessoal e central e páginas legais. Guard de escopo
inverte somente mudanças explicitamente revisadas, preservando hash do portal
fora do escopo; hash atual em scripts/validate.mjs. Testes isolados existentes
instalam o runtime real de sessão, sem trocar guards por stubs permissivos.

Ensaio combinado no backend fix/agenda-lock-release: Auth/Firestore demo-forja,
Chromium completo, Google mockado; troca de UID sem recarregar e publicação
correta do psicólogo, login administrativo e persistência própria. Nenhum Google,
Firestore/Auth real ou dado real usado. Firebase/URLs de produção preservados.

PR base no ensaio mantém diff restrito à correção; PRs8/9/10 originais intactos.
Implantação futura somente após autorização: backend locks primeiro, verificar
API, frontend depois. Sem merge/deploy nesta tarefa. Google Testing, Limited Use
integral e Etapa4 não foram resolvidos por estas correções.
