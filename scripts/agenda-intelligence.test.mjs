import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {withoutAgendaIntelligence} from './agenda-intelligence-scope.mjs';
import {performancePortal,delay} from './helpers/performance-portal-fixture.mjs';
import {buildHostingArtifact} from './prepare-hosting.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('exact reversible boundary preserves optimized login and all older integrity guards',()=>{assert.equal(createHash('sha256').update(withoutAgendaIntelligence(html)).digest('hex'),'9643749053f34ab0213512a724fb3949fabc5ae33b6bfdc33056f8f2a3d9234a');assert.throws(()=>withoutAgendaIntelligence(html.replace('AGENDA_RESULT_INVALID','TAMPERED')),/boundary/);});
async function fixture(t,{role='admin',mobile=false,mode='free',clock=false}={}){
 const f=await performancePortal({browser,...buildHostingArtifact(),requestDelay:5,secondaryDelay:5,role,mobile}),p=f.page;let current=mode,count=0,release=null,held=false;
 await p.route('**/agenda/snapshot?**',async route=>{
  count++;const request=new URL(route.request().url()),from=request.searchParams.get('from'),to=request.searchParams.get('to'),ids=request.searchParams.getAll('professionalId'),chosen=current;
  if(held){held=false;await new Promise(r=>release=r);}
  const at=Date.now(),days={};for(let d=from;d<=to;){days[d]=[{inicio:'09:00',fim:'18:00'}];const date=new Date(d+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);d=date.toISOString().slice(0,10);}
  const body={ok:true,policy:'agenda-readonly-v1',from,to,professionalIds:ids,complete:!['partial','mixed'].includes(chosen),checkedAt:new Date(at).toISOString(),servedAt:new Date(at).toISOString(),expiresAt:new Date(at+(chosen==='expired'?-1:25000)).toISOString(),items:ids.map((professionalId,index)=>({professionalId,status:chosen==='partial'||chosen==='mixed'&&index===0?'unavailable':'success',nativeStatus:'success',days,lessons:[],blocks:[],school:chosen==='school'?[{data:from,horaInicio:'00:00',horaFim:'23:59'}]:chosen==='mixed'&&index===1?Object.keys(days).map(data=>({data,horaInicio:'10:00',horaFim:'11:00'})):[],busy:chosen==='all-day'?[{professionalId,startAt:from+'T00:00:00-03:00',endAt:to+'T23:59:00-03:00',source:'google'}]:[],personal:{status:chosen==='partial'||chosen==='mixed'&&index===0?'unavailable':'success',checkedAt:new Date(at).toISOString()},central:{status:'success',checkedAt:new Date(at).toISOString()}}))};
  if(chosen==='network')return route.abort();if(chosen==='quota')return route.fulfill({status:429,headers:{'Access-Control-Allow-Origin':f.origin},contentType:'application/json',body:'{"error":"Limite simulado"}'});
  return route.fulfill({headers:{'Access-Control-Allow-Origin':f.origin},contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
 });
 t.after(()=>f.close());if(clock)await p.clock.install();await p.evaluate(()=>{const Native=BroadcastChannel;window.fixtureBroadcastNames=[];window.fixtureBroadcastClosed=0;window.BroadcastChannel=class extends Native{constructor(name){super(name);fixtureBroadcastNames.push(name)}close(){fixtureBroadcastClosed++;return super.close()}};});await f.login();await p.waitForFunction(()=>state.profile&&!state.loading);await p.evaluate(()=>navigate('agenda'));await p.locator('[data-forja2-status]').waitFor();
 await p.waitForFunction(()=>!document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consultando'));
 return {...f,setMode:x=>current=x,count:()=>count,holdNext:()=>held=true,release:()=>release?.()};
}
for(const role of ['admin','teacher'])for(const mode of ['all-day','school','partial','expired'])test(`${role}: ${mode} never offers false green; unknown differs from confirmed blocking`,async t=>{
 const f=await fixture(t,{role,mode}),p=f.page;
 if(mode==='school'){await p.locator(`[data-v621-view="day"][data-role="${role}"]`).click();await p.waitForFunction(()=>document.querySelectorAll('.forja2-band.busy').length>0);}
 assert.equal(await p.locator('.v621-block.availability').count(),0);
 assert.ok(await p.locator('.forja2-band.'+(['all-day','school'].includes(mode)?'busy':'unknown')).count()>0);assert.deepEqual(f.errors,[]);
});
test('20-second reads pause while hidden/closed, resume immediately and never invoke sync',async t=>{
 const f=await fixture(t,{clock:true}),p=f.page;const initial=f.count();await p.clock.fastForward(20010);await p.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'));assert.equal(f.count(),initial+1);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await p.clock.fastForward(60000);assert.equal(f.count(),initial+1);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'));assert.equal(f.count(),initial+2);
 await p.evaluate(()=>navigate('inicio'));await p.clock.fastForward(60000);assert.equal(f.count(),initial+2);assert.equal(f.calls.filter(x=>x.path.endsWith('/sync')).length,0);
});
for(const mode of ['quota','network','partial'])test(`${mode}: manual feedback is honest, green disappears and retries back off`,async t=>{
 const f=await fixture(t,{clock:true}),p=f.page;f.setMode(mode);await p.locator('[data-v629-refresh]').click();await p.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.includes('incompleta'));assert.equal(await p.locator('.v621-block.availability').count(),0);const count=f.count();await p.clock.fastForward(20010);assert.equal(f.count(),count);await p.clock.fastForward(20010);await delay(50);assert.equal(f.count(),count+1);assert.ok(!(await p.locator('#toast').textContent()).includes('Disponibilidade e Google atualizados.'));
});
test('new period cancels late replies; logout cannot receive previous agenda data',async t=>{
 const f=await fixture(t),p=f.page;f.setMode('all-day');f.holdNext();await p.evaluate(()=>{void forjaAgenda2Refresh();});await delay(30);f.setMode('free');await p.locator('[data-v621-nav="next"][data-role="admin"]').click();await p.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'));f.release();await delay(50);assert.ok(await p.locator('.v621-block.availability').count()>0);assert.equal(await p.locator('.forja2-band.busy').count(),0);
 f.holdNext();await p.evaluate(()=>{void forjaAgenda2Refresh();});await delay(30);await p.evaluate(()=>forjaEndSession());f.release();await delay(50);assert.equal(await p.evaluate(()=>state.profile),null);assert.equal(await p.evaluate(()=>forjaAgenda2Periods('PERF_TEACHER',todayKey()).length),0);
});
for(const mobile of [false,true])test(`discrete refresh preserves drawer/form, filters and scroll ${mobile?'mobile':'desktop'}`,async t=>{
 const f=await fixture(t,{mobile}),p=f.page;await p.locator('[data-v630-open]').first().click();await p.locator('#v630Place').fill('Local em edição');const before=await p.evaluate(()=>{const wrap=document.querySelector('.v621-week-wrap');wrap.scrollTop=210;wrap.scrollLeft=120;return {top:wrap.scrollTop,left:wrap.scrollLeft,filters:JSON.stringify(state.v629SecretaryFilters)}});
 await p.evaluate(()=>forjaAgenda2Refresh());assert.equal(await p.locator('#v630Place').inputValue(),'Local em edição');assert.deepEqual(await p.evaluate(()=>{const wrap=document.querySelector('.v621-week-wrap');return {top:wrap.scrollTop,left:wrap.scrollLeft,filters:JSON.stringify(state.v629SecretaryFilters)}}),before);
 await p.locator('button[data-v630-close]').first().click();const root=process.env.FORJA_AGENDA_EVIDENCE_DIR;if(root){mkdirSync(root,{recursive:true});await p.locator('.v621-week-wrap').evaluate(el=>{el.scrollTop=0;el.scrollLeft=0;});await p.screenshot({path:resolve(root,`agenda2-${mobile?'mobile':'desktop'}.png`),fullPage:true});}assert.deepEqual(f.errors,[]);
});
test('same browser tabs coalesce simultaneous reads through a lock and memory-only broadcast',async t=>{
 const f=await fixture(t),p=f.page,second=await f.openTab();await second.evaluate(()=>{window.__perfActivation=__perfSignIn();});await second.waitForFunction(()=>state.profile&&!state.loading);
 const release=f.hold('/agenda/snapshot');const before=f.calls.filter(x=>x.path==='/agenda/snapshot').length;await second.evaluate(()=>navigate('agenda'));await delay(50);await p.evaluate(()=>{void forjaAgenda2Refresh();});await delay(50);release();await second.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'));await p.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'));assert.ok(f.calls.filter(x=>x.path==='/agenda/snapshot').length-before<=1);assert.deepEqual(f.errors,[]);
});
for(const mobile of [false,true])test(`mixed professionals retain independent states and all four colors ${mobile?'mobile':'desktop'}`,async t=>{
 const f=await fixture(t,{mobile}),p=f.page;f.setMode('mixed');await p.evaluate(()=>{state.users.push({uid:'PERF_TEACHER_2',role:'teacher',active:true,fullName:'Segundo professor sintético',disciplinaIds:['MATH']});});await p.locator('[data-v629-select-all]').click();await p.locator('[data-v621-view="day"][data-role="admin"]').click();
 await p.waitForFunction(()=>document.querySelector('.forja2-band.unknown')&&document.querySelector('.forja2-band.available')&&document.querySelector('.forja2-band.busy')&&document.querySelector('.forja2-band.outside'));await p.evaluate(()=>renderPage());await delay(50);assert.equal(await p.locator('[data-forja2-status]').count(),1);assert.equal(await p.locator('.forja2-legend').count(),1);assert.equal(await p.locator('[data-v629-refresh]').textContent(),'Atualizar consulta');assert.ok(await p.locator('.v621-block.school').count()>0);
 assert.ok(await p.locator('.v621-block.availability').count()>0);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const root=process.env.FORJA_AGENDA_EVIDENCE_DIR;if(root){mkdirSync(root,{recursive:true});await p.screenshot({path:resolve(root,`agenda2-four-colors-${mobile?'mobile':'desktop'}.png`),fullPage:true});}assert.deepEqual(f.errors,[]);
});
test('a stalled token read times out without signing out or blocking navigation',async t=>{
 const f=await fixture(t,{clock:true}),p=f.page;await p.evaluate(()=>{window.savedAgendaToken=auth.currentUser.getIdToken;auth.currentUser.getIdToken=()=>new Promise(r=>window.releaseAgendaToken=r);void forjaAgenda2Refresh();});await p.clock.fastForward(15010);await p.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta incompleta'));assert.equal(await p.locator('.v621-block.availability').count(),0);await p.evaluate(()=>{auth.currentUser.getIdToken=savedAgendaToken;navigate('conta');});assert.equal(await p.evaluate(()=>state.profile.role),'admin');assert.equal(await p.evaluate(()=>state.page),'conta');assert.deepEqual(f.errors,[]);
});
test('tab channels are private to UID/context and close when the session changes',async t=>{
 const f=await fixture(t),p=f.page,names=await p.evaluate(()=>fixtureBroadcastNames);assert.ok(names.length>0);assert.ok(names.every(name=>name.includes('PERF_ADMIN')&&name.includes('"admin"')));await p.evaluate(()=>forjaEndSession());assert.ok(await p.evaluate(()=>fixtureBroadcastClosed>0));
});
test('transport delay cannot restart the twenty-five-second source validity',async t=>{
 const f=await fixture(t,{clock:true}),p=f.page;f.holdNext();await p.evaluate(()=>{void forjaAgenda2Refresh();});await delay(100);await p.clock.fastForward(10000);f.release();await p.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'));const count=f.count();await p.clock.fastForward(15010);assert.equal(f.count(),count);assert.equal(await p.locator('.v621-block.availability').count(),0);assert.ok(await p.locator('.forja2-band.unknown').count()>0);
});
