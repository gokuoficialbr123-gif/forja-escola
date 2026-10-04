import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, before, after } from 'node:test';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const between=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end)};
const code=[
 between('  function v621AdminWeekEntry(', '  async function v621FetchTeacherWeek('),
 between('  function v621GoogleBusy(', '  function v621LessonClass('),
 between('  function v621EventStyle(', '  function v621AllDay('),
 between('  function v623ManualBusy(', '  function v623NowLine('),
 between('  function v629SlotStyle(', '  function v629Sidebar('),
].join('\n');
const {chromium}=await import(process.env.FORJA_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href:'playwright');
let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));
after(async()=>browser?.close());
const cases=[
 {label:'30min',day:'2026-09-28',kind:'availability',start:'08:00',end:'08:30',top:48,height:24},
 {label:'60min',day:'2026-09-29',kind:'lesson',start:'09:00',end:'10:00',top:96,height:48},
 {label:'2h',day:'2026-09-30',kind:'busy',start:'10:00',end:'12:00',top:144,height:96},
 {label:'4h',day:'2026-10-01',kind:'availability',start:'08:00',end:'12:00',top:48,height:192},
 {label:'12:33–14:44',day:'2026-10-02',kind:'availability',start:'12:33',end:'14:44',top:266.4,height:104.8},
 {label:'19:58–21:52',day:'2026-10-03',kind:'busy',start:'19:58',end:'21:52',top:622.4,height:91.2},
];
async function fixture(t,{mobile=false,view='week',teachers=1,portalSource=html}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:1000}});t.after(()=>page.close());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
 await page.route('**/*',r=>r.abort());
 await page.setContent('<div id="workspaceContent"><div class="v629-secretary-agenda"><div id="calendar" class="v629-calendar-card"></div></div></div>');
 await page.evaluate(({portalSource,code,view,teachers})=>{
  const portal=new DOMParser().parseFromString(portalSource,'text/html');document.head.replaceChildren(...[...portal.querySelectorAll('style')].map(s=>s.cloneNode(true)));
  const fixtureStyle=document.createElement('style');fixtureStyle.textContent='html,body{margin:0;height:auto;overflow:visible}#workspaceContent{padding:12px}';document.head.append(fixtureStyle);
  const uid='teacher-local',ws='2026-09-28';
  const selected=Array.from({length:teachers},(_,i)=>({uid:i?uid+i:uid,fullName:i?'Professor 2':'Carlos'}));
  const disponibilidade={1:[{inicio:'08:00',fim:'08:30'}],4:[{inicio:'08:00',fim:'12:00'}],5:[{inicio:'12:33',fim:'14:44'}],0:[{inicio:'12:33',fim:'14:44'}]};
  window.state={v629SecretaryFilters:{lesson:true,availability:true,busy:true},v621AdminWeekCache:{[ws]:Object.fromEntries(selected.map(t=>[t.uid,{weekStart:ws,publicationValid:true,availabilityPolicy:'confirmed-week-v2',disponibilidade}]))},
   lessons:[{id:'lesson-60',professorId:uid,dataAula:'2026-09-29',horaAula:'09:00',horaFim:'10:00',status:'agendada',nomeAluno:'Aluno local'},
    {id:'lesson-between',professorId:uid,dataAula:'2026-10-04',horaAula:'13:00',horaFim:'14:00',status:'agendada',nomeAluno:'Aluno local'}],
   unavailability:[{professionalId:uid,data:'2026-09-30',horaInicio:'10:00',horaFim:'12:00',status:'ativo'},...(teachers>1?[{professionalId:uid,data:'2026-10-04',horaInicio:'10:00',horaFim:'11:00',status:'ativo'}]:[])],
   googleBusy:[{professionalId:uid,startAt:'2026-10-03T22:58:00Z',endAt:'2026-10-04T00:52:00Z',allDay:false}]};
  window.gDateObj=d=>new Date(d+'T12:00:00Z');window.gDateKey=d=>d.toISOString().slice(0,10);
  window.gAddDays=(d,n)=>{const x=gDateObj(d);x.setUTCDate(x.getUTCDate()+n);return gDateKey(x)};
  window.gWeekStart=()=>ws;window.v621DayCode=d=>String(gDateObj(d).getUTCDay());
  window.v621TimeMinutes=x=>/^\d{2}:\d{2}$/.test(x)?Number(x.slice(0,2))*60+Number(x.slice(3)):null;
  window.v621MinutesToTime=x=>String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');
  window.v621Clamp=(x,a,b)=>Math.max(a,Math.min(b,x));window.addMinutesTime=(s,n)=>v621MinutesToTime(v621TimeMinutes(s)+n);
  window.zonedDateParts=x=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(x)).map(p=>[p.type,p.value]));
  window.v629SelectedTeachers=()=>selected;window.v621Date=()=>view==='week'?'2026-09-28':'2026-10-04';window.v621View=()=>view;
  window.v621RangeDays=()=>Array.from({length:7},(_,i)=>gAddDays(ws,i));window.todayKey=()=> '2026-10-04';
  window.v623NowLine=()=>'';window.v621LessonClass=()=>'';window.lessonTitle=()=> 'Matemática';window.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  (0,eval)(code);
  document.querySelector('#calendar').innerHTML=view==='month'?v629MonthCalendar():v629WeekCalendar();
 },{portalSource,code,view,teachers});
 return page;
}
async function metrics(page,selector){return page.locator(selector).evaluate(e=>{
 const s=getComputedStyle(e),r=e.getBoundingClientRect(),b=e.querySelector('b'),br=b.getBoundingClientRect(),small=e.querySelector('small'),sr=small.getBoundingClientRect();
 const time=e.querySelector('time'),tr=time?.getBoundingClientRect();
 return {top:parseFloat(s.top),height:r.height,left:r.left,width:r.width,paddingTop:parseFloat(s.paddingTop),paddingLeft:parseFloat(s.paddingLeft),borderLeft:parseFloat(s.borderLeftWidth),radius:s.borderRadius,overflow:s.overflow,background:s.backgroundColor,
  title:b.textContent,subtitle:small.textContent,time:time?.textContent,textTop:br.top-r.top,textLeft:br.left-r.left,textHeight:br.height,subtitleTop:sr.top-r.top,subtitleBottom:sr.bottom-r.top,timeInside:!!tr&&tr.left>=r.left&&tr.right<=r.right,timeRight:tr?.right,
  contentFits:br.bottom<=sr.top+0.5&&sr.bottom<=r.bottom,compact:e.classList.contains('compact')};
})}
for(const mobile of [false,true]){
 for(const c of cases)test(`${mobile?'mobile':'desktop'} ${c.label}: top-left text, exact minutes and unclipped time`,async t=>{
  const page=await fixture(t,{mobile});const selector=`[data-v629-day="${c.day}"] .v629-block.${c.kind}`;
  const m=await metrics(page,selector);
  assert.ok(Math.abs(m.top-c.top)<0.15);assert.ok(Math.abs(m.height-c.height)<0.15);
  assert.equal(m.title,'Carlos');assert.ok(m.textTop<=m.paddingTop+0.5,'event content must start at top padding, never vertically centered');
  assert.ok(Math.abs(m.textLeft-m.paddingLeft-m.borderLeft)<0.5);assert.equal(m.time,`${c.start}–${c.end}`);
  assert.equal(m.overflow,'hidden');assert.ok(m.contentFits,'two lines must not overlap or overflow');assert.ok(m.timeInside,'exact range remains legible within column');
  assert.equal(m.radius,'7px');assert.equal(m.background,{availability:'rgb(230, 244, 234)',lesson:'rgb(26, 115, 232)',busy:'rgb(252, 232, 230)'}[c.kind]);
  if(c.label==='30min')assert.equal(m.compact,true);
  const grid=await page.locator(`[data-v629-day="${c.day}"]`).evaluate(e=>getComputedStyle(e).backgroundImage);assert.match(grid,/47px/);assert.match(grid,/48px/);
  const root=process.env.FORJA_VISUAL_ARTIFACT_DIR;if(root){mkdirSync(root,{recursive:true});await page.locator(selector).screenshot({path:resolve(root,`event-${c.day}-${mobile?'mobile':'desktop'}.png`)})}
 });
 test(`${mobile?'mobile':'desktop'}: blue lesson between exact green fragments, uniform gutters and width`,async t=>{
  const page=await fixture(t,{mobile});const sel='[data-v629-day="2026-10-04"] .v629-block';
  const items=await page.locator(sel).evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {start:e.dataset.start,time:e.querySelector('time')?.textContent,top:parseFloat(e.style.top),height:r.height,left:r.left,width:r.width,padding:getComputedStyle(e).paddingLeft}}));
  assert.equal(items.length,3);assert.deepEqual(items.map(x=>x.time),['12:33–13:00','14:00–14:44','13:00–14:00']);
  assert.deepEqual(items.map(x=>x.top),[266.4,336,288]);
  // Preserve original geometry, including the existing 24px minimum for short events.
  for(const [i,h]of [24,35.2,48].entries())assert.ok(Math.abs(items[i].height-h)<0.15);
  assert.ok(items.every(x=>Math.abs(x.width-items[0].width)<0.1&&Math.abs(x.left-items[0].left)<0.1&&x.padding===items[0].padding));
  const root=process.env.FORJA_VISUAL_ARTIFACT_DIR;if(root){mkdirSync(root,{recursive:true});if(mobile)await page.locator('.v621-week-wrap').evaluate(e=>{e.scrollLeft=e.scrollWidth;e.scrollTop=220});await page.locator('.v629-calendar-card').screenshot({path:resolve(root,`agenda-week-${mobile?'mobile':'desktop'}.png`)})}
 });
 test(`${mobile?'mobile':'desktop'} day/month remain legible and confined to calendar`,async t=>{
  for(const view of ['day','month']){
   const page=await fixture(t,{mobile,view});
   if(view==='day'){const m=await metrics(page,'.v629-block.lesson');assert.equal(m.title,'Carlos');assert.ok(m.contentFits);assert.ok(m.textTop<=m.paddingTop+0.5);assert.ok(m.timeRight<=page.viewportSize().width,'day range must remain within viewport without horizontal scroll')}
   else{assert.ok(await page.locator('.v629-month-tag.lesson').count()>0);const m=await page.locator('.v629-month-tag.lesson').first().evaluate(e=>{const s=getComputedStyle(e);return {text:e.textContent,overflow:s.overflow,textAlign:s.textAlign,width:e.getBoundingClientRect().width,parent:e.parentElement.getBoundingClientRect().width}});assert.match(m.text,/Carlos/);assert.equal(m.overflow,'hidden');assert.equal(m.textAlign,'left');assert.ok(m.width<=m.parent+0.5)}
   const root=process.env.FORJA_VISUAL_ARTIFACT_DIR;if(root){await page.locator('.v629-calendar-card').screenshot({path:resolve(root,`agenda-${view}-${mobile?'mobile':'desktop'}.png`)})}
  }
 });
}
test('multiple teachers keep identical gutter and width for blue/green/red within the same lane',async t=>{
 const page=await fixture(t,{teachers:2,view:'day'});const events=await page.locator('.v629-block').evaluateAll(es=>es.map(e=>({type:e.className,left:e.getBoundingClientRect().left,width:e.getBoundingClientRect().width})));
 const first=events.slice(0,4);assert.ok(first.some(e=>e.type.includes("busy"))&&first.some(e=>e.type.includes("lesson"))&&first.some(e=>e.type.includes("availability")));assert.ok(first.every(e=>Math.abs(e.left-first[0].left)<0.1&&Math.abs(e.width-first[0].width)<0.1));
});
test('hover does not shift minute geometry',async t=>{
 const page=await fixture(t);const event=page.locator('[data-v629-day="2026-10-01"] .availability');const before=await event.boundingBox();await event.hover();const after=await event.boundingBox();assert.equal(after.x,before.x);assert.equal(after.y,before.y);assert.equal(after.height,before.height);
});
