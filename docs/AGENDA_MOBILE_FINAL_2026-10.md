# Agenda Premium — auditoria mobile final

29/10/2026. Base revisada: PR #34, `2f34b2d3be814aa030214b38dd291f07aa30c9ac`.
Somente demonstração local, Chromium/Chrome real, Node 22 e dados fictícios.
Nenhuma conta Firebase/Google, dado escolar, merge, Preview ou deploy.

## Causas reproduzidas e correções

1. Nos cartões mensais de aulas, o texto juntava intervalo e matéria/professor em
   uma linha estreita. Professor e Aluno cortavam o horário; Secretaria ocultava
   essa linha por estilo legado. A mesma renderização nativa agora inclui um
   horário compacto (`13h`, `13h30`), visível somente no mês em até 600px. O
   intervalo completo permanece no rótulo acessível, title e detalhe oficial.
   Não se mudou a grade, a modalidade, a duração ou qualquer cálculo de reserva.
2. A adaptação flexível/rolável do modal era limitada à Secretaria/Professor.
   Nas outras agendas o modal chegava a `y=-6px`, ocupando a altura inteira,
   e o rodapé podia encobrir opções finais do menu. A mesma adaptação existente
   foi aplicada às agendas Aluno/Responsável/Psicólogo somente em até 600px:
   margem de 12px, corpo rolável, cabeçalho e rodapé contidos. Desktop preservado.

Os números do mês foram medidos dentro de suas células e estavam corretos;
não foram alterados. O texto abreviado de matéria/professor no cartão é um
resumo com detalhe completo, não um corte do horário. A auditoria separa os
dois casos por medição do trecho de texto do horário, sem relaxar sua asserção.

## Matriz e parecer local

Larguras **360×640** e **390×844**, toque habilitado, cinco perfis. Dia, Semana e
Mês nos calendários existentes; lista nativa do Responsável. São 26 combinações,
com **216 verificações após a correção, zero falhas**. Os 42 dias de cada mês
foram rolados e verificados por hit-test real contra overlays/navegação fixa.
Antes: 216 verificações, 16 ocorrências dos dois problemas acima, incluindo
repetições entre perfis/larguras e medições do mesmo cartão.

| Critério | Resultado observado na demonstração |
|---|---|
| Textos e horários | Horário mensal íntegro; semanal/diário preservados; nomes longos acessíveis nos detalhes |
| Botões e sobreposições | Cartões, fechar modal e última opção de Mais atingíveis pelo navegador |
| Rolagem horizontal | Zero excesso da página; rolagem interna da semana preservada para os sete dias |
| Todos os dias do mês | 42/42 acessíveis em cada calendário/largura |
| Filtros e menus | Busca e toggles nativos utilizáveis; menu rolável até a última opção |
| Detalhes/modais | Dentro do viewport, sem excesso horizontal; conteúdo pode rolar sem esconder o rodapé |
| Navegação inferior | Não encobre cartões/datas/ações quando rolados para sua área de leitura |
| Cores/legendas | Paleta e legendas existentes mantidas; regressões Premium verificam cores exatas |
| Datas e aulas | Avançar/voltar período e abertura de aulas/sessões pelos handlers oficiais |
| Formulários/perfis | Regressões existentes de drawer, edição, cinco ciclos, scroll e sessão preservadas |

**Parecer mobile local: aprovado nessa matriz de Chrome com viewport/toque
simulados.** Não equivale a teste em aparelhos Android/iOS físicos ou teclado
virtual do sistema operacional. A confirmação pessoal do proprietário continua
disponível no localhost, com gravações e rede externa bloqueadas.

## Regressões e evidências

`scripts/agenda-mobile-final.test.mjs`: 12 regressões permanentes, **12 falhas
antes / 12 aprovações depois**, e nova rodada após restringir a alteração ao
mobile. Também verifica `13h30`, intervalo acessível e abertura nativa do detalhe.
Os 33 testes locais de pipeline/recursos passaram com guards e hashes intactos.
A suíte ampliada de 113 regressões e a CI integral são registradas pelos checks
e comentário técnico do PR; execução em andamento não é aprovação.
O workflow mantém todos os testes anteriores e acrescenta os 12 novos (562
testes de navegador esperados). Backend funcional não foi alterado.

[Galeria antes/depois e medições](evidence/agenda-mobile-final/README.md).
Fontes modificadas: stylesheet/client/gerador existentes; index e manifests
regenerados exclusivamente pelo procedimento oficial. Não criar outra Agenda.

O servidor local verifica o SHA e o hash exato do HTML commitado antes de servir.
As APIs/Auth são as fixtures existentes; nenhuma escrita ou sincronização real
é executada. Estes resultados não comprovam grant/ACL, Rules ou webhook reais.
