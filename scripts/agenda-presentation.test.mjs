import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {agendaPresentationFixture,reviewDay,ready,setView} from './helpers/agenda-presentation-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const signatures=new Map();
const laneFor=(p,role,date=reviewDay)=>p.locator(role==='admin'?`[data-v629-day="${date}"]`:`[data-v621-lane="teacher"][data-date="${date}"]`);
async function cycles(f){const start=f.reads();for(let n=0;n<5;n++){await f.page.clock.fastForward(20010);await ready(f.page);}assert.equal(f.reads()-start,5,'exactly five automatic reads');}
async function refresh(f,mode){f.setMode(mode);await f.page.evaluate(()=>forjaAgenda2Refresh());await ready(f.page);}
async function setDay(f,role,date){await f.page.locator(`[data-v621-date="${role}"]`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('change',{bubbles:true}));},date);await ready(f.page);}
async function geometry(lane){return lane.evaluate(el=>{
 const base=el.getBoundingClientRect(),cards=[...el.querySelectorAll('.v621-block,.forja2-state')].map(x=>({cls:x.className,top:parseFloat(x.style.top),height:parseFloat(x.style.height),rect:x.getBoundingClientRect().toJSON()})),overlaps=[];
 for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++){const a=cards[i].rect,b=cards[j].rect;if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1)overlaps.push([cards[i].cls,cards[j].cls]);}
 return {height:base.height,overlaps,cards:cards.map(({cls,top,height})=>({cls,top,height})),now:el.querySelector('.v623-now-line')?.style.top};
 });}

