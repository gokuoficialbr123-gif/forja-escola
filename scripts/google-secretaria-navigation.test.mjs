import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';

// Entire official portal, actual auth bootstrap/navigation/render/bind chain.
// Only Firebase Auth and HTTP are doubled at the network boundary.
const html=readFileSync(process.env.FORJA_NAV_HTML_FILE||new URL('../index.html',import.meta.url),'utf8');
const {chromium}=await import(process.env.FORJA_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href:'playwright');
let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));
after(async()=>browser?.close());
const base='/admin/google-calendar/central';
const local='https://forja-portal-fixture.invalid';
const firebaseDouble=`(()=>{const user={uid:'LOCAL_ADMIN',email:'admin@forja.invalid',emailVerified:true,getIdToken:async()=> 'TEST_ONLY_LOCAL_TOKEN'};
 const auth={currentUser:user,setPersistence:async()=>{},onAuthStateChanged:cb=>{Promise.resolve().then(()=>cb(user));return()=>{}},signOut:async()=>{}};
 const authFactory=()=>auth;authFactory.Auth={Persistence:{SESSION:'session'}};
 window.firebase={apps:[],initializeApp:()=>firebase.apps.push({}),auth:authFactory};})();`;

async function fixture(t,{mobile=false,ageMs=301000,reauth=false,failList=0,oauth=false,status='success',busy=false}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});t.after(()=>page.close());
 const requests=[],errors=[];
 const provider={lastRefreshAt:{seconds:(Date.now()-ageMs)/1000},lastRefreshStatus:status,reauth,failList,gate:null,revision:1};
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.FORJA_FIREBASE_CONFIG={apiKey:'TEST_ONLY_LOCAL_API_KEY',projectId:'demo-forja',authDomain:'forja.invalid'}});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':local}});
  if(url.origin===local&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase-app-compat.js'))return route.fulfill({contentType:'application/javascript',body:firebaseDouble});
  if(url.hostname==='www.gstatic.com'&&url.pathname.includes('firebase-auth-compat.js'))return route.fulfill({contentType:'application/javascript',body:''});
  if(url.hostname!=='forja-api-m1kq.onrender.com')return route.abort();
  requests.push({path:url.pathname,method:req.method(),body:req.postData()?JSON.parse(req.postData()):null});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':local,'Access-Control-Allow-Headers':'authorization,content-type,x-forja-otp','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'}});
  if(url.pathname==='/me')return json({ok:true,profile:{uid:'LOCAL_ADMIN',email:'admin@forja.invalid',fullName:'Admin local',role:'admin',active:true}});
  if(url.pathname===base+'/status')return json({configured:true,policy:'calendarlist-association-v2',...(busy?{freeBusyPolicy:'central-freebusy-query-v1'}:{}),item:{freeBusyAuthorized:busy,connected:true,requiresReauthorization:provider.reauth,maskedEmail:'s***@f***.invalid'}});
  const list=()=>({connected:true,connectionRevision:provider.revision,requiresReauthorization:provider.reauth,lastRefreshAt:provider.lastRefreshAt,lastRefreshStatus:provider.lastRefreshStatus,items:[{id:'a'.repeat(64),displayName:'Calendário local',accessRole:'reader',primary:false,teacherId:busy?'LOCAL_TEACHER':'',enabled:busy,effectiveEnabled:busy,accessStatus:'accessible'}],teachers:[{id:'LOCAL_TEACHER',fullName:'Professor local',role:'teacher',active:true}]});
  if(url.pathname===base+'/freebusy'){
   const body=JSON.parse(req.postData());
   return json({policy:'central-freebusy-query-v1',status:'success',complete:true,timeMin:body.timeMin,timeMax:body.timeMax,timeZone:'America/Sao_Paulo',checkedAt:'2026-10-05T18:00:00Z',items:[{teacherId:'LOCAL_TEACHER',status:'success',busy:[{start:body.timeMin.slice(0,10)+'T16:33:00.000Z',end:body.timeMin.slice(0,10)+'T17:44:00.000Z',label:'Ocupado'}]}]});
  }
  if(url.pathname===base+'/calendars'){
   if(provider.failList-->0)return json({error:'Falha local de leitura'},502);
   return json(list());
  }
  if(url.pathname===base+'/calendars/refresh'){
   if(provider.gate)await provider.gate;
   provider.lastRefreshAt={seconds:Date.now()/1000};provider.lastRefreshStatus='success';return json(list());
  }
  if(url.pathname==='/admin/usuarios')return json({users:[{uid:'LOCAL_ADMIN',role:'admin',active:true,fullName:'Admin local'},{uid:'LOCAL_TEACHER',role:'teacher',active:true,fullName:'Professor local'}]});
  return json({ok:true,items:[],item:{},connections:[]});
 });
 await page.goto(local+(oauth?'/?googleSecretaria=connected':'/'));
 assert.deepEqual(errors,[],'Full portal script parsing must succeed');
 await page.waitForFunction(()=>typeof state!=='undefined'&&state.role==='admin'&&!state.loading);
 assert.deepEqual(errors,[],'Full portal bootstrap must succeed');
 const posts=()=>requests.filter(x=>x.path===base+'/calendars/refresh'&&x.method==='POST');
 const enter=async()=>{
  if(mobile)await page.evaluate(()=>navigate('configuracoes'));
  else await page.locator('#sideNav [data-page="configuracoes"]').click();
  await page.waitForFunction(()=>state.page==='configuracoes'&&document.getElementById('googleSecretariaCard')&&!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
  // Flush entry's promise continuation without a timer or UI-state mutation.
  await page.evaluate(async()=>{await Promise.resolve();await Promise.resolve()});
 };
 const leave=async()=>{await page.evaluate(()=>navigate('inicio'));await page.waitForFunction(()=>state.page==='inicio'&&!document.getElementById('googleSecretariaCard'))};
 return {page,provider,requests,posts,enter,leave,errors};
}

