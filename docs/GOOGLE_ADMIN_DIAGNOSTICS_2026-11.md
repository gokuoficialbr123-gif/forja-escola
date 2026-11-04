# Diagnóstico administrativo Google — somente Draft

Base frontend: `46c86e9f1ed6d158f3875ac5b79056a7d4fd7867`.
Backend coordenado sobre `cbdb28e0d75274b6e0e4ff188543fe72dd60cc1b`.
Branch: `codex/google-integration-diagnostics`. Não publicado.

## Uso e limites

Agenda geral → Fontes e diagnóstico → Verificar integração Google → selecionar
o professor → Consultar requisitos. Com um único professor selecionado na Agenda,
ele vem pré-selecionado no modal. Nenhuma leitura é iniciada apenas por abrir.

São executados somente os GETs administrativos existentes de `central/status`
e `central/calendars`, este último com o novo parâmetro restrito `diagnosticFor`.
O backend realiza leitura projetada de metadados, incluindo os dois campos
técnicos de vínculo Google das aulas; não devolve documentos brutos ou IDs.
O painel mostra OK, Bloqueado ou Não verificado, com horário da consulta.
Não exibe UID/calendarId completos, tokens, conteúdo de aulas ou eventos.

Concessões registradas não comprovam a cobertura real ou autorização Google
ainda vigente. O relatório nunca autoriza ativação e não consulta a fonte
pessoal. Não chama atualização de catálogo, refresh OAuth, webhook ou sync.
Falha, resposta incompleta, backend antigo e respostas inconsistentes não
produzem aprovação. Respostas de seleção/sessão/modal anteriores são descartadas.
Atualizações da Agenda preservam o modal e não repetem o diagnóstico.

## Validação focada

Na conferência visual da demonstração foi reproduzido corte de descrições na
tabela mobile. A correção limita-se à largura e quebra de texto da tabela deste
diagnóstico. A regressão exige colunas dentro do modal e descrições com quebra
normal em 1366, 390 e 360px; nenhum layout da Agenda foi redesenhado.

Node 22.23.3; Chromium 141; portal real com fixtures e firewall de rede existentes.
Oito verificações de navegador: desktop/celular, consultas explícitas, clique duplo,
privacidade, falha HTTP/contrato antigo, cinco repinturas, mudança de seleção,
troca oficial de sessão e ausência do controle no professor. Backend: quatro
testes unitários e seis verificações HTTP/Auth/Firestore demo-forja emulados.
Nenhum teste utiliza conta ou dados escolares reais.

HTML regenerado por `scripts/agenda-intelligence-build.mjs`, incluindo as camadas
oficiais de navegação e calendário institucional. Os arquivos dessas camadas
alteram somente recibos/hashes de geração; não há mudança funcional nelas.
`scripts/validate.mjs` valida hash, 13 scripts e recursos legais. A nova regressão
integra a CI frontend existente; nenhum guard ou teste anterior é removido.

Publicação futura depende de revisão e backend primeiro. O frontend é compatível
com backend antigo por falha explícita no novo diagnóstico, sem modificar Agenda,
reservas, formulário de agendamento ou integrações dos demais perfis.
Reversão futura requer autorização e é somente de código, sem migração de dados.
