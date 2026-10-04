import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, before, after } from 'node:test';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const between=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start);assert.ok(start>=0&&end>start);return html.slice(start,end)};
const code=[
 between('  function v621AdminWeekEntry(', '  async function v621FetchTeacherWeek('),
 between('  function v621GoogleBusy(', '  function v621LessonClass('),
 between('  function v623ManualBusy(', '  function v623NowLine('),
 between('  function v629DayData(', '  function v629AllDay('),
].join('\n');
const {chromium}=await import(process.env.FORJA_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href:'playwright');
let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));
after(async()=>browser?.close());
const date='2026-10-04',weekStart='2026-09-28',uid='local-teacher';
const validEntry={weekStart,publicationValid:true,availabilityPolicy:'confirmed-week-v2',disponibilidade:{0:[{inicio:'12:33',fim:'14:44'}]}};
async function fixture(t,{entry=validEntry,lessons=[],googleBusy=[],cache='v621AdminWeekCache'}={}){
 const page=await browser.newPage();t.after(()=>page.close());
 await page.route('**/*',r=>r.abort());await page.setContent('<div id="lane"></div>');
 await page.evaluate(({code,entry,lessons,googleBusy,cache,uid,weekStart})=>{
  window.state={v621AdminWeekCache:{[weekStart]:{[uid]:entry}},lessons,googleBusy,unavailability:[],v629SecretaryFilters:{lesson:true,availability:true,busy:true}};
  if(cache==='adminProfessionalWeekMapV619'){state.adminProfessionalWeekLoadedV619=weekStart;state.adminProfessionalWeekMapV619={[uid]:entry}}
  if(cache==='adminAvailabilityWeekV616'){state.adminAvailabilityWeekStartV616=weekStart;state.adminAvailabilityWeekV616={[uid]:entry}}
  window.gWeekStart=()=>weekStart;window.v621DayCode=x=>String(new Date(x+'T12:00:00Z').getUTCDay());
  window.v621TimeMinutes=x=>/^\d{2}:\d{2}$/.test(x)?Number(x.slice(0,2))*60+Number(x.slice(3)):null;
  window.v621MinutesToTime=x=>String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');
  window.addMinutesTime=(s,n)=>v621MinutesToTime(v621TimeMinutes(s)+n);
  window.zonedDateParts=x=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(x)).map(p=>[p.type,p.value]));
  window.v629SelectedTeachers=()=>[{uid,fullName:'Professor local'}];window.v623NowLine=()=>'';
  window.v629SlotStyle=()=>'';window.v621LessonClass=()=>'';window.lessonTitle=()=> 'Aula';window.esc=x=>String(x??'');
  (0,eval)(code);
 },{code,entry,lessons,googleBusy,cache,uid,weekStart});
 return page;
}
for(const cache of ['v621AdminWeekCache','adminProfessionalWeekMapV619','adminAvailabilityWeekV616'])test('legacy cache '+cache+' cannot paint unpublished availability green',async t=>{
 const page=await fixture(t,{entry:{...validEntry,publicationValid:false},cache});
 assert.deepEqual(await page.evaluate(({uid,date})=>v629DayData(uid,date).availability,{uid,date}),[]);
 assert.equal(await page.evaluate(date=>v629Lane(date).includes('Disponível'),date),false);
});
for(const entry of [{...validEntry,availabilityPolicy:'published-week-v1'},{...validEntry,publicationValid:undefined},{...validEntry,weekStart:'2026-10-05'}])test('missing/currently invalid proof or wrong week cannot paint green',async t=>{
 const page=await fixture(t,{entry});assert.deepEqual(await page.evaluate(({uid,date})=>v629DayData(uid,date).availability,{uid,date}),[]);
});
test('real Sunday intervals in confirmed fixture: blue/Google cut 13–14, only 27/44 minutes remain green',async t=>{
 const lessons=[{id:'local-lesson',professorId:uid,dataAula:date,horaAula:'13:00',horaFim:'14:00',status:'agendada'}];
 const googleBusy=[{professionalId:uid,startAt:'2026-10-04T16:00:00Z',endAt:'2026-10-04T17:00:00Z'}];
 const page=await fixture(t,{lessons,googleBusy});
 const result=await page.evaluate(({uid,date})=>{document.querySelector('#lane').innerHTML=v629Lane(date);return {periods:v629DayData(uid,date).availability.map(p=>[p.inicio,p.fim]),greens:document.querySelectorAll('.availability.bookable').length,blues:document.querySelectorAll('.lesson').length}},{uid,date});
 assert.deepEqual(result,{periods:[['12:33','13:00'],['14:00','14:44']],greens:2,blues:1});
});
test('unpublished real Sunday keeps the blue lesson visible and removes only invalid green',async t=>{
 const page=await fixture(t,{entry:{...validEntry,publicationValid:false},lessons:[{id:'local',professorId:uid,dataAula:date,horaAula:'13:00',horaFim:'14:00',status:'agendada'}]});
 const result=await page.evaluate(date=>{document.querySelector('#lane').innerHTML=v629Lane(date);return {greens:document.querySelectorAll('.availability').length,blues:document.querySelectorAll('.lesson').length}},date);
 assert.deepEqual(result,{greens:0,blues:1});
});
test('all-day Google only removes confirmed availability, with exclusive end date in São Paulo',async t=>{
 const page=await fixture(t,{googleBusy:[{professionalId:uid,allDay:true,startDate:date,endDate:'2026-10-05'}]});
 assert.deepEqual(await page.evaluate(({uid,date})=>v629DayData(uid,date).availability,{uid,date}),[]);
});
test('other weekday never leaks into Sunday; teacher draft editor is preserved',async t=>{
 const page=await fixture(t,{entry:{...validEntry,disponibilidade:{6:[{inicio:'19:58',fim:'23:58'}]}}});
 assert.deepEqual(await page.evaluate(({uid,date})=>v629DayData(uid,date).availability,{uid,date}),[]);
 assert.match(code,/if\(role==='teacher'\)return/);
});
