import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';
import {loginPortal} from './helpers/login-portal-fixture.mjs';
import {withoutLoginProfileChanges,portalBeforeLoginSha256} from './login-profile-scope.mjs';
import {sha256} from './validate.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE||'/tmp/forja-browser-tests/node_modules/playwright/index.mjs')).href);
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));after(async()=>browser?.close());
async function fixture(t,options){const f=await loginPortal(browser,options);t.after(()=>f.close());return f;}
async function rejected(p){await p.locator('#loginError').waitFor({state:'visible'});await p.locator('#processOverlay').waitFor({state:'hidden'});assert.equal(await p.locator('#portalApp').isVisible(),false);assert.deepEqual(await p.evaluate(()=>({profile:state.profile,role:state.role,loading:state.loading})),{profile:null,role:null,loading:false});assert.equal(await p.locator('[data-action="enterPortal"]').isEnabled(),true);}
async function ready(p,uid='A'){await p.waitForFunction(uid=>state.user?.uid===uid&&!state.loading,uid);assert.equal(await p.locator('#processOverlay').isVisible(),false);assert.equal(await p.locator('#portalApp').isVisible(),true);}
test('review guard restores exact current main and rejects unrelated portal edits',()=>{assert.equal(sha256(withoutLoginProfileChanges(html)),portalBeforeLoginSha256);assert.throws(()=>withoutLoginProfileChanges(html+'\n'),/Only the reviewed login changes|Agenda 2.0 must restore|Navigation\/student changes must restore exact published main|Institutional changes must restore the exact reviewed portal/);});
test('positive reproduction: published main leaves overlay after fetch error and logout invalidates its session',async t=>{
 const f=await fixture(t,{html:withoutLoginProfileChanges(html)}),p=f.page;await f.mode('network');await f.login();await p.waitForFunction(()=>!manualLoginInProgress);
 assert.deepEqual(await p.evaluate(()=>({overlay:!document.querySelector('#processOverlay').classList.contains('hidden'),auth:!!auth.currentUser,current:forjaSessionCurrent(forjaCaptureSession()),loading:state.loading,signOut:loginFixture.signOutCalls,error:document.querySelector('#loginError').textContent})),{overlay:true,auth:false,current:false,loading:true,signOut:1,error:'Failed to fetch'});
});
for(const mode of ['network','http503','http502','http500','json','invalid','inactive','bad-role','wrong-email','wrong-uid','http401','http403','http429'])test(`${mode}: bounded error closes overlay, rejects access and never exposes provider payload`,async t=>{
 const f=await fixture(t),p=f.page;await f.mode(mode);await f.login();await rejected(p);
 const text=await p.locator('#loginError').textContent();assert.doesNotMatch(text,/Failed to fetch|UNTRUSTED_PROVIDER_PAYLOAD|SYNTHETIC_|<html>|Bearer/);assert.match(text,/servidor|perfil|acesso|sessão|tentativas/);
 assert.equal(await p.evaluate(()=>loginFixture.profileCalls),['network','http503','http502','http500'].includes(mode)?2:1);assert.equal(await p.evaluate(()=>loginFixture.signOutCalls),0);
 assert.equal(await p.locator('#loginProfileRetry').isVisible(),!['http401','http403','http429'].includes(mode));assert.deepEqual(f.errors,[]);
});
for(const mobile of [false,true])test(`API recovery ${mobile?'mobile':'desktop'}: retry needs no second password and opens only a validated profile`,async t=>{
 const f=await fixture(t,{mobile}),p=f.page;await f.mode('network');await f.login();await rejected(p);assert.equal(await p.inputValue('#loginEmail'),'A@forja.invalid');assert.equal(await p.inputValue('#loginPassword'),'');
 await f.mode('ok');await p.locator('#loginProfileRetry').click();await ready(p);assert.equal(await p.evaluate(()=>loginFixture.profileCalls),3);assert.equal(await p.evaluate(()=>loginFixture.signOutCalls),0);assert.deepEqual(f.errors,[]);
});
for(const mode of ['hang','token'])test(`${mode}: token/fetch wait is at most 41 seconds, late result cannot reopen portal`,async t=>{
 const f=await fixture(t),p=f.page;await p.clock.install();await f.mode(mode);await f.login();await p.waitForFunction(mode=>mode==='hang'?loginFixture.profileCalls===1:typeof loginFixture.releaseToken==='function',mode);
 await p.clock.fastForward(20001);await p.waitForFunction(()=>document.querySelector('#processTitle').textContent==='Aguardando o servidor...');await p.clock.fastForward(1001);await p.clock.fastForward(20001);await rejected(p);assert.match(await p.locator('#loginError').textContent(),/demorou/);
 await p.evaluate(mode=>{loginFixture.mode='ok';if(mode==='hang')loginFixture.releaseProfile(new Response(JSON.stringify({profile:{role:'admin',active:true,email:'A@forja.invalid'}})));else loginFixture.releaseToken();},mode);
 await p.clock.fastForward(5000);assert.equal(await p.locator('#portalApp').isVisible(),false);assert.equal(f.calls.filter(x=>x.path==='/me').length,0,'expired token must never launch an obsolete request');
 await p.locator('#loginProfileRetry').click();await ready(p);assert.deepEqual(f.errors,[]);
});
test('first cold-start timeout can recover on the last bounded attempt',async t=>{
 const f=await fixture(t),p=f.page;await p.clock.install();await f.mode('hang');await f.login();await p.waitForFunction(()=>loginFixture.profileCalls===1);await p.clock.fastForward(20001);await f.mode('ok');await p.clock.fastForward(1001);await ready(p);assert.equal(await p.evaluate(()=>loginFixture.profileCalls),2);assert.deepEqual(f.errors,[]);
});
test('logout observer invalidates generation during /me and immediately releases owned loading',async t=>{
 const f=await fixture(t),p=f.page;await f.mode('hang');await f.login();await p.waitForFunction(()=>loginFixture.profileCalls===1);await p.evaluate(()=>{window.previousGeneration=forjaSessionGeneration;window.previousLogout=executeLogout()});await p.evaluate(()=>previousLogout);
 await p.locator('#processOverlay').waitFor({state:'hidden'});assert.equal(await p.locator('#portalApp').isVisible(),false);
 await p.waitForFunction(()=>!manualLoginInProgress);assert.equal(await p.evaluate(()=>forjaSessionGeneration>previousGeneration),true);assert.equal(await p.evaluate(()=>state.loading),false);
});
for(const sameUID of [false,true])for(const outcome of ['success','error'])test(`late ${outcome} after ${sameUID?'same-UID session renewal':'user switch'} cannot dismiss or overwrite a new profile attempt`,async t=>{
 const f=await fixture(t),p=f.page;await f.mode('hang');await f.login();await p.waitForFunction(()=>loginFixture.profileCalls===1);
 await p.evaluate(()=>{window.oldRelease=loginFixture.releaseProfile;forjaEndSession()});await p.waitForFunction(()=>!manualLoginInProgress);
 const uid=sameUID?'A':'B';await p.evaluate(uid=>{window.nextActivation=fixtureAuth(uid)},uid);await p.waitForFunction(()=>loginFixture.profileCalls===2);
 await p.evaluate(outcome=>oldRelease(new Response(JSON.stringify(outcome==='error'?{error:'OLD_PRIVATE_MESSAGE'}:{profile:{role:'admin',active:true,email:'A@forja.invalid'}}),{status:outcome==='error'?503:200})),outcome);
 await p.evaluate(()=>new Promise(r=>setTimeout(r,50)));assert.equal(await p.locator('#processOverlay').isVisible(),true);assert.equal(await p.evaluate(()=>state.loading),true);assert.equal(await p.evaluate(()=>auth.currentUser.uid),uid);assert.equal(await p.locator('#portalApp').isVisible(),false);
 await p.evaluate(uid=>{loginFixture.mode='ok';loginFixture.releaseProfile(new Response(JSON.stringify({ok:true,uid,profile:{role:uid==='B'?'psychologist':'teacher',active:true,email:uid+'@forja.invalid'}})))},uid);await ready(p,uid);assert.equal(await p.evaluate(()=>state.role),sameUID?'teacher':'psychologist');assert.deepEqual(f.errors,[]);
});
test('double Enter cannot submit concurrent logins; a pending signOut is never called on profile failure',async t=>{
 const f=await fixture(t),p=f.page;await p.evaluate(()=>loginFixture.signOutHang=true);await f.mode('network');await f.login();await p.evaluate(()=>enterPortal());await rejected(p);assert.equal(await p.evaluate(()=>loginFixture.profileCalls),2);assert.equal(await p.evaluate(()=>loginFixture.signOutCalls),0);
});
