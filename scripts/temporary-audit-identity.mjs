// TEMPORARY: print only the two non-secret identity fields authorized by the user.
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function accountIdentity(raw) {
  let account;
  try { account = JSON.parse(raw || 'null'); }
  catch { throw new Error('SERVICE_ACCOUNT_JSON_INVALID'); }
  assert.ok(account && typeof account === 'object', 'SERVICE_ACCOUNT_JSON_INVALID');
  const { client_email, project_id } = account;
  assert.ok(typeof client_email === 'string' && /^[a-zA-Z0-9._-]+@[a-zA-Z0-9-]+\.iam\.gserviceaccount\.com$/.test(client_email), 'SERVICE_ACCOUNT_IDENTITY_INVALID');
  assert.ok(typeof project_id === 'string' && /^[a-z][a-z0-9-]{4,62}$/.test(project_id), 'SERVICE_ACCOUNT_PROJECT_INVALID');
  return { client_email, project_id };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const identity = accountIdentity(process.env.FORJA_AUDIT_SERVICE_ACCOUNT);
    console.log(JSON.stringify(identity));
    console.log(`::notice title=FORJA_ACCOUNT_IDENTITY::${JSON.stringify(identity)}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
      `same_account=${identity.client_email === 'github-forja-hosting@forja-escola.iam.gserviceaccount.com'}\nproject_ok=${identity.project_id === 'forja-escola'}\n`);
    assert.equal(identity.project_id, 'forja-escola', 'SERVICE_ACCOUNT_PROJECT_MISMATCH');
  } catch (error) {
    console.error(/^[A-Z_]+$/.test(error.message) ? error.message : 'SERVICE_ACCOUNT_IDENTITY_CHECK_FAILED');
    process.exitCode = 1;
  }
}
