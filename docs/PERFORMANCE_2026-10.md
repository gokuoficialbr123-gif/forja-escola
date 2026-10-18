# FORJA mais rápida — medições e rascunhos de 18/10/2026

## Estado e limites

Bases publicadas conferidas no GitHub: frontend
`71dca65c19f41e8582561227e3ed4dd820f4839f`, backend
`9bb86ec0b834136279f346338ec7ab2667ba22e1`. PRs anteriores20/21 mergeados;
Etapa4 está na produção. HTML público byte a byte igual à base, SHA256
`43731860d9923001c68f097a76068e082c2c7aeaebc5cbe77161cd2732b790eb`;
health confirmou o SHA backend e central-booking-fail-closed-v1.

Esta missão não faz merge, deploy (inclusive Preview), OAuth real, mudanças de
Cloud/DNS/Rules/segredos/plano/custo nem QA com dados da escola. Não modifica
confirmação, cancelamento, recorrência, locks ou regras Google. Resultado
preparado em Draft; não confundir testes isolados com uso real validado.

## Método e antes/depois

Chromium, três contextos novos por cenário em desktop1365x900 e celular390x844,
CPU móvel4x, modelo de banda móvel1,6Mbps/desktop10Mbps. HTTP loopback real
para HTML/imagens, Brotli; Auth/SDK/API/Google simulados na fronteira. Rotas
sintéticas com120ms, auditoria/treinamentos/famílias com900ms; nenhuma informação
real. Os mesmos perfis e respostas são usados antes/depois. Interceptação de
requests desativa cache HTTP do navegador: não alegamos ter medido cache quente
de assets. O benchmark quantitativo é do administrador/Secretaria; regressões
funcionais dos demais perfis são mantidas, sem prometer o mesmo ganho numérico.

Fonte baseline é reconstruída pelo guard reversível, com hash exato publicado.
Fonte/artefato novo são derivados pelo build validado; não servir um mock de portal.
Medições ocorreram antes da execução concorrente das regressões. Valores abaixo
são medianas de três amostras, em milissegundos; não são SLOs nem p95 de produção.
Dados individuais e modelo: `performance-2026-10-results.json`.

|Métrica|Desktop antes|Desktop depois|Celular antes|Celular depois|
|---|---:|---:|---:|---:|
|Primeiro conteúdo visível (FCP)|336|236|720|612|
|Primeira navegação autenticada|3548|141|3642|169|
|Portal/dados prontos|3576|1234|3733|1371|
|DOMContentLoaded|406.3|302.7|1677.6|1535.7|
|Tarefas longas na abertura|0|0|280|247|
|Entrar em Cadastros|71|47|147|129|
|Abrir Agenda/confirmar fonte central|244|220|498|487|
|Trocar semana/confirmar fonte central|231|226|472|533|

A mediana de dados prontos caiu aproximadamente65% no desktop e63% no celular.
A primeira navegação aparece após perfil/UID/permissões validados; o conteúdo
permanece em loading até ficar pronto. Não exibimos uma lista vazia como dado
carregado. O usuário pode escolher a área e mantém essa escolha ao concluir.

Cadastros e Agenda/troca de semana já têm renderização relativamente curta neste
modelo. As diferenças pequenas nessas latências não comprovam ganho; a consulta
central continua necessária, e a disponibilidade só é conhecida após sua resposta.
Há33 GETs no login antes/depois: não remover dados para fabricar números melhores.
A leitura semanal duplicada passou de duas para uma; a consulta central permanece
uma. Não havia freeBusy central antes da Agenda, e continua havendo zero.

HTML publicado:1.785.001→1.450.558 bytes (-18,7%). Brotli local do HTML:
285.117→230.761 bytes (-19,1%). Transferência inicial medida, incluindo logo e
headers do servidor local:285.417→264.411 bytes (-7,4%). Isso não representa uma
redução de19% em toda a página: arquivos separados também contam. A imagem
secundária decorativa carrega quando necessária. CSS e todos os scripts têm os
mesmos bytes/ordem da fonte nova; nenhuma minificação/transcodificação foi feita.

## Gargalos comprovados e mudanças

1. **Waterfall administrativo:** o wrapper de dados aguardava sucessivamente
   catálogos/base, Google pessoal, pedagógico, solicitações, pacote, famílias e
   semana. Fontes independentes se acumulavam na espera. O novo helper inicia
   essas cargas em paralelo somente para admin; os demais perfis conservam a
   ordem, com checagem de sessão antes/depois. Catálogos/dependências internas
   não foram removidos. Falha de uma fonte conserva a semântica de erro anterior.
2. **Interface bloqueada por dados secundários:** o overlay permanecia até todas
   as etapas. Após perfil válido mostramos shell/menus e loading honesto. As telas
   de trabalho não renderizam arrays ainda incompletos. Não antecipar autorização.
3. **Semana duplicada:** dois bind/ensure simultâneos chegavam à mesma leitura
   antes do cache ser preenchido. Compartilhamento apenas da Promise pendente,
   por UID+geração+perfil+semana, com limpeza em finally e no máximo32 entradas.
   Não é novo cache TTL, não compartilha dados entre usuários, não envolve POST
   de reserva nem reduz a atualização final sob locks. Refresh explícito permanece.
