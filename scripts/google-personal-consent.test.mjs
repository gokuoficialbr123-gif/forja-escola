import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const code=html.match(/<script id="forja-google-personal-consent-script">([\s\S]*?)<\/script>/)[1];
const modalCode=html.slice(html.indexOf('let lastModalFocus=null;'),html.indexOf('function formField('));
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE||'/tmp/forja-browser-tests/node_modules/playwright/index.mjs')).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));after(async()=>browser?.close());
async function fixture(t,{role='teacher',connected=false,mobile=false,fail=false,old=false,legacy=false,preview=false}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});t.after(()=>page.close());await page.route('**/*',r=>r.abort());
 const doc='<button id="connect">Conectar</button><div id="modal" class="hidden"></div><div id="feedback"></div>';
 if(preview){await page.route('https://forja-escola--pr9-fix-google-fixtur-a1b2c3d4.web.app/**',r=>r.fulfill({contentType:'text/html',body:doc}));await page.goto('https://forja-escola--pr9-fix-google-fixtur-a1b2c3d4.web.app/');}else await page.setContent(doc);
 await page.evaluate(({html,code,modalCode,role,connected,fail,old,legacy})=>{
  const parsed=new DOMParser().parseFromString(html,'text/html');for(const style of parsed.querySelectorAll('style'))document.head.appendChild(style.cloneNode(true));
  window.state={role,profile:{active:true},googleCalendar:{item:{connected,personalConsent:{accepted:false}}}};window.calls=[];window.$=q=>document.querySelector(q);window.$$=q=>[...document.querySelectorAll(q)];window.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.setBusy=(b,v)=>{if(b)b.disabled=v};window.toast=x=>document.getElementById('feedback').textContent=x;window.reloadAndRender=async()=>calls.push({reload:true});
  window.googleAction=async action=>calls.push({delegated:action});window.googleCalendarPanel=()=>'<div>Conexão atual</div>';window.forjaAgendaPage=()=>'<div>Agenda atual</div>';
  window.api=async(path,options={})=>{calls.push({path,...options});if(path.endsWith('/status'))return {consent:old?undefined:{version:'personal-busy-secretaria-v1',text:'Autorizo consulta de intervalos ocupados pela Secretaria, sem títulos, descrições ou participantes.',connectionChallenge:legacy?'':'opaque-fixture'},item:{connected,personalConsent:{requiresReconnect:legacy}}};if(fail)throw Error('TEST_ONLY_PRIVATE_TOKEN');return {ok:true,authUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=fixture'};};
  (0,eval)(modalCode+'\n'+code);document.getElementById('connect').onclick=()=>googleAction(connected?'consent':'connect',document.getElementById('connect'));
 },{html,code,modalCode,role,connected,fail,old,legacy});return page;
}
for(const role of ['teacher','psychologist'])for(const mobile of [false,true])test(`${role} ${mobile?'mobile':'desktop'}: unchecked affirmative consent before Google`,async t=>{
 const p=await fixture(t,{role,mobile});await p.click('#connect');const checkbox=p.locator('#googlePersonalConsentAccept');assert.equal(await checkbox.isChecked(),false);assert.equal(await p.locator('#modalSave').isDisabled(),true);
 assert.match(await p.locator('.modal-body').textContent(),/sem títulos, descrições ou participantes/);await p.click('[data-close-modal]');assert.equal((await p.evaluate(()=>calls)).filter(x=>x.method==='POST').length,0);
});
test('identity-bound legacy regularization sends only current version and challenge, never UID/token',async t=>{
 const p=await fixture(t,{connected:true});await p.click('#connect');await p.check('#googlePersonalConsentAccept');await p.click('#modalSave');await p.waitForFunction(()=>calls.some(x=>x.reload));
 const post=(await p.evaluate(()=>calls)).find(x=>x.method==='POST');assert.deepEqual(post.body,{accepted:true,version:'personal-busy-secretaria-v1',connectionChallenge:'opaque-fixture'});assert.equal(post.path,'/google/calendar/consent');
});
test('failed regularization remains visible and retryable without disclosing provider errors',async t=>{
 const p=await fixture(t,{connected:true,fail:true});await p.click('#connect');await p.check('#googlePersonalConsentAccept');await p.click('#modalSave');await p.waitForFunction(()=>document.getElementById('googlePersonalConsentFeedback').textContent.length>0);assert.ok(!(await p.content()).includes('TEST_ONLY_PRIVATE_TOKEN'));assert.equal(await p.locator('#modalSave').isDisabled(),false);
});
test('backend without consent capability cannot launch OAuth and other actions are delegated',async t=>{
 const p=await fixture(t,{old:true});await p.click('#connect');assert.equal(await p.locator('#googlePersonalConsentAccept').count(),0);assert.equal((await p.evaluate(()=>calls)).filter(x=>x.method==='POST').length,0);await p.evaluate(()=>googleAction('sync'));assert.ok((await p.evaluate(()=>calls)).some(x=>x.delegated==='sync'));
});
test('legacy without OIDC must reconnect; unavailable Google is never presented as free',async t=>{
 const p=await fixture(t,{connected:true,legacy:true});await p.click('#connect');assert.match(await p.locator('#modalSave').textContent(),/Google/);const view=await p.evaluate(()=>{state.role='admin';state.googleBusyUnavailable=true;return forjaAgendaPage()});assert.match(view,/não comprova horário livre/);
});
test('official Firebase Preview only displays unchecked consent; no read/write/OAuth is attempted',async t=>{
 const p=await fixture(t,{preview:true});await p.click('#connect');assert.equal(await p.locator('#modal input[type=checkbox]').isChecked(),false);assert.equal(await p.locator('#modalSave').count(),0);assert.equal((await p.evaluate(()=>calls)).length,0);await p.evaluate(()=>googleAction('sync'));assert.equal((await p.evaluate(()=>calls)).length,0);
});
