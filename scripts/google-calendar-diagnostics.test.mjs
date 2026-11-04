import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {agendaPresentationFixture} from './helpers/agenda-presentation-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const keys=['calendar','teacher','uid','enabled','effective','accessRole','accessStatus','mode','model','institutional','freeBusy','reauthorization','configuration','legacy','coverage','synchronization'];
const report=()=>({ok:true,policy:'central-readonly-diagnostics-v1',checkedAt:'2026-11-04T12:00:00.000Z',state:'blocked',activationSafe:false,checks:keys.map(key=>({key,state:['coverage','synchronization','model'].includes(key)?'not_verified':key==='mode'?'blocked':'ok',explanation:key==='coverage'?'A cobertura real não foi verificada.':'Metadado sintético.'}))});
async function fixture(t,options={}){
 const f=await agendaPresentationFixture(browser,{role:'admin',pauseClock:true,...options}),p=f.page,calls=[];let finish,enter,finished=0;const completed=new Promise(r=>finish=r),entered=new Promise(r=>enter=r);
 await p.evaluate(()=>{window.__diagnosticSettled=0;const previous=api;api=async function(path,...args){try{return await previous(path,...args);}finally{if(path.startsWith('/admin/google-calendar/central/'))window.__diagnosticSettled++;}};});
 await p.route('**/admin/google-calendar/central/**',async route=>{
  const r=route.request(),url=new URL(r.url());calls.push({method:r.method(),path:url.pathname,query:url.search});if(calls.length===2)enter();
  assert.equal(r.method(),'GET');assert.ok(['/admin/google-calendar/central/status','/admin/google-calendar/central/calendars'].includes(url.pathname));
  if(options.hold)await options.hold;
  if(options.fail)return route.fulfill({status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({error:'PRIVATE_PROVIDER'})});
  const body=url.pathname.endsWith('/status')?{ok:true,policy:'calendarlist-association-v2',item:{connected:true,institutionalAuthorized:true,freeBusyAuthorized:true,requiresReauthorization:false,freeBusyRequiresReauthorization:false}}:options.invalid?{ok:true,items:[{calendarId:'PRIVATE_RAW_ID'}]}:report();
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify(body)}).catch(error=>{if(!options.hold)throw error;});if(++finished===2)finish();
 });
 t.after(()=>f.close());return {...f,calls,entered,completed};
}
async function open(f){await f.page.getByText('Fontes e diagnóstico',{exact:true}).click();await f.page.getByRole('button',{name:'Verificar integração Google',exact:true}).click();}
for(const mobile of [false,true])test('Google diagnostic: explicit GETs, private IDs hidden, polling preserves report '+(mobile?'mobile':'desktop'),async t=>{
 const f=await fixture(t,{mobile,mode:'unknown'}),p=f.page;await open(f);assert.equal(f.calls.length,0,'opening is not an automatic read');
 await p.getByRole('button',{name:'Consultar requisitos',exact:true}).dblclick();await p.waitForFunction(()=>document.querySelector('[data-forja2-diagnostic-result]')?.textContent.includes('Este diagnóstico não autoriza ativação'));
 assert.equal(f.calls.length,2);assert.ok(f.calls.every(x=>x.method==='GET'));assert.ok(f.calls.find(x=>x.path.endsWith('/calendars')).query.includes('diagnosticFor=PERF_TEACHER'));
 const before=await p.locator('[data-forja2-diagnostic-result]').innerText();assert.ok(!/PRIVATE_|PERF_TEACHER|calendarId/.test(before));assert.ok(before.includes('Não verificado'));
 for(const width of mobile?[390,360]:[1366]){await p.setViewportSize({width,height:900});assert.equal(await p.locator('[data-forja2-diagnostic-result] table').evaluate(table=>table.scrollWidth<=table.parentElement.clientWidth+1),true,'diagnostic columns and descriptions must fit the modal at '+width);assert.equal(await p.locator('[data-forja2-diagnostic-result] td').first().evaluate(el=>getComputedStyle(el).whiteSpace),'normal','descriptions must wrap rather than clip');}
 await p.evaluate(()=>{for(let n=0;n<5;n++)forjaAgenda2Paint();});assert.equal(await p.locator('[data-forja2-diagnostic-result]').innerText(),before);assert.equal(f.calls.length,2);assert.equal(await p.locator('[data-forja2-google-check]').count(),1);
 assert.deepEqual(f.errors,[]);
});
test('Google diagnostic: HTTP failure and older backend response never produce OK',async t=>{
 for(const option of [{fail:true},{invalid:true}])await t.test(JSON.stringify(option),async t=>{const f=await fixture(t,option);await open(f);await f.page.getByRole('button',{name:'Consultar requisitos',exact:true}).click();await f.page.waitForFunction(()=>document.querySelector('[data-forja2-diagnostic-result]')?.textContent.includes('Não foi possível confirmar'));assert.equal(await f.page.locator('[data-forja2-diagnostic-result] table').count(),0);assert.ok(!(await f.page.locator('[data-forja2-diagnostic-result]').innerText()).includes('PRIVATE'));});
});
test('Google diagnostic: changed selection discards late responses',async t=>{
 let release;const hold=new Promise(r=>release=r),f=await fixture(t,{hold}),p=f.page;await open(f);await p.getByRole('button',{name:'Consultar requisitos',exact:true}).click();await f.entered;await p.locator('#forja2DiagnosticTeacher').selectOption('');release();await f.completed;await p.waitForFunction(()=>window.__diagnosticSettled===2);assert.ok((await p.locator('[data-forja2-diagnostic-result]').innerText()).startsWith('Seleção alterada'));assert.equal(await p.locator('[data-forja2-diagnostic-result] table').count(),0);
});
test('Google diagnostic: late response cannot reappear after session change',async t=>{
 let release;const hold=new Promise(r=>release=r),f=await fixture(t,{hold}),p=f.page;await open(f);await p.getByRole('button',{name:'Consultar requisitos',exact:true}).click();await f.entered;await p.evaluate(()=>forjaChangeSession('ANOTHER_SYNTHETIC_ACCOUNT'));release();await f.completed;await p.waitForFunction(()=>window.__diagnosticSettled===2);assert.equal(await p.locator('#modal .modal').count(),0,'official session reset closes the dialog; late responses cannot reopen it');
});
test('Google diagnostic: teachers do not receive the administrative control',async t=>{const f=await fixture(t,{role:'teacher'});assert.equal(await f.page.locator('[data-forja2-google-check]').count(),0);assert.equal(f.calls.length,0);});
