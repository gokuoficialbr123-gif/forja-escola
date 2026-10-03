# FORJA Escola / Projeto Júlio — frontend oficial

Registro de 03/10/2026, fuso America/Sao_Paulo. O usuário definiu
`gokuoficialbr123-gif/forja-escola` como repositório oficial do frontend.
O código foi preparado no checkout `/workspace/forja-escola`. A continuação foi
autorizada em `setup/firebase-hosting-6.30`, com commit/push, PR e tentativa de
preview. Merge, ativação da variável e publicação em produção continuam proibidos.

## Atualização: Firebase Preview conectado ao Render Preview

O backend está em revisão no PR #1 de forja-backend, commit
849a16f16df1d6bb1c860730f85f0b4e96346e31. O usuário confirmou o serviço Preview
com /health 6.30.1-cors-preview-forja-escola; produção segue no backend original.
Esta etapa autoriza atualizar e republicar somente o Firebase Preview do PR #1
frontend. Sem merge, ativação da variável ou deploy de produção.

O index.html oficial continua byte a byte igual à base e com a API oficial.
Apenas .firebase-public/index.html gerado para Preview substitui a única declaração
FORJA_API_URL. A URL temporária é um parâmetro na descrição do PR, não um valor
permanente do portal ou do workflow. O parâmetro precisa corresponder ao padrão
HTTPS forja-api-pr-N.onrender.com; faltando ou inválido, Preview falha.

validate.mjs mantém o hash original fixo. O hash do Preview é derivado da fonte
validada com a única substituição permitida; não se aceita hash arbitrário nem
um arquivo gerado sem conferir sua origem. Produção ignora a variável temporária
e continua exigindo os bytes originais. Ambos mantêm o mesmo marker frontend.
Quinze testes locais passaram, incluindo artefatos separados e rejeição de
alterações adicionais; resultados de publicação e integração constam no PR.

Auth, Firestore, Google Calendar e regras de negócio não foram modificados.
O banco/Auth continuam configurados conforme a base; não declarar isolamento
completo só porque a API está em outro serviço. Verificação pós-Preview é somente
GET/OPTIONS: health/version, CORS, preflight e /me exigindo autenticação.

O bloqueio inicial do secret descrito abaixo é histórico: run 37138923430,
tentativa 3, passou e criou o primeiro Firebase Preview. Não pedir outro secret.

## Origem e versão preservadas

A base é exatamente o `index.html` do pacote
`FORJA_6.30.0_BLOCO_A_SECRETARIA_MARCAR_AULA.zip`, também presente em
`ULTIMA_VERSAO_6.30.0` no backup completo de 02/10. O arquivo foi comparado com
o HTML realmente servido por `https://forja-escola.web.app` e copiado byte a byte.

- Marker ativo: `6.30.0-bloco-a-secretaria-marcar-aula`.
- Tamanho: 1.661.612 bytes.
- SHA-256: `447bef249c8e4ea839b133739311fcf68d271c0c6d8b4c482a650fcf35a22868`.
- JavaScript inline: dois blocos, ambos aprovados em verificação de sintaxe.
- O HTML, CSS, JavaScript, URLs de API, Firebase web config e regras da aplicação
  não foram alterados para colocar o frontend sob versionamento.

O marcador e o hash estão fixados em `scripts/validate.mjs`. Eles impedem
publicar por engano um protótipo, versão antiga ou arquivo diferente da base.
Uma futura mudança funcional autorizada deve atualizar a referência e o changelog
conscientemente; não remover a validação para fazer uma falha passar.

## Arquitetura

| Componente | Local/serviço |
| --- | --- |
| Frontend | `index.html`, portal existente com HTML/CSS/JavaScript inline |
| Hosting oficial | Site e projeto Firebase `forja-escola`, `https://forja-escola.web.app` |
| Autenticação/banco | Firebase Authentication e Firestore |
| Backend | `gokuoficialbr123-gif/forja-backend` |
| API | `https://forja-api-m1kq.onrender.com` |
| Publicação proposta | GitHub Actions → Firebase Hosting |

O backend e o `/health` público informavam 6.30.0 na auditoria. Os arquivos
`src/server.js` e `src/firebase.js` eram idênticos aos do ZIP 6.30.
`main` do backend estava em `d019898ccbdd598fc06b6df03fda4474eb5cdfb7`.
Os quatro documentos do backend foram commitados localmente em
`docs/forja-context-6-30`, commit `b75b7672bccfa901deeaed701d616bbd9098b9df`,
sem modificar os oito arquivos funcionais existentes. Não houve push ou merge.

