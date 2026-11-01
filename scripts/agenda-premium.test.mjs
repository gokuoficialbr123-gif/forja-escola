import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync} from 'node:fs';
import {premiumFixture,premiumLessons,agendaViewports} from './helpers/agenda-premium-fixture.mjs';
import {agendaPresentationFixture,setView,reviewDay,nextSnapshot,ready} from './helpers/agenda-presentation-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());

test('agenda modality comes only from native data and never from a title',async t=>{
 const f=await premiumFixture(browser);t.after(()=>f.close());
 const values=await f.page.evaluate(()=>['presencial','online','',null,'remoto'].map(modalidade=>window.forjaAgenda2Modality?.({modalidade,nomeAluno:'Aula online presencial'})?.kind));
 assert.deepEqual(values,['presencial','online','unknown','unknown','unknown']);
});
for(const legacyMetadata of [false,true])test('institutional teacher renders no personal actions; inherited legacy metadata '+legacyMetadata,async t=>{
 const f=await premiumFixture(browser,{institutional:true,legacyMetadata});t.after(()=>f.close());
 assert.equal(await f.page.locator('.v622-sync [data-google-action="sync"]').count(),0);
 assert.equal(await f.page.locator('.v622-sync [data-google-action="connect"],.v622-sync [data-v620-google-diagnostics]').count(),0);
 assert.equal(await f.page.locator('[data-forja2-refresh]').count(),1,'the read-only refresh remains available');
 assert.equal(await f.page.locator('[data-personal-google-status]').count(),0);
 assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher'])for(const view of ['day','week','month'])test(`native modality palette ${role} ${view}`,async t=>{
 const f=await premiumFixture(browser,{role});t.after(()=>f.close());await setView(f,role,view);
 const cell=f.page.locator(view==='month'?(role==='admin'?`[data-v629-month-day="${reviewDay}"]`:`[data-v625-month-day="${reviewDay}"]`):(role==='admin'?`[data-v629-day="${reviewDay}"]`:`[data-v621-lane="teacher"][data-date="${reviewDay}"]`));
 for(const [id,kind,color]of [['PREMIUM_ONSITE','presencial','rgb(37, 99, 235)'],['PREMIUM_ONLINE','online','rgb(245, 158, 11)'],['PREMIUM_UNKNOWN','unknown','rgb(100, 116, 139)']]){
  let card=cell.locator(`[data-lesson="${id}"]`);
  if(view==='month'&&id==='PREMIUM_UNKNOWN'){assert.equal(await card.count(),0,'month summarizes excess, it does not squeeze every lesson');const more=cell.locator('.forja2-more-lessons');assert.equal(await more.count(),1);assert.equal((await more.textContent()).trim(),'+1');const request=nextSnapshot(f.page,{view:'day'});await more.click();await ready(f.page,{request});card=f.page.locator(`.v621-block.lesson[data-lesson="${id}"]`);}
  assert.equal(await card.count(),1);
  assert.equal(await card.getAttribute('data-forja2-modality'),kind);
  assert.equal(await card.evaluate(el=>getComputedStyle(el).borderLeftColor),color);
  assert.ok(!(await card.evaluate(el=>getComputedStyle(el).backgroundColor)).includes('26, 115, 232'),'no inherited solid legacy blue');
 }
 assert.equal(await f.page.locator('.forja2-legend').count(),1);assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher','student','parent','psychologist'])for(const viewport of agendaViewports)test(`agenda responsive and isolated ${role} ${viewport.width}`,async t=>{
 const f=await premiumFixture(browser,{role,...viewport});t.after(()=>f.close());const p=f.page;
 const views=role==='parent'?['list']:['day','week','month'];
 for(const view of views){
  if(['admin','teacher'].includes(role)){await setView(f,role,view);await p.waitForFunction(view=>window.forjaAgenda2Context()?.view===view&&/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]')?.textContent||'')&&document.querySelector('[data-lesson="PREMIUM_ONSITE"]'),view,{timeout:6000});}
  else if(role==='student'){await p.locator(`[data-g-cal-view="${view}"][data-g-cal-role="student"]`).click();await p.waitForFunction(view=>state.studentLessonAgendaViewG===view,view);}
  else if(role==='psychologist'){await p.locator(`[data-agenda-view="${view}"]`).click();await p.waitForFunction(view=>state.agendaView===view,view);}
  assert.equal(await p.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)<=innerWidth+1),true,'root and body must fit the viewport');
  if(['student','parent'].includes(role)){
   assert.equal(await p.locator('[data-lesson="FOREIGN_LESSON"],[data-forja2-lesson="FOREIGN_LESSON"]').count(),0,'foreign lessons are never rendered');
   assert.doesNotMatch(await p.locator('#workspaceContent').textContent(),/FOREIGN_PRIVATE_SENTINEL/);
   assert.equal(await p.locator('.forja2-state,.forja2-busy,.v621-block.availability').count(),0,'no private professional availability');
  }
  if(role==='psychologist')assert.equal(await p.locator('[data-session="PREMIUM_THERAPY"]').count(),1,'therapy remains a session');
  else for(const [id,color]of [['PREMIUM_ONSITE','rgb(37, 99, 235)'],['PREMIUM_ONLINE','rgb(245, 158, 11)'],['PREMIUM_UNKNOWN','rgb(100, 116, 139)']]){
   if(view==='month'&&['admin','teacher'].includes(role)&&id==='PREMIUM_UNKNOWN'){assert.equal(await p.locator('.v621-month-tags [data-lesson="PREMIUM_UNKNOWN"]').count(),0);assert.equal(await p.locator('.forja2-more-lessons').count(),1,'summarized lesson retains an explicit day action');continue;}
   const selector=`.forja2-lesson[data-lesson="${id}"],.forja2-lesson[data-forja2-lesson="${id}"]`;
   // Query and measure in one browser task. Locator handles obtained before an
   // SSE repaint can refer to detached nodes, whose computed CSS is empty.
   const palette=await p.evaluate(selector=>[...document.querySelectorAll(selector)].flatMap(el=>{const rect=el.getBoundingClientRect(),style=getComputedStyle(el);return el.isConnected&&rect.width>0&&rect.height>0&&!['hidden','collapse'].includes(style.visibility)?[style.borderLeftColor]:[];}),selector);
   assert.ok(palette.length>0,'native lesson remains available in '+view);
   assert.deepEqual(palette,Array(palette.length).fill(color),'one modality palette across calendars and secondary lesson cards');
   if(role==='student')assert.equal(await p.locator(`.student-b-lesson[data-forja2-lesson="${id}"]`).count(),1,'the final history renderer uses the same modality');
  }
  if(view==='month'&&['student','admin','teacher'].includes(role)){
   const grid=p.locator(role==='student'?'.cal18-month-grid':'.v621-month-grid');
   assert.equal(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),7);
   assert.ok(await grid.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1),'all monthly weekdays fit');
  }
  if(role==='teacher'&&viewport.width<=900){
   const header=p.locator('.v622-topbar');assert.ok((await header.boundingBox()).height<350,'no inherited flex-basis whitespace in the mobile header');
   assert.equal(await header.locator('.forja2-source-status').isVisible(),true,'current source states remain readable');
   const diagnosis=header.locator('.forja2-diagnostic');assert.equal(await diagnosis.locator('summary').isVisible(),true);await diagnosis.locator('summary').click();assert.equal(await header.locator('.sync-copy').isVisible(),true,'original Google controls remain reachable through the source diagnosis');await diagnosis.locator('summary').click();
   assert.equal(await p.locator('.forja2-teacher-filters').evaluate(el=>el.open),false,'filters start compact on mobile/tablet');
  }
  if(process.env.FORJA_AGENDA_EVIDENCE_DIR){mkdirSync(process.env.FORJA_AGENDA_EVIDENCE_DIR,{recursive:true});await p.screenshot({path:resolve(process.env.FORJA_AGENDA_EVIDENCE_DIR,`${role}-${view}-${viewport.width}.png`),fullPage:true,animations:'disabled'});}
  if(view==='month'&&['admin','teacher'].includes(role)){const request=nextSnapshot(p,{view:'day'});await p.locator('.forja2-more-lessons').click();await ready(p,{request});for(const [id,color]of [['PREMIUM_ONSITE','rgb(37, 99, 235)'],['PREMIUM_ONLINE','rgb(245, 158, 11)'],['PREMIUM_UNKNOWN','rgb(100, 116, 139)']]){const card=p.locator(`.v621-block.lesson[data-lesson="${id}"]`);assert.equal(await card.count(),1);assert.equal(await card.evaluate(el=>getComputedStyle(el).borderLeftColor),color);}}
 }
 assert.deepEqual(f.errors,[]);
 assert.equal(f.calls.filter(x=>['POST','PATCH','DELETE'].includes(x.method)&&/google|aulas/.test(x.path)).length,0,'visual navigation does not write or synchronize');
});
test('palette checks observe current cards rather than detached pre-repaint handles',async t=>{
 const f=await premiumFixture(browser);t.after(()=>f.close());const p=f.page;await setView(f,'teacher','day');
 const selector='.forja2-lesson[data-lesson="PREMIUM_ONSITE"]',old=await p.locator(selector).elementHandle(),request=nextSnapshot(p);
 const changed=f.snapshot();changed.items=changed.items.map(item=>({...item,lessons:item.lessons.map(l=>l.id==='PREMIUM_ONSITE'?{...l,id:'PREMIUM_REPLACED'}:l)}));await p.route('**/agenda/snapshot?**',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify(changed)}));await p.evaluate(()=>forjaAgenda2Refresh({manual:true}));await ready(p,{request});
 assert.equal(await old.evaluate(el=>el.isConnected),false,'a changed snapshot legitimately replaces the old card');
 assert.equal(await old.evaluate(el=>getComputedStyle(el).borderLeftColor),'','detached computed CSS reproduces the stale-handle failure');
 assert.deepEqual(await p.evaluate(selector=>[...document.querySelectorAll(selector)].map(el=>({connected:el.isConnected,color:getComputedStyle(el).borderLeftColor})),selector.replace('PREMIUM_ONSITE','PREMIUM_REPLACED')),[{connected:true,color:'rgb(37, 99, 235)'}]);
 assert.deepEqual(f.errors,[]);
});
for(const role of ['student','psychologist'])test('month date keyboard navigation uses the official day view '+role,async t=>{
 const f=await premiumFixture(browser,{role,width:390,height:844});t.after(()=>f.close());const p=f.page;
 await p.locator(role==='student'?'[data-g-cal-view="month"]':'[data-agenda-view="month"]').click();
 const day=p.locator(role==='student'?`[data-forja2-cal-day="${reviewDay}"]`:`[data-forja2-therapy-day="${reviewDay}"]`);await day.focus();await day.press('Enter');
 assert.equal(await p.evaluate(role=>role==='student'?state.studentLessonAgendaViewG:state.agendaView,role),'day');
 assert.equal(await p.evaluate(role=>role==='student'?state.studentLessonAgendaDateG:state.agendaDate,role),reviewDay);assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher','student','parent'])test('official details preserve authorized modality '+role,async t=>{
 const f=await premiumFixture(browser,{role,width:390,height:844});t.after(()=>f.close());const p=f.page;
 await p.route('**/aulas/PREMIUM_*',async route=>{const id=new URL(route.request().url()).pathname.split('/').at(-1),uid=await p.evaluate(()=>state.user.uid);await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({item:premiumLessons(role==='teacher'?uid:'PERF_TEACHER',role==='student'?uid:'PREMIUM_CHILD').find(l=>l.id===id)})});});
 if(['admin','teacher'].includes(role))await setView(f,role,'day');
 await p.locator('[data-lesson="PREMIUM_ONLINE"]').first().click();await p.waitForSelector('.forja2-detail-mode.forja2-online');
 assert.match(await p.locator('.forja2-detail-mode').innerText(),/Online/);assert.equal(await p.locator('.forja2-detail-mode').evaluate(el=>getComputedStyle(el).borderLeftColor),'rgb(245, 158, 11)');
 assert.equal(await p.locator('#modal:not(.hidden)').count(),1);assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher'])test('unknown source stays neutral and never free '+role,async t=>{
 const f=await premiumFixture(browser,{role,mode:'unknown',width:390,height:844});t.after(()=>f.close());await setView(f,role,'day');
 assert.equal(await f.page.locator('.v621-block.availability').count(),0);
 const unknown=f.page.locator('.forja2-state.unknown');assert.ok(await unknown.count()>0);
 assert.equal(await unknown.first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(248, 250, 252)');
 assert.equal(await f.page.locator('.forja2-lesson[data-forja2-modality="online"]').count(),1,'online lesson keeps its modality during source failure');
 assert.deepEqual(f.errors,[]);
});
for(const [reason,label]of [['institutional_rate_limit',/Limite temporário na fonte Google/],['institutional_consent_required',/Autorização institucional incompleta/],['institutional_access_denied',/Acesso ao calendário institucional recusado/],['institutional_configuration',/Configuração da integração institucional indisponível/]])test('institutional source failure has a neutral specific message '+reason,async t=>{
 const f=await agendaPresentationFixture(browser,{role:'teacher',mode:'unknown',transformItem:item=>({...item,personal:{status:'not_applicable',connected:false,sourceMode:'institutional-events-v1'},central:{status:'unavailable',reason}})});t.after(()=>f.close());
 assert.match(await f.page.locator('[data-forja2-status]').innerText(),label);
 assert.equal(await f.page.locator('.v621-block.availability').count(),0);
 assert.equal(await f.page.locator('.v622-sync [data-google-action]').count(),0,'only the Secretariat can address institutional authorization');assert.deepEqual(f.errors,[]);
});
for(const width of [1366,390])test('psychologist calendar preserves its professional render scope '+width,async t=>{
 const f=await premiumFixture(browser,{role:'psychologist',width,height:844});t.after(()=>f.close());
 assert.equal(await f.page.locator('[data-action="newLesson"],[data-action="newSession"],#agendaProfessional,.agenda-f-overview').count(),0,'no Secretariat actions, global professional filter or administrative overview');
 assert.match(await f.page.locator('#workspaceContent').innerText(),/Minha agenda/);
 assert.equal(await f.page.locator('[data-session="PREMIUM_THERAPY"]').count(),1);
 assert.equal(await f.page.locator('[data-lesson]').count(),0,'psychological sessions are not lessons');assert.deepEqual(f.errors,[]);
});
