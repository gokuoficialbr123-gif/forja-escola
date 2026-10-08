import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootDir, referenceVersion, referenceSha256, sha256, validate, validateInlineScripts } from './validate.mjs';
import { buildHostingArtifact, hostingOptionsFromArgs, prepareHosting, productionApiUrl } from './prepare-hosting.mjs';
import { verifyHosting } from './verify-hosting.mjs';
import { previewApiFromEvent, previewConfigFromEvent, validatePreviewApiUrl } from './preview-config.mjs';
import { assertVaryOrigin, verifyPreviewHealth, previewVersion, productionVersion, assertPreviewIsolation } from './verify-preview-backend.mjs';

const html = readFileSync(join(rootDir, 'index.html'));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'forja-pipeline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ['index.html', 'firebase.json', '.firebaserc']) copyFileSync(join(rootDir, file), join(root, file));
  return root;
}

test('base 6.31 passa em marker, hash, configuração e sintaxe', () => {
  const result = validate();
  assert.ok(result.inlineScripts > 0);
  assert.equal(result.bytes, html.length);
});
test('marker histórico em outro script não mascara uma release ativa errada', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'index.html'), html.toString().replace(`const VERSION='${referenceVersion}'`, "const VERSION='6.29.0'"));
  assert.throws(() => validate(root), /Marker da release ativa incorreto/);
});
test('mesmo marker com HTML diferente é recusado', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'index.html'), Buffer.concat([html, Buffer.from('\n<!-- alteração -->')]));
  assert.throws(() => validate(root), /HTML diferente da base/);
});
test('projeto Firebase diferente é recusado', t => {
  const root = fixture(t);
  writeFileSync(join(root, '.firebaserc'), JSON.stringify({ projects: { default: 'outro-projeto' } }));
  assert.throws(() => validate(root), /Projeto Firebase incorreto/);
});
test('pasta de publicação na raiz é recusada', t => {
  const root = fixture(t);
  const config = JSON.parse(readFileSync(join(root, 'firebase.json')));
  config.hosting.public = '.';
  writeFileSync(join(root, 'firebase.json'), JSON.stringify(config));
  assert.throws(() => validate(root), /Pasta publicada deve ser isolada/);
});
test('JavaScript inline quebrado é detectado', () => {
  assert.throws(() => validateInlineScripts('<script>const = ;</script>'), /JavaScript inline/);
});
test('artefato contém somente o HTML e sua preparação é repetível', t => {
  const root = fixture(t);
  prepareHosting(root);
  writeFileSync(join(root, '.firebase-public', 'nao-publicar.txt'), 'documentação');
  prepareHosting(root);
  assert.deepEqual(readdirSync(join(root, '.firebase-public')), ['index.html']);
  assert.ok(readFileSync(join(root, '.firebase-public', 'index.html')).equals(html));
});
test('verificação pública aguarda propagação e recusa bytes errados com mesmo marker', async t => {
  let body = Buffer.from('versão antiga');
  let calls = 0;
  const server = createServer((_req, res) => { calls++; res.end(calls === 1 ? body : html); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  await verifyHosting(url, { attempts: 2, delayMs: 1 });
  assert.equal(calls, 2);
  body = Buffer.concat([html, Buffer.from('alterado')]);
  calls = 0;
  await assert.rejects(verifyHosting(url, { attempts: 1 }), /HTML servido diferente/);
});

const previewApiUrl = 'https://forja-api-pr-42.onrender.com';
test('Preview Hosting requires current backend release before publication',async()=>{
  const calls=[];
  const result=await verifyPreviewHealth(previewApiUrl,{request:async(url)=>{calls.push(url);return new Response(JSON.stringify({ok:true,version:previewVersion,secretariaAvailabilityPolicy:'confirmed-week-v2',googleOAuthSecurityPolicy:'state-pkce-oidc-v1',googleSecretariaPolicy:'calendarlist-association-v2',googleSecretariaFreeBusyPolicy:'central-freebusy-query-v1',googleSecretariaStorage:{policy:'central-preview-isolation-v1',environment:'preview',namespace:'pr-42',ready:true,personalGoogleEnabled:false},googleCalendarConfigured:false,googleCalendarWebhookConfigured:false}),{status:200})}});
  assert.deepEqual(calls,[previewApiUrl+'/health']);assert.equal(result.version,previewVersion);
});
test('old release cannot pass the pre-deploy check',async()=>{
  await assert.rejects(verifyPreviewHealth(previewApiUrl,{request:async()=>new Response(JSON.stringify({ok:true,version:'6.31.0-secretaria-disponibilidade-publicada'}),{status:200})}),/a regra atual/);
});
test('missing Render service blocks Preview publication',async()=>{
  await assert.rejects(verifyPreviewHealth(previewApiUrl,{request:async()=>new Response('Not Found',{status:404})}),/não está disponível/);
});
const previewEvent = body => ({
  repository: { full_name: 'gokuoficialbr123-gif/forja-escola' },
  pull_request: { head: { repo: { full_name: 'gokuoficialbr123-gif/forja-escola' } }, body },
});

test('artefato Preview muda somente a declaração da API e preserva a fonte oficial', t => {
  const root = fixture(t);
  const result = prepareHosting(root, { previewApiUrl });
  const artifact = readFileSync(join(root, '.firebase-public', 'index.html'));
  const expected = Buffer.from(html.toString().replace(
    `const FORJA_API_URL = "${productionApiUrl}";`,
    `const FORJA_API_URL = "${previewApiUrl}";`,
  ));
  assert.ok(artifact.equals(expected));
  assert.ok(readFileSync(join(root, 'index.html')).equals(html));
  assert.equal(result.target, 'preview');
  assert.equal(result.sha256, sha256(expected));
  assert.notEqual(result.sha256, referenceSha256);
  assert.equal(artifact.toString().includes(productionApiUrl), false);
  assert.equal(artifact.toString().includes(previewApiUrl), true);
  assert.deepEqual(readdirSync(join(root, '.firebase-public')), ['index.html']);
});

test('preparar produção depois de Preview restaura integralmente o artefato oficial', t => {
  const root = fixture(t);
  prepareHosting(root, { previewApiUrl });
  const result = prepareHosting(root);
  const artifact = readFileSync(join(root, '.firebase-public', 'index.html'));
  assert.ok(artifact.equals(html));
  assert.equal(result.target, 'production');
  assert.equal(result.sha256, referenceSha256);
  assert.equal(artifact.toString().includes(previewApiUrl), false);
  assert.equal(artifact.toString().includes(productionApiUrl), true);
});

test('variável temporária não afeta produção e --preview exige URL explícita', t => {
  const previous = process.env.FORJA_PREVIEW_API_URL;
  t.after(() => {
    if (previous === undefined) delete process.env.FORJA_PREVIEW_API_URL;
    else process.env.FORJA_PREVIEW_API_URL = previous;
  });
  process.env.FORJA_PREVIEW_API_URL = previewApiUrl;
  assert.deepEqual(hostingOptionsFromArgs([]), {});
  assert.deepEqual(hostingOptionsFromArgs(['--preview']), { previewApiUrl });
  assert.equal(buildHostingArtifact(rootDir, hostingOptionsFromArgs([])).result.sha256, referenceSha256);
  delete process.env.FORJA_PREVIEW_API_URL;
  assert.throws(() => hostingOptionsFromArgs(['--preview']), /URL do backend Preview obrigatória/);
  assert.throws(() => hostingOptionsFromArgs(['--preview', '--production']), /Use somente/);
});

test('Preview não dispensa o hash fixo da fonte nem aceita alterações adicionais', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'index.html'), Buffer.concat([html, Buffer.from('\n<!-- alteração -->')]));
  assert.throws(() => prepareHosting(root, { previewApiUrl }), /HTML diferente da base/);
});

