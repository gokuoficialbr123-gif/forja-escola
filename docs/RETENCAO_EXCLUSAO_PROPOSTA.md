## 15/10/2026 — Revisão para publicação autorizada

Documentos temporários aprovados, portados sobre #16/#17 publicados. Autorizações
históricas de somente Preview abaixo foram substituídas pelo protocolo atual.
Pendências institucionais continuam pendentes, sem declaração Limited Use integral.
Privacidade descreve a falha parcial de desconexão existente; PRs9/10 não entram.
URLs públicas verificadas somente após o workflow concluir. Nenhuma configuração
Google, DNS ou integração foi modificada.

# Política temporária de retenção e exclusão — FORJA Escola

Atualização de 10/10/2026 no PR frontend #8. **Júlio aprovou a Política de
Privacidade temporária preparada anteriormente, incluindo esta proposta.**
Critérios concretos e procedimentos operacionais ainda precisam de confirmação;
aprovação do texto não comprova implementação. Não executar exclusão ou criar
automação. Sem merge, produção, mudanças OAuth ou dados reais.

## Informações fornecidas pela escola

- Identificação registrada informada: **FORJA Escola**. Isso registra a informação
  fornecida, não comprova conferência cadastral. CNPJ ainda não conferido.
- Contato oficial ativo/autorizado: `adm@forjaescola.com.br`.
- Política de Privacidade e Termos temporários aprovados por Júlio; os
  procedimentos não são considerados implementados só pela aprovação do texto.
- Finalidade dos dados Google Calendar confirmada por Júlio: uso exclusivamente
  nas funcionalidades de agenda do FORJA Escola.
- A escola confirmou que não vende dados Google Calendar nem os usa para publicidade.
- Conformidade integral Google Limited Use permanece pendente: verificar
  treinamento de IA, compartilhamento com terceiros e acesso humano; não presumir
  que as confirmações da escola comprovam práticas de todos os prestadores.

## Fatos técnicos verificados por leitura do código

Base histórica auditada: `3c816cf3080f3fddd77ea9913a3f36419ae3baf3`.
Revisão atual também sobre backend publicado `2f415feadad109f233911c11e575cd1192d3a105`; nenhuma rotina de exclusão nova foi incluída.
Não consultar documentos pessoais, executar rotas ou testar exclusão em produção.

| Evidência | Alcance observado | Limite da conclusão |
| --- | --- | --- |
| `src/server.js`: PATCH `/admin/usuarios/:uid/arquivo` e `/status` | Arquivamento/desativação controla acesso; arquivar preserva histórico. | Não equivale a eliminação. |
| `src/server.js`: DELETE `/admin/usuarios/:uid` | Admin, somente teacher/psychologist; exige confirmação e ausência de agenda ativa. Remove Firebase Auth, perfil e subcoleção histórico do usuário. | Não percorre todos os dados relacionados, arquivos, calendário Google ou backups. Não é procedimento completo para direitos de todos os titulares. |
| `src/server.js`: DELETE `/google/calendar/connection`, `clearGoogleBusyForProfessional` | Tenta revogar, encerrar monitoramento e remover conexão/cache pessoal; falhas podem ser parciais e mascaradas na resposta atual. | Não elimina automaticamente histórico escolar nem todos os eventos previamente criados no Google. |
| `src/google-secretaria.js`: `/disconnect` | Substitui documento central removendo credencial; preserva catálogo/associações. | Não revoga grant Google global nem apaga toda configuração. |
| Revisão de fonte/configuração versionada | Não demonstrada uma política geral de expurgo por tempo para registros escolares. | TTL/cache/limpeza de operações específicas não comprovam política geral de retenção. |
| Backups, exportações, versões e restauração | Configuração efetiva dos provedores e inventário da escola não verificados. | Não afirmar existência/ausência de backups, periodicidade, prazo ou eliminação integral. |

As seções de fatos técnicos da página pública descrevem essas evidências. A
política temporária aprovada fica em seção distinta, `#retencao`, marcada como
`temporary-approved`, distinguindo orientações aprovadas de procedimentos ainda
propostos/não comprovados.

## Orientações temporárias aprovadas e procedimentos a confirmar

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
backups ou procedimento já implementado foi criado ou presumido. Aprovar essas
orientações não autoriza operações destrutivas, não comprova obrigações concretas
nem aprova declaração integral Limited Use.

## Confirmações necessárias antes da versão definitiva

- CNPJ e dados cadastrais complementares da identificação informada.
- Critérios concretos de retenção por categoria de dados; o texto temporário já
  está aprovado, mas sua operacionalização continua pendente.
- Obrigações de conservação aplicáveis e bases legais; tratamento de registros
  de atendimento e de menores, representação e acesso dos responsáveis.
- Responsável/equipe, método proporcional de verificação, registro e comunicação
  das decisões. Nenhum prazo legal específico é inventado nesta proposta.
- Inventário real de armazenamento, arquivos, backups, exportações e versões;
  capacidades dos provedores, limitações de exclusão e cuidados em restauração.
- Prestadores, localização/transferências e práticas de acesso humano.
- Verificação independente das demais restrições Limited Use (treinamento de IA,
  compartilhamento com terceiros e acesso humano), antes de declarar conformidade
  integral; demais condições institucionais ainda não comprovadas.

O email, a finalidade Google exclusiva de agenda e a aprovação do texto
temporário estão confirmados. Implementação, critérios concretos e verificação
de conformidade são etapas distintas. Nenhuma exclusão, alteração de dados,
merge, publicação em produção ou ação Google é autorizada por essa aprovação.