## Contexto e regras de produto

Fontes: backup completo de 02/10, backup mestre e Firestore de 01/10, prompts
de continuidade/automação e documentação das versões 6.20–6.30. Conteúdo antigo
de 5.6/6.20 ou fallback de 15 minutos é histórico, não o estado atual.

- Preservar o projeto existente; não reconstruir, usar mocks ou recriar banco.
- Roles oficiais: admin, teacher, psychologist, student, parent. Nunca staff.
- Azul = Aula; verde = Disponível; vermelho = Ocupado.
- Eventos pessoais Google aparecem somente como Ocupado, sem título/descrição.
- Conexões Google individuais dos professores e webhook devem ser preservados.
- Fallback e refresh silencioso: cinco minutos. Scope atual: calendar.events.owned.
- Secretaria: disponibilidade multi-professor da 6.29 e drawer de marcação 6.30.
- Professor: base visual 6.28 com scroll corrigido e sync da 6.27.
- Aluno/responsável não recebem telefone pessoal do professor; não expor detalhes clínicos.
- Preservar correção de participação/remarcação com lessonShouldAutoCancel no backend.
- Não alterar Firestore, Rules, IDs, forjaId, disponibilidade ou dados legados nesta etapa.
- D-2/WhatsApp permanece preservado. Existe workflow D-2 ativo no backend;
  ele não faz parte da publicação do frontend e não foi executado por esta tarefa.
- OTP não deve ser ativado nesta etapa.

## Bug prioritário, ainda sem correção

O drawer Secretaria → Marcar aula volta ao topo após cada seleção.
`v630Render()` substitui o HTML inteiro do drawer, recriando seu contêiner de
scroll. A carga de horários também chama essa renderização no início e no fim.

O filtro de alunos pode recorrer ao catálogo/série quando faltam vínculos,
enquanto o backend exige matéria liberada em `aluno_materias`. O bloqueio de
scroll do body já existe; o movimento do fundo precisa ser reproduzido nos
contêineres reais antes de mudar CSS.

Uma futura correção deve manter o drawer montado, atualizar subseções, preservar
seleção/foco/scroll e alinhar o filtro com o backend. Preservar locks de agenda,
conflitos e sincronização Google. Nenhuma dessas alterações foi feita aqui.

Depois da Secretaria: Google central da escola, mediante análise dos scopes;
depois treinamento genérico baseado em Matemática Básica I, nivelamento adaptativo,
acompanhamento, cronograma e financeiro com requisitos confirmados.

## Infraestrutura preparada nesta etapa

`firebase.json` aponta explicitamente para o site `forja-escola` e para a pasta
gerada `.firebase-public/`. O artefato contém exclusivamente `index.html`.
A configuração aplica fallback de rotas para esse HTML, compatível com o
comportamento observado de uma rota pública arbitrária. A configuração antiga
do Cloud Shell não foi recuperada: headers/redirects personalizados ainda devem
ser conferidos antes de ativar o deploy. Nenhuma configuração publicada foi mudada.

O workflow de validação é reutilizado pelo workflow Hosting. Preview só recebe
credenciais em PR do próprio repositório; produção só em push de main.
Somente produção depende de `FIREBASE_HOSTING_ENABLED=true`; não ativamos essa
variável. O usuário informou a criação do secret Firebase. No primeiro job do
PR #1, ele veio vazio; a checagem de presença falhou, sem exibir seu valor e
antes de qualquer publicação. A leitura de metadados por API recebeu HTTP 403.
O PR e a branch foram publicados, sem merge. Ver diagnóstico em DEPLOYMENT.md.

Preview Channel publica uma cópia do HTML, mas continua usando os serviços reais
configurados no arquivo. Não equivale a um banco ou backend de testes.

Validados localmente e no GitHub Actions: marker/hash/sintaxe, oito testes do
pipeline e geração do artefato. Actionlint também passou localmente. O Hosting
validou o artefato, mas preview falhou na presença do secret. Não executados:
autenticação Firebase, publicação de Preview Channel, deploy live e fluxo
autenticado da Secretaria. Ver DEPLOYMENT.md para resultados e desbloqueio.
