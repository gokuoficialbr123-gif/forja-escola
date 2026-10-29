import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync} from 'node:fs';
import {premiumFixture} from './helpers/agenda-premium-fixture.mjs';
import {setView,reviewDay,nextSnapshot,ready,automaticCycle} from './helpers/agenda-presentation-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
async function evidence(page,name){if(!process.env.FORJA_VISUAL_REVIEW_EVIDENCE_DIR)return;mkdirSync(process.env.FORJA_VISUAL_REVIEW_EVIDENCE_DIR,{recursive:true});await page.screenshot({path:resolve(process.env.FORJA_VISUAL_REVIEW_EVIDENCE_DIR,name+'.png'),fullPage:true,animations:'disabled'});}
test('new view checkpoint ignores a completed renewal of the former period',async t=>{
 const f=await premiumFixture(browser);t.after(()=>f.close());await setView(f,'teacher','week');
 let matched=false;const request=nextSnapshot(f.page,{view:'day'}).then(r=>{matched=true;return r;});const before=f.reads();
 await automaticCycle(f.page);assert.equal(f.reads(),before+1,'one automatic read for the former week');assert.equal(matched,false,'a weekly renewal cannot satisfy the daily view checkpoint');
 await f.page.locator('[data-v621-view="day"][data-role="teacher"]').click();await ready(f.page,{request});
 const query=new URL((await request).url()).searchParams;assert.equal(query.get('from'),query.get('to'));assert.equal(f.reads(),before+2);assert.deepEqual(f.errors,[]);
});
for(const width of [360,768])test('teacher legend remains readable above every calendar '+width,async t=>{
 const f=await premiumFixture(browser,{width,height:1024});t.after(()=>f.close());
 for(const view of ['day','week','month']){
  await setView(f,'teacher',view);const legend=f.page.locator('.forja2-legend');
  assert.equal(await legend.isVisible(),true,'the legend must not inherit a legacy mobile display:none');
  const bounds=await legend.boundingBox();assert.ok(bounds.width<=width&&bounds.height>0);
  assert.equal(await legend.locator('span').count(),5);
 }
 assert.deepEqual(f.errors,[]);
});
for(const width of [360,390])test('psychologist monthly cards remain compact with full accessible text '+width,async t=>{
 const f=await premiumFixture(browser,{role:'psychologist',width,height:844});t.after(()=>f.close());const p=f.page;
 await p.locator('[data-agenda-view="month"]').click();
 assert.equal(await p.locator('.agenda-month-weekday').count(),7,'every monthly column must identify its weekday');
 await p.waitForFunction(()=>agendaRangeKeys().every(day=>state.forjaFixedWeeks?.[gWeekStart(day)]));
 const data=await p.evaluate(()=>{const el=document.querySelector('[data-session="PREMIUM_THERAPY"]');return {height:el.getBoundingClientRect().height,label:el.getAttribute('aria-label'),whiteSpace:getComputedStyle(el.querySelector('b')).whiteSpace};});
 assert.ok(data.height<=76,'a monthly appointment must not wrap into a tall column of fragments');
 assert.equal(data.whiteSpace,'nowrap');assert.match(data.label||'',/10:00–11:00/);assert.match(data.label||'',/Atendimento/);
 assert.equal(await p.locator('[data-session="PREMIUM_THERAPY"] .forja2-operational-compact').innerText(),'10h\nSessão');
 await evidence(p,'psychologist-month-'+width);
 await p.locator(`[data-forja2-therapy-day="${reviewDay}"]`).click();assert.equal(await p.evaluate(()=>state.agendaView),'day');
 assert.equal(await p.locator('[data-session="PREMIUM_THERAPY"]').count(),1);assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher'])test('native agenda markup already owns its presentation scope '+role,async t=>{
 const f=await premiumFixture(browser,{role});t.after(()=>f.close());
 const scoped=await f.page.evaluate(role=>{const template=document.createElement('template');template.innerHTML=role==='admin'?adminPage('agenda'):teacherPage('agenda');return template.content.querySelector(role==='admin'?'.v629-secretary-agenda':'.v625-professor-agenda')?.classList.contains('forja2-agenda');},role);
 assert.equal(scoped,true,'presentation must not depend on a later decoration pass');
});
for(const [role,width] of [['teacher',360],['teacher',768],['admin',768],['student',768],['psychologist',768]])test('last monthly date is reachable above fixed navigation '+role+' '+width,async t=>{
 const f=await premiumFixture(browser,{role,width,height:1024});t.after(()=>f.close());const p=f.page;
 if(['teacher','admin'].includes(role))await setView(f,role,'month');else await p.locator(role==='student'?'[data-g-cal-view="month"]':'[data-agenda-view="month"]').click();
 const selector=['teacher','admin'].includes(role)?'.v621-month-num':role==='student'?'.cal18-daynum':'.agenda-month-date';
 if(role==='psychologist')await p.waitForFunction(()=>agendaRangeKeys().every(day=>state.forjaFixedWeeks?.[gWeekStart(day)]));
 await p.evaluate(selector=>[...document.querySelectorAll(selector)].at(-1).scrollIntoView({block:'end',behavior:'instant'}),selector);await p.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
 const result=await p.evaluate(selector=>{const el=[...document.querySelectorAll(selector)].at(-1),r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {reachable:el===hit||el.contains(hit),rect:r.toJSON(),hit:hit?.className};},selector);
 assert.equal(result.reachable,true,JSON.stringify(result));assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher'])test('boundary hour labels remain inside the time axis '+role,async t=>{
 const f=await premiumFixture(browser,{role,width:390,height:844});t.after(()=>f.close());await setView(f,role,'day');
 const bounds=await f.page.evaluate(()=>{const axis=document.querySelector('.v621-time-axis'),r=axis.getBoundingClientRect(),labels=axis.querySelectorAll('.v621-time-label'),first=labels[0].getBoundingClientRect(),last=labels[labels.length-1].getBoundingClientRect();return {first:first.top-r.top,last:last.bottom-r.bottom};});
 assert.ok(bounds.first>=-1,'07:00 must not extend above the grid: '+JSON.stringify(bounds));
 assert.ok(bounds.last<=1,'22:00 must not extend below the grid: '+JSON.stringify(bounds));assert.deepEqual(f.errors,[]);
 await evidence(f.page,role+'-day-390');
});
