import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rootDir, validate } from './validate.mjs';

export function prepareHosting(root = rootDir) {
  const result = validate(root);
  const output = join(root, '.firebase-public');
  // This is a generated, ignored directory owned exclusively by this script.
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output);
  copyFileSync(join(root, 'index.html'), join(output, 'index.html'));
  assert.deepEqual(readdirSync(output), ['index.html']);
  assert.ok(readFileSync(join(root, 'index.html')).equals(readFileSync(join(output, 'index.html'))));
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(prepareHosting(), null, 2));
}
