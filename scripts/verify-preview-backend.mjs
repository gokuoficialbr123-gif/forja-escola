import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePreviewApiUrl } from './preview-config.mjs';

export const productionVersion = '6.31.1-secretaria-publicacao-confirmada';
export const previewVersion = '6.31.1-secretaria-publicacao-confirmada';

export function assertPreviewIsolation(health,apiUrl) {
  const expected='pr-'+new URL(apiUrl).hostname.match(/^forja-api-pr-([1-9][0-9]*)\.onrender\.com$/)?.[1];
  const storage=health.googleSecretariaStorage;
  const centralReady=storage?.ready===true && storage.namespace===expected;
  // Teacher-only review does not call central Google. Its server-side read-only
  // allowlist blocks central routes and all writes before they reach handlers.
  const teacherOnly=health.previewTeacher?.readOnly===true && storage?.ready===false && storage.namespace===null;
  assert.ok(storage?.policy==='central-preview-isolation-v1'&&storage.environment==='preview'&&storage.personalGoogleEnabled===false&&(centralReady||teacherOnly),'Render Preview sem isolamento confirmado nem modo de revisão somente leitura; Hosting bloqueado.');
  assert.equal(health.googleCalendarConfigured,false,'Google pessoal deve ficar desabilitado no Preview.');
  assert.equal(health.googleCalendarWebhookConfigured,false,'Webhook pessoal deve ficar desabilitado no Preview.');
}

export async function verifyPreviewHealth(apiUrl, { mode = 'render-preview', request = fetch } = {}) {
  assert.ok(['render-preview', 'production-unchanged'].includes(mode), 'Modo de backend inválido.');
  if (mode === 'production-unchanged') assert.equal(apiUrl, 'https://forja-api-m1kq.onrender.com');
  else validatePreviewApiUrl(apiUrl);
  const response = await request(apiUrl + '/health', { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, 'Render Preview não está disponível; Preview Hosting não publicado.');
  const health = await response.json();
  assert.equal(health.ok, true);
  assert.equal(health.version, mode === 'production-unchanged' ? productionVersion : previewVersion, 'Render Preview ainda não tem a regra atual; Preview Hosting não publicado.');
  if(mode==='render-preview')assert.equal(health.secretariaAvailabilityPolicy,'confirmed-week-v2','Render Preview ainda não unifica Agenda e booking; Preview Hosting não publicado.');
  if(mode==='render-preview'){assert.equal(health.googleOAuthSecurityPolicy,'state-pkce-oidc-v1','Hardening OAuth ausente.');assert.equal(health.googleSecretariaPolicy,'calendarlist-association-v2','Etapa 2 central ausente; Preview não publicado.');assert.equal(health.googleSecretariaFreeBusyPolicy,'central-freebusy-query-v1','Etapa 3 freeBusy central ausente; Preview não publicado.')}
  if(mode==='render-preview'){assertPreviewIsolation(health,apiUrl);assert.equal(health.previewTeacher?.readOnly,true,'Render Preview precisa bloquear toda mutação e acesso não auditado; Hosting Preview bloqueado.');}
  return { apiUrl, version: health.version, health: 200 };
}

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

  if(mode==='render-preview')assert.equal(data.secretariaAvailabilityPolicy,'confirmed-week-v2','Agenda e booking ainda não unificados no Render Preview.');
  if(mode==='render-preview'){assert.equal(data.googleOAuthSecurityPolicy,'state-pkce-oidc-v1');assert.equal(data.googleSecretariaPolicy,'calendarlist-association-v2');assert.equal(data.googleSecretariaFreeBusyPolicy,'central-freebusy-query-v1')}

  if(mode==='render-preview'){assertPreviewIsolation(data,apiUrl);assert.equal(data.previewTeacher?.readOnly,true,'Backend do Preview não confirmou revisão somente leitura para Professor.');}

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
    const mode = process.env.FORJA_PREVIEW_BACKEND_MODE || 'render-preview';
    const result = process.argv.includes('--health-only')
      ? await verifyPreviewHealth(process.env.FORJA_PREVIEW_API_URL, { mode })
      : await verifyPreviewBackend(process.env.FORJA_PREVIEW_API_URL, process.env.FORJA_VERIFY_URL, { mode });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    // Surface a useful diagnostic through GitHub check annotations even when
    // the separate signed log-download host is inaccessible to the reviewer.
    const message = `${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`;
    const escaped = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
    console.error(`::error::${escaped}`);
    process.exitCode = 1;
  }
}
