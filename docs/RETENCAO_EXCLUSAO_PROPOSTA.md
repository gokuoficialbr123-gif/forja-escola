# Proposta inicial de retenção e exclusão — FORJA Escola

Rascunho de 10/10/2026, autorizado para preparação e revisão no PR frontend #8.
**Aprovação institucional pendente.** Não executar operações de exclusão ou criar
automação nesta tarefa. Sem merge, produção, mudanças OAuth ou dados reais.

## Informações fornecidas pela escola

- Identificação registrada informada: **FORJA Escola**. Isso registra a informação
  fornecida, não comprova conferência cadastral. CNPJ ainda não conferido.
- Contato oficial ativo/autorizado: `adm@forjaescola.com.br`.
- Autorizada a elaboração da proposta; não foi aprovada uma política definitiva.
- Declaração Google Limited Use permanece pendente e não foi modificada.

## Fatos técnicos verificados por leitura do código

Backend main auditado: `3c816cf3080f3fddd77ea9913a3f36419ae3baf3`.
Não consultar documentos pessoais, executar rotas ou testar exclusão em produção.

| Evidência | Alcance observado | Limite da conclusão |
| --- | --- | --- |
| `src/server.js`: PATCH `/admin/usuarios/:uid/arquivo` e `/status` | Arquivamento/desativação controla acesso; arquivar preserva histórico. | Não equivale a eliminação. |
| `src/server.js`: DELETE `/admin/usuarios/:uid` | Admin, somente teacher/psychologist; exige confirmação e ausência de agenda ativa. Remove Firebase Auth, perfil e subcoleção histórico do usuário. | Não percorre todos os dados relacionados, arquivos, calendário Google ou backups. Não é procedimento completo para direitos de todos os titulares. |
| `src/server.js`: DELETE `/google/calendar/connection`, `clearGoogleBusyForProfessional` | Solicita revogação, encerra monitoramento e remove conexão/cache pessoal. | Não elimina automaticamente histórico escolar nem todos os eventos previamente criados no Google. |
| `src/google-secretaria.js`: `/disconnect` | Substitui documento central removendo credencial; preserva catálogo/associações. | Não revoga grant Google global nem apaga toda configuração. |
| Revisão de fonte/configuração versionada | Não demonstrada uma política geral de expurgo por tempo para registros escolares. | TTL/cache/limpeza de operações específicas não comprovam política geral de retenção. |
| Backups, exportações, versões e restauração | Configuração efetiva dos provedores e inventário da escola não verificados. | Não afirmar existência/ausência de backups, periodicidade, prazo ou eliminação integral. |

As seções de fatos técnicos da página pública descrevem essas evidências. As
regras propostas ficam em seção distinta, `#retencao`, marcada como proposta.

## Regras propostas, ainda não aprovadas

1. Conservar pelo período necessário às atividades educacionais/administrativas
   relacionadas e obrigações legais realmente aplicáveis. Identificar finalidade
   e necessidade por categoria e rever a necessidade quando concluídas.
2. Receber pedidos de acesso, correção ou exclusão pelo contato oficial. Definir
   responsável, verificação proporcional de identidade/legitimidade, análise,
   registro de decisão e comunicação. Não afirmar que esse fluxo já existe.
3. Avaliar exclusão individualmente; identificar obrigações que exigem conservar
   parte dos registros. Quando cabível, avaliar execução por recursos disponíveis,
   documentar alcance/limitações e comunicar ao solicitante autorizado.
4. Considerar melhor interesse de menores, representação dos responsáveis,
   acesso restrito e minimização de dados/comprovantes. Vínculo cadastral não
   comprova sozinho todos os requisitos de representação ou bases legais.
5. Inventariar cópias efetivas antes de prometer exclusão. Se existirem backups ou
   versões, verificar recursos e obrigações; restringir utilização e documentar
   critérios. Eventual restauração deve considerar decisões prévias de exclusão.

Nenhum prazo fixo, ferramenta automática de exclusão/anonimização, expurgo de
backups ou procedimento já implementado foi criado ou presumido. A proposta não
aprova automaticamente operações destrutivas, obrigações ou texto Limited Use.

## Confirmações necessárias antes da versão definitiva

- CNPJ e dados cadastrais complementares da identificação informada.
- Aprovação institucional do texto e critérios por categoria de dados.
- Obrigações de conservação aplicáveis e bases legais; tratamento de registros
  de atendimento e de menores, representação e acesso dos responsáveis.
- Responsável/equipe, método proporcional de verificação, registro e comunicação
  das decisões. Nenhum prazo legal específico é inventado nesta proposta.
- Inventário real de armazenamento, arquivos, backups, exportações e versões;
  capacidades dos provedores, limitações de exclusão e cuidados em restauração.
- Prestadores, localização/transferências e práticas de acesso humano.
- Aprovação independente da declaração Google Limited Use e demais condições.

O email é confirmado. Todas as propostas acima permanecem em revisão. Aprovação
do texto e implementação de eventuais recursos futuros são etapas distintas;
nenhuma exclusão ou alteração de dados é autorizada por publicar um rascunho.