4. **Imagens repetidas no documento:** dois WebP ocupavam337.088 caracteres em
   oito data URLs. O build deriva dois arquivos de hash completo, sem alterar
   pixels; preload do logo, dimensões intrínsecas verificadas902x420/353x416 e
   lazy somente na arte decorativa. Script/CSS não foram extraídos. Allowlist
   explícita, nomes/hash/bytes, expansão reversível para a fonte validada e
   verificação pública dos assets evitam aceitar uma SPA200 como imagem válida.
5. **Sem tempo de aplicação por HTTP:** backend acrescenta apenas
   `Server-Timing: forja;dur=...`, monotônico e arredondado. CORS expõe esse
   metadado, sem mudar origens/autorização. Sem logging, UID, URL, query, token,
   conteúdo Google ou serviço de telemetria. Tempo medido até writeHead, exclui
   serialização posterior do corpo, download, TLS/rede/proxy e espera anterior
   ao processo Node. Não usar esse número isolado para culpar Google/Firestore.

Além disso, cargas de famílias/pacotes agora verificam a sessão nos catches:
uma resposta/falha antiga não pode apagar os dados do próximo usuário.

## Variante rejeitada e limitações

Foi ensaiada a extração ampla de CSS e do script principal como recursos
bloqueantes. Apesar de reduzir muito o HTML, a primeira exibição móvel piorou
(cerca de1,42s contra0,74s naquele ensaio). Essa variante foi descartada; não está
no artefato final. Lazy loading de módulos JS globais exigiria separar dependências
e o bootstrap, portanto não foi improvisado neste ajuste. O monólito ainda contém
muito CSS/JS e é uma oportunidade futura; não prometemos eliminação das tarefas
longas ou instantaneidade em redes lentas. O resultado final manteve só a extração
menor medida acima, preservando scripts/estilos integralmente.

Não há benchmark autenticado de produção nem volume real da escola. O total de
leituras foi preservado, mas parte delas passa a se sobrepor; manter os limites
e observar429/503 na infraestrutura Free após eventual publicação autorizada. Listas
completas/consultas por profissional continuam existindo; não introduzir paginação,
cache entre usuários ou mudanças de regra sem medir volume/latência e revisar
contratos. Google central já era on-demand; esta missão não o transformou em
culpado nem o retirou das decisões de disponibilidade/reserva.

## Render Free: frio versus aquecido

Duas leituras públicas não autenticadas do health deram TTFB277/290ms. O Hosting
público deu443ms e285.119 bytes comprimidos. São observações do ambiente via proxy,
não da rede de professores no Brasil. Não houve evidência de cold start, não
forçamos inatividade e não mantivemos o serviço acordado com ping. O plano Free
em Oregon é a informação de infraestrutura fornecida pelo proprietário.

Cold start anterior ao Node não desaparece com frontend menor. No modelo, se
/me demorar3.000ms em vez de120ms, acrescenta pelo menos2.880ms à validação do
perfil; é uma estimativa/simulação, não uma medida do Render. A interface não
libera conteúdo privado antes da identidade. Depois de publicação autorizada,
comparar TTFB/tempo total do cliente com Server-Timing em ações normais permitirá
separar espera externa da duração do handler. Plano/região/custos não foram
alterados; nenhuma recomendação de upgrade foi executada automaticamente.

## Regressões e publicação futura

Auth/Firestore demo-forja, Google simulado, servidor HTTP real. O fixture pareado
do backend agora testa o artefato real de Hosting e serve somente seus assets;
recurso ausente não recebe HTML fingindo ser JS/imagem. Verificar reservas,
remarcações, cancelamentos, recorrências, locks/concorrência, erro Google, UID,
callbacks atrasados e permissões. Chromium desktop/celular também compara estilos,
geometria e marca em público/login/cadastro e recusa verde após falha central.

Comandos frontend: `node scripts/validate.mjs`;
`node --test --test-concurrency=1 scripts/*.test.mjs`;
`node scripts/prepare-hosting.mjs`. Benchmark reproduzível:
`FORJA_PERFORMANCE_OUTPUT=/tmp/before.json node scripts/performance-benchmark.mjs --baseline`
e depois `FORJA_PERFORMANCE_OUTPUT=/tmp/after.json node scripts/performance-benchmark.mjs`.
Usar FORJA_PLAYWRIGHT_MODULE/FORJA_CHROMIUM_PATH do ambiente e não rodar outros
testes pesados em paralelo com medições. Backend: `npm test` e emuladores Auth/
Firestore com `npm run test:integration`; nunca npm start (D-2). Rodada local concluída: backend291 testes/subtestes unitários e253 HTTP; frontend305.
São828 casos individuais, sem contar21 grupos-pai, e zero falhas/skip/cancelamentos.
SHAs e CI finais são registrados nos PRs; não somar reruns como casos.

Compatibilidade: mesmos endpoints, mesmos corpos, API oficial inalterada,
sem migração. Backend de observabilidade primeiro é recomendável para medir,
mas o frontend não exige o header novo. Publicação futura só com aprovação,
SHA/CI exatos, registro das versões anteriores, Render LIVE e health/Auth/CORS,
depois workflow oficial Firebase e hashes do HTML+imagens. Legais/Search Console
permanecem. Recuperação de código/Hosting anterior não exige excluir usuários,
aulas, tokens ou dados; não executar rollback sem autorização. Nenhum Preview ou
produção foi publicado nesta missão.
