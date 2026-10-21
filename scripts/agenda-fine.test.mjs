import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {agendaPresentationFixture,setView,reviewDay,automaticCycle,nextSnapshot,ready} from './helpers/agenda-presentation-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const sizes=[[1920,1080,'desktop'],[1366,768,'notebook'],[768,1024,'tablet'],[390,844,'mobile'],[360,640,'small']];
const evidence=resolve('docs/evidence/agenda-fine');
const dense=uid=>[['A','10:00','11:00'],['B','10:30','11:30'],['C','11:30','11:45'],['D','12:00','13:30']].map(([id,horaAula,horaFim])=>({id:'FINE_'+id,professorId:uid,nomeProfessor:'Professor sintético',alunoId:'PERF_STUDENT',nomeAluno:'Aluno sintético '+id+' com nome completo',disciplinaId:'MATH',dataAula:reviewDay,horaAula,horaFim,status:'confirmada',modalidade:'presencial',localAula:'Sala sintética',...(id==='D'?{recurrenceGroupId:'SYNTHETIC_SERIES'}:{})}));
const transform=x=>({...x,busy:[],blocks:[],school:[],lessons:dense(x.professionalId)});
const lane=(p,role)=>p.locator(role==='admin'?`[data-v629-day="${reviewDay}"]`:`[data-v621-lane="teacher"][data-date="${reviewDay}"]`);
async function fixture(t,options={}){const f=await agendaPresentationFixture(browser,options);t.after(()=>f.close());return f;}
async function detailRoutes(f,{hold}={}){await f.page.route('**/aulas/FINE_*',async route=>{
 if(hold)await hold;
 const id=new URL(route.request().url()).pathname.split('/').at(-1),uid=await f.page.evaluate(()=>state.role==='teacher'?state.user.uid:'PERF_TEACHER');
 await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({item:dense(uid).find(l=>l.id===id)})});
});}
async function noOverlaps(locator){const data=await locator.evaluate(el=>{
 const cards=[...el.querySelectorAll('.v621-block,.forja2-state')].map(e=>({id:e.dataset.lesson||e.className,...e.getBoundingClientRect().toJSON()}));
 const overlaps=[];for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const a=cards[i],b=cards[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([a.id,b.id]);}return {cards,overlaps};
});assert.deepEqual(data.overlaps,[],'every lesson, cut availability and background has its own visible space');return data;}

