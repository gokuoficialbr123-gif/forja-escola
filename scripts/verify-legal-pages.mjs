import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {rootDir, sha256} from './validate.mjs';
import {legalFiles, validateLegalPages} from './legal-pages.mjs';

export async function verifyLegalPages(url, {root=rootDir, request=fetch, attempts=12, delayMs=5000}={}) {
  const origin = new URL(url);
  assert.ok(['https:', 'http:'].includes(origin.protocol));
  validateLegalPages(root);
  const results = [];
  for (const file of legalFiles) {
    const path = file.endsWith('/index.html') ? '/'+file.slice(0,-10) : '/'+file;
    const target = new URL(path, origin);
    let failure;
    for (let attempt=1; attempt<=attempts; attempt++) {
      try {
        target.searchParams.set('forja_verify', `${Date.now()}-${attempt}`);
        const response = await request(target, {headers:{'Cache-Control':'no-cache'}, signal:AbortSignal.timeout(15000)});
        assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
        assert.equal(new URL(response.url || target.href).origin, origin.origin, 'Página pública deve permanecer no mesmo domínio.');
        const body = Buffer.from(await response.arrayBuffer());
        assert.equal(sha256(body), sha256(readFileSync(join(root,file))), `${path}: conteúdo diferente ou fallback da SPA.`);
        results.push({path,status:200,sha256:sha256(body)});
        failure=undefined;
        break;
      } catch(error) {
        failure=error;
        if(attempt<attempts) await new Promise(resolve=>setTimeout(resolve,delayMs));
      }
    }
    if(failure) throw failure;
  }
  return results;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.ok(process.env.FORJA_VERIFY_URL, 'Defina FORJA_VERIFY_URL.');
  console.log(JSON.stringify(await verifyLegalPages(process.env.FORJA_VERIFY_URL),null,2));
}