for(const role of ['teacher','admin'])for(const mobile of [false,true])for(const view of ['day','week','month'])test(`one agenda representation ${role} ${mobile?'mobile':'desktop'} ${view}`,async t=>{
 const f=await agendaPresentationFixture(browser,{role,mobile});t.after(()=>f.close());const p=f.page;await setView(f,role,view);
 assert.equal(await p.locator('.forja2-legend').count(),1);assert.equal(await p.locator('.forja2-legend span').count(),5);assert.equal(await p.locator('[data-forja2-status]').count(),1);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no page overflow');
 assert.equal(await p.locator('.v623-two-way').count(),0,'no stale frontend sync promise');
 if(role==='admin'){assert.equal(await p.locator('[data-v630-open]:visible').count(),1,'one official main booking action');assert.equal(await p.locator('.v630-edge-tab:visible').count(),0);}
 assert.equal(await p.locator('.forja2-band.available').count(),0,'green is represented only by its official card');
 let before;
 if(view!=='month'){
  const lane=laneFor(p,role);assert.equal(await lane.locator('.forja2-busy[data-forja2-start="09:00"]').count(),1,'personal and central overlap is one red card');
  assert.match(await lane.locator('[data-forja2-start="09:00"]').getAttribute('data-forja2-origin'),/Google central · Google pessoal/);
  assert.equal(await lane.locator('.v621-block.lesson').count(),1);assert.match(await lane.locator('.v621-block.lesson').getAttribute('title'),/Também ocupado · Google pessoal/);
  assert.equal(await lane.locator('[data-forja2-start="13:00"]').count(),0,'blue keeps priority without a second red layer');
  const g=await geometry(lane);assert.equal(g.height,720);assert.deepEqual(g.overlaps,[],'no backgrounds or cards obscure other cards');
  const expected=await p.evaluate(()=>{const n=zonedDateParts(new Date());return ((Number(n.hour)*60+Number(n.minute)-420)*48/60)});assert.ok(Math.abs(parseFloat(g.now)-expected)<1,'current-time line uses the minute scale');
  const key=mobile+':'+view,sig=g.cards.map(x=>[x.cls.includes('availability')?'available':x.cls.includes('lesson')?'lesson':x.cls.includes('unknown')?'unknown':x.cls.includes('outside')?'outside':'busy',x.top,x.height]);
  if(role==='teacher')signatures.set(key,sig);else assert.deepEqual(sig,signatures.get(key),'teacher and secretary use the same occupied/free intervals');
  before=await lane.locator('.v621-block,.forja2-state').count();
 }else{
  assert.equal(await p.locator('.forja2-month.available,.forja2-month.busy,.forja2-month.unknown').count(),0,'a month cell never claims all professionals share one state');
  assert.equal(await p.locator('.v621-month-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'all seven month columns fit the calendar');
  const separation=await p.evaluate(()=>({titleBottom:document.querySelector('.v621-cal-toolbar strong').getBoundingClientRect().bottom,daysTop:document.querySelector('.v621-month-head').getBoundingClientRect().top}));assert.ok(separation.titleBottom<=separation.daysTop+1,'month title never overlaps weekdays');
 }
 await cycles(f);
 if(view!=='month'){assert.equal(await laneFor(p,role).locator('.v621-block,.forja2-state').count(),before);assert.deepEqual((await geometry(laneFor(p,role))).overlaps,[]);}
 assert.equal(await p.locator('.forja2-legend').count(),1);assert.equal(await p.locator('[data-forja2-status]').count(),1);
 assert.equal(f.calls.filter(x=>/\/sync$/.test(x.path)).length,0,'polling never invokes bidirectional synchronization');
 assert.equal(f.calls.filter(x=>x.path==='/me').length,1,'polling adds no login reads');
 await refresh(f,'external');
 if(view!=='month'){
  const lane=laneFor(p,role);assert.equal(await lane.locator('[data-forja2-start="11:00"][data-forja2-end="12:00"]').count(),1);
  const greens=await lane.locator('.availability').evaluateAll(xs=>xs.map(x=>({top:parseFloat(x.style.top),bottom:parseFloat(x.style.top)+parseFloat(x.style.height)})));assert.ok(greens.every(x=>x.bottom<=192||x.top>=240),'external busy removes green immediately after read');
 }
 for(const mode of ['all-day','multi-day']){
  await refresh(f,mode);
  const cell=view==='month'?p.locator(role==='admin'?`[data-v629-month-day="${reviewDay}"]`:`[data-v625-month-day="${reviewDay}"]`):laneFor(p,role);
  assert.equal(await cell.locator('.availability,.forja2-band.available').count(),0,mode+' never displays green');
  if(view!=='month'){const busy=cell.locator('.forja2-busy');assert.equal(await busy.count(),1);assert.equal(await busy.evaluate(el=>parseFloat(el.style.height)),720);}
  const covered=mode==='multi-day'?['2026-10-21','2026-10-22']:[],exclusive=mode==='multi-day'?'2026-10-23':'2026-10-21';
  for(const day of [...covered,exclusive]){
   if(view==='day')await setDay(f,role,day);
   const current=view==='month'?p.locator(role==='admin'?`[data-v629-month-day="${day}"]`:`[data-v625-month-day="${day}"]`):laneFor(p,role,day),green=await current.locator('.availability').count();
   assert.equal(green>0,day===exclusive,mode+': covered days stay blocked; exclusive midnight end frees the next day');
  }
  if(view==='day')await setDay(f,role,reviewDay);
 }
 await refresh(f,'unknown');assert.equal(await p.locator('.v621-block.availability,.v621-month-tag.availability,.v629-month-tag.availability').count(),0);
 assert.ok(await p.locator(view==='month'?'[data-forja2-month-status].unknown':'.forja2-state.unknown').count()>0);assert.deepEqual(f.errors,[]);
 await refresh(f,'cancelled');assert.equal(await p.locator('.v621-block.lesson').count(),0,'cancelled lesson never covers a free interval');
 const history=p.locator(view==='month'?'.v621-month-tag.cancelled,.v629-month-tag.cancelled':'.forja2-cancelled');assert.equal(await history.count(),1);assert.match(await history.textContent(),/cancelada|Cancelada/);assert.ok(await p.locator(view==='month'?'.v621-month-tag.availability,.v629-month-tag.availability':'.v621-block.availability').count()>0);
});

for(const mobile of [false,true])test(`monthly professionals have independent states ${mobile?'mobile':'desktop'}`,async t=>{
 const f=await agendaPresentationFixture(browser,{role:'admin',mobile,mode:'professionals'});t.after(()=>f.close());await setView(f,'admin','month');const p=f.page,cell=p.locator(`[data-v629-month-day="${reviewDay}"]`);
 assert.equal(await cell.locator('.availability').count(),1);assert.match(await cell.locator('.availability').textContent(),/Professor sintético/);
 assert.equal(await cell.locator('.busy').count(),1);assert.match(await cell.locator('.busy').textContent(),/Professor ocupado/);
 assert.equal(await cell.locator('[data-forja2-month-status="REVIEW_UNKNOWN"]').count(),1);assert.match(await cell.locator('.unknown').textContent(),/Professor desconhecido · Não confirmado/);
 assert.equal(await cell.evaluate(el=>el.classList.contains('available')),false);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
});

for(const mobile of [false,true])test(`teacher editing and official busy handler survive five polls ${mobile?'mobile':'desktop'}`,async t=>{
 const f=await agendaPresentationFixture(browser,{mobile});t.after(()=>f.close());const p=f.page;await setView(f,'teacher','day');await cycles(f);
 await p.locator('[data-v625-busy="REVIEW_BLOCK"]').click();assert.match(await p.locator('#modal').textContent(),/Horário ocupado/);assert.match(await p.locator('#modal').textContent(),/14:00–15:00/);await p.evaluate(()=>closeModal());
 await p.locator('[data-v625-new-slot="busy"]').first().click();const fields=p.locator('#modal input');assert.ok(await fields.count()>0);
 const input=fields.last();await input.fill('19:30');const node=await input.elementHandle(),value=await input.inputValue(),html=await p.locator('#modal').innerHTML();await cycles(f);
 assert.equal(await input.inputValue(),value);assert.equal(await p.locator('#modal').innerHTML(),html);assert.equal(await node.evaluate(el=>el===document.querySelector('#'+el.id)),true);assert.deepEqual(f.errors,[]);
});

for(const mobile of [false,true])test(`native reschedule never claims successful Google synchronization on partial failure ${mobile?'mobile':'desktop'}`,async t=>{
 const f=await agendaPresentationFixture(browser,{role:'admin',mobile});t.after(()=>f.close());const p=f.page;let patches=0;
 const lesson={id:'REVIEW_LESSON',professorId:'PERF_TEACHER',alunoId:'PERF_STUDENT',disciplinaId:'MATH',dataAula:reviewDay,horaAula:'13:00',horaFim:'14:00',modalidade:'presencial',localAula:'Sala sintética',status:'confirmada'};
 await p.route('**/aulas/REVIEW_LESSON',async route=>{if(route.request().method()==='PATCH')patches++;await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({ok:true,item:{...lesson,googleSyncStatus:'erro'}})});});
 await p.evaluate(l=>{state.lessons=[l];rescheduleLessonModal(l.id);},lesson);await p.locator('#resPlace').fill('Sala sintética atualizada');await p.locator('#modalSave').click();
 await p.waitForFunction(()=>document.querySelector('#toast')?.textContent.includes('sincronização Google pendente'));assert.equal(patches,1);assert.match(await p.locator('#toast').textContent(),/reagendada no FORJA/);assert.ok(!(await p.locator('#toast').textContent()).includes('sincronização Google confirmada'));assert.deepEqual(f.errors,[]);
});
