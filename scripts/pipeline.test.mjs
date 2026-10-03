import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootDir, validate, validateInlineScripts } from './validate.mjs';
import { prepareHosting } from './prepare-hosting.mjs';
import { verifyHosting } from './verify-hosting.mjs';

const html = readFileSync(join(rootDir, 'index.html'));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'forja-pipeline-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const file of ['index.html', 'firebase.json', '.firebaserc']) copyFileSync(join(rootDir, file), join(root, file));
  return root;
}

test('base 6.30 passa em marker, hash, configuração e sintaxe', () => {
  const result = validate();
  assert.ok(result.inlineScripts > 0);
  assert.equal(result.bytes, 1661612);
});
test('marker histórico em outro script não mascara uma release ativa errada', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'index.html'), html.toString().replace("const VERSION='6.30.0-bloco-a-secretaria-marcar-aula'", "const VERSION='6.29.0'"));
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
