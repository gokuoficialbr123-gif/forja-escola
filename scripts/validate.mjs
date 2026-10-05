import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const referenceVersion = '6.31.1-secretaria-drawer-fluido';
export const referenceSha256 = '6d11b17bd7c067e500577f1b8f720224b59595bb534c45a0ef7e6e4bef55d224';
export const sha256 = data => createHash('sha256').update(data).digest('hex');

export function validateInlineScripts(html) {
  const temp = mkdtempSync(join(tmpdir(), 'forja-syntax-'));
  let checked = 0;
  try {
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      const attrs = match[1];
      if (/\bsrc\s*=/i.test(attrs) || !match[2].trim()) continue;
      const type = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (type && !['module', 'text/javascript', 'application/javascript'].includes(type)) continue;
      const file = join(temp, `${++checked}.${type === 'module' ? 'mjs' : 'js'}`);
      writeFileSync(file, match[2]);
      const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
      assert.equal(result.status, 0, `JavaScript inline ${checked} inválido:\n${result.stderr || result.error || ''}`);
    }
    assert.ok(checked > 0, 'Nenhum script JavaScript foi validado.');
    return checked;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

export function validate(root = rootDir) {
  const bytes = readFileSync(join(root, 'index.html'));
  const html = bytes.toString('utf8');
  const release = html.match(/<script\b[^>]*\bid=["']forja-v630-script["'][^>]*>([\s\S]*?)<\/script\s*>/i)?.[1];
  assert.ok(release, 'Script ativo forja-v630-script ausente.');
  const marker = release.match(/\bconst\s+VERSION\s*=\s*["']([^"']+)["']/)?.[1];
  assert.equal(marker, referenceVersion, 'Marker da release ativa incorreto.');
  assert.match(release, /dataset\.forjaAgendaVersion\s*=\s*VERSION/, 'Marker não aplicado à versão ativa.');
  assert.equal(sha256(bytes), referenceSha256, 'HTML diferente da base 6.31 preparada para revisão.');
  assert.ok(!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(html), 'Chave privada não pode entrar no frontend.');
  const central=html.match(/<script id="forja-google-secretaria-script">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(central?.includes("const CENTRAL_POLICY='calendarlist-association-v2'"), 'Marker da conexão central ausente.');
  const config = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));
  const aliases = JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8'));
  assert.equal(aliases.projects?.default, 'forja-escola', 'Projeto Firebase incorreto.');
  assert.equal(config.hosting?.site, 'forja-escola', 'Site Hosting incorreto.');
  assert.equal(config.hosting?.public, '.firebase-public', 'Pasta publicada deve ser isolada.');
  assert.deepEqual(config.hosting?.rewrites, [{ source: '**', destination: '/index.html' }]);
  const checked = validateInlineScripts(html);
  return { version: marker, sha256: referenceSha256, inlineScripts: checked, bytes: bytes.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validate(), null, 2));
}