test('URL de Preview recusa produção, domínios falsos, injeções e normalização', () => {
  for (const url of [
    productionApiUrl, 'https://evil.example',
    'http://forja-api-pr-42.onrender.com',
    previewApiUrl + '.evil.example', previewApiUrl + '/', previewApiUrl + ':443',
    previewApiUrl + '?token=x', previewApiUrl + '#fragment', previewApiUrl + '\n',
    'https://evil.example@forja-api-pr-42.onrender.com',
    'https://forja-api-pr-0.onrender.com',
    'https://forja-api-pr-42.onrender.com";alert(1);//',
    undefined, '',
  ]) assert.throws(() => validatePreviewApiUrl(url));
});

test('parâmetro temporário do PR é obrigatório, único e restrito ao próprio repo', () => {
  const comment = `<!-- FORJA_PREVIEW_API_URL=${previewApiUrl} -->`;
  assert.equal(previewApiFromEvent(previewEvent(comment)), previewApiUrl);
  assert.throws(() => previewApiFromEvent(previewEvent('sem parâmetro')), /exatamente um/);
  assert.throws(() => previewApiFromEvent(previewEvent(comment + '\n' + comment)), /exatamente um/);
  assert.throws(() => previewApiFromEvent(previewEvent(`<!-- FORJA_PREVIEW_API_URL=${productionApiUrl} -->`)), /Backend Preview/);
  const fork = previewEvent(comment);
  fork.pull_request.head.repo.full_name = 'other/fork';
  assert.throws(() => previewApiFromEvent(fork), /próprio repositório/);
});