for(const role of ['admin','teacher'])for(const [width,height,label] of sizes)test(`Agenda fine geometry and reachable actions ${role} ${label}`,async t=>{
 const f=await fixture(t,{role,mobile:width<=900,transformItem:transform}),p=f.page;await p.setViewportSize({width,height});await detailRoutes(f);
 for(const view of ['day','week','month']){
  await setView(f,role,view);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(view!=='month'){
   const geometry=await noOverlaps(lane(p,role));assert.equal(geometry.cards.filter(x=>x.id.startsWith('FINE_')).length,4);
   const lessons=lane(p,role).locator('[data-lesson]');for(const b of await lessons.all()){assert.match(await b.getAttribute('aria-label'),/Aluno sintético/);assert.match(await b.getAttribute('aria-label'),/\d\d:\d\d–\d\d:\d\d/);}
   assert.equal(await lessons.nth(0).getAttribute('data-forja2-column'),'0');assert.equal(await lessons.nth(1).getAttribute('data-forja2-column'),'1');assert.equal(await lessons.nth(2).getAttribute('data-forja2-column'),'0','consecutive lesson regains full width');
  }else{
   const grid=p.locator('.v621-month-grid');assert.equal(await grid.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   if(width<=900)assert.equal(await p.locator('.v621-month-tag.availability,.v629-month-tag.availability').first().evaluate(el=>getComputedStyle(el,'::before').content),'"Livre"','mobile and tablet label retain meaning without relying on color');
  }
  if(process.env.FORJA_CAPTURE_AGENDA==='1'){mkdirSync(evidence,{recursive:true});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.screenshot({path:resolve(evidence,`after-${role}-${label}-${view}.png`),fullPage:true,animations:'disabled'});}
 }
 await setView(f,role,'day');await lane(p,role).locator('[data-lesson="FINE_A"]').click();await p.waitForFunction(()=>document.querySelector('#modalTitle')?.textContent==='Central da Aula');
 const bounds=await p.locator('#modal .modal').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'entire Agenda detail stays within viewport, including small mobile');
 assert.equal(await p.locator('#modal .modal-body').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await p.locator('[data-cancel-lesson="FINE_A"]').scrollIntoViewIfNeeded();
 assert.equal(await p.locator('[data-cancel-lesson="FINE_A"]').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'detail actions remain reachable above the fixed footer');
 await p.locator('#modal [data-close-modal]').first().press('Escape');
 if(role==='admin'){await p.locator('[data-v630-open]:visible').click();await p.locator('.v630-drawer').waitFor();const r=await p.locator('.v630-drawer').boundingBox();assert.ok(r.x>=-1&&r.y>=-1&&r.x+r.width<=width+1&&r.y+r.height<=height+1,'official drawer stays inside viewport');await p.locator('#v630Place').press('Escape');}
 assert.deepEqual(f.errors,[]);
});

for(const role of ['admin','teacher'])for(const mobile of [false,true])test(`newly polled lesson canonical details and one cancellation ${role} ${mobile}`,async t=>{
 let cancelled=false,patches=0;
 const f=await fixture(t,{role,mobile,transformItem:x=>{const item=transform(x);if(cancelled)item.lessons[0].status='cancelada_admin';return item;}}),p=f.page;
 await detailRoutes(f);await setView(f,role,'day');const reads=f.reads();for(let i=0;i<5;i++)await automaticCycle(p);assert.equal(f.reads()-reads,5);
 assert.equal(await p.evaluate(()=>state.lessons.some(l=>l.id==='FINE_A')),false,'lesson is first discovered by snapshot, not initial list');
 await lane(p,role).locator('[data-lesson="FINE_A"]').click();await p.waitForFunction(()=>document.querySelector('#modalTitle')?.textContent==='Central da Aula');
 assert.match(await p.locator('#modal').textContent(),/60 min \(prevista\)/);assert.equal(await p.evaluate(()=>state.lessons.some(l=>l.id==='FINE_A')),true,'canonical authorized detail supports existing actions');
 if(process.env.FORJA_CAPTURE_AGENDA==='1')await p.screenshot({path:resolve(evidence,`after-${role}-${mobile?'mobile':'desktop'}-detail.png`),animations:'disabled'});
 const before=await p.locator('#modal').innerHTML();await automaticCycle(p);assert.equal(await p.locator('#modal').innerHTML(),before,'polling preserves the open detail');
 await p.locator('[data-cancel-lesson="FINE_A"]').click();assert.equal(await p.locator('#modalTitle').textContent(),'Cancelar aula');await p.locator('#cancelReason').fill('Cancelamento sintético de teste');
 await automaticCycle(p);assert.equal(await p.locator('#cancelReason').inputValue(),'Cancelamento sintético de teste');
 await p.route('**/aulas/FINE_A/cancelar',async route=>{patches++;cancelled=true;const uid=await p.evaluate(()=>state.role==='teacher'?state.user.uid:'PERF_TEACHER');await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({cancellationState:'cancelled',item:{...dense(uid)[0],status:'cancelada_admin'}})});});
 await p.locator('#modalSave').evaluate(el=>{el.click();el.click();});await p.waitForFunction(()=>document.querySelector('#modal').classList.contains('hidden'));assert.equal(patches,1,'one existing cancel action, even on double click');
 // The existing cancellation flow invalidates the snapshot and then reloads
 // native lists. Wait for that committed refresh, rather than racing it with a
 // second manual read that it may legitimately cancel.
 await p.locator('.forja2-cancelled[data-lesson="FINE_A"]').waitFor();await p.waitForFunction(()=>!state.loading);await ready(p);assert.equal(await lane(p,role).locator('[data-lesson="FINE_A"]').count(),0);assert.equal(await p.locator('.forja2-cancelled[data-lesson="FINE_A"]').count(),1);
 assert.equal(f.calls.filter(x=>/\/sync$/.test(x.path)).length,0);assert.deepEqual(f.errors,[]);
});

