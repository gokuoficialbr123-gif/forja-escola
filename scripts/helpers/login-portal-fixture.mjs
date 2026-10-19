import {readFileSync} from 'node:fs';

// Real portal, controlled Auth SDK/provider boundaries. All requests are routed;
// there is no school account, Google call or production API access.
export async function loginPortal(browser,{html=readFileSync(new URL('../../index.html',import.meta.url),'utf8'),mobile=false}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1365,height:900}}),calls=[],errors=[],origin='https://login.forja.invalid';
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.FORJA_FIREBASE_CONFIG={apiKey:'SYNTHETIC',projectId:'demo-forja',authDomain:'forja.invalid'};window.loginFixture={mode:'ok',profileCalls:0,signOutCalls:0};const previous=fetch;window.fetch=(url,options)=>{if(new URL(String(url),location.href).pathname==='/me'){const f=loginFixture;f.profileCalls++;if(f.mode==='network')return Promise.reject(new TypeError('Failed to fetch'));if(f.mode==='hang')return new Promise(r=>f.releaseProfile=r);if(f.mode==='token')throw Error('Token should not have reached fetch');}return previous(url,options)};});
 const sdk=`(()=>{let notify=()=>{};const make=uid=>({uid,email:uid+'@forja.invalid',emailVerified:true,getIdToken:async()=>{if(loginFixture.mode==='token')await new Promise(r=>loginFixture.releaseToken=r);return 'SYNTHETIC_'+uid}});const a={currentUser:null,setPersistence:async()=>{},onAuthStateChanged:cb=>{notify=cb;queueMicrotask(()=>cb(null));return()=>{}},signInWithEmailAndPassword:async email=>{const user=make(email.split('@')[0].toUpperCase());a.currentUser=user;notify(user);return {user}},signOut:async()=>{loginFixture.signOutCalls++;if(loginFixture.signOutHang)await new Promise(r=>loginFixture.releaseSignOut=r);a.currentUser=null;notify(null)}};const factory=()=>a;factory.Auth={Persistence:{SESSION:'session'}};window.firebase={apps:[],initializeApp:()=>firebase.apps.push({}),auth:factory};window.fixtureAuth=async(uid)=>{a.currentUser=uid?make(uid):null;return notify(a.currentUser)};})();`;
 await page.route('**/*',async route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.origin===origin)return route.fulfill({contentType:'text/html',body:html});
  if(u.hostname==='www.gstatic.com')return route.fulfill({contentType:'application/javascript',body:u.pathname.includes('firebase-app')?sdk:''});
  if(u.hostname!=='forja-api-m1kq.onrender.com')return route.abort();
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type,x-forja-otp','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'};
  if(r.method()==='OPTIONS')return route.fulfill({status:204,headers});
  calls.push({path:u.pathname,method:r.method()});const uid=(r.headers().authorization||'').replace('Bearer SYNTHETIC_',''),mode=await page.evaluate(()=>loginFixture.mode);
  let status=200,body={items:[],users:[],item:{}};
  if(u.pathname==='/me'){
   body={ok:true,uid,profile:{uid,email:uid+'@forja.invalid',fullName:'Pessoa sintética',active:true,role:uid==='B'?'psychologist':'teacher'}};
   if(/^http\d+$/.test(mode)){status=Number(mode.slice(4));body={error:'UNTRUSTED_PROVIDER_PAYLOAD',code:'SYNTHETIC_ERROR'}}
   if(mode==='invalid')body={ok:true,profile:{role:'admin'}};
   if(mode==='wrong-email')body.profile.email='other@forja.invalid';
   if(mode==='wrong-uid')body.uid='other';
   if(mode==='inactive')body.profile.active=false;
   if(mode==='bad-role')body.profile.role='staff';
   if(mode==='json')return route.fulfill({status,headers,contentType:'text/html',body:'<html>upstream error</html>'});
  }
  if(u.pathname==='/google/calendar/status')body={configured:false,item:{connected:false}};
  if(u.pathname==='/google/calendar/busy')body={items:[],complete:true,status:'success'};
  return route.fulfill({status,headers,contentType:'application/json',body:JSON.stringify(body)}).catch(()=>{});
 });
 await page.goto(origin);await page.waitForFunction(()=>typeof fixtureAuth==='function'&&firebaseReady);await page.evaluate(async()=>{showLogin();await new Promise(r=>requestAnimationFrame(r))});
 return {page,calls,errors,async mode(mode){await page.evaluate(mode=>loginFixture.mode=mode,mode)},async login(uid='A'){await page.fill('#loginEmail',uid+'@forja.invalid');await page.fill('#loginPassword','synthetic-password');await page.click('[data-action="enterPortal"]')},async close(){await page.close()}};
}
