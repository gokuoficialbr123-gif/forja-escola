import {agendaPresentationFixture,reviewDay} from './agenda-presentation-fixture.mjs';
import {performancePortal} from './performance-portal-fixture.mjs';
import {buildHostingArtifact} from '../prepare-hosting.mjs';

export const agendaViewports=[{width:1920,height:1080},{width:1366,height:768},{width:768,height:1024},{width:390,height:844},{width:360,height:800}];
export function premiumLessons(teacher='PERF_TEACHER',student='PERF_STUDENT'){
 const base={professorId:teacher,alunoId:student,nomeProfessor:'Professora Ana · simulação',nomeAluno:'Estudante Júlia · simulação',disciplinaId:'MATH',dataAula:reviewDay,status:'confirmada'};
 return [
  {...base,id:'PREMIUM_ONSITE',horaAula:'13:00',horaFim:'14:00',modalidade:'presencial',localAula:'Sala 2 · simulada'},
  {...base,id:'PREMIUM_ONLINE',horaAula:'15:00',horaFim:'16:00',modalidade:'online',meetLink:'https://meet.google.com/sim-ulat-edx'},
  {...base,id:'PREMIUM_UNKNOWN',horaAula:'17:00',horaFim:'18:00',nomeAluno:'Online no nome não define modalidade',modalidade:''}
 ];
}
export async function premiumFixture(browser,{role='teacher',width=1366,height=768,mode='mixed',institutional=false,legacyMetadata=false,overlap=false,artifact=buildHostingArtifact()}={}){
 let f;
 if(['admin','teacher'].includes(role)){
  const version='0'.repeat(64);
  f=await agendaPresentationFixture(browser,{role,mobile:width<=900,mode,artifact,changeVersion:()=>version,agendaEvents:(req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.flushHeaders();const send=kind=>res.write('data: '+JSON.stringify({kind,version})+'\n\n');send('ready');const heartbeat=setInterval(()=>send('heartbeat'),5000);res.on('close',()=>clearInterval(heartbeat));},transformItem:item=>({...item,lessons:[...premiumLessons(item.professionalId),...(overlap?[{...premiumLessons(item.professionalId)[0],id:'PREMIUM_OVERLAP',horaAula:'13:15',horaFim:'13:45'}]:[])]})});
  if(institutional)await f.page.evaluate(legacy=>{state.profile.calendarModel='institutional-events-v1';state.googleCalendar={configured:true,institutional:true,item:legacy?{connected:true,lastSyncStatus:'erro',lastSyncAt:'2026-10-19T12:00:00Z'}:{connected:false,managedBySecretaria:true,sourceMode:'institutional-events-v1',initialSyncComplete:true,status:'success'}};renderPage();window.forjaAgenda2Paint?.();},legacyMetadata);
 }else{
  f=await performancePortal({browser,...artifact,role,mobile:width<=900,requestDelay:5,secondaryDelay:5});
  // The psychologist uses the native fixed-week contract. A generic empty API
  // response has no policy/coverage and cannot stand in for a verified week.
  if(role==='psychologist')await f.page.route('**/disponibilidade-semanal?**',route=>{const weekStart=new URL(route.request().url()).searchParams.get('weekStart');return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({weekStart,fixedAvailabilityPolicy:'confirmed-recurring-week-v1',items:{},effectiveItems:{2:[{inicio:'08:00',fim:'18:00'}]}})});});
  await f.login();await f.page.waitForFunction(()=>state.profile&&!state.loading);
  const student=role==='student'?'PERF_ADMIN':'PREMIUM_CHILD';
  await f.page.evaluate(({role,day,lessons,student})=>{
   state.lessons=role==='psychologist'?[]:lessons;
   if(['student','parent'].includes(role))state.lessons.push({...lessons[0],id:'FOREIGN_LESSON',alunoId:'UNRELATED_CHILD',nomeAluno:'FOREIGN_PRIVATE_SENTINEL'});
   if(role==='parent'){state.students=[{uid:student,role:'student',active:true,fullName:'Dependente simulado',forjaId:'TEST-CHILD'}];state.selectedChildId=student;}
   state.sessions=role==='psychologist'?[{id:'PREMIUM_THERAPY',alunoId:student,psicologoId:state.user.uid,nomeAluno:'Paciente simulado',nomePsicologo:'Profissional simulado',dataSessao:day,horaSessao:'10:00',horaFim:'11:00',modalidade:'presencial',status:'agendada',localSessao:'Sala simulada'}]:[];
   state.studentLessonAgendaDateG=day;state.adminLessonAgendaDateG=day;state.agendaWeekSeenF=agendaWeekStartKey(todayKey());state.agendaDate=day;state.agendaView='week';
   navigate('agenda');
  },{role,day:reviewDay,lessons:premiumLessons('PERF_TEACHER',student),student});
 }
 await f.page.setViewportSize({width,height});
 return f;
}
