import assert from 'node:assert/strict';
import {withoutRegistrationChanges} from './registration-scope.mjs';
import {withoutLegalNavigation} from './legal-pages.mjs';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';
import {createHash} from 'node:crypto';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const {chromium}=await import(process.env.FORJA_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href:'playwright');
let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));
after(async()=>browser?.close());
const origin='https://forja-new-user-fixture.invalid';
const firebaseDouble=`(()=>{const user={uid:'LOCAL_ADMIN',email:'admin@forja.invalid',emailVerified:true,getIdToken:async()=> 'TEST_ONLY_LOCAL_TOKEN'};const auth={currentUser:user,setPersistence:async()=>{},onAuthStateChanged:cb=>{Promise.resolve().then(()=>cb(user));return()=>{}},signOut:async()=>{}};const factory=()=>auth;factory.Auth={Persistence:{SESSION:'session'}};window.firebase={apps:[],initializeApp:()=>firebase.apps.push({}),auth:factory};})();`;
const subjects=[{id:'math-id',nome:'Matemática',active:true},{id:'portuguese-id',nome:'Português',active:true},{id:'inactive-id',nome:'Inativa',active:false},...Array.from({length:18},(_,i)=>({id:'subject-'+i,nome:'Matéria de teste '+i,active:true}))];
async function fixture(t,{mobile=false,source=html}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:1000},locale:'pt-BR',reducedMotion:'reduce'});t.after(()=>page.close());
 const requests=[],errors=[],provider={fail:false,gate:null,activation:false,warning:false,invite:null,resetFail:false,resetGate:null};
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.FORJA_FIREBASE_CONFIG={apiKey:'TEST_ONLY_LOCAL_API_KEY',projectId:'demo-forja',authDomain:'forja.invalid'}});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':origin}});
  if(url.origin===origin&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:source});
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase-app-compat.js'))return route.fulfill({contentType:'application/javascript',body:firebaseDouble});
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase-auth-compat.js'))return route.fulfill({contentType:'application/javascript',body:''});
  if(url.hostname!=='forja-api-m1kq.onrender.com')return route.abort();
  requests.push({path:url.pathname,method:req.method(),body:req.postData()?JSON.parse(req.postData()):null});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type,x-forja-otp','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'}});
  if(url.pathname==='/me')return json({ok:true,profile:{uid:'LOCAL_ADMIN',fullName:'Admin local',role:'admin',active:true}});
  if(req.method()==='POST'&&['/admin/usuarios','/admin/profissionais'].includes(url.pathname)){
   if(provider.gate)await provider.gate;
   if(provider.fail)return json({error:'Confira os dados do cadastro.'},400);
   return json({ok:true,uid:'LOCAL_USER',forjaId:'TEST-LOCAL-001',...(provider.invite||{}),...(provider.activation?{activationLink:'https://forja-fixture.invalid/activation'}:{}),...(provider.warning?{activationWarning:'Aviso de ativação local.'}:{})},201);
  }
  if(/^\/admin\/usuarios\/[^/]+\/reset-senha$/.test(url.pathname)){
   if(provider.resetGate)await provider.resetGate;
   if(provider.resetFail)return json({error:'Sem permissão para reenviar.'},403);
   return json({ok:true,...(provider.invite||{emailSent:true,invitationStatus:'accepted'})});
  }
  if(url.pathname==='/admin/usuarios/LOCAL_USER')return json({user:{profile:{uid:'LOCAL_USER',role:'parent',active:true,fullName:'Usuário local',forjaId:'TEST-LOCAL-001',email:'local@forja.invalid',childIds:[]},auth:{email:'local@forja.invalid',disabled:false,emailVerified:false}},history:[]});
  if(url.pathname==='/admin/catalogos/series')return json({items:[{id:'serie-a',nome:'Série A',active:true},{id:'serie-b',nome:'Série B',active:true}]});
  if(url.pathname==='/admin/catalogos/disciplinas')return json({items:subjects});
  if(url.pathname==='/turmas')return json({items:[{id:'class-a',nome:'Turma A',serieId:'serie-a',active:true},{id:'class-b',nome:'Turma B',serieId:'serie-b',active:true},{id:'class-inactive',nome:'Turma inativa',serieId:'serie-a',active:false}]});
  if(url.pathname==='/admin/usuarios')return json({users:[]});
  if(url.pathname==='/admin/google-calendar/central/status')return json({configured:true,policy:'calendarlist-association-v2',freeBusyPolicy:'central-freebusy-query-v1',item:{connected:false}});
  if(url.pathname==='/admin/google-calendar/central/calendars')return json({items:[],teachers:[],connected:false});
  if(url.pathname==='/health')return json({ok:true});
  return json({items:[],users:[],item:{}});
 });
 await page.goto(origin);await page.waitForFunction(()=>typeof state!=='undefined'&&state.role==='admin'&&!state.loading);
 assert.deepEqual(errors,[]);
 await page.evaluate(()=>navigate('usuarios'));
 const opener=page.locator('[data-action="newUser"]');await opener.click();await page.waitForSelector('#newUserRole',{state:'attached'});
 const posts=()=>requests.filter(x=>x.method==='POST'&&['/admin/usuarios','/admin/profissionais'].includes(x.path));
 const profile=async role=>page.locator(`[name=newUserProfile][value=${role}]`).check();
 const fill=async()=>{await page.locator('#newUserName').fill(' Pessoa local ');await page.locator('#newUserCpf').fill('123.456.789-00');await page.locator('#newUserEmail').fill(' local@forja.invalid ');await page.locator('#newUserPhone').fill('(11) 99999-0000')};
 return {page,requests,errors,provider,posts,profile,fill};
}
async function screenshot(page,name){if(!process.env.FORJA_USER_SCREENSHOTS)return;mkdirSync(process.env.FORJA_USER_SCREENSHOTS,{recursive:true});await page.evaluate(()=>{const body=document.querySelector('#modal .modal-body');if(body)body.scrollTop=0});await page.screenshot({path:join(process.env.FORJA_USER_SCREENSHOTS,name+'.png')})}
for(const mobile of [false,true])for(const role of ['teacher','psychologist','student','parent'])test(`${mobile?'mobile':'desktop'} ${role}: four native profiles, conditional fields and scoped layout`,async t=>{
 const f=await fixture(t,{mobile});await f.profile(role);
 assert.equal(await f.page.locator('[name=newUserProfile]').count(),4);assert.equal(await f.page.locator('#newUserRole').inputValue(),role);
 assert.equal(await f.page.locator('#newUserProfessionalFields').isVisible(),['teacher','psychologist'].includes(role));
 assert.equal(await f.page.locator('#newUserTeacherSubjects').isVisible(),role==='teacher');assert.equal(await f.page.locator('#newUserStudentFields').isVisible(),role==='student');assert.equal(await f.page.locator('#newUserParentFields').isVisible(),role==='parent');
 if(role==='teacher'){await f.page.locator('[data-new-subject="math-id"]').check();await f.page.locator('[data-new-subject="portuguese-id"]').check()}
 const geometry=await f.page.evaluate(()=>{const root=document.getElementById('forjaNewUserDialog'),r=root.getBoundingClientRect(),layout=root.querySelector('.nu-layout');return {width:r.width,left:r.left,top:r.top,bottom:r.bottom,viewport:innerWidth,height:innerHeight,overflow:root.scrollWidth>root.clientWidth,columns:getComputedStyle(layout).gridTemplateColumns.split(' ').length,white:getComputedStyle(root).backgroundColor,body:getComputedStyle(root.querySelector('.modal-body')).overflowY,round:getComputedStyle(root).borderRadius,subjects:getComputedStyle(document.getElementById('newUserSubjectResults')).maxHeight}});
 assert.ok(geometry.width<=geometry.viewport&&geometry.left>=0&&!geometry.overflow);assert.ok(geometry.top>=0&&geometry.bottom<=geometry.height+.5);assert.equal(geometry.columns,mobile?1:2);assert.equal(geometry.white,'rgb(255, 255, 255)');assert.equal(geometry.body,'auto');assert.notEqual(geometry.round,'0px');assert.equal(geometry.subjects,'192px');assert.equal(f.posts().length,0);assert.deepEqual(f.errors,[]);
 await screenshot(f.page,`${mobile?'mobile':'desktop'}-${role}`);
});
for(const role of ['teacher','psychologist','student','parent'])test(`${role}: exact original endpoint, field names and values; no fields from another profile`,async t=>{
 const f=await fixture(t);await f.fill();await f.page.locator('[data-new-subject="math-id"]').check();await f.page.locator('[data-new-subject="portuguese-id"]').check();await f.page.locator('#newUserMeet').fill('https://meet.google.com/test-local');await f.profile(role);
 const expected={role,fullName:'Pessoa local',cpf:'12345678900',email:'local@forja.invalid',phone:'11999990000'};
 if(['teacher','psychologist'].includes(role))expected.meetLinkFixo='https://meet.google.com/test-local';
 if(role==='teacher')expected.disciplinaIds=['math-id','portuguese-id'];
 if(role==='student'){await f.page.locator('#newUserBirth').fill('2010-02-03');await f.page.locator('#newUserSerie').selectOption('serie-a');await f.page.locator('#newUserClass').selectOption('class-a');await f.page.locator('#newUserTherapy').check();await f.page.locator('#newUserParentIds').fill('res-local-1, res-local-2\nres-local-3');Object.assign(expected,{birthDate:'2010-02-03',serieId:'serie-a',turmaId:'class-a',therapyActive:true,parentIds:['RES-LOCAL-1','RES-LOCAL-2','RES-LOCAL-3']})}
 if(role==='parent'){await f.page.locator('#newUserChildIds').fill('alu-local-1\nalu-local-2');expected.childIds=['ALU-LOCAL-1','ALU-LOCAL-2']}
 await f.page.locator('#modalSave').click();await f.page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));
 assert.deepEqual(f.posts(),[{path:['teacher','psychologist'].includes(role)?'/admin/profissionais':'/admin/usuarios',method:'POST',body:expected}]);assert.deepEqual(f.errors,[]);
});
test('search ignores accents; multiple choices, keyboard, chips, clearing and filtered selections stay synchronized',async t=>{
 const f=await fixture(t),p=f.page;assert.equal(await p.locator('[data-new-subject="inactive-id"]').count(),0);
 await p.locator('#newUserSubjectSearch').fill('matematica');assert.equal(await p.locator('.nu-subject:visible').count(),1);await p.locator('[data-new-subject="math-id"]').focus();await p.keyboard.press('Space');
 await p.locator('#newUserSubjectSearch').fill('portugues');await p.locator('[data-new-subject="portuguese-id"]').check();assert.equal(await p.locator('#newUserSubjectCount').textContent(),'2 matérias selecionadas');assert.equal(await p.locator('.nu-chip').count(),2);
 await p.getByRole('button',{name:'Remover Matemática',exact:true}).click();assert.deepEqual(await p.locator('#newUserSubjects').evaluate(s=>[...s.selectedOptions].map(o=>o.value)),['portuguese-id']);
 await p.locator('#newUserSubjectSearch').fill('zz-no-results');assert.ok(await p.locator('#newUserSubjectEmpty').isVisible());assert.equal(await p.locator('.nu-chip').count(),1);
 await p.locator('#newUserSubjectsClear').click();assert.equal(await p.locator('.nu-chip').count(),0);assert.equal(await p.locator('#newUserSubjectsClear').isDisabled(),true);await p.locator('#newUserSubjectSearch').fill('');assert.equal(await p.locator('[data-new-subject]:checked').count(),0);
});
test('switch roles without ghost selection, lost common fields or incompatible class; native radio arrows work',async t=>{
 const f=await fixture(t);await f.fill();await f.page.locator('[data-new-subject="math-id"]').check();await f.profile('student');await f.page.locator('#newUserSerie').selectOption('serie-a');await f.page.locator('#newUserClass').selectOption('class-a');await f.profile('parent');await f.profile('student');assert.equal(await f.page.locator('#newUserClass').inputValue(),'class-a');await f.page.locator('#newUserSerie').selectOption('serie-b');assert.equal(await f.page.locator('#newUserClass').inputValue(),'');assert.equal(await f.page.locator('#newUserClass option[value=class-a]').count(),0);
 await f.profile('teacher');assert.equal(await f.page.locator('[data-new-subject="math-id"]').isChecked(),true);assert.equal(await f.page.locator('.nu-chip').count(),1);assert.equal(await f.page.locator('#newUserName').inputValue(),' Pessoa local ');await f.page.locator('[name=newUserProfile][value=teacher]').focus();await f.page.keyboard.press('ArrowRight');assert.equal(await f.page.locator('#newUserRole').inputValue(),'psychologist');assert.deepEqual(f.errors,[]);
});
test('teacher requires subjects; error stays in modal; failed API unlocks and retry succeeds',async t=>{
 const f=await fixture(t);await f.fill();await f.page.locator('#modalSave').click();assert.equal(f.posts().length,0);assert.match(await f.page.locator('#newUserFeedback').textContent(),/pelo menos uma matéria/);
 await f.page.locator('[data-new-subject="math-id"]').check();f.provider.fail=true;await f.page.locator('#modalSave').click();await f.page.waitForFunction(()=>!document.getElementById('modalSave').disabled);assert.equal(await f.page.locator('#newUserName').inputValue(),' Pessoa local ');assert.match(await f.page.locator('#newUserFeedback').textContent(),/Confira os dados/);assert.equal(await f.page.locator('#newUserName').isDisabled(),false);
 f.provider.fail=false;await f.page.locator('#modalSave').click();await f.page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));assert.equal(f.posts().length,2);
});
test('Enter submits once; pending submit locks edits/close and rejects duplicate dispatches',async t=>{
 const f=await fixture(t);await f.fill();await f.profile('parent');let release;f.provider.gate=new Promise(r=>release=r);t.after(()=>release());await f.page.locator('#newUserName').press('Enter');await f.page.waitForFunction(()=>document.getElementById('forjaNewUserDialog').getAttribute('aria-busy')==='true');
 await f.page.evaluate(()=>{const form=document.getElementById('newUserForm');form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});await f.page.keyboard.press('Tab');await f.page.keyboard.press('Shift+Tab');await f.page.locator('#modal').click({position:{x:1,y:1}});await f.page.keyboard.press('Escape');assert.ok(await f.page.locator('#forjaNewUserDialog').isVisible());assert.equal(await f.page.locator('#newUserName').isDisabled(),true);assert.equal(await f.page.locator('[data-close-modal]').first().isDisabled(),true);
 release();await f.page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));assert.equal(f.posts().length,1);
});
for(const action of ['Cancelar','Fechar janela','Escape'])test(`${action} closes without POST and returns focus to opener; focus wraps`,async t=>{
 const f=await fixture(t),p=f.page;await p.locator('#modalSave').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Fechar janela');await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'modalSave');
 if(action==='Escape')await p.keyboard.press('Escape');else await p.getByRole('button',{name:action,exact:true}).click();await p.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));await p.waitForFunction(()=>document.activeElement.dataset.action==='newUser');assert.equal(f.posts().length,0);
});
test('activation link and activation warning retain existing success flows',async t=>{
 for(const activation of [true,false]){const f=await fixture(t);await f.profile('parent');f.provider.activation=activation;f.provider.warning=!activation;await f.fill();await f.page.locator('#modalSave').click();if(activation){await f.page.waitForSelector('#generatedLink');assert.equal(await f.page.locator('#generatedLink').inputValue(),'https://forja-fixture.invalid/activation');assert.equal(await f.page.locator('#forjaNewUserDialog').count(),0)}else await f.page.waitForSelector('#modal .system-note');assert.equal(f.posts().length,1)}
});
test('other portal bytes are unchanged; dialog CSS does not alter other modals',async t=>{
 const stripped=withoutRegistrationChanges(withoutLegalNavigation(html));
 assert.equal(createHash('sha256').update(stripped).digest('hex'),'e87934aa90eb6a68ea0983e0265de6868b72a3d023dc4b3f9bd57b26786aca3f');
 const f=await fixture(t);await f.page.getByRole('button',{name:'Cancelar',exact:true}).click();await f.page.evaluate(()=>modal('Outro modal','<input id="other-input">'));assert.equal(await f.page.locator('#forjaNewUserDialog').count(),0);assert.equal(await f.page.locator('.modal-head .nu-subtitle').count(),0);assert.equal(await f.page.locator('.modal-foot [data-close-modal]').textContent(),'Fechar');assert.deepEqual(f.errors,[]);
});
if(process.env.FORJA_USER_BASELINE_HTML)test('capture unchanged before desktop/mobile for visual review',async t=>{for(const mobile of [false,true]){const f=await fixture(t,{mobile,source:readFileSync(process.env.FORJA_USER_BASELINE_HTML,'utf8')});await screenshot(f.page,`${mobile?'mobile':'desktop'}-before`)}});

