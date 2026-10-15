# FORJA — evidências e pendências OAuth, 15/10/2026

Nenhuma configuração Google foi alterada. Testing é o último estado informado pelo proprietário; o ambiente não tem acesso ao Console para comprovar o estado atual, Branding ou revisão de scopes. Não foram acessados tokens nem dados reais.

## Fatos do código

- Pessoal: openid, email, calendar.events.owned. PKCE, state atômico e OIDC; AES-256-GCM no backend. Consulta eventos para obter ocupado; cache minimizado e interface Ocupado. Eventos escolares gerenciados podem conter aluno, matéria/atendimento, local e Meet. Compartilhamento do calendário Google influencia visibilidade desses eventos.
- Central: openid, email, calendar.calendarlist.readonly; calendar.events.freebusy somente via consentimento adicional. CalendarList/associações operacionais persistem; freeBusy não persiste eventos ou ocupado no Firestore. Não participa do booking atual.
- PRs9 de consentimento pessoal ainda não publicados; não integrar automaticamente. A autorização Google existente não comprova ciência específica de acesso administrativo aos intervalos. Regularização e comprovação institucional continuam necessárias antes de declarar conformidade integral.
- PRs10 de desconexão ainda não publicados. A API atual pode ocultar falha local de exclusão; páginas precisam expor a limitação, sem promessa de remoção integral.
- Não foi encontrada integração de treinamento de IA no código; isso não comprova práticas externas. Firebase/Google/Render confirmados tecnicamente; Resend/Meta opcionais dependem de ativação operacional.

## Confirmações institucionais ainda necessárias

1. Uso/transferência para treinamento de IA por escola, equipes e prestadores.
2. Inventário efetivo de prestadores, dados recebidos, transferências e acesso operacional.
3. Pessoas/equipes com acesso humano e consentimentos/condições aplicáveis, incluindo Secretaria e suporte.
4. Procedimentos reais de retenção, exclusão, solicitações dos titulares e backups/restauração; bases legais e menores.
5. CNPJ/dados institucionais complementares: não é campo obrigatório do Branding Google, mas ainda deve ser conferido pela escola.

A escola confirmou finalidade agenda, ausência de venda/publicidade e aprovação temporária dos documentos. Não há autorização/comprovação para declarar Limited Use integral. Essas pendências não bloqueiam as correções independentes da Agenda.

## Google Cloud: sequência quando requisitos forem comprovados

1. Identificar projeto efetivo dos clientes pessoal/central; preservar Backend, Secretaria, Make e n8n. Firebase project_id sozinho não comprova propriedade dos clientes.
A política de produção Google também exige separar projetos de teste e produção. O Console precisa confirmar a organização efetiva de todos os clientes antes de qualquer mudança: o status do consent screen é do projeto, não uma liberação isolada de cada cliente. Não criar projetos nem mover clientes nesta rodada.

2. Branding: nome FORJA Escola, suporte adm@forjaescola.com.br, contatos reais do desenvolvedor e URLs públicas definitivas. Privacidade deve ser HTML público real. Termos são complementares se solicitados/configurados; CNPJ não substitui propriedade de domínio.
3. Provar propriedade dos domínios apropriados no Search Console e conferir Authorized domains, origens e redirects existentes. Não alegar propriedade de web.app/onrender.com inteiro.
4. Audience External para professores externos; conferir aviso que desabilita Publish app. Testing/In production e Publish branding são operações distintas.
5. Data Access/Verification Center: somente scopes já existentes; classificação e aprovação efetivas no Console. Preparar justificativa mínima por scope e vídeo do consentimento/uso, sem informações privadas. Não adicionar scopes nem prometer aprovação ou prazo.
6. Publicar Branding e Audience somente após critérios e declarações comprovados. Publicar não equivale a verificar scopes nem remove necessariamente alertas/limites. Não enviar verificação com declarações pendentes.
7. Teste autorizado pelo titular depois da liberação; tokens Testing com Calendar podem expirar em7dias. A mudança de status não renova automaticamente credenciais antigas nem comprova a causa do erro de Carlos.

## Domínio

forjaescola.com.br: CONNECT403 imposto pelo proxy mesmo após concessão de rede; TLS não comprovado. A API oficial rejeita essa origem com403 Origem não permitida. Conexão central valida frontend somente em web.app/firebaseapp.com e previews oficiais. Alteração de domínio exige revisão coordenada, preservando clientes e sem modificar DNS/e-mail sem autorização. web.app segue como alternativa comprovada para portal/API. A configuração pública do Firebase e o endpoint público Identity Toolkit foram consultados sem login: projeto forja-escola confirmado; forjaescola.com.br NÃO consta em authorizedDomains. Nenhuma chave pública do SDK foi exposta e nenhum segredo administrativo foi lido. Não alterar a lista antes de concluir e autorizar a preparação do domínio.

## Fontes oficiais consultadas

- https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
- https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance
- https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/workspace-api-user-data-developer-policy
- https://developers.google.com/terms/api-services-user-data-policy
- https://developers.google.com/identity/protocols/oauth2#expiration

Páginas oficiais retornaram HTTP200; cópias de auditoria locais não contêm configurações/credenciais do projeto.
