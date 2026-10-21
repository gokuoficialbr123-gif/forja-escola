import {withoutRecurringLessons} from './recurring-lessons-scope.mjs';
import {legalFiles,withoutLegalNavigation,portalBeforeLegalSha256,validateLegalPages} from './legal-pages.mjs';
import {withoutFixedAvailability} from './fixed-availability-scope.mjs';
import {withoutLessonReadPolicy} from './lesson-read-policy-scope.mjs';
import {withoutPersonalGoogleDiagnostics} from './personal-google-diagnostics-scope.mjs';
import {withoutBookingHotfix} from './booking-hotfix-scope.mjs';
import {withoutSessionIsolation} from './session-isolation-scope.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const referenceVersion = '6.31.1-secretaria-drawer-fluido';
export const referenceSha256 = 'c22fae0c5d7240dbe7dc93b4c68cd930b25ee5df660751a1597e9a7fd4c4cf28';
export const sha256 = data => createHash('sha256').update(data).digest('hex');
// Public ownership proof: preserve the exact bytes, including no final newline.
export const googleVerificationFile = 'googleaaf1dd5c13d03a74.html';
export const googleVerificationContent = 'google-site-verification: googleaaf1dd5c13d03a74.html';

export function validateGoogleVerification(root = rootDir) {
  const file = join(root, googleVerificationFile);
  assert.ok(lstatSync(file).isFile(), 'Verificação Google deve ser arquivo regular.');
  const bytes = readFileSync(file);
  assert.ok(bytes.equals(Buffer.from(googleVerificationContent)), 'Conteúdo da verificação Google deve ser exato, sem quebra de linha adicional.');
  return {file:googleVerificationFile, bytes:bytes.length, sha256:sha256(bytes)};
}

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
  assert.equal(sha256(withoutSessionIsolation(withoutBookingHotfix(withoutPersonalGoogleDiagnostics(withoutLessonReadPolicy(withoutFixedAvailability(withoutLegalNavigation(withoutRecurringLessons(html)))))))), '3d6908cd807c5b2abf3a7620b2d4275738bb28931478e4340fe84c4557e6cf1f', 'Fora do isolamento de sessão, o portal deve ser idêntico ao main publicado.');
  assert.equal(sha256(withoutLegalNavigation(withoutRecurringLessons(html))),portalBeforeLegalSha256,'Fora do rodapé legal, portal igual à produção #16/#17.');
  assert.ok(!/-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(html), 'Chave privada não pode entrar no frontend.');
  const central=html.match(/<script id="forja-google-secretaria-script">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(central?.includes("const CENTRAL_POLICY='calendarlist-association-v2'"), 'Marker da conexão central ausente.');
  const config = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));
  const aliases = JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8'));
  assert.equal(aliases.projects?.default, 'forja-escola', 'Projeto Firebase incorreto.');
  assert.equal(config.hosting?.site, 'forja-escola', 'Site Hosting incorreto.');
  assert.equal(config.hosting?.public, '.firebase-public', 'Pasta publicada deve ser isolada.');
  assert.deepEqual(config.hosting?.rewrites, [{ source: '**', destination: '/index.html' }]);
  const googleVerification = validateGoogleVerification(root);
  const checked = validateInlineScripts(html);
  return { version: marker, sha256: referenceSha256, inlineScripts: checked, bytes: bytes.length, legalPages:validateLegalPages(root), googleVerification };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(validate(), null, 2));
}
