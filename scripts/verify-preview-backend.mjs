import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePreviewApiUrl } from './preview-config.mjs';

const productionVersion = '6.30.1-cors-preview-forja-escola';
const previewVersion = '6.31.1-secretaria-publicacao-confirmada';

export function assertVaryOrigin(headers) {
  const fields = (headers.get('vary') || '').split(',').map(field => field.trim().toLowerCase());
  assert.ok(fields.includes('origin'), 'Vary deve incluir Origin; proxies podem acrescentar Accept-Encoding.');
}

export async function verifyPreviewBackend(apiUrl, frontendUrl, { mode = 'render-preview' } = {}) {
  assert.ok(['render-preview', 'production-unchanged'].includes(mode), 'Modo de backend inválido.');
  if (mode === 'production-unchanged') assert.equal(apiUrl, 'https://forja-api-m1kq.onrender.com', 'API oficial deve ser exata.');
  else validatePreviewApiUrl(apiUrl);
  const origin = new URL(frontendUrl).origin;
  assert.match(origin, /^https:\/\/forja-escola--[a-z0-9-]+-[a-z0-9]{8}\.web\.app$/, 'Origem deve ser um Firebase Preview da FORJA.');
  const request = (path, options = {}) => fetch(apiUrl + path, {
    ...options, signal: AbortSignal.timeout(30000),
    headers: { Origin: origin, ...options.headers },
  });
  const health = await request('/health');
  console.log(JSON.stringify({ check: 'preview-health', status: health.status, origin, allowedOrigin: health.headers.get('access-control-allow-origin') }));
  assert.equal(health.status, 200, 'Backend Preview indisponível.');
  assert.equal(health.headers.get('access-control-allow-origin'), origin, 'CORS do health deve refletir a origem exata.');
  assertVaryOrigin(health.headers);
  const data = await health.json();
  assert.equal(data.ok, true);
  assert.equal(data.version, mode === 'production-unchanged' ? productionVersion : previewVersion, 'Versão incorreta no backend Preview.');

  const preflight = await request('/me', {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type,x-forja-otp',
    },
  });
  assert.equal(preflight.status, 204, 'Preflight do backend Preview deve passar.');
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  const allowedHeaders = preflight.headers.get('access-control-allow-headers')?.toLowerCase().split(',').map(s => s.trim()) || [];
  for (const header of ['authorization', 'content-type', 'x-forja-otp']) assert.ok(allowedHeaders.includes(header), `Header ${header} ausente no preflight.`);

  const protectedRoute = await request('/me');
  assert.equal(protectedRoute.status, 401, 'Preview não pode dispensar autenticação.');
  assert.equal(protectedRoute.headers.get('access-control-allow-origin'), origin);
  return { apiUrl, origin, version: data.version, health: 200, preflight: 204, unauthenticatedMe: 401 };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await verifyPreviewBackend(process.env.FORJA_PREVIEW_API_URL, process.env.FORJA_VERIFY_URL, { mode: process.env.FORJA_PREVIEW_BACKEND_MODE || 'render-preview' }), null, 2));
  } catch (error) {
    // Surface a useful diagnostic through GitHub check annotations even when
    // the separate signed log-download host is inaccessible to the reviewer.
    const message = `${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`;
    const escaped = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    console.error(`::error::${escaped}`);
    process.exitCode = 1;
  }
}
