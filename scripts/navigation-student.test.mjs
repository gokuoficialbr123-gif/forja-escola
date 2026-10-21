import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readFileSync,mkdirSync} from 'node:fs';
import {performancePortal} from './helpers/performance-portal-fixture.mjs';
import {buildHostingArtifact} from './prepare-hosting.mjs';
import {withoutNavigationStudent,navigationBaseline} from './navigation-student-scope.mjs';
import {sha256} from './validate.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const artifact=buildHostingArtifact();
async function fixture(t,options={}){const f=await performancePortal({browser,...artifact,requestDelay:5,secondaryDelay:5,...options});f.page.setDefaultTimeout(15000);t.after(()=>f.close());return f;}
async function login(f){await f.login();await f.page.evaluate(()=>__perfActivation);await f.page.waitForFunction(()=>state.user&&!state.loading&&Object.keys(state.trainingProfileLoading||{}).length===0);}
async function at(p,name){await p.waitForFunction(name=>state.page===name&&!state.loading,name);}
async function seed(p){await p.evaluate(()=>{
 const skills=['reforco','atencao','dominio'].map((status,i)=>({id:'SKILL'+i,status,topico:['Frações','Equações','Geometria'][i],observacao:'Pratique com o apoio do professor.'}));
 const profile={student:{uid:state.user.uid,fullName:'Aluno sintético',limiteMaterias:2},subjects:[{disciplinaId:'MATH',nome:'Matemática',competencias:skills,frequencia:{frequenciaPercentual:90},aulasRealizadas:8,vinculo:{professorId:state.user.uid,nivelLabel:'Matemática Básica I'}}]};
 state.subjects=[{id:'MATH',nome:'Matemática',active:true}];state.profile.disciplinaIds=['MATH'];state.trainingProfiles[state.user.uid]=profile;state.trainingProfiles.PERF_STUDENT=profile;
 state.mathSubjectLinks=[{disciplinaId:'MATH',professorId:state.user.uid,nivelLabel:'Matemática Básica I'}];state.secretarySubjectLinksD=[{alunoId:'PERF_STUDENT',disciplinaId:'MATH',professorId:state.user.uid}];
 state.mathDiagnosticData={latest:{nivelLabel:'Matemática Básica I',nivelRecomendado:'basica_1',topicos:skills,totalRespostas:8,scoreProcesso:75},active:null};state.mathStudentPanels={PERF_STUDENT:{materias:state.mathSubjectLinks,diagnosticos:[state.mathDiagnosticData.latest]}};
 renderPage();
 });const profile=await p.evaluate(()=>state.trainingProfiles[state.user.uid]);await p.route('**/alunos/*/treinamento',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':new URL(p.url()).origin},body:JSON.stringify({item:profile})}));}
test('scoped migration restores exact published source and all older guards',()=>assert.equal(sha256(withoutNavigationStudent(readFileSync(new URL('../index.html',import.meta.url),'utf8'))),navigationBaseline));
for(const mobile of [false,true])for(const role of ['admin','teacher','psychologist','student','parent']){
 test(`browser back/forward, same-page deduplication and permissions ${role} ${mobile?'mobile':'desktop'}`,async t=>{
  const f=await fixture(t,{role,mobile}),p=f.page;await login(f);const uid=await p.evaluate(()=>state.user.uid),start=await p.evaluate(()=>history.length);
  await p.evaluate(()=>navigate('perfil'));await at(p,'perfil');assert.equal(await p.evaluate(()=>history.length),start+1);
  await p.evaluate(()=>navigate('perfil'));assert.equal(await p.evaluate(()=>history.length),start+1);
  await p.evaluate(()=>navigate('conta'));await at(p,'conta');await p.goBack();await at(p,'perfil');await p.goBack();await at(p,'inicio');await p.goForward();await at(p,'perfil');
  assert.equal(await p.evaluate(()=>state.user.uid),uid);assert.equal(await p.locator('#portalApp').isVisible(),true);
  if(role!=='admin'){const n=await p.evaluate(()=>history.length);await p.evaluate(()=>navigate('usuarios'));assert.equal(await p.evaluate(()=>state.page),'perfil');assert.equal(await p.evaluate(()=>history.length),n);}
  assert.deepEqual(f.errors,[]);
  for(const page of await p.evaluate(()=>MENUS[state.role].map(x=>x[0]))){await p.evaluate(page=>navigate(page),page);await at(p,page);assert.doesNotMatch(await p.locator('#workspaceContent').textContent(),/Não foi possível montar esta tela/);}
  assert.deepEqual(f.errors,[]);
 });
}
for(const mobile of [false,true]){
 test(`official booking drawer back preserves its draft without writes ${mobile?'mobile':'desktop'}`,async t=>{
  const f=await fixture(t,{mobile}),p=f.page;await p.route('**/admin/aluno-materias',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({items:[{alunoId:'PERF_STUDENT',disciplinaId:'MATH',professorId:'PERF_TEACHER',status:'ativo'}]})}));await login(f);await p.evaluate(()=>navigate('agenda'));await at(p,'agenda');await p.locator('[data-forja2-status]').filter({hasText:'Consulta confirmada'}).waitFor();
  await p.locator('[data-v630-open]:visible').first().click();await p.locator('#v630BookingRoot .v630-drawer').waitFor();await p.locator('#v630Teacher').selectOption('PERF_TEACHER');await p.locator('#v630Subject').selectOption('MATH');await p.locator('#v630Student').selectOption('PERF_STUDENT');await p.locator('#v630Place').fill('Local em edição');await p.locator('#v630Duration').selectOption('90');const reads=f.calls.length;
  await p.goBack();await p.waitForFunction(()=>!state.v630Booking.open);assert.equal(await p.evaluate(()=>state.page),'agenda');assert.equal(await p.locator('#portalApp').isVisible(),true);
  await p.locator('[data-v630-open]:visible').first().click();await p.locator('#v630BookingRoot .v630-drawer').waitFor();assert.equal(await p.locator('#v630Place').inputValue(),'Local em edição');assert.equal(await p.locator('#v630Duration').inputValue(),'90');assert.equal(f.calls.slice(reads).filter(x=>x.method==='POST').length,0);assert.deepEqual(f.errors,[]);
 });
 test(`public login, enrollment steps, draft and modal back ${mobile?'mobile':'desktop'}`,async t=>{
  const f=await fixture(t,{mobile}),p=f.page;
  const scroll=async id=>{if(mobile){await p.locator('[data-action=publicMenu]').click();await p.locator(`[data-public-scroll=${id}]`).click();}else await p.locator(`[data-scroll=${id}]`).first().click();};
  const initial=await p.evaluate(()=>history.length);await scroll('metodologia');assert.equal(await p.evaluate(()=>history.length),initial+1);await scroll('programas');await p.goBack();assert.equal(await p.evaluate(()=>history.state.forjaNavigation.section),'metodologia');await p.goBack();assert.equal(await p.locator('#publicSite').isVisible(),true);
  await p.evaluate(()=>showLogin());await p.locator('#loginEmail').fill('aluno@forja.invalid');await p.goBack();assert.equal(await p.locator('#publicSite').isVisible(),true);await p.goForward();await p.locator('#loginView').waitFor({state:'visible'});assert.equal(await p.locator('#loginEmail').inputValue(),'aluno@forja.invalid');
  await p.evaluate(()=>showPublic());await p.locator('[data-action=openEnrollment]').first().click();await p.locator('#enrollName').fill('Aluno sintético');
  await p.evaluate(()=>setEnrollmentStep(2));await p.locator('#enrollGoal').fill('Aprender com tranquilidade');await p.evaluate(()=>setEnrollmentStep(3));await p.goBack();await p.waitForFunction(()=>state.enrollmentStep===2);assert.equal(await p.locator('#enrollGoal').inputValue(),'Aprender com tranquilidade');
  await p.locator('#enrollBack').click();await p.waitForFunction(()=>state.enrollmentStep===1);assert.equal(await p.locator('#enrollName').inputValue(),'Aluno sintético');await p.goBack();await p.locator('#publicSite').waitFor({state:'visible'});
  await p.evaluate(()=>showLogin());await p.evaluate(()=>modal('Cadastro simulado','<input id="draftName">'));await p.locator('#draftName').fill('Rascunho preservado');
  p.once('dialog',d=>d.dismiss());await p.goBack();await p.waitForFunction(()=>history.state.forjaNavigation.kind==='modal');assert.equal(await p.locator('#draftName').inputValue(),'Rascunho preservado');
  p.once('dialog',d=>d.accept());await p.goBack();await p.locator('#modal').waitFor({state:'hidden'});assert.equal(await p.locator('#loginView').isVisible(),true);assert.deepEqual(f.errors,[]);
  await p.evaluate(()=>modal('Modal sobre o login','<input id="escapeField">'));await p.locator('#escapeField').focus();await p.keyboard.press('Escape');assert.equal(await p.locator('#modal').isVisible(),false);assert.equal(await p.locator('#loginView').isVisible(),true);assert.equal(await p.locator('#loginEmail').inputValue(),'aluno@forja.invalid');
 });
 test(`student neutral home, learning, leveling and exercise results ${mobile?'mobile':'desktop'}`,async t=>{
  const f=await fixture(t,{role:'student',mobile}),p=f.page;await login(f);await seed(p);
  const before=await p.evaluate(()=>JSON.stringify(state.trainingProfiles));
  for(const page of ['inicio','aprendizado','materias','treinamento','frequencia','nivelamento']){
   await p.evaluate(page=>navigate(page),page);await at(p,page);const text=await p.locator('#workspaceContent').textContent();assert.doesNotMatch(text,/🔴|🟡|🟢|semáforo|precisa de reforço|bom domínio|tópicos em atenção/i);
   assert.equal(await p.locator('.student-b-traffic,.math-status-grid,.student-b-topic .bad,.student-b-topic .warn,.student-b-topic .good').count(),0);
   if(['inicio','aprendizado'].includes(page)){assert.match(text,/Frações/);assert.match(text,/Conteúdo para praticar/);}
  }
  await p.route('**/matematica/listas/TEST_LIST',r=>r.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({item:{id:'TEST_LIST',titulo:'Prática',status:'corrigida',resultadoPercentual:80,sugestoes:[{topico:'Frações',status:'reforco',percentual:80}],questoes:[]}})}));
  await p.evaluate(()=>{state.tasks=[{id:'TASK',listaExerciciosId:'TEST_LIST'}];return openTask('TASK');});assert.doesNotMatch(await p.locator('#modal').textContent(),/🔴|🟡|🟢|Precisa de reforço|Bom domínio|Em atenção/);assert.match(await p.locator('#modal').textContent(),/Conteúdo para praticar/);
  assert.equal(await p.evaluate(()=>JSON.stringify(state.trainingProfiles)),before);assert.deepEqual(f.errors,[]);
  const shared=await p.evaluate(()=>trainingProfileMarkup(state.trainingProfiles[state.user.uid]));assert.doesNotMatch(shared,/🔴|🟡|🟢|competency-legend|competency-dot|reinforcement|mastery|Precisa de reforço|Bom domínio|Em atenção/);assert.match(shared,/Frações/);assert.match(shared,/Conteúdo para praticar/);
  if(process.env.FORJA_NAV_EVIDENCE_DIR){await p.evaluate(()=>{closeModal();navigate('aprendizado')});await at(p,'aprendizado');await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));mkdirSync(process.env.FORJA_NAV_EVIDENCE_DIR,{recursive:true});await p.screenshot({path:resolve(process.env.FORJA_NAV_EVIDENCE_DIR,`student-after-${mobile?'mobile':'desktop'}.png`),fullPage:true,animations:'disabled'});}
 });
 test(`back restores page draft, filters and session fences ${mobile?'mobile':'desktop'}`,async t=>{
  const f=await fixture(t,{role:'admin',mobile}),p=f.page;await login(f);await p.evaluate(()=>{for(let n=0;n<40;n++)state.users.push({uid:'SCROLL_'+n,role:'teacher',active:true,fullName:'Professor sintético '+n});navigate('usuarios')});await at(p,'usuarios');const input=p.locator('#workspaceContent input:not([type=file]):not([type=hidden]):not([readonly])').first();await input.fill('Professor');const id=await input.getAttribute('id'),filtered=await p.locator('[data-user]').count();assert.ok(filtered>30);
  const positions=await p.evaluate(()=>{const c=document.getElementById('workspaceContent');c.scrollTop=400;scrollTo(0,400);return {window:scrollY,content:c.scrollTop}});assert.ok(positions.window>0||positions.content>0);
  await p.evaluate(()=>navigate('conta'));await at(p,'conta');await p.goBack();await at(p,'usuarios');assert.equal(await p.locator('#'+id).inputValue(),'Professor');assert.equal(await p.locator('[data-user]').count(),filtered);await p.waitForFunction(pos=>scrollY===pos.window&&document.getElementById('workspaceContent').scrollTop===pos.content,positions);
  assert.doesNotMatch(await p.evaluate(()=>JSON.stringify(history.state)),/Professor|SCROLL_|Local em edição/);
  await p.evaluate(()=>{forjaEndSession();state.user=null;state.role=null;showPublic()});await p.goBack();await p.locator('#publicSite').waitFor({state:'visible'});assert.equal(await p.locator('#portalApp').isVisible(),false);assert.deepEqual(await p.evaluate(()=>({user:state.user,role:state.role,users:state.users.length})),{user:null,role:null,users:0});
 });
}
for(const role of ['teacher','admin'])test(`${role} retains full pedagogical semaphore and unchanged statuses`,async t=>{
 const f=await fixture(t,{role}),p=f.page;await login(f);await seed(p);
 const out=await p.evaluate(()=>({labels:['reforco','atencao','dominio'].map(mathTopicStateLabel),classes:['reforco','atencao','dominio'].map(mathTopicStateClass),html:teacherTrainingTab(state.trainingProfiles.PERF_STUDENT,'PERF_STUDENT')}));
 assert.deepEqual(out.labels,['🔴 Precisa de reforço','🟡 Em atenção','🟢 Bom domínio']);assert.deepEqual(out.classes,['reforco','atencao','dominio']);assert.match(out.html,/Frações/);for(const [cls,label] of [['reinforcement','Precisa de reforço'],['attention','Em atenção'],['mastery','Bom domínio']]){assert.match(out.html,new RegExp(cls));assert.match(out.html,new RegExp(label));}
 if(process.env.FORJA_NAV_EVIDENCE_DIR){await p.evaluate(html=>modal('Acompanhamento pedagógico',html),out.html);await p.screenshot({path:resolve(process.env.FORJA_NAV_EVIDENCE_DIR,`${role}-semaphore-desktop.png`),fullPage:true});}
});