test('verificação exige o hash exato do Preview e continua recusando Preview como produção', async t => {
  const { bytes: previewBytes } = buildHostingArtifact(rootDir, { previewApiUrl });
  let body = previewBytes;
  const server = createServer((_req, res) => res.end(body));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  await verifyHosting(url, { expected: previewBytes, attempts: 1 });
  await assert.rejects(verifyHosting(url, { attempts: 1 }), /HTML servido diferente/);
  body = Buffer.concat([previewBytes, Buffer.from('alteração indevida')]);
  await assert.rejects(verifyHosting(url, { expected: previewBytes, attempts: 1 }), /HTML servido diferente/);
  body = html;
  await verifyHosting(url, { attempts: 1 });
  await assert.rejects(verifyHosting(url, { expected: previewBytes, attempts: 1 }), /HTML servido diferente/);
});

test('Vary inclui Origin mesmo quando o proxy acrescenta Accept-Encoding', () => {
  for (const value of ['Origin', 'Origin, Accept-Encoding', 'Accept-Encoding, origin']) {
    assertVaryOrigin(new Headers({ Vary: value }));
  }
  for (const value of ['', 'Accept-Encoding', 'OriginX', '*']) {
    assert.throws(() => assertVaryOrigin(new Headers({ Vary: value })), /Vary deve incluir Origin/);
  }
  assert.throws(() => assertVaryOrigin(new Headers()), /Vary deve incluir Origin/);
});


test('PR só de frontend precisa optar explicitamente pela API oficial exata', () => {
  const comment = '<!-- FORJA_PREVIEW_BACKEND=production-unchanged -->';
  assert.deepEqual(previewConfigFromEvent(previewEvent(comment)), { mode: 'production-unchanged', apiUrl: productionApiUrl });
  assert.deepEqual(previewConfigFromEvent(previewEvent(`<!-- FORJA_PREVIEW_API_URL=${previewApiUrl} -->`)), { mode: 'render-preview', apiUrl: previewApiUrl });
  assert.throws(() => previewConfigFromEvent(previewEvent('')), /exatamente um/);
  assert.throws(() => previewConfigFromEvent(previewEvent(comment + comment)), /único/);
  assert.throws(() => previewConfigFromEvent(previewEvent(comment + `<!-- FORJA_PREVIEW_API_URL=${previewApiUrl} -->`)), /Não combine/);
  assert.throws(() => previewConfigFromEvent(previewEvent('<!-- FORJA_PREVIEW_BACKEND=anything -->')), /inválido/);
  const fork = previewEvent(comment); fork.pull_request.head.repo.full_name = 'other/fork';
  assert.throws(() => previewConfigFromEvent(fork), /próprio repositório/);
});