for(const role of ['admin','teacher'])test(`late Agenda detail cannot reopen, replace a form, or cross a session ${role}`,async t=>{
 const f=await fixture(t,{role,transformItem:transform}),p=f.page;await setView(f,role,'day');let release;const gate=new Promise(r=>release=r);t.after(()=>release());await detailRoutes(f,{hold:gate});
 const request=p.waitForRequest(r=>new URL(r.url()).pathname==='/aulas/FINE_A');await lane(p,role).locator('[data-lesson="FINE_A"]').click();await request;
 await p.locator('#modal [data-close-modal]').first().click();await p.evaluate(()=>modal('Rascunho preservado','<input id="fineDraft" value="Texto sintético">'));
 release();await p.waitForResponse(r=>new URL(r.url()).pathname==='/aulas/FINE_A');await new Promise(r=>setTimeout(r,100));
 assert.equal(await p.locator('#modalTitle').textContent(),'Rascunho preservado');assert.equal(await p.locator('#fineDraft').inputValue(),'Texto sintético');
 assert.equal(await p.evaluate(()=>state.lessons.some(l=>l.id==='FINE_A')),false,'discarded detail cannot seed new actions');await p.locator('#fineDraft').press('Escape');assert.equal(await p.locator('#modal').isVisible(),false);assert.equal(await p.locator('#portalApp').isVisible(),true);assert.deepEqual(f.errors,[]);
});

for(const mobile of [false,true])test(`teacher month indicators and extra lessons open the official day ${mobile}`,async t=>{
 const f=await fixture(t,{mobile,transformItem:transform}),p=f.page;await setView(f,'teacher','month');const cell=p.locator(`[data-v625-month-day="${reviewDay}"]`);
 await cell.locator('.availability').click();await p.waitForFunction(()=>state.teacherLessonAgendaViewG==='day');await ready(p);assert.equal(await lane(p,'teacher').locator('[data-lesson]').count(),4);assert.deepEqual(f.errors,[]);
});

for(const role of ['admin','teacher'])test(`detail Escape returns focus to the repainted lesson ${role}`,async t=>{
 const f=await fixture(t,{role,transformItem:transform}),p=f.page;await detailRoutes(f);await setView(f,role,'day');await lane(p,role).locator('[data-lesson="FINE_A"]').click();await p.waitForFunction(()=>document.querySelector('#modalTitle')?.textContent==='Central da Aula');
 for(let i=0;i<5;i++)await automaticCycle(p);await p.locator('#modal [data-close-modal]').first().press('Escape');
 await p.waitForFunction(()=>document.activeElement?.dataset.lesson==='FINE_A');assert.equal(await p.locator('#modal').isVisible(),false);assert.deepEqual(f.errors,[]);
});

for(const role of ['admin','teacher'])test(`month date keyboard action keeps focus across five polls ${role}`,async t=>{
 const f=await fixture(t,{role,mobile:true}),p=f.page;await setView(f,role,'month');const button=p.locator(`[data-forja2-date="${reviewDay}"]`);await button.focus();const start=f.reads();
 for(let i=0;i<5;i++)await automaticCycle(p);assert.equal(f.reads()-start,5);assert.equal(await p.evaluate(()=>document.activeElement?.dataset.forja2Date),reviewDay);
 await button.press('Enter');await p.waitForFunction(role=>document.querySelector(`[data-v621-view="day"][data-role="${role}"]`)?.classList.contains('active'),role);await ready(p);assert.equal(await lane(p,role).count(),1);assert.deepEqual(f.errors,[]);
});

test('mobile Secretary filters are reachable, preserve selection/search and collapse without losing calendar context',async t=>{
 const f=await fixture(t,{role:'admin',mobile:true}),p=f.page;const details=p.locator('.forja2-filters');assert.equal(await details.getAttribute('open'),null);
 await details.locator('summary').click();await p.locator('#v629TeacherSearch').fill('sintético');await automaticCycle(p);assert.equal(await p.locator('#v629TeacherSearch').inputValue(),'sintético');
 const selection=await p.evaluate(()=>[...state.v629SecretarySelectedTeacherIds]);await details.locator('summary').click();await p.evaluate(()=>navigate('inicio'));await p.evaluate(()=>navigate('agenda'));await ready(p);
 assert.equal(await details.getAttribute('open'),null);assert.deepEqual(await p.evaluate(()=>state.v629SecretarySelectedTeacherIds),selection);await details.locator('summary').click();assert.equal(await p.locator('#v629TeacherSearch').inputValue(),'sintético');
 assert.deepEqual(f.errors,[]);
});

