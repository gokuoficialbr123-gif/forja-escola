import {createServer}from'node:http';import{brotliCompressSync}from'node:zlib';
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export async function performancePortal({browser,bytes,resources=[],mobile=false,requestDelay=120,secondaryDelay=900,meDelay=requestDelay,role='admin'}){
 const assets=new Map(resources.map(r=>['/'+r.file,{raw:r.bytes,br:/\.(?:css|js)$/.test(r.file)?brotliCompressSync(r.bytes):null}])),compressed=brotliCompressSync(bytes),held=new Map(),failed=new Set();
 const server=createServer((req,res)=>{const path=new URL(req.url,'http://localhost').pathname,asset=assets.get(path),b=path==='/'?bytes:asset?.raw;if(!b){res.writeHead(404);return res.end()}res.setHeader('Content-Type',path==='/'?'text/html':path.endsWith('.js')?'application/javascript':path.endsWith('.css')?'text/css':'image/webp');res.setHeader('Cache-Control',path==='/'?'no-cache':'public,max-age=3600');if(path==='/'){res.setHeader('Content-Encoding','br');res.end(compressed)}else if(asset.br){res.setHeader('Content-Encoding','br');res.end(asset.br)}else res.end(b)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:900},locale:'pt-BR',reducedMotion:'reduce'}),page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:mobile?4:1});
 await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:mobile?80:20,downloadThroughput:(mobile?1.6:10)*1024*1024/8,uploadThroughput:750000});
 const calls=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await context.addInitScript(()=>{window.__longTasks=[];new PerformanceObserver(l=>__longTasks.push(...l.getEntries().map(x=>({start:x.startTime,duration:x.duration})))).observe({type:'longtask',buffered:true});window.FORJA_FIREBASE_CONFIG={apiKey:'SYNTHETIC',projectId:'demo-forja',authDomain:'forja.invalid'};});
 const user={uid:'PERF_ADMIN',fullName:'Admin sintético',email:'admin@forja.invalid',role,active:true};const teacher={uid:'PERF_TEACHER',fullName:'Professor sintético',role:'teacher',active:true,disciplinaIds:['MATH'],forjaId:'TEST-1'},student={uid:'PERF_STUDENT',fullName:'Aluno sintético',role:'student',active:true,serieId:'YEAR',disciplinasLiberadas:['MATH'],forjaId:'TEST-2'};
 const handler=async route=>{const request=route.request(),url=new URL(request.url());if(url.origin===origin)return route.continue();
  if(url.hostname==='www.gstatic.com')return route.fulfill({contentType:'application/javascript',body:url.pathname.includes('firebase-app')?`(()=>{const user={uid:'PERF_ADMIN',email:'admin@forja.invalid',emailVerified:true,getIdToken:async()=>'SYNTHETIC'},a={currentUser:null,setPersistence:async()=>{},onAuthStateChanged:cb=>{window.__perfSignIn=()=>{a.currentUser=user;return cb(user)};queueMicrotask(()=>cb(null));return()=>{}},signOut:async()=>{a.currentUser=null}};const f=()=>a;f.Auth={Persistence:{SESSION:'session'}};window.firebase={apps:[],initializeApp:()=>firebase.apps.push({}),auth:f};})();`:''});
  if(url.hostname!=='forja-api-m1kq.onrender.com')return route.abort();
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE'}});
  const start=Date.now(),entry={path:url.pathname,query:url.search,method:request.method(),start};calls.push(entry);
  if(held.has(url.pathname))await held.get(url.pathname).promise;
  const slow=['/auditoria','/admin/familias','/treinamentos'].includes(url.pathname);await delay(url.pathname==='/me'?meDelay:slow?secondaryDelay:requestDelay);
  const json=(body,status=200)=>{entry.end=Date.now();return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Access-Control-Allow-Origin':origin}}).catch(()=>{})};
  if(failed.has(url.pathname))return json({error:'Fonte sintética indisponível'},503);
  if(url.pathname==='/me')return json({profile:user});
  if(url.pathname==='/admin/usuarios')return json({users:[teacher,student,user]});
  if(url.pathname.endsWith('/catalogos/series'))return json({items:[{id:'YEAR',nome:'Ano sintético',active:true}]});
  if(url.pathname.endsWith('/catalogos/disciplinas'))return json({items:[{id:'MATH',nome:'Matemática',active:true}]});
  if(url.pathname==='/configuracoes/escola')return json({item:{nome:'FORJA Escola'}});
  if(url.pathname==='/google/calendar/busy')return json({items:[],complete:true,status:'success',unavailable:[]});
  if(url.pathname==='/admin/google-calendar/connections')return json({items:[],configured:false});
  if(url.pathname==='/admin/disponibilidades-semana'){const weekStart=url.searchParams.get('weekStart');return json({weekStart,items:[{uid:teacher.uid,weekStart,availabilityPolicy:'confirmed-week-v2',publicationValid:true,disponibilidade:Object.fromEntries([0,1,2,3,4,5,6].map(x=>[x,[{inicio:'08:00',fim:'18:00'}]]))}]})}
  if(url.pathname==='/admin/agenda/google-central-busy')return json({ok:true,policy:'central-booking-fail-closed-v1',from:url.searchParams.get('from'),to:url.searchParams.get('to'),complete:true,status:'success',unavailable:[],items:[]});
  if(url.pathname==='/agenda/snapshot'){
   const from=url.searchParams.get('from'),to=url.searchParams.get('to'),ids=url.searchParams.getAll('professionalId'),at=Date.now(),days={};for(let t=Date.parse(from+'T12:00:00Z');t<=Date.parse(to+'T12:00:00Z');t+=86400000)days[new Date(t).toISOString().slice(0,10)]=[{inicio:'08:00',fim:'18:00'}];
   return json({ok:true,policy:'agenda-readonly-v1',from,to,professionalIds:ids,checkedAt:new Date(at).toISOString(),servedAt:new Date(at).toISOString(),expiresAt:new Date(at+25000).toISOString(),complete:true,items:ids.map(professionalId=>({professionalId,status:'success',nativeStatus:'success',days,lessons:[],blocks:[],school:[],busy:[],personal:{status:'not_applicable',checkedAt:null},central:{status:'success',checkedAt:null}}))});
  }
  if(url.pathname==='/admin/google-calendar/central/status')return json({configured:false,policy:'calendarlist-association-v2',item:{connected:false}});
  if(url.pathname==='/admin/familias')return json({links:[],pending:[],unlinkedStudents:[]});
  return json({ok:true,items:[],users:[],item:{}});
 };await page.route('**/*',handler);

 await page.goto(origin);await page.waitForFunction(()=>typeof __perfSignIn==='function');
 return {page,context,cdp,calls,errors,origin,async openTab(){const tab=await context.newPage();tab.on('pageerror',e=>errors.push(e.message));await tab.route('**/*',handler);await tab.goto(origin);await tab.waitForFunction(()=>typeof __perfSignIn==='function');return tab;},fail(path){failed.add(path)},hold(path){let release;const promise=new Promise(r=>release=r);held.set(path,{promise,release});return ()=>{held.delete(path);release()}},async close(){for(const x of held.values())x.release();await context.close();await new Promise(r=>server.close(r))},async login(){await page.evaluate(()=>{const previous=renderShell;renderShell=function(...args){const value=previous(...args);if(window.__perfShellTime===undefined)window.__perfShellTime=Date.now();return value};window.__perfActivation=__perfSignIn();});}};
}
