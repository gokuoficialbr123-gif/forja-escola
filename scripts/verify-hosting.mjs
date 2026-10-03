import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rootDir, referenceVersion, sha256 } from './validate.mjs';

export async function verifyHosting(url, {
  expected = readFileSync(join(rootDir, 'index.html')),
  attempts = 12,
  delayMs = 5000,
  timeoutMs = 15000,
} = {}) {
  const target = new URL(url);
  assert.ok(['https:', 'http:'].includes(target.protocol), 'URL HTTP(S) obrigatória.');
  let failure;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      // Bypass cache using a different URL on every attempt, preserving preview origins.
      target.searchParams.set('forja_verify', `${Date.now()}-${attempt}`);
      const response = await fetch(target, {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      assert.equal(response.status, 200, `Hosting respondeu HTTP ${response.status}.`);
      const deployed = Buffer.from(await response.arrayBuffer());
      assert.ok(deployed.toString('utf8').includes(referenceVersion), 'Versão esperada não servida.');
      assert.equal(sha256(deployed), sha256(expected), 'HTML servido diferente do artefato validado.');
      return { version: referenceVersion, sha256: sha256(deployed) };
    } catch (error) {
      failure = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Verificação do Hosting falhou após ${attempts} tentativa(s): ${failure.message}`, { cause: failure });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.FORJA_VERIFY_URL;
  assert.ok(url, 'Defina FORJA_VERIFY_URL.');
  console.log(JSON.stringify(await verifyHosting(url), null, 2));
}
