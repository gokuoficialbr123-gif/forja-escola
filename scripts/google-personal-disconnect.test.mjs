import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),code=html.match(/<script id="forja-google-personal-disconnect-script">([\s\S]*?)<\/script>/)[1];
const sessionCode=html.slice(html.indexOf('// FORJA session isolation:'),html.indexOf('// END FORJA session isolation.')+'// END FORJA session isolation.'.length);
const modalCode=html.slice(html.indexOf('let lastModalFocus=null;'),html.indexOf('function formField(')),apiCode=html.slice(html.indexOf('async function api('),html.indexOf('async function publicApi('));
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE||'/tmp/forja-browser-tests/node_modules/playwright/index.mjs')).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));after(async()=>browser?.close());
async function fixture(t,{outcome='completed',role='teacher',mobile=false,preview=false,confirm=true,gate=false}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});t.after(()=>page.close());await page.route('**/*',r=>r.abort());const doc='<button id="disconnect">Desconectar</button><div id="modal" class="hidden"></div><div id="feedback"></div><main></main>';
 if(preview){await page.route('https://forja-escola--pr10-fix-google-test-a1b2c3d4.web.app/**',r=>r.fulfill({contentType:'text/html',body:doc}));await page.goto('https://forja-escola--pr10-fix-google-test-a1b2c3d4.web.app/')}else await page.setContent(doc);
 await page.evaluate(({html,sessionCode,code,modalCode,apiCode,outcome,role,confirm,gate})=>{
  const parsed=new DOMParser().parseFromString(html,'text/html');for(const style of parsed.querySelectorAll('style'))document.head.appendChild(style.cloneNode(true));
  window.$=q=>document.querySelector(q);window.$$=q=>[...document.querySelectorAll(q)];window.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));window.state={role,googleCalendar:{item:{connected:true}}};window.messages=[];window.calls=[];window.confirm=()=>confirm;window.setBusy=(b,v)=>{if(b)b.disabled=v};window.toast=(text,type)=>{messages.push({text,type});document.getElementById('feedback').textContent=text};window.googleAction=async action=>calls.push({delegated:action});window.googleCalendarPanel=()=>'<div>Original</div>';window.FORJA_API_URL='https://api-fixture.invalid';window.auth={currentUser:{uid:'local-owner',getIdToken:async()=>'LOCAL_ONLY_TOKEN'}};
  window.reloadAndRender=async()=>{calls.push({reload:true});if(outcome==='local-failure')state.googleCalendar.item={connected:false,disconnectPending:true};document.querySelector('main').innerHTML=googleCalendarPanel()};
  window.fetch=async(url,options)=>{calls.push({path:new URL(url).pathname,method:options.method});if(gate)await new Promise(resolve=>window.release=resolve);
   if(outcome==='network')throw Error('TEST_ONLY_PRIVATE_TOKEN');if(outcome==='old')return new Response(JSON.stringify({ok:true}),{status:200});
   const partial=['local-failure','remote-failure'].includes(outcome),failed=['failed','changed'].includes(outcome);const body={ok:!partial&&!failed,outcome:failed?'failed':partial?'partial':'completed',retryable:outcome==='local-failure',local:{busy:outcome==='local-failure'?'failed':'deleted',connection:outcome==='changed'?'changed':outcome==='local-failure'?'retained':failed?'not_attempted':'deleted'},google:{revocation:outcome==='remote-failure'?'deferred_shared_project':'revoked',webhook:'stopped'},private_key:'TEST_ONLY_PRIVATE_TOKEN',error:'TEST_ONLY_PRIVATE_TOKEN'};
   return new Response(JSON.stringify(body),{status:failed?503:partial?502:200});};
  (0,eval)(sessionCode+'\n'+apiCode+'\n'+modalCode+'\n'+code+";forjaBeginSession(auth.currentUser);state.role='"+role+"';");document.getElementById('disconnect').onclick=()=>googleAction('disconnect',document.getElementById('disconnect'));
 },{html,sessionCode,code,modalCode,apiCode,outcome,role,confirm,gate});return page;
}
for(const role of ['teacher','psychologist'])for(const mobile of [false,true])test(`${role} ${mobile?'mobile':'desktop'}: actual API response confirms local completion`,async t=>{
 const p=await fixture(t,{role,mobile});await p.click('#disconnect');await p.waitForFunction(()=>messages.length>0);assert.equal((await p.evaluate(()=>messages))[0].type,'ok');assert.match(await p.locator('#feedback').textContent(),/local confirmada/);assert.ok(!(await p.content()).includes('TEST_ONLY_PRIVATE_TOKEN'));
});
test('local failure is partial, never green success, and presents retry on suspended connection',async t=>{
 const p=await fixture(t,{outcome:'local-failure'});await p.click('#disconnect');await p.waitForFunction(()=>calls.some(x=>x.reload));assert.equal((await p.evaluate(()=>messages))[0].type,'bad');assert.equal(await p.locator('[data-google-action=disconnect]').textContent(),'Tentar concluir desconexão');
});
test('remote deferral/failure remains visible although local cleanup succeeded',async t=>{
 const p=await fixture(t,{outcome:'remote-failure'});await p.click('#disconnect');await p.waitForFunction(()=>messages.length>0);assert.equal((await p.evaluate(()=>messages))[0].type,'warn');assert.match(await p.locator('.modal-body').textContent(),/todos os clientes OAuth/);assert.ok(!(await p.content()).includes('TEST_ONLY_PRIVATE_TOKEN'));
});
for(const outcome of ['old','failed','network'])test(`${outcome}: no unjustified success or credential displayed`,async t=>{
 const p=await fixture(t,{outcome});await p.click('#disconnect');await p.waitForFunction(()=>messages.length>0);assert.equal((await p.evaluate(()=>messages))[0].type,'bad');assert.ok(!(await p.content()).includes('TEST_ONLY_PRIVATE_TOKEN'));
});
test('concurrent clicks do not duplicate request; cancellation and Preview perform zero requests',async t=>{
 const p=await fixture(t,{gate:true});await p.click('#disconnect');await p.evaluate(()=>googleAction('disconnect',document.getElementById('disconnect')));assert.equal((await p.evaluate(()=>calls)).filter(x=>x.method==='DELETE').length,1);await p.evaluate(()=>release());
 for(const options of [{confirm:false},{preview:true},{role:'admin'}]){const p=await fixture(t,options);await p.click('#disconnect');assert.equal((await p.evaluate(()=>calls)).length,0);}
});

