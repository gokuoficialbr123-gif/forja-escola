# QA — calendário institucional

Preparação local para PRs Draft; não comprova publicação ou validação Google real.
Node 22.23.3, Playwright 1.56.1, Chrome instalado. Auth e Firestore exclusivamente
em `demo-forja`, portas locais 9099/8081. Provedor Google simulado na borda HTTPS,
sem tokens ou contas reais. Todas as guardas, hashes e asserções preservados.

## Execuções

| Grupo | Resultado local |
| --- | --- |
| Backend, `node --test test/*.test.mjs` | 349 aprovados |
| Integração completa, serial, Auth/Firestore/Google simulado | 284 aprovados |
| Revalidação dos contratos centrais e institucionais afetados | 14 aprovados |
| Contratos institucionais após endurecimento final e projeção temporal | 4 aprovados |
| Callback OAuth, recuperação e contratos institucionais finais | 50 aprovados |
| Arquivo de login após reconhecer a guarda institucional externa | 26 aprovados |
| Frontend completo, `node --test --test-concurrency=2 scripts/*.test.mjs` | 516 executados: 513 aprovados inicialmente; três expectativas antigas corrigidas e revalidadas abaixo |
| Performance: login/público/cadastro inalterado e isolamento | 8 aprovados |
| Extração estática, reversibilidade e economia exata de bytes | 3 aprovados |
| Pipeline oficial e recursos estáticos, revalidação final | 33 aprovados |
| Seletor institucional do professor em desktop/celular | 2 aprovados |

Os grupos se sobrepõem; não somar essas contagens como cenários distintos.
As três falhas da execução completa foram: a mensagem esperada da nova guarda,
a comparação do cadastro de professor com o formulário anterior sem o campo
autorizado e o percentual relativo de extração de imagens após aumento de código.
O arquivo de login inteiro passou novamente (26). A comparação visual exata foi
mantida para login/público e cadastro não alterado (8); o professor tem regressão
própria desktop/celular. A extração passou a exigir a mesma economia absoluta de
bytes da base histórica com hash exato, mantendo também o requisito de 82% nessa
base (3). Nenhuma proteção de integridade foi removida.
O cenário extra de cadastro móvel foi adicionado após a execução completa; a
cobertura final contém 517 cenários frontend. Não houve uma segunda execução
integral local após essas correções apenas de testes: os arquivos afetados foram
revalidados, e a CI dos Drafts deve executar a cobertura final.
Após a suíte completa emulada, os últimos ajustes foram revalidados nos
componentes afetados e na suíte unitária backend completa.

HTML gerado e validado:
`9e8ea5be55f0be79df981f187a09ed86cc382d7432a4e1123d9f5d5265fc7df4`.
Treze scripts inline validados, páginas legais e verificação Google preservadas.
O HTML foi regenerado pelo procedimento oficial, mantendo a reversibilidade de
todas as camadas anteriores.
A execução completa local levou 22min54s com dois arquivos por vez. O orçamento
da CI frontend serial foi ajustado para 45min; backend para 20min, pois a suíte
emulada completa levou aproximadamente 14min, além da preparação do ambiente.

## Reprodução e regressões

- EOF normal do SSE: a regressão falhou antes; após corrigir a interpretação de
  encerramento inesperado, passou com retirada imediata da confirmação verde.
- Aba institucional oculta: a reprodução mostrou sete cartões verdes ao voltar
  sem novo canal confirmado. Após invalidar somente a confirmação institucional
  ao pausar, o mesmo teste passou com zero cartões verdes nesse intervalo.
- Espelho antigo e nova revisão OAuth: teste aguarda a nova coleta realmente
  começar e verifica que o binding novo não herda disponibilidade anterior.
- Reconexão da mesma conta: o teste reproduziu a recusa pela revisão antiga;
  passou após permitir recuperação com o grant atual, exigindo espelho novo.
  Outra identidade não herda o vínculo. Desativar/reativar muda a geração.
- PATCH/DELETE institucional sem ETag é recusado; `If-Match` conserva a versão.
  ID estável, replay de reserva e webhook não duplicam eventos/alterações.
- Importação de cancelamento Google sem propriedades privadas identifica a aula
  por vínculo persistido. Status nativo pendente/erro impede sobrescrita; aula
  sincronizada pode receber o cancelamento legítimo.
- Dia inteiro/múltiplos dias, cor Google irrelevante, transparência, duas fontes
  isoladas, paginação incompleta, 410, 403/429/Retry-After, retomada e leases.
- Cadastro de professor reserva apenas calendário livre, sem login Google
  individual, autorização fictícia ou ativação implícita. Outro vínculo não pode
  ser trocado por uma tela com seleção antiga.
- Nas quatro combinações Secretaria/professor e desktop/celular, a suíte nova
  exige ausência de consultas fixas por 100 segundos, cinco eventos com cinco
  consultas, nenhuma exceção JS e preservação do campo aberto no drawer.

Capturas: [Secretaria desktop](evidence/institutional-calendar/agenda-admin-desktop.png),
[Secretaria celular](evidence/institutional-calendar/agenda-admin-mobile.png),
[professor desktop](evidence/institutional-calendar/agenda-teacher-desktop.png),
[professor celular](evidence/institutional-calendar/agenda-teacher-mobile.png).
Todos os nomes, aulas, contas e agendas dessas evidências são sintéticos.

## Fora da comprovação desta QA

Consentimento institucional real e verificação do app OAuth; ACLs efetivas;
entrega/reconexão/renovação do webhook no Render com Google real; latência e
capacidade sob a carga real da escola. As Rules publicadas para as coleções
servidoras novas precisam ter a negação de acesso por clientes confirmada antes
de produção. Nenhuma Rule foi alterada.

A migração recusa aulas já ligadas a outro modelo/calendário e requer plano
específico nesses casos. Revalidação Google tem janela/validade e orçamento
conservadores; não equivale a atualização instantânea garantida.

Render verificado em leitura: branch de deploy `main`, Previews desabilitados.
Hosting existente exige PR fora de Draft para Preview e push em `main` para
produção. Os novos PRs devem continuar Draft. Nenhuma publicação foi executada.
