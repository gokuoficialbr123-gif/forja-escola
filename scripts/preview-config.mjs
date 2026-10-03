import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function validatePreviewApiUrl(url) {
  assert.equal(typeof url, 'string', 'URL do backend Preview obrigatória.');
  assert.match(url, /^https:\/\/forja-api-pr-[1-9][0-9]{0,8}\.onrender\.com$/, 'Backend Preview deve pertencer ao formato HTTPS forja-api-pr-N.onrender.com.');
  assert.equal(new URL(url).origin, url, 'URL do backend Preview deve ser literal, sem normalização.');
  return url;
}

export function previewApiFromEvent(event) {
  assert.ok(event.repository?.full_name, 'Repositório do evento ausente.');
  assert.equal(event.pull_request?.head?.repo?.full_name, event.repository.full_name, 'Preview só aceita PR do próprio repositório.');
  const matches = [...String(event.pull_request?.body || '').matchAll(/<!--\s*FORJA_PREVIEW_API_URL=([^\r\n]*?)\s*-->/g)];
  assert.equal(matches.length, 1, 'Descrição do PR deve conter exatamente um comentário FORJA_PREVIEW_API_URL.');
  return validatePreviewApiUrl(matches[0][1].trim());
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.env.GITHUB_EVENT_PATH && process.env.GITHUB_OUTPUT, 'Evento e outputs do GitHub obrigatórios.');
  const apiUrl = previewApiFromEvent(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
  appendFileSync(process.env.GITHUB_OUTPUT, `api_url=${apiUrl}\n`);
  console.log('Backend temporário do Preview validado a partir da descrição do PR.');
}