test('320px screen and empty catalog remain usable without horizontal overflow',async t=>{
 const f=await fixture(t,{mobile:true});await f.page.getByRole('button',{name:'Cancelar',exact:true}).click();await f.page.setViewportSize({width:320,height:640});await f.page.evaluate(()=>{state.subjects=[];newUserModal()});
 assert.equal(await f.page.locator('[name=newUserProfile]').count(),4);assert.ok(await f.page.locator('#newUserSubjectEmpty').isVisible());assert.equal(await f.page.locator('#newUserSubjectsClear').isDisabled(),true);
 assert.equal(await f.page.locator('#forjaNewUserDialog').evaluate(el=>el.scrollWidth>el.clientWidth),false);await f.profile('parent');await f.fill();await f.page.locator('#modalSave').click();await f.page.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));assert.equal(f.posts().length,1);
});

for(const mobile of [false,true])for(const status of ['accepted','unavailable','not_configured','rate_limited'])test(`${mobile?'mobile':'desktop'} invitation ${status}: account survives and accepted is not delivered`,async t=>{
 const f=await fixture(t,{mobile});await f.profile('parent');await f.fill();
 f.provider.invite={emailSent:status==='accepted',invitationStatus:status,...(['unavailable','not_configured'].includes(status)?{activationLink:'https://forja-fixture.invalid/__/auth/action?mode=resetPassword&oobCode=LOCAL_ONLY',activationWarning:'Envio automático não confirmado. Cadastro preservado.'}:status==='rate_limited'?{activationWarning:'Aguarde 60 segundos antes de solicitar outro convite.',retryAfter:60}:{})};
 await f.page.locator('#modalSave').click();await f.page.waitForFunction(()=>document.querySelector('.modal-head h3')?.textContent.includes('Convite de acesso'));
 assert.equal(f.posts().length,1);assert.equal(await f.page.locator('#forjaNewUserDialog').count(),0);
 const text=await f.page.locator('#modal').innerText();assert.ok(text.includes(status==='accepted'?'Isso não confirma a entrega':'Cadastro concluído'));
 if(['unavailable','not_configured'].includes(status)){assert.ok(await f.page.getByRole('button',{name:'Copiar link de ativação',exact:true}).isVisible());assert.ok(await f.page.locator('#generatedLink').isVisible())}
 await screenshot(f.page,`${mobile?'mobile':'desktop'}-invitation-${status}`);
});
test('admin resend uses existing reset endpoint, locks concurrent invite/reset and never creates user',{timeout:12000},async t=>{
 const f=await fixture(t);await f.page.getByRole('button',{name:'Cancelar',exact:true}).click();await f.page.evaluate(()=>openUser('LOCAL_USER'));await f.page.locator('[data-v616-user-tab=seguranca]').click();const button=f.page.locator('[data-user-action=invite]');await button.waitFor();
 let release;f.provider.resetGate=new Promise(r=>release=r);t.after(()=>release());await button.click();assert.equal(await button.isDisabled(),true);assert.equal(await f.page.locator('[data-user-action=reset]').isDisabled(),true);
 await f.page.evaluate(()=>{const b=document.querySelector('[data-user-action=invite]');userAction('LOCAL_USER',{},'invite',b)});release();await f.page.waitForFunction(()=>document.querySelector('.modal-head h3')?.textContent==='Reenviar convite');
 assert.equal(f.requests.filter(x=>x.path==='/admin/usuarios/LOCAL_USER/reset-senha'&&x.method==='POST').length,1);assert.equal(f.posts().length,0);assert.ok((await f.page.locator('#modal').innerText()).includes('não confirma a entrega'));
});
test('admin resend failure unlocks retry and keeps user management intact',{timeout:12000},async t=>{
 const f=await fixture(t);await f.page.getByRole('button',{name:'Cancelar',exact:true}).click();await f.page.evaluate(()=>openUser('LOCAL_USER'));await f.page.locator('[data-v616-user-tab=seguranca]').click();await f.page.locator('[data-user-action=invite]').waitFor();f.provider.resetFail=true;
 await f.page.locator('[data-user-action=invite]').click();await f.page.waitForFunction(()=>!document.querySelector('[data-user-action=invite]').disabled);assert.equal(f.posts().length,0);
 f.provider.resetFail=false;f.provider.invite={emailSent:false,invitationStatus:'not_configured',resetLink:'https://forja-fixture.invalid/local-reset',activationWarning:'Envio não configurado.'};await f.page.locator('[data-user-action=invite]').click();await f.page.waitForSelector('#generatedLink');assert.ok(await f.page.getByRole('button',{name:'Copiar link de ativação',exact:true}).isVisible());assert.equal(f.posts().length,0);
});