for(const mobile of [false,true])test(`Secretary selection of 50 professionals keeps readable, separate columns ${mobile}`,async t=>{
 const f=await fixture(t,{role:'admin',mobile,mode:'free'}),p=f.page;
 const request=nextSnapshot(p);await p.evaluate(()=>{for(let i=1;i<50;i++)state.users.push({uid:'QA_'+i,fullName:'Professor sintético '+i,role:'teacher',active:true});state.v629SecretarySelectionTouched=true;state.v629SecretarySelectedTeacherIds=state.users.filter(x=>x.role==='teacher').map(x=>x.uid);renderPage();});await ready(p,{request});await setView(f,'admin','day');
 assert.equal(await lane(p,'admin').locator('.availability').count(),50);const widths=await lane(p,'admin').locator('.availability').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));assert.ok(widths.every(w=>w>=96),'minimum readable width per professional, using internal scroll');await noOverlaps(lane(p,'admin'));
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const wrap=p.locator('.v621-week-wrap.v626-day-mode');assert.ok(await wrap.evaluate(el=>el.scrollWidth>el.clientWidth));
 const widthsAligned=await p.locator('.v621-week-wrap.v626-day-mode > .v621-week').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));assert.ok(Math.abs(widthsAligned[0]-widthsAligned[1])<1,'days and hour grid have exactly the same width');assert.deepEqual(f.errors,[]);
});

test('teacher mobile exposes all native filters and fixed availability without losing edits or polling context',async t=>{
 const f=await fixture(t,{role:'teacher',mobile:true}),p=f.page;const details=p.locator('.forja2-teacher-filters');assert.equal(await details.getAttribute('open'),null);assert.equal(await p.locator('[data-fixed-open]:visible').count(),1,'original fixed availability action stays visible when filters are collapsed');
 await details.locator('summary').click();assert.equal(await p.locator('[data-v624-filter]:visible').count(),3);assert.equal(await p.locator('[data-fixed-open]:visible').count(),1);
 await p.locator('[data-v624-filter="busy"]').click();await ready(p);assert.equal(await details.getAttribute('open'),'');assert.equal(await p.evaluate(()=>state.v624Filters.busy),false);
 const reads=f.reads();for(let i=0;i<5;i++)await automaticCycle(p);assert.equal(f.reads()-reads,5);assert.equal(await p.evaluate(()=>state.v624Filters.busy),false);
 await details.locator('summary').click();await p.evaluate(()=>navigate('inicio'));await p.evaluate(()=>navigate('agenda'));await ready(p);assert.equal(await details.getAttribute('open'),null);await details.locator('summary').click();assert.equal(await p.locator('[data-v624-filter]:visible').count(),3);assert.equal(await p.evaluate(()=>state.v624Filters.busy),false);assert.deepEqual(f.errors,[]);
});

for(const role of ['admin','teacher'])for(const mobile of [false,true])test(`Agenda internal scroll survives filters, navigation, five polls and clears by session ${role} ${mobile}`,async t=>{
 const f=await fixture(t,{role,mobile}),p=f.page,details=p.locator('.forja2-filters');if(!(await details.evaluate(el=>el.open)))await details.locator('summary').click();
 const position=()=>p.locator('.v621-week-wrap').evaluate(el=>({top:el.scrollTop,left:el.scrollLeft}));
 await p.locator('.v621-week-wrap').evaluate(el=>{el.scrollTop=80;el.scrollLeft=80;});await p.waitForFunction(()=>Object.values(state.forjaAgenda2Scrolls||{}).some(x=>x.top>0));const expected=await position();assert.ok(expected.top>0);
 await p.locator(role==='admin'?'[data-v629-filter="busy"]':'[data-v624-filter="busy"]').click();await ready(p);assert.deepEqual(await position(),expected,'filter repaint preserves both axes');
 const before=f.reads();for(let i=0;i<5;i++)await automaticCycle(p);assert.equal(f.reads()-before,5);assert.deepEqual(await position(),expected);
 await p.evaluate(()=>navigate('inicio'));await p.evaluate(()=>navigate('agenda'));await ready(p);assert.deepEqual(await position(),expected,'same session and period recover the exact scroll');
 await p.evaluate(()=>forjaChangeSession('QA_ANOTHER_SESSION'));assert.equal(await p.evaluate(()=>state.forjaAgenda2Scrolls),undefined,'view positions never cross session ownership');assert.deepEqual(f.errors,[]);
});
