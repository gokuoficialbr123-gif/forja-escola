import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE||'/tmp/forja-browser-tests/node_modules/playwright/index.mjs')).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));after(async()=>browser?.close());
const origin='https://forja-session-fixture.invalid',weekA='2030-01-07',weekB='2030-01-14';
const sdk=`(()=>{let notify=()=>{};const roles={A:'teacher',B:'psychologist',C:'admin',D:'teacher'};const make=uid=>({uid,email:uid+'@forja.invalid',emailVerified:true,getIdToken:async()=>{if(window.fixtureTokenGate)await new Promise(resolve=>window.releaseToken=resolve);return 'LOCAL_'+uid}});const auth={currentUser:make('A'),setPersistence:async()=>{},onAuthStateChanged:cb=>{notify=cb;Promise.resolve().then(()=>cb(auth.currentUser));return()=>{}},signOut:async()=>{auth.currentUser=null;notify(null)},signInWithEmailAndPassword:async email=>{const user=make(email.split('@')[0].toUpperCase());auth.currentUser=user;notify(user);return {user}}};const factory=()=>auth;factory.Auth={Persistence:{SESSION:'session'}};window.firebase={apps:[],initializeApp:()=>firebase.apps.push({}),auth:factory};})();`;
async function fixture(t,{ignoreAbort=false,mobile=false}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});t.after(()=>page.close());const requests=[],holds=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({ignoreAbort})=>{window.FORJA_FIREBASE_CONFIG={apiKey:'local-test-only',projectId:'demo-forja',authDomain:'forja.invalid'};if(ignoreAbort){const previous=fetch;window.fetch=(url,options={})=>previous(url,{...options,signal:undefined})}},{ignoreAbort});
 const weekly=(uid,week)=>week===weekA&&uid==='A'?{1:[{inicio:'13:00',fim:'17:00'}]}:week===weekB&&uid==='B'?{1:[{inicio:'11:00',fim:'12:00'}]}:{};
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin===origin)return route.fulfill({contentType:'text/html',body:html});
  if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase-app-compat.js'))return route.fulfill({contentType:'application/javascript',body:sdk});
  if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase-auth-compat.js'))return route.fulfill({contentType:'application/javascript',body:''});
  if(u.hostname!=='forja-api-m1kq.onrender.com')return route.abort();
  if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type,x-forja-otp','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'}});
  const uid=(r.headers().authorization||'').replace('Bearer LOCAL_',''),week=u.searchParams.get('weekStart')||'2026-10-12';requests.push({uid,path:u.pathname,week,method:r.method()});
  let body={items:[],users:[],item:{}},status=200;
  if(u.pathname==='/me')body={profile:{uid,role:({A:'teacher',B:'psychologist',C:'admin',D:'teacher'})[uid],active:true,fullName:'Fictício '+uid,email:uid+'@forja.invalid'}};
  if(u.pathname==='/disponibilidade-semanal')body={items:weekly(uid,week),weekStart:week,hasSavedWeek:Object.keys(weekly(uid,week)).length>0};
  if(u.pathname==='/admin/disponibilidades-semana')body={weekStart:week,items:[{uid:'A',weekStart:week,availabilityPolicy:'confirmed-week-v2',publicationValid:true,disponibilidade:{1:[{inicio:'13:00',fim:'17:00'}]}}]};
  if(u.pathname==='/google/calendar/status')body={configured:false,item:{connected:false}};
  if(u.pathname==='/google/calendar/busy')body={items:[],complete:true,status:'success'};
  if(u.pathname==='/admin/google-calendar/central/status')body={configured:false,policy:'calendarlist-association-v2',item:{connected:false}};
  const hold=holds.find(x=>!x.used&&x.path===u.pathname&&x.uid===uid&&(!x.week||x.week===week));
  if(hold){hold.used=true;hold.ready();await hold.promise;if(hold.error){status=503;body={error:'Consulta indisponível'}}else if(hold.body)body=hold.body;}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':origin}}).catch(()=>{});
 });
 await page.goto(origin);await page.waitForFunction(()=>state.user?.uid==='A'&&!state.loading);
 // Complete the login screen autofocus before automated input, without a fixed delay.
 const login=async(uid)=>{await page.evaluate(()=>executeLogout());await page.evaluate(async()=>{showLogin();await new Promise(resolve=>requestAnimationFrame(resolve));});await page.fill('#loginEmail',uid+'@forja.invalid');await page.fill('#loginPassword','local-only-password');await page.click('[data-action="enterPortal"]');await page.waitForFunction(uid=>state.user?.uid===uid&&!state.loading,uid)};
 const hold=options=>{let ready,release;const item={...options,used:false,ready:()=>ready(),promise:new Promise(r=>release=r)};const started=new Promise(r=>ready=r);holds.push(item);return {started,release}};
 return {page,login,hold,requests,errors};
}
for(const mobile of [false,true])test(`full portal ${mobile?'mobile':'desktop'}: future week never crosses teacher, psychologist, admin or same-UID relogin`,async t=>{
 const f=await fixture(t,{mobile}),p=f.page;await p.evaluate(ws=>loadWeekAvailabilityV616(ws,{render:false}),weekA);assert.equal(await p.evaluate(()=>state.availabilityWeekItemsV616['1'][0].inicio),'13:00');
 await f.login('B');await p.evaluate(()=>navigate('disponibilidade'));assert.equal(await p.locator('[data-v616-start="1"]').count(),0);assert.deepEqual(await p.evaluate(()=>state.v621TeacherWeekCache),{});
 await f.login('C');await p.evaluate(ws=>v619LoadAdminWeek(ws,{render:false}),weekA);assert.ok(await p.evaluate(()=>state.adminProfessionalWeekMapV619.A));
 await f.login('D');assert.ok(!(await p.evaluate(()=>state.adminProfessionalWeekMapV619?.A)));assert.ok(!(await p.evaluate(()=>state.adminAvailabilityWeekV616?.A)));assert.deepEqual(await p.evaluate(()=>state.v621AdminWeekCache),{});
 await f.login('A');await p.evaluate(ws=>loadWeekAvailabilityV616(ws,{render:false}),weekA);await f.login('A');assert.notEqual(await p.evaluate(()=>state.availabilityWeekStartV616),weekA);assert.deepEqual(f.errors,[]);
});
for(const error of [false,true])test(`uncancellable late ${error?'error':'response'} from A cannot overwrite B's week or loading`,async t=>{
 const f=await fixture(t,{ignoreAbort:true}),p=f.page,held=f.hold({uid:'A',path:'/disponibilidade-semanal',week:weekA,error});await p.evaluate(ws=>{window.oldWeek=loadWeekAvailabilityV616(ws,{render:false});},weekA);await held.started;
 await f.login('B');await p.evaluate(ws=>loadWeekAvailabilityV616(ws,{render:false}),weekB);const before=await p.evaluate(()=>({week:state.availabilityWeekStartV616,items:state.availabilityWeekItemsV616,loading:state.loading}));held.release();await p.evaluate(()=>oldWeek);
 assert.deepEqual(await p.evaluate(()=>({week:state.availabilityWeekStartV616,items:state.availabilityWeekItemsV616,loading:state.loading})),before);assert.deepEqual(f.errors,[]);
});
test('same UID after logout has a new generation: old response is refused',async t=>{
 const f=await fixture(t,{ignoreAbort:true}),p=f.page,held=f.hold({uid:'A',path:'/disponibilidade-semanal',week:weekA,body:{weekStart:weekA,items:{1:[{inicio:'20:00',fim:'22:00'}]}}});await p.evaluate(ws=>{window.oldWeek=loadWeekAvailabilityV616(ws,{render:false});},weekA);await held.started;const before=await p.evaluate(()=>forjaCaptureSession().generation);
 await f.login('A');assert.notEqual(await p.evaluate(()=>forjaCaptureSession().generation),before);held.release();await p.evaluate(()=>oldWeek);assert.notEqual(await p.evaluate(()=>state.availabilityWeekStartV616),weekA);assert.ok(!(await p.evaluate(()=>JSON.stringify(state))).includes('20:00'));
});
test('late profile failure never signs out or clears the newly authenticated user',async t=>{
 const f=await fixture(t,{ignoreAbort:true}),p=f.page,held=f.hold({uid:'A',path:'/me',error:true});await p.evaluate(()=>{window.oldActivation=activateUser(auth.currentUser)});await held.started;await f.login('B');held.release();await p.evaluate(()=>oldActivation);assert.equal(await p.evaluate(()=>auth.currentUser.uid),'B');assert.equal(await p.evaluate(()=>state.user.uid),'B');assert.equal(await p.evaluate(()=>state.loading),false);assert.deepEqual(f.errors,[]);
});
test('token arriving after logout cannot send a queued write under another identity',async t=>{
 const f=await fixture(t),p=f.page;await p.evaluate(()=>{window.fixtureTokenGate=true;window.oldWrite=api('/disponibilidade-semanal',{method:'PATCH',body:{semana:{}}}).catch(e=>e.code)});await p.waitForFunction(()=>typeof releaseToken==='function');await p.evaluate(()=>{window.fixtureTokenGate=false});await f.login('B');await p.evaluate(()=>releaseToken());assert.equal(await p.evaluate(()=>oldWrite),'FORJA_STALE_SESSION');assert.equal(f.requests.filter(x=>x.method==='PATCH').length,0);
});
test('admin availability refresh completing after logout does not repopulate teacher caches',async t=>{
 const f=await fixture(t,{ignoreAbort:true}),p=f.page;await f.login('C');const held=f.hold({uid:'C',path:'/admin/disponibilidades-semana',week:weekA});await p.evaluate(ws=>{window.oldAdminWeek=v619LoadAdminWeek(ws,{render:false})},weekA);await held.started;await f.login('D');held.release();await p.evaluate(()=>oldAdminWeek);assert.ok(!(await p.evaluate(()=>state.adminProfessionalWeekMapV619?.A)));assert.deepEqual(await p.evaluate(()=>state.v621AdminWeekCache),{});assert.equal(await p.evaluate(()=>state.adminProfessionalWeekLoadingV619||false),false);
});
test('older week selection in the same session cannot replace the newer selected week',async t=>{
 const f=await fixture(t,{ignoreAbort:true}),p=f.page,held=f.hold({uid:'A',path:'/disponibilidade-semanal',week:weekA});await p.evaluate(ws=>{window.oldWeek=loadWeekAvailabilityV616(ws,{render:false})},weekA);await held.started;await p.evaluate(ws=>loadWeekAvailabilityV616(ws,{render:false}),weekB);held.release();await p.evaluate(()=>oldWeek);assert.equal(await p.evaluate(()=>state.availabilityWeekStartV616),weekB);assert.deepEqual(await p.evaluate(()=>state.availabilityWeekItemsV616),{});
});
