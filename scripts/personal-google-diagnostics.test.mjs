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
async function fixture(t,{ignoreAbort=false,mobile=false,connected=true,failure=null,diagnosticResult=failure,legacy=false}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});t.after(()=>page.close());const requests=[],holds=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({ignoreAbort})=>{window.FORJA_FIREBASE_CONFIG={apiKey:'local-test-only',projectId:'demo-forja',authDomain:'forja.invalid'};if(ignoreAbort){const previous=fetch;window.fetch=(url,options={})=>previous(url,{...options,signal:undefined})}},{ignoreAbort});
 const weekly=(uid,week)=>week===weekA&&uid==='A'?{1:[{inicio:'13:00',fim:'17:00'}]}:week===weekB&&uid==='B'?{1:[{inicio:'11:00',fim:'12:00'}]}:{};
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin===origin)return route.fulfill({contentType:'text/html',body:html});
  if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase-app-compat.js'))return route.fulfill({contentType:'application/javascript',body:sdk});
  if(u.hostname==='www.gstatic.com'&&u.pathname.includes('firebase-auth-compat.js'))return route.fulfill({contentType:'application/javascript',body:''});
  if(u.hostname==='accounts.google.com')return route.fulfill({contentType:'text/html',body:'<p>OAuth simulado no Chromium; nenhuma conta real.</p>'});
  if(u.hostname!=='forja-api-m1kq.onrender.com')return route.abort();
  if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type,x-forja-otp','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'}});
  const uid=(r.headers().authorization||'').replace('Bearer LOCAL_',''),week=u.searchParams.get('weekStart')||'2026-10-12';requests.push({uid,path:u.pathname,week,method:r.method()});
  let body={items:[],users:[],item:{}},status=200;
  if(u.pathname==='/me')body={profile:{uid,role:({A:'teacher',B:'psychologist',C:'admin',D:'teacher'})[uid],active:true,fullName:'Fictício '+uid,email:uid+'@forja.invalid'}};
  if(u.pathname==='/disponibilidade-semanal')body={items:weekly(uid,week),weekStart:week,hasSavedWeek:Object.keys(weekly(uid,week)).length>0};
  if(u.pathname==='/admin/disponibilidades-semana')body={weekStart:week,items:[{uid:'A',weekStart:week,availabilityPolicy:'confirmed-week-v2',publicationValid:true,disponibilidade:{1:[{inicio:'13:00',fim:'17:00'}]}}]};
  if(u.pathname==='/google/calendar/status')body={consent:{version:'personal-busy-secretaria-v1',text:'Autorizo a consulta dos intervalos ocupados pela Secretaria, sem detalhes privados.',connectionChallenge:'SYNTHETIC_CONSENT_CHALLENGE'},configured:true,diagnosticsPolicy:'personal-google-diagnostics-v1',item:{connected,lastSyncStatus:failure?'erro':'ok',lastFailure:failure}};
  if(u.pathname==='/google/calendar/diagnostics'){status=diagnosticResult?.status==='unavailable'?409:200;body=legacy?{apiReachable:true,connection:{connected:true}}:{googleDiagnosis:diagnosticResult||{policy:'personal-google-diagnostics-v1',status:'verified',stage:'calendar_api',checkedAt:'2026-10-14T19:00:00.000Z'}};}
  if(u.pathname==='/google/calendar/connect')body={authUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=TEST_ONLY_OPAQUE_STATE'};
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
async function showGoogleControls(p){const details=p.locator('.forja2-diagnostic');if(await details.count()&&!await details.evaluate(el=>el.open))await details.locator('summary').click();}
async function diagnose(p){await showGoogleControls(p);await p.locator('[data-v620-google-diagnostics]:visible,[data-personal-google-diagnose]:visible').click();}
const policy='personal-google-diagnostics-v1';
const fail=(kind='authorization_invalid',resolution='professional_reconnect')=>({policy,status:'unavailable',failureKind:kind,resolution,reconnectRequired:resolution==='professional_reconnect',stage:'token',checkedAt:'2026-10-14T19:00:00.000Z',providerHttpStatus:400});
for(const mobile of [false,true])test(`personal recovery ${mobile?'mobile':'desktop'}: diagnosis then reconnect uses existing OAuth, never DELETE`,async t=>{
 const f=await fixture(t,{mobile,failure:fail()}),p=f.page;
 await p.evaluate(()=>navigate('agenda'));
 assert.equal(await p.locator('[data-personal-google-reconnect]').count(),1);
 await diagnose(p);await p.waitForFunction(()=>!document.getElementById('modal').classList.contains('hidden'));
 assert.match(await p.locator('#modal').innerText(),/Autorização Google inválida/);assert.match(await p.locator('#modal').innerText(),/Testing/);
 assert.match(await p.locator('#modal').innerText(),/não distingue.*expiração de revogação/);
 assert.match(await p.locator('#modal').innerText(),/conexão anterior será preservada/);
 await p.locator('#modal [data-personal-google-reconnect]').click();await p.waitForSelector('#googlePersonalConsentAccept');assert.equal(await p.isChecked('#googlePersonalConsentAccept'),false);assert.equal(f.requests.filter(r=>r.path==='/google/calendar/connect').length,0);await p.check('#googlePersonalConsentAccept');await p.click('#modalSave');await p.waitForURL('https://accounts.google.com/**');
 assert.equal(f.requests.filter(r=>r.path==='/google/calendar/connect'&&r.method==='POST').length,1);
 assert.equal(f.requests.filter(r=>r.method==='DELETE').length,0);assert.deepEqual(f.errors,[]);
});
for(const [kind,resolution,label] of [['server_configuration','administrator','Configuração OAuth'],['insufficient_scope','administrator','Permissão OAuth insuficiente'],['credential_decryption','administrator','descriptografia'],['network','retry_later','Falha de rede'],['timeout','retry_later','Tempo de consulta'],['access_denied','professional_and_administrator','Acesso ao calendário'],['rate_limited','retry_later','Limite de consultas'],['provider_unavailable','retry_later','temporariamente indisponível']])test(`personal ${kind}: actionable report without unnecessary reconnection`,async t=>{
 const f=await fixture(t,{failure:fail(kind,resolution)}),p=f.page;await p.evaluate(()=>navigate('agenda'));
 assert.equal(await p.locator('[data-personal-google-reconnect]').count(),0);
 await diagnose(p);await p.waitForFunction(()=>!document.getElementById('modal').classList.contains('hidden'));
 assert.ok((await p.locator('#modal').innerText()).includes(label));assert.equal(await p.locator('[data-personal-google-reconnect]').count(),0);assert.deepEqual(f.errors,[]);
});
test('verified probe supersedes old failure without claiming sync or free slots',async t=>{
 const f=await fixture(t,{failure:fail(),diagnosticResult:{policy,status:'verified',stage:'calendar_api',checkedAt:'2026-10-14T19:05:00.000Z'}}),p=f.page;
 await p.evaluate(()=>navigate('agenda'));await diagnose(p);await p.waitForFunction(()=>!document.getElementById('modal').classList.contains('hidden'));
 assert.match(await p.locator('#modal').innerText(),/Consulta Google verificada agora/);assert.match(await p.locator('#modal').innerText(),/não.*garante.*horário/);assert.equal(await p.locator('[data-personal-google-reconnect]').count(),0);
});
test('legacy API/generic error is inconclusive and never invents need for consent',async t=>{
 const f=await fixture(t,{legacy:true}),p=f.page;await p.evaluate(()=>{state.googleCalendar.item.lastSyncStatus='erro';navigate('agenda')});
 await diagnose(p);await p.waitForFunction(()=>!document.getElementById('modal').classList.contains('hidden'));
 assert.match(await p.locator('#modal').innerText(),/não contém uma causa verificável/);assert.equal(await p.locator('[data-personal-google-reconnect]').count(),0);
});
test('concurrent diagnostic clicks share one call; late response cannot cross UID/session',async t=>{
 const f=await fixture(t,{failure:fail()}),p=f.page,held=f.hold({uid:'A',path:'/google/calendar/diagnostics',body:{googleDiagnosis:fail()}});
 await p.evaluate(()=>navigate('agenda'));await showGoogleControls(p);await p.locator('[data-v620-google-diagnostics]').evaluate(b=>{window.oldDiagnostic=b.onclick();b.onclick()});await held.started;
 assert.equal(f.requests.filter(r=>r.path==='/google/calendar/diagnostics').length,1);
 await f.login('B');await p.evaluate(()=>navigate('conta'));held.release();await p.evaluate(()=>window.oldDiagnostic);
 assert.equal(await p.locator('#modal:not(.hidden)').count(),0);assert.equal(await p.evaluate(()=>state.googleCalendar.personalDiagnosis||null),null);
});
test('psychologist has the same recovery and an actually disconnected account retains Connect',async t=>{
 const f=await fixture(t,{failure:fail()}),p=f.page;await f.login('B');await p.evaluate(()=>navigate('conta'));assert.ok(await p.locator('[data-personal-google-reconnect]').count());
 const g=await fixture(t,{connected:false});await g.page.evaluate(()=>navigate('agenda'));assert.equal(await g.page.locator('[data-google-action="connect"]').count(),1);assert.equal(await g.page.locator('[data-personal-google-reconnect]').count(),0);
});
test('late reconnect response cannot redirect a different authenticated session',async t=>{
 const f=await fixture(t,{ignoreAbort:true,failure:fail()}),p=f.page,held=f.hold({uid:'A',path:'/google/calendar/connect',body:{authUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=TEST_ONLY_OLD_SESSION'}});
 await p.evaluate(()=>{navigate('agenda');const previous=googleAction;googleAction=(...args)=>window.oldReconnect=previous(...args)});await showGoogleControls(p);await p.locator('[data-personal-google-reconnect]').click();await p.waitForSelector('#googlePersonalConsentAccept');await p.check('#googlePersonalConsentAccept');await p.evaluate(()=>{const b=document.getElementById('modalSave'),fn=b.onclick;b.onclick=(...args)=>(window.oldConsentSave=fn(...args));});await p.click('#modalSave');await held.started;
 await f.login('B');held.release();await p.evaluate(()=>window.oldConsentSave);
 assert.equal(new URL(p.url()).origin,origin);assert.equal(f.requests.filter(r=>r.method==='DELETE').length,0);assert.equal(await p.evaluate(()=>state.user.uid),'B');
});
