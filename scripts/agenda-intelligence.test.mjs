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
  const at=Date.now(),days={};for(let d=from;d<=to;){days[d]=[{inicio:'09:00',fim:chosen==='short'?'09:30':'18:00'}];const date=new Date(d+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);d=date.toISOString().slice(0,10);}
  const exclusiveEnd=new Date(Date.parse(to+'T12:00:00Z')+86400000).toISOString().slice(0,10);
  const body={ok:true,policy:'agenda-readonly-v1',from,to,professionalIds:ids,complete:!['partial','mixed'].includes(chosen),checkedAt:new Date(at).toISOString(),servedAt:new Date(at).toISOString(),expiresAt:new Date(at+(chosen==='expired'?-1:25000)).toISOString(),items:ids.map((professionalId,index)=>({professionalId,status:chosen==='partial'||chosen==='mixed'&&index===0?'unavailable':'success',nativeStatus:'success',days,lessons:[],blocks:[],school:chosen==='school'?[{data:from,horaInicio:'00:00',horaFim:'23:59'}]:chosen==='mixed'&&index===1?Object.keys(days).map(data=>({data,horaInicio:'10:00',horaFim:'11:00'})):[],busy:chosen==='all-day'?[{professionalId,startAt:from+'T00:00:00-03:00',endAt:exclusiveEnd+'T00:00:00-03:00',source:'google'}]:[],personal:{status:chosen==='partial'||chosen==='mixed'&&index===0?'unavailable':'success',checkedAt:new Date(at).toISOString()},central:{status:'success',checkedAt:new Date(at).toISOString()}}))};
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

async function confirmedAgenda(page){
 await page.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'));
}
async function fiveAutomaticReads(f){
 const before=f.count();
 for(let i=0;i<5;i++){await f.page.clock.fastForward(20010);await confirmedAgenda(f.page);}
 assert.equal(f.count()-before,5,'one read for each automatic cycle');
}
async function clickListeners(f,expression){
 const {result}=await f.cdp.send('Runtime.evaluate',{expression,objectGroup:'agenda-drawer-regression'});
 const {listeners}=await f.cdp.send('DOMDebugger.getEventListeners',{objectId:result.objectId});
 return listeners.map(x=>x.type).sort();
}

