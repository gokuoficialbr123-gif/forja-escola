import {performancePortal,delay} from './performance-portal-fixture.mjs';
import {buildHostingArtifact} from '../prepare-hosting.mjs';
export const reviewDay='2026-10-20';
const next=d=>new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10);
// Full portal, synthetic identities and provider data only. Every external URL
// is intercepted by performancePortal; the only real server is loopback static.
export async function agendaPresentationFixture(browser,{role='teacher',mobile=false,mode='mixed',artifact=buildHostingArtifact()}={}){
 const f=await performancePortal({browser,...artifact,role,mobile,requestDelay:5,secondaryDelay:5}),p=f.page;
 let current=mode,reads=0;
 await p.clock.install({time:new Date(reviewDay+'T10:15:00-03:00')});
 await p.route('**/agenda/snapshot?**',async route=>{
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
  });
  await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({policy:'agenda-readonly-v1',from,to,professionalIds:ids,items,complete:items.every(x=>x.status==='success'),checkedAt:new Date(at).toISOString(),servedAt:new Date(at).toISOString(),expiresAt:new Date(at+25000).toISOString()})}).catch(()=>{});
 });
 await f.login();await p.waitForFunction(()=>state.profile&&!state.loading);
 if(mode==='professionals')await p.evaluate(()=>{state.users.push({uid:'REVIEW_BUSY',fullName:'Professor ocupado',role:'teacher',active:true,disciplinaIds:['MATH']},{uid:'REVIEW_UNKNOWN',fullName:'Professor desconhecido',role:'teacher',active:true,disciplinaIds:['MATH']});state.v629SecretarySelectionTouched=true;state.v629SecretarySelectedTeacherIds=['PERF_TEACHER','REVIEW_BUSY','REVIEW_UNKNOWN'];});
 // The portal initializes its selected date before the test clock is installed.
 // Keep the synthetic event day explicit even when QA resumes on another day.
 await p.evaluate(day=>{state.teacherLessonAgendaDateG=day;state.adminLessonAgendaDateG=day;navigate('agenda');},reviewDay);await ready(p);
 return {...f,setMode:x=>current=x,reads:()=>reads};
}
export async function ready(page){await page.waitForFunction(()=>/^(Consulta confirmada|Consulta incompleta)/.test(document.querySelector('[data-forja2-status]')?.textContent||''));await delay(20);}
export async function setView(f,role,view){await f.page.locator(`[data-v621-view="${view}"][data-role="${role}"]`).click();await ready(f.page);}
