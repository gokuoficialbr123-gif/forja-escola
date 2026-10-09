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

// Frontend-only PRs explicitly opt into the unchanged official API. Missing or
// conflicting metadata must fail, never silently fall back to production.
export function previewConfigFromEvent(event) {
  assert.ok(event.repository?.full_name, 'Repositório do evento ausente.');
  assert.equal(event.pull_request?.head?.repo?.full_name, event.repository.full_name, 'Preview só aceita PR do próprio repositório.');
  const body = String(event.pull_request?.body || '');
  const modes = [...body.matchAll(/<!--\s*FORJA_PREVIEW_BACKEND=([^\r\n]*?)\s*-->/g)];
  if (!modes.length) return { mode: 'render-preview', apiUrl: previewApiFromEvent(event) };
  assert.equal(modes.length, 1, 'Modo do backend precisa ser único.');
  const selected=modes[0][1].trim();
  assert.ok(['production-unchanged','invitation-demo'].includes(selected),'Modo do backend inválido.');
  assert.ok(!body.includes('FORJA_PREVIEW_API_URL='), 'Não combine API temporária e backend oficial.');
  return selected==='invitation-demo'?{mode:selected,apiUrl:''}:{mode:selected,apiUrl:'https://forja-api-m1kq.onrender.com'};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.ok(process.env.GITHUB_EVENT_PATH && process.env.GITHUB_OUTPUT, 'Evento e outputs do GitHub obrigatórios.');
  const { apiUrl, mode } = previewConfigFromEvent(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
  appendFileSync(process.env.GITHUB_OUTPUT, `api_url=${apiUrl}\nmode=${mode}\n`);
  console.log('Modo e backend do Preview validados a partir da descrição do PR.');
}