for(const mobile of [false,true]){
 test(`real portal ${mobile?'mobile':'desktop'}: stale login → navigate to settings → exactly one automatic POST`,async t=>{
  const f=await fixture(t,{mobile});assert.equal(f.posts().length,0);await f.enter();
  assert.equal(f.posts().length,1);assert.deepEqual(f.posts()[0].body,{automatic:true});assert.ok(!f.requests.some(x=>x.path===base+'/connect'));
 });
 test(`real portal ${mobile?'mobile':'desktop'}: fresh login → settings → no automatic POST`,async t=>{
  const f=await fixture(t,{mobile,ageMs:60000});await f.enter();assert.equal(f.posts().length,0);
 });
 test(`real portal ${mobile?'mobile':'desktop'}: leave settings → saved timestamp expires → reenter without reconnect`,async t=>{
  const f=await fixture(t,{mobile,ageMs:0});await f.enter();assert.equal(f.posts().length,0);await f.leave();
  f.provider.lastRefreshAt={seconds:(Date.now()-301000)/1000};await f.enter();
  assert.equal(f.posts().length,1);assert.deepEqual(f.posts()[0].body,{automatic:true});
 });
}
test('real portal: previous snapshot read failure is retried on entry without reconnect',async t=>{
 const f=await fixture(t,{failList:1});await f.enter();await f.leave();await f.enter();assert.equal(f.posts().length,1);
});
test('real portal: scope/account status is rechecked on each entry instead of retaining stale reauthorization guard',async t=>{
 const f=await fixture(t,{reauth:true});await f.enter();assert.equal(f.posts().length,0);await f.leave();f.provider.reauth=false;await f.enter();assert.equal(f.posts().length,1);
});
test('real portal: F5 in settings restores that view and refreshes expired metadata once',async t=>{
 const f=await fixture(t,{ageMs:0});await f.enter();f.provider.lastRefreshAt={seconds:(Date.now()-301000)/1000};
 await f.page.reload();await f.page.waitForFunction(()=>state.role==='admin'&&!state.loading&&!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
 assert.equal(await f.page.evaluate(()=>state.page),'configuracoes');assert.equal(f.posts().length,1);
});
test('real portal: F5 in settings with a fresh snapshot restores view without a POST',async t=>{
 const f=await fixture(t,{ageMs:0});await f.enter();await f.page.reload();
 await f.page.waitForFunction(()=>state.role==='admin'&&!state.loading&&!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
 assert.equal(await f.page.evaluate(()=>state.page),'configuracoes');assert.equal(f.posts().length,0);
});
test('real portal: session settings marker from another admin never restores the view',async t=>{
 const f=await fixture(t,{ageMs:0});await f.enter();await f.page.evaluate(()=>sessionStorage.setItem('forja.secretaria.settings','OTHER_ADMIN'));await f.page.reload();
 await f.page.waitForFunction(()=>state.role==='admin'&&!state.loading);
 assert.equal(await f.page.evaluate(()=>state.page),'inicio');assert.equal(f.posts().length,0);
});
test('real portal: OAuth return opens settings and refreshes not_refreshed even with a recent timestamp',async t=>{
 const f=await fixture(t,{oauth:true,ageMs:0,status:'not_refreshed'});await f.page.waitForFunction(()=>!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
 assert.equal(await f.page.evaluate(()=>state.page),'configuracoes');assert.equal(f.posts().length,1);
});
test('real portal: repeated binding and reentry during automatic refresh never duplicate POST',async t=>{
 const f=await fixture(t);let finish;f.provider.gate=new Promise(resolve=>finish=resolve);
 await f.page.evaluate(()=>navigate('configuracoes'));await f.page.waitForFunction(()=>state.googleSecretaria.listLoading);
 await f.page.evaluate(()=>{bindPage();bindPage();navigate('inicio');navigate('configuracoes');bindPage()});
 assert.equal(f.posts().length,1);finish();await f.page.waitForFunction(()=>!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);assert.equal(f.posts().length,1);
});

for(const mobile of [false,true])test(`real portal ${mobile?'mobile':'desktop'}: central occupied diagnostic preserves actual timezone and does not alter Agenda`,async t=>{
 const f=await fixture(t,{mobile,busy:true,ageMs:60000});await f.enter();const baselineWrites=f.requests.filter(x=>x.method==='POST'&&!x.path.startsWith(base)).length;assert.equal(f.requests.filter(x=>x.path===base+'/freebusy').length,0);
 await f.page.locator('[data-central-busy=from]').fill('2026-10-03');await f.page.locator('[data-central-busy=to]').fill('2026-10-03');await f.page.locator('[data-central-busy=teacher]').selectOption('LOCAL_TEACHER');await f.page.click('[data-secretaria-google=busy]');
 await f.page.waitForFunction(()=>!state.googleSecretaria.freeBusyLoading&&state.googleSecretaria.busyResult);
 const calls=f.requests.filter(x=>x.path===base+'/freebusy');assert.equal(calls.length,1);assert.deepEqual(calls[0].body,{timeMin:'2026-10-03T03:00:00.000Z',timeMax:'2026-10-04T03:00:00.000Z',teacherIds:['LOCAL_TEACHER']});
 const text=await f.page.locator('#centralFreeBusyResults').textContent();assert.match(text,/Ocupado/);assert.match(text,/13:33/);assert.match(text,/14:44/);assert.deepEqual(f.errors,[]);
 assert.equal(f.requests.filter(x=>x.method==='POST'&&!x.path.startsWith(base)).length,baselineWrites);await f.leave();await f.enter();assert.equal(f.requests.filter(x=>x.path===base+'/freebusy').length,1);
});
