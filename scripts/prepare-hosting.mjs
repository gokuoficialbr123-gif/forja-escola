import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rootDir, sha256, validate, validateInlineScripts } from './validate.mjs';
import { validatePreviewApiUrl } from './preview-config.mjs';

export const productionApiUrl = 'https://forja-api-m1kq.onrender.com';

export function buildHostingArtifact(root = rootDir, { previewApiUrl } = {}) {
  const result = validate(root);
  const source = readFileSync(join(root, 'index.html'));
  if (previewApiUrl === undefined) return { bytes: source, result: { ...result, target: 'production', apiUrl: productionApiUrl } };

  validatePreviewApiUrl(previewApiUrl);
  const declaration = `const FORJA_API_URL = "${productionApiUrl}";`;
  const html = source.toString('utf8');
  assert.equal(html.split(declaration).length, 2, 'Declaração oficial da API deve existir exatamente uma vez.');
  const bytes = Buffer.from(html.replace(declaration, `const FORJA_API_URL = "${previewApiUrl}";`));
  const inlineScripts = validateInlineScripts(bytes.toString('utf8'));
  return { bytes, result: { ...result, target: 'preview', apiUrl: previewApiUrl, sha256: sha256(bytes), bytes: bytes.length, inlineScripts } };
}

export function hostingOptionsFromArgs(args = process.argv.slice(2)) {
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === '--preview'), 'Use somente --preview ou nenhum argumento.');
  if (!args.length) return {}; // Preview environment variables cannot affect production.
  return { previewApiUrl: validatePreviewApiUrl(process.env.FORJA_PREVIEW_API_URL) };
}

export function prepareHosting(root = rootDir, options = {}) {
  const { bytes, result } = buildHostingArtifact(root, options);
  const output = join(root, '.firebase-public');
  // This is a generated, ignored directory owned exclusively by this script.
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output);
  writeFileSync(join(output, 'index.html'), bytes);
  assert.deepEqual(readdirSync(output), ['index.html']);
  assert.ok(bytes.equals(readFileSync(join(output, 'index.html'))));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(prepareHosting(rootDir, hostingOptionsFromArgs()), null, 2));
}
