import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';
import {createHash} from 'node:crypto';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),POLICY='confirmed-recurring-week-v1';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE||'/tmp/forja-browser-tests/node_modules/playwright/index.mjs')).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));after(async()=>browser?.close());
const origin='https://forja-fixed-fixture.invalid';
const sdk=`(()=>{let notify=()=>{};const make=uid=>({uid,email:uid+'@forja.invalid',emailVerified:true,getIdToken:async()=> 'LOCAL_'+uid});const auth={currentUser:make('A'),setPersistence:async()=>{},onAuthStateChanged:cb=>{notify=cb;Promise.resolve().then(()=>cb(auth.currentUser));return()=>{}},signOut:async()=>{auth.currentUser=null;notify(null)},signInWithEmailAndPassword:async email=>{const user=make(email.split('@')[0].toUpperCase());auth.currentUser=user;notify(user);return {user}}};const factory=()=>auth;factory.Auth={Persistence:{SESSION:'session'}};window.firebase={apps:[],initializeApp:()=>firebase.apps.push({}),auth:factory};})();`;
async function fixture(t,{mobile=false,status=200,policy=POLICY,hold=false,weekOverride={}}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});t.after(()=>page.close());page.setDefaultTimeout(7000);const requests=[],errors=[];let release;const gate=new Promise(r=>release=r);
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.FORJA_FIREBASE_CONFIG={apiKey:'local-only',projectId:'demo-forja',authDomain:'forja.invalid'};const prev=fetch;window.fetch=(url,options={})=>prev(url,{...options,signal:undefined});});
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin===origin)return route.fulfill({contentType:'text/html',body:html});
  if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase-app-compat.js'))return route.fulfill({contentType:'application/javascript',body:sdk});
  if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase-auth-compat.js'))return route.fulfill({contentType:'application/javascript',body:''});
  if(u.hostname!=='forja-api-m1kq.onrender.com')return route.abort();
  if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type,x-forja-otp','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'}});
  const uid=(r.headers().authorization||'').replace('Bearer LOCAL_','');requests.push({uid,path:u.pathname,method:r.method(),body:r.postDataJSON()});
  let body={items:[],users:[],item:{}},code=200;
  if(u.pathname==='/me')body={profile:{uid,role:({A:'teacher',B:'psychologist',C:'admin'})[uid],active:true,fullName:'Sintético '+uid}};
  if(u.pathname==='/admin/usuarios')body={users:[{uid:'A',role:'teacher',active:true,fullName:'Professor A'},{uid:'B',role:'psychologist',active:true,fullName:'Psicólogo B'},{uid:'D',role:'teacher',active:false,fullName:'Inativo'}]};
  if(u.pathname==='/disponibilidade-semanal')body={weekStart:u.searchParams.get('weekStart')||'2026-10-12',items:{1:[{inicio:'13:00',fim:'17:00'}]},effectiveItems:{1:[{inicio:'13:00',fim:'14:00'}]},fixedAvailabilityPolicy:POLICY,origins:{1:'fixed'},...weekOverride};
  if(u.pathname==='/disponibilidade-padrao'){
   if(hold&&r.method()==='GET'&&uid==='A')await gate;
   if(r.method()==='PATCH'){code=status;body=status===409?{error:'O padrão mudou em outra sessão. Reabra e revise antes de confirmar.'}:{ok:true,revision:1};}
   else body={policy,revision:0,item:null,history:[]};
  }
  if(u.pathname==='/google/calendar/status')body={configured:false,item:{connected:false}};
  if(u.pathname==='/admin/disponibilidades-semana')body={items:[],weekStart:u.searchParams.get('weekStart')};
  if(u.pathname==='/google/calendar/busy')body={items:[],complete:true,status:'success'};
  if(u.pathname==='/admin/google-calendar/central/status')body={configured:false,policy:'calendarlist-association-v2',item:{connected:false}};
  await route.fulfill({status:code,headers:{'Access-Control-Allow-Origin':origin},contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
 });
 await page.goto(origin);await page.waitForFunction(()=>state.user?.uid==='A'&&!state.loading);
 // Complete the login screen autofocus before automated input, without a fixed delay.
 const login=async(uid)=>{await page.evaluate(()=>executeLogout());await page.evaluate(async()=>{showLogin();await new Promise(resolve=>requestAnimationFrame(resolve));});await page.fill('#loginEmail',uid+'@forja.invalid');await page.fill('#loginPassword','local-only-password');await page.click('[data-action="enterPortal"]');await page.waitForFunction(uid=>state.user?.uid===uid&&!state.loading,uid);};
 const open=async()=>{await page.evaluate(()=>navigate(state.role==='teacher'?'agenda':'disponibilidade'));await page.click('[data-fixed-open]');await page.waitForSelector('#forjaFixedForm');};
 return {page,requests,errors,login,open,release};
}
for(const mobile of [false,true])test(`fixed editor ${mobile?'mobile psychologist':'desktop teacher'}: affirmative confirmation, multiple periods, exact hash and exceptions`,async t=>{
 const f=await fixture(t,{mobile}),p=f.page;if(mobile)await f.login('B');await f.open();
 assert.equal(await p.isChecked('#fixedConfirm'),false);await p.fill('#fixedFrom','2030-01-07');
 for(const [start,end] of [['08:33','10:44'],['13:00','17:00']]){await p.click('[data-fixed-add="1"]');await p.locator('[data-fixed-period="1"] [data-fixed-start]').last().fill(start);await p.locator('[data-fixed-period="1"] [data-fixed-end]').last().fill(end);}
 await p.click('#fixedAddException');await p.selectOption('[data-fixed-kind]','vacation');await p.fill('[data-fixed-first]','2030-01-14');await p.fill('[data-fixed-last]','2030-01-20');
 assert.equal(await p.locator('#forjaFixedForm').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
 await p.screenshot({path:mobile?'/tmp/forja-fixed-psychologist-mobile.png':'/tmp/forja-fixed-teacher-desktop.png'});
 await p.click('#modalSave');assert.match(await p.locator('#fixedFeedback').innerText(),/explicitamente/);assert.equal(f.requests.filter(x=>x.method==='PATCH').length,0);
 await p.check('#fixedConfirm');assert.equal(await p.isChecked('#fixedConfirm'),true);await p.click('#modalSave');await p.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));
 const sent=f.requests.find(x=>x.method==='PATCH'&&x.path==='/disponibilidade-padrao');assert.equal(sent.uid,mobile?'B':'A');assert.deepEqual(sent.body.semana['1'],[{inicio:'08:33',fim:'10:44'},{inicio:'13:00',fim:'17:00'}]);assert.equal(sent.body.exceptions[0].kind,'vacation');
 const {expectedRevision,confirmation,...input}=sent.body;const hash=createHash('sha256').update(JSON.stringify({policy:POLICY,timeZone:'America/Sao_Paulo',professionalId:sent.uid,revision:1,...input})).digest('hex');assert.equal(confirmation.fingerprint,hash);assert.equal(confirmation.accepted,true);assert.equal(expectedRevision,0);
 assert.deepEqual(f.errors,[]);
});
test('editing or removing after confirmation clears affirmative action; conflicting update preserves form',async t=>{
 const f=await fixture(t,{status:409}),p=f.page;await f.open();await p.fill('#fixedFrom','2030-01-07');await p.check('#fixedConfirm');await p.click('[data-fixed-add="1"]');assert.equal(await p.isChecked('#fixedConfirm'),false);await p.fill('[data-fixed-start]','13:00');await p.fill('[data-fixed-end]','15:00');await p.check('#fixedConfirm');await p.click('#modalSave');await p.waitForFunction(()=>document.getElementById('fixedFeedback').textContent.includes('outra sessão'));assert.equal(await p.inputValue('[data-fixed-start]'),'13:00');assert.equal(await p.locator('#forjaFixedForm').count(),1);
});
test('admin can inspect active teacher/psychologist configuration but cannot publish',async t=>{
 const f=await fixture(t),p=f.page;await f.login('C');await p.evaluate(()=>navigate('agenda'));await p.locator('#fixedProfessional option').first().waitFor({state:'attached'});assert.equal(await p.locator('#fixedProfessional option').count(),2);await p.selectOption('#fixedProfessional','B');await p.click('[data-fixed-open]');await p.waitForSelector('#forjaFixedForm');assert.equal(await p.locator('#modalSave').count(),0);assert.equal(await p.locator('#fixedEnabled').isDisabled(),true);assert.equal(f.requests.filter(x=>x.method==='PATCH').length,0);
});
test('server-derived periods preserve editor values and exclude exception hours from teacher display',async t=>{
 const f=await fixture(t),p=f.page;await p.evaluate(()=>loadWeekAvailabilityV616('2030-01-07',{render:false}));
 assert.deepEqual(await p.evaluate(()=>state.availabilityWeekItemsV616['1']),[{inicio:'13:00',fim:'17:00'}]);assert.deepEqual(await p.evaluate(()=>forjaFixedWeekItems('2030-01-07',{})['1']),[{inicio:'13:00',fim:'14:00'}]);
 await f.login('B');assert.deepEqual(await p.evaluate(()=>forjaFixedWeekItems('2030-01-07',{})),{});
});
test('late old-user response cannot open a modal or repopulate a new session',async t=>{
 const f=await fixture(t,{hold:true}),p=f.page;await p.evaluate(()=>navigate(state.role==='teacher'?'agenda':'disponibilidade'));await p.click('[data-fixed-open]');await p.waitForFunction(()=>document.querySelector('[data-fixed-open]').disabled);await f.login('B');f.release();await p.waitForTimeout(100);assert.equal(await p.locator('#forjaFixedForm').count(),0);assert.equal(await p.evaluate(()=>state.user.uid),'B');
});
test('older backend does not expose a writable fixed editor',async t=>{
 const f=await fixture(t,{policy:'unsupported'}),p=f.page;await p.evaluate(()=>navigate(state.role==='teacher'?'agenda':'disponibilidade'));await p.click('[data-fixed-open]');await p.waitForFunction(()=>!document.querySelector('[data-fixed-open]').disabled);assert.equal(await p.locator('#forjaFixedForm').count(),0);assert.equal(f.requests.filter(x=>x.method==='PATCH').length,0);
});
test('late response for the same week cannot replace a newer effective configuration',async t=>{
 const f=await fixture(t),p=f.page;let release,started;const gate=new Promise(r=>release=r),ready=new Promise(r=>started=r);let held=false;
 await p.route('**/disponibilidade-semanal?weekStart=2030-01-07',async route=>{
  if(held)return route.fallback();held=true;started();await gate;await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin},body:JSON.stringify({weekStart:'2030-01-07',fixedAvailabilityPolicy:POLICY,effectiveItems:{1:[{inicio:'20:00',fim:'22:00'}]},items:{}})});
 });
 await p.evaluate(()=>{window.oldFixedWeek=api('/disponibilidade-semanal?weekStart=2030-01-07')});await ready;
 await p.evaluate(()=>api('/disponibilidade-semanal?weekStart=2030-01-07'));release();await p.evaluate(()=>oldFixedWeek);
 assert.deepEqual(await p.evaluate(()=>forjaFixedWeekItems('2030-01-07',{})['1']),[{inicio:'13:00',fim:'14:00'}]);
});
for(const [empty,published,expected] of [[true,false,/semana específica vazia/],[false,false,/rascunho ou legado/],[true,true,/semana específica vazia/],[false,true,/semana específica publicada/]])test(`week precedence notice empty=${empty} published=${published}`,async t=>{
 const f=await fixture(t,{weekOverride:{hasSavedWeek:true,savedWeekEmpty:empty,publicationValid:published}}),p=f.page;
 await p.evaluate(()=>navigate('agenda'));await p.evaluate(()=>api('/disponibilidade-semanal?weekStart='+gWeekStart(todayKey())));
 assert.match(await p.locator('#fixedWeekNotice').innerText(),expected);
 if(empty||!published)assert.match(await p.locator('#fixedWeekNotice').innerText(),/não substitui esta semana/);
 assert.equal(f.requests.filter(x=>x.method==='PATCH').length,0);
});
