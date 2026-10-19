import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
// Explicit opt-in local runner. Never loaded by the portal or Hosting artifact.
assert.match(process.env.FIRESTORE_EMULATOR_HOST||'',/^127\.0\.0\.1:\d+$/);
assert.match(process.env.FIREBASE_AUTH_EMULATOR_HOST||'',/^127\.0\.0\.1:\d+$/);
assert.equal(process.env.FIREBASE_PROJECT_ID,'demo-forja');
const backend=resolve(process.env.FORJA_BACKEND_DIR||new URL('../../forja-backend',import.meta.url).pathname);
const {fixture}=await import(pathToFileURL(resolve(backend,'test/helpers/booking-http-fixture.mjs')).href);
const {fixedPortalFixture}=await import(pathToFileURL(resolve(backend,'test/helpers/fixed-portal-fixture.mjs')).href);
test('login hotfix: actual Auth and Firestore, failed network, retry and inactive permissions',async t=>{
 const f=await fixture(t);assert.equal(f.app.options.projectId,'demo-forja');
 await t.test('real HTTP profile, transient retry and forbidden inactive user',async browserT=>{
 const {page:p,login,errors}=await fixedPortalFixture(browserT,f);
 await login(f.teacherAuth,'teacher');await p.evaluate(async()=>{await executeLogout();showLogin();await new Promise(r=>requestAnimationFrame(r))});
 await p.evaluate(()=>{const actual=fetch;window.emulatedProfileFailure=true;window.fetch=(url,options)=>window.emulatedProfileFailure&&String(url).endsWith('/me')?Promise.reject(new TypeError('Failed to fetch')):actual(url,options)});
 await p.fill('#loginEmail',f.teacherAuth.email);await p.fill('#loginPassword','local-test-only-password');await p.click('[data-action="enterPortal"]');
 await p.locator('#loginProfileRetry').waitFor({state:'visible'});assert.equal(await p.locator('#processOverlay').isVisible(),false);assert.equal(await p.locator('#portalApp').isVisible(),false);assert.equal(await p.evaluate(()=>state.profile),null);
 await p.evaluate(()=>window.emulatedProfileFailure=false);await p.click('#loginProfileRetry');await p.waitForFunction(uid=>state.user?.uid===uid&&!state.loading,f.teacherAuth.uid);assert.equal(await p.evaluate(()=>state.role),'teacher');
 await p.evaluate(async()=>{await executeLogout();showLogin();await new Promise(r=>requestAnimationFrame(r))});
 await f.db.doc('users/'+f.teacherAuth.uid).update({active:false});
 await p.fill('#loginEmail',f.teacherAuth.email);await p.fill('#loginPassword','local-test-only-password');await p.click('[data-action="enterPortal"]');await p.locator('#loginError').waitFor({state:'visible'});
 assert.equal(await p.locator('#processOverlay').isVisible(),false);assert.equal(await p.locator('#portalApp').isVisible(),false);assert.equal(await p.evaluate(()=>state.profile),null);assert.match(await p.locator('#loginError').textContent(),/Secretaria/);
 await f.db.doc('users/'+f.teacherAuth.uid).update({active:true});await login(f.user,'admin');assert.equal(await p.evaluate(()=>state.role),'admin');await p.waitForLoadState('networkidle');assert.deepEqual(errors,[]);
 });
});
