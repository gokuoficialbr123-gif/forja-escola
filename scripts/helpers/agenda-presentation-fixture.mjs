import assert from 'node:assert/strict';
import {performancePortal} from './performance-portal-fixture.mjs';
import {buildHostingArtifact} from '../prepare-hosting.mjs';
export const reviewDay='2026-10-20';
const next=d=>new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10);
// Full portal, synthetic identities and provider data only. Every external URL
// is intercepted by performancePortal; the only real server is loopback static.
export async function agendaPresentationFixture(browser,{role='teacher',mobile=false,mode='mixed',artifact=buildHostingArtifact(),transformItem=x=>x,transformSnapshot=x=>x,agendaEvents=null,changeVersion=()=>null}={}){
 const f=await performancePortal({browser,...artifact,role,mobile,requestDelay:5,secondaryDelay:5,agendaEvents}),p=f.page;
 let current=mode,reads=0,lastSnapshot=null;
 await p.clock.install({time:new Date(reviewDay+'T10:15:00-03:00')});
 const snapshotRoute=async route=>{
  reads++;const q=new URL(route.request().url()).searchParams,from=q.get('from'),to=q.get('to'),ids=q.getAll('professionalId'),at=await p.evaluate(()=>Date.now()),days={};
  for(let d=from;d<=to;d=next(d))days[d]=[{inicio:'08:00',fim:'18:00'}];
  const items=ids.map(professionalId=>{
   const unknown=current==='unknown'||current==='professionals'&&professionalId==='REVIEW_UNKNOWN',busy=(start,end,source='google')=>({professionalId,startAt:reviewDay+'T'+start+':00-03:00',endAt:reviewDay+'T'+end+':00-03:00',source});
   return {professionalId,status:unknown?'unavailable':'success',nativeStatus:'success',days,
    lessons:['mixed','cancelled'].includes(current)?[{id:'REVIEW_LESSON',professorId:professionalId,alunoId:'PERF_STUDENT',nomeAluno:'Aluno sintético',disciplinaId:'MATH',dataAula:reviewDay,horaAula:'13:00',horaFim:'14:00',status:current==='cancelled'?'cancelada_admin':'confirmada',modalidade:'presencial'}]:[],
    blocks:current==='mixed'?[{id:'REVIEW_BLOCK',data:reviewDay,horaInicio:'14:00',horaFim:'15:00'}]:[],
    school:current==='mixed'?[{data:reviewDay,horaInicio:'16:00',horaFim:'17:00'}]:[],
    busy:current==='mixed'?[busy('09:00','10:00'),busy('09:00','10:00','google-central'),busy('13:00','14:00')]:current==='external'?[busy('11:00','12:00')]:['all-day','multi-day'].includes(current)||current==='professionals'&&professionalId==='REVIEW_BUSY'?[{professionalId,startAt:reviewDay+'T00:00:00-03:00',endAt:(current==='multi-day'?'2026-10-23':next(reviewDay))+'T00:00:00-03:00',source:'google'}]:[],
    personal:{status:unknown?'unavailable':'success',connected:true,lastSyncAt:'2026-10-20T12:00:00Z',checkedAt:new Date(at).toISOString()},central:{status:'success',checkedAt:new Date(at).toISOString()}};
  }).map(transformItem);
  lastSnapshot=transformSnapshot({policy:'agenda-readonly-v1',from,to,professionalIds:ids,items,changeVersion:changeVersion(),complete:items.every(x=>x.status==='success'),checkedAt:new Date(at).toISOString(),servedAt:new Date(at).toISOString(),expiresAt:new Date(at+25000).toISOString()});
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify(lastSnapshot)}).catch(()=>{});
 };await p.route('**/agenda/snapshot?**',snapshotRoute);
 await f.login();await p.waitForFunction(()=>state.profile&&!state.loading);
 if(mode==='professionals')await p.evaluate(()=>{state.users.push({uid:'REVIEW_BUSY',fullName:'Professor ocupado',role:'teacher',active:true,disciplinaIds:['MATH']},{uid:'REVIEW_UNKNOWN',fullName:'Professor desconhecido',role:'teacher',active:true,disciplinaIds:['MATH']});state.v629SecretarySelectionTouched=true;state.v629SecretarySelectedTeacherIds=['PERF_TEACHER','REVIEW_BUSY','REVIEW_UNKNOWN'];});
 // The portal initializes its selected date before the test clock is installed.
 // Keep the synthetic event day explicit even when QA resumes on another day.
 const request=nextSnapshot(p);
 await p.evaluate(day=>{state.teacherLessonAgendaDateG=day;state.adminLessonAgendaDateG=day;navigate('agenda');},reviewDay);await ready(p,{request});
 return {...f,setMode:x=>current=x,reads:()=>reads,snapshot:()=>lastSnapshot,prepareTab:tab=>tab.route('**/agenda/snapshot?**',snapshotRoute),
  async close(){
   // Playwright route callbacks can still be resolving a synthetic page clock
   // when node:test ends. Dispose page interception before closing context.
   // Do not mask assertions or swallow route errors while tests are running.
   await f.context.setOffline(true);await p.unrouteAll({behavior:'ignoreErrors'});
   await f.close();
  }};
}
export const nextSnapshot=page=>page.waitForRequest(r=>r.method()==='GET'&&new URL(r.url()).pathname==='/agenda/snapshot');
export async function ready(page,{request}={}){
 // For a new read, status alone can still belong to the previous response.
 // Bind completion to the request captured before the action/clock advance.
 if(request){const response=await(await request).response();assert.ok(response,'snapshot must receive a response');assert.equal(response.status(),200);assert.equal(await response.finished(),null,'snapshot response body must finish');}
 await page.waitForFunction(()=>/^(Consulta confirmada|Consulta incompleta)/.test(document.querySelector('[data-forja2-status]')?.textContent||''));
}
export async function automaticCycle(page){const [request]=await Promise.all([nextSnapshot(page),page.clock.fastForward(20010)]);await ready(page,{request});}
export async function setView(f,role,view){const button=f.page.locator(`[data-v621-view="${view}"][data-role="${role}"]`),changes=!(await button.evaluate(el=>el.classList.contains('active'))),request=changes?nextSnapshot(f.page):undefined;await button.click();await ready(f.page,{request});}