test('same 6.31.1 version without unified Secretaria contract cannot publish Preview',async()=>{
 await assert.rejects(verifyPreviewHealth(previewApiUrl,{request:async()=>new Response(JSON.stringify({ok:true,version:previewVersion}),{status:200})}),/não unifica Agenda e booking/);
});

test('backend sem Etapa 2 central não pode autorizar o novo Preview',async()=>{
 await assert.rejects(verifyPreviewHealth(previewApiUrl,{request:async()=>new Response(JSON.stringify({ok:true,version:previewVersion,secretariaAvailabilityPolicy:'confirmed-week-v2',googleOAuthSecurityPolicy:'state-pkce-oidc-v1'}),{status:200})}),/Etapa 2 central ausente/);
});

test('Somente blocos centrais e Novo usuário podem mudar; Agenda e relatório preservados',()=>{
 const previous=html.toString().replace(/<style id="forja-new-user-style">[\s\S]*?<\/style>\n\n/,'').replace(/function newUserModal\(\)\{[\s\S]*?\n\}\nfunction showGeneratedLink/,'__NEW_USER__\nfunction showGeneratedLink').replace(/<style id="forja-google-secretaria-style">[\s\S]*?<\/style>\n/,'').replace(/<script id="forja-google-secretaria-script">[\s\S]*?<\/script>\n\n/,'');
 assert.equal(sha256(Buffer.from(previous)),'934bf09928a32b889187ad562b81a81ac002481683e1695e35cb7203adcea6d1');
});


test('backend com Etapa 2 mas sem freeBusy não pode publicar Preview da Etapa 3',async()=>{
 await assert.rejects(verifyPreviewHealth(previewApiUrl,{request:async()=>new Response(JSON.stringify({ok:true,version:previewVersion,secretariaAvailabilityPolicy:'confirmed-week-v2',googleOAuthSecurityPolicy:'state-pkce-oidc-v1',googleSecretariaPolicy:'calendarlist-association-v2'}),{status:200})}),/Etapa 3 freeBusy central ausente/);
});


test('Preview isolation gate blocks legacy/missing namespace, production storage and personal Google jobs',()=>{
 const base={googleSecretariaStorage:{policy:'central-preview-isolation-v1',environment:'preview',namespace:'pr-42',ready:true,personalGoogleEnabled:false},googleCalendarConfigured:false,googleCalendarWebhookConfigured:false};
 assertPreviewIsolation(base,previewApiUrl);
 for(const storage of [undefined,{...base.googleSecretariaStorage,ready:false},{...base.googleSecretariaStorage,environment:'production'},{...base.googleSecretariaStorage,namespace:'pr-6'},{...base.googleSecretariaStorage,personalGoogleEnabled:true}])assert.throws(()=>assertPreviewIsolation({...base,googleSecretariaStorage:storage},previewApiUrl),/sem isolamento/);
 assert.throws(()=>assertPreviewIsolation({...base,googleCalendarConfigured:true},previewApiUrl),/Google pessoal/);
 assert.throws(()=>assertPreviewIsolation({...base,googleCalendarWebhookConfigured:true},previewApiUrl),/Webhook pessoal/);
});

test('frontend-only Preview checks the current official backend without requiring Preview isolation', async()=>{
  const health={ok:true,version:productionVersion,googleSecretariaStorage:{environment:'production',namespace:'production'}};
  const result=await verifyPreviewHealth(productionApiUrl,{mode:'production-unchanged',request:async()=>new Response(JSON.stringify(health))});
  assert.equal(result.version,'6.31.1-secretaria-publicacao-confirmada');
  await assert.rejects(verifyPreviewHealth(productionApiUrl,{mode:'production-unchanged',request:async()=>new Response(JSON.stringify({...health,version:'6.30.1-cors-preview-forja-escola'}))}),/release|regra atual/);
});