for(const mobile of [false,true])for(const view of ['day','week','month'])test(`green slot uses official drawer before/after five polls ${mobile?'mobile':'desktop'} ${view}`,async t=>{
 const f=await fixture(t,{mobile,clock:true,mode:view==='day'?'short':'free'}),p=f.page;
 let linkReads=0,releasePost,startPost;const posts=[],postStarted=new Promise(resolve=>startPost=resolve),postGate=new Promise(resolve=>releasePost=resolve);
 t.after(()=>releasePost());
 await p.route('**/admin/aluno-materias',async route=>{
  linkReads++;await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({items:[{id:'DRAWER_LINK',alunoId:'PERF_STUDENT',disciplinaId:'MATH',status:'ativo'}]})});
 });
 await p.route('**/profissionais/disponibilidade?**',async route=>{
  const q=new URL(route.request().url()).searchParams,date=q.get('data'),duration=Number(q.get('duracaoMinutos')),end=duration===30?'09:30':'10:00';
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({availabilityPolicy:'confirmed-week-v2',bookingSafetyPolicy:'future-live-google-v1',centralBookingPolicy:'central-booking-fail-closed-v1',serverNow:new Date().toISOString(),items:[{uid:q.get('professionalId'),googleVerification:{status:'verified'},slots:[{inicio:'09:00',fim:end,startAt:date+'T09:00:00-03:00',endAt:date+'T'+end+':00-03:00',status:'disponivel'}]}]})});
 });
 await p.route('**/aulas',async route=>{
  if(route.request().method()!=='POST')return route.fallback();
  const body=route.request().postDataJSON();posts.push(body);startPost();await postGate;
  await route.fulfill({status:201,contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({ok:true,item:{...body,id:'DRAWER_CREATED',status:'confirmada'},warnings:[]})}).catch(()=>{});
 });

 // Establish the subject through the official UI; each green click then passes
 // through the native package and future/live preflight gates before saving.
 await p.locator('[data-v630-open]').first().click();await p.waitForFunction(()=>state.secretarySubjectLinksLoadedD===true);
 await p.locator('#v630Subject').selectOption('MATH');await p.locator('button[data-v630-close]').first().click();
 const date=await p.evaluate(()=>gAddDays(todayKey(),1));
 await p.locator('[data-v621-date="admin"]').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},date);await confirmedAgenda(p);
 await p.locator(`[data-v621-view="${view}"][data-role="admin"]`).click();await confirmedAgenda(p);
 await p.locator('[data-v629-filter="lesson"]').click();await confirmedAgenda(p);
 await p.evaluate(()=>{
  window.drawerOpenCalls=0;let value=state.v630Booking.open;
  Object.defineProperty(state.v630Booking,'open',{enumerable:true,configurable:true,get:()=>value,set:next=>{if(next===true)drawerOpenCalls++;value=next;}});
  window.legacyBookingCalls=0;const legacy=newLessonModal;newLessonModal=function(...args){legacyBookingCalls++;return legacy(...args)};
 });

 let expected;
 for(const phase of ['before','after']){
  if(phase==='after')await fiveAutomaticReads(f);
  if(view==='month'){
   await p.locator(`.v629-month-tag.availability[data-date="${date}"]`).first().click();await confirmedAgenda(p);
  }
  const slot=p.locator(`.v621-block.availability[data-date="${date}"]`).first();
  expected=await slot.evaluate(el=>({teacherId:el.dataset.v621BookSlot,date:el.dataset.date,start:el.dataset.start,duration:Number(el.dataset.duration)}));
  const opens=await p.evaluate(()=>drawerOpenCalls),reads=linkReads;await slot.click();
  assert.equal(await p.evaluate(()=>state.v630Booking.open),true,`${phase}: green slot must open current drawer`);
  await p.waitForFunction(()=>state.secretarySubjectLinksLoadedD===true);
  assert.equal(await p.evaluate(()=>drawerOpenCalls)-opens,1,'one official open per click');
  assert.equal(linkReads-reads,1,'one package load per open');
  assert.equal(await p.evaluate(()=>legacyBookingCalls),0,'legacy booking is never invoked');
  assert.equal(await p.locator('#modal').evaluate(el=>el.classList.contains('hidden')),true);
  assert.equal(await p.locator('#v630BookingRoot.open').count(),1);
  assert.deepEqual(await p.evaluate(()=>({teacherId:state.v630Booking.teacherId,date:state.v630Booking.date,start:state.v630Booking.preferredStart||state.v630Booking.slotStart,duration:state.v630Booking.duration})),expected);
  if(await p.locator('#v630Student').inputValue()!=='PERF_STUDENT')await p.locator('#v630Student').selectOption('PERF_STUDENT');
  await p.waitForFunction(()=>!state.v630Booking.loading&&(state.v630Booking.slotStart==='09:00'||state.v630Booking.error||state.v630Booking.slots.length));
  assert.equal(await p.evaluate(()=>state.v630Booking.slotStart),'09:00',JSON.stringify(await p.evaluate(()=>state.v630Booking)));
  assert.equal(await p.locator('#v630Teacher').inputValue(),expected.teacherId);
  assert.equal(await p.locator('#v630Date').inputValue(),expected.date);
  assert.equal(await p.locator('#v630Duration').inputValue(),String(expected.duration));
  assert.equal(await p.evaluate(()=>state.v630Booking.slotEnd),expected.duration===30?'09:30':'10:00');
  if(phase==='before'){
   await p.locator('button[data-v630-close]').first().click();
   if(view==='month'){await p.locator('[data-v621-view="month"][data-role="admin"]').click();await confirmedAgenda(p);}
  }
 }

 await p.locator('#v630Place').fill('Local presencial em edição');
 const snapshot=()=>p.evaluate(()=>{
  const wrap=document.querySelector('.v621-week-wrap'),root=document.querySelector('#v630BookingRoot');
  return {top:wrap.scrollTop,left:wrap.scrollLeft,filters:JSON.stringify(state.v629SecretaryFilters),selected:JSON.stringify(state.v629SecretarySelectedTeacherIds),context:JSON.stringify(forjaAgenda2Context()),fields:[...root.querySelectorAll('input,select')].map(el=>[el.id,el.value]),slot:[state.v630Booking.slotStart,state.v630Booking.slotEnd],uid:state.user.uid,role:state.role,focus:document.activeElement.id};
 });
 await p.locator('.v621-week-wrap').evaluate(el=>{el.scrollTop=210;el.scrollLeft=95;});
 const form=await p.locator('#v630Place').elementHandle(),before=await snapshot(),listeners=await clickListeners(f,'document');
 await fiveAutomaticReads(f);await p.evaluate(()=>{for(let i=0;i<20;i++)forjaAgenda2Paint()});
 assert.deepEqual(await snapshot(),before,'polling and binds preserve open form, focus, filters, session and scroll');
 assert.equal(await form.evaluate(el=>el===document.querySelector('#v630Place')),true,'form node is preserved');
 assert.deepEqual(await clickListeners(f,'document'),listeners);
 assert.deepEqual(await clickListeners(f,'document.querySelector(".v621-block.availability")'),['click']);
 assert.equal(await p.evaluate(()=>legacyBookingCalls),0);
 const save=p.locator('[data-v630-save]');assert.equal(await save.isEnabled(),true);
 await save.evaluate(el=>{el.dispatchEvent(new MouseEvent('click',{bubbles:true}));el.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
 await Promise.race([postStarted,delay(3000).then(()=>{throw Error('No booking POST received')})]);await delay(30);
 assert.equal(posts.length,1,'double click issues exactly one booking POST');
 assert.deepEqual({teacherId:posts[0].professorId,date:posts[0].dataAula,start:posts[0].horaAula,duration:expected.duration},expected);
 assert.equal(posts[0].horaFim,expected.duration===30?'09:30':'10:00');
 assert.equal(posts[0].localAula,'Local presencial em edição');assert.match(posts[0].bookingRequestId,/^[a-f0-9-]{36}$/);
 releasePost();await p.waitForFunction(()=>state.v630Booking.open===false);
 assert.equal(f.calls.filter(x=>x.path.endsWith('/sync')).length,0);assert.deepEqual(f.errors,[]);
});