test('changed authorization is not falsely reported as suspended or deleted',async t=>{const p=await fixture(t,{outcome:'changed'});await p.click('#disconnect');await p.waitForFunction(()=>messages.length>0);const text=await p.locator('#feedback').textContent();assert.match(text,/conexão mudou/);assert.ok(!text.includes('suspensa'));assert.ok(!text.includes('concluída'));});

test('late disconnect is fenced by UID and generation and does not block the new user',async t=>{
 const p=await fixture(t,{gate:true});await p.evaluate(()=>{const action=googleAction;googleAction=(...args)=>(window.pendingDisconnect=action(...args));});
 await p.click('#disconnect');await p.waitForFunction(()=>typeof release==='function');
 await p.evaluate(()=>{window.oldRelease=release;window.oldDisconnect=pendingDisconnect;forjaEndSession();auth.currentUser={uid:'another-synthetic-owner',getIdToken:async()=>'LOCAL_NEW_TOKEN'};forjaBeginSession(auth.currentUser);state.role='psychologist';const fresh=document.createElement('button');fresh.id='disconnect';fresh.textContent='Desconectar';fresh.onclick=()=>googleAction('disconnect',fresh);document.getElementById('disconnect').replaceWith(fresh);});
 await p.click('#disconnect');await p.waitForFunction(()=>calls.filter(x=>x.method==='DELETE').length===2);await p.evaluate(()=>release());await p.evaluate(()=>pendingDisconnect);assert.equal((await p.evaluate(()=>messages)).length,1);
 await p.evaluate(()=>oldRelease());await p.evaluate(()=>oldDisconnect);assert.equal((await p.evaluate(()=>messages)).length,1);assert.equal((await p.evaluate(()=>calls)).filter(x=>x.reload).length,1);assert.equal(await p.evaluate(()=>state.role),'psychologist');
});
