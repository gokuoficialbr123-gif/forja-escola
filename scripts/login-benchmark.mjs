// Controlled full-click benchmark. No school data or real Auth/Google calls.
import{readFileSync,writeFileSync}from'node:fs';import{resolve}from'node:path';import{pathToFileURL}from'node:url';
import{performancePortal}from'./helpers/performance-portal-fixture.mjs';import{buildHostingArtifact}from'./prepare-hosting.mjs';
import{withoutLoginCriticalPath}from'./login-critical-path-scope.mjs';import{extractStaticResources}from'./static-resources.mjs';
import{withoutAgendaIntelligence}from'./agenda-intelligence-scope.mjs';
const{chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);
const baseline=process.argv.includes('--baseline'),agendaBaseline=process.argv.includes('--agenda-baseline'),n=Number(process.env.FORJA_LOGIN_RUNS||10),output=process.env.FORJA_LOGIN_OUTPUT;
if(!output||!Number.isInteger(n)||n<1||n>20)throw Error('Output and bounded run count required');
const artifact=agendaBaseline?extractStaticResources(Buffer.from(withoutAgendaIntelligence(readFileSync(new URL('../index.html',import.meta.url),'utf8')))):baseline?extractStaticResources(Buffer.from(withoutLoginCriticalPath(readFileSync(new URL('../index.html',import.meta.url),'utf8')))):buildHostingArtifact();
const browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}),rows=[];
try{for(const mobile of [false,true])for(let run=0;run<n;run++){
 const f=await performancePortal({browser,...artifact,mobile,requestDelay:250,secondaryDelay:2500,meDelay:350});
 try{
  const p=f.page;await p.evaluate(async()=>{
   window.__loginBench={};let first=true;
   const user={uid:'PERF_ADMIN',email:'admin@forja.invalid',emailVerified:true,getIdToken:async()=>{if(first){first=false;const t=performance.now();await new Promise(r=>setTimeout(r,100));__loginBench.tokenMs=performance.now()-t;}return 'SYNTHETIC'}};
   auth.signInWithEmailAndPassword=async()=>{const t=performance.now();await new Promise(r=>setTimeout(r,400));__loginBench.authMs=performance.now()-t;auth.currentUser=user;return {user}};
   showLogin();await new Promise(r=>requestAnimationFrame(r));
  });
  await p.fill('#loginEmail','admin@forja.invalid');await p.fill('#loginPassword','synthetic-only-password');
  const clientStart=Date.now();await p.evaluate(()=>{__loginBench.click=performance.now();document.querySelector('[data-action="enterPortal"]').click()});
  await p.waitForFunction(()=>state.role==='admin'&&!state.loading&&document.querySelector('.secretary-d-hero'));
  const portal=await p.evaluate(()=>({portalMs:performance.now()-__loginBench.click,authMs:__loginBench.authMs,tokenMs:__loginBench.tokenMs,longTaskMs:__longTasks.filter(t=>t.start>=__loginBench.click).reduce((a,t)=>a+t.duration,0)})),loginCalls=f.calls.slice();
  await p.evaluate(()=>{__loginBench.agendaStart=performance.now();navigate('agenda')});await p.waitForFunction(()=>!state.loading&&(window.forjaAgenda2Enabled?document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'):Object.values(state.v631CentralRanges||{}).some(x=>x.valid)));await p.locator('[data-v630-open]').first().waitFor({state:'visible'});
  const agenda=await p.evaluate(()=>({agendaFromClickMs:performance.now()-__loginBench.click,agendaNavigationMs:performance.now()-__loginBench.agendaStart}));
  const cadastroStart=Date.now();await p.evaluate(()=>navigate('cadastros'));await p.waitForFunction(()=>!state.loading&&document.querySelector('[data-action="newUser"]'));
  const me=loginCalls.find(x=>x.path==='/me'),row={mobile,run,...portal,...agenda,cadastroMs:Date.now()-cadastroStart,loginGetRequests:loginCalls.filter(x=>x.method==='GET').length,meBoundaryMs:me.end-me.start,loginCalls:loginCalls.map(x=>({path:x.path,method:x.method,startMs:x.start-clientStart,endMs:x.end-clientStart})),errors:f.errors};if(f.errors.length)throw Error('Browser error');rows.push(row);console.log(JSON.stringify({...row,loginCalls:undefined}));
 }finally{await f.close()}
}}finally{await browser.close()}
const quantile=(xs,q)=>xs.slice().sort((a,b)=>a-b)[Math.ceil(xs.length*q)-1];
const summary=[false,true].map(mobile=>({mobile,n:rows.filter(x=>x.mobile===mobile).length,metrics:Object.fromEntries(['portalMs','agendaFromClickMs','agendaNavigationMs','cadastroMs','authMs','tokenMs','meBoundaryMs','loginGetRequests','longTaskMs'].map(k=>{const xs=rows.filter(x=>x.mobile===mobile).map(x=>x[k]).sort((a,b)=>a-b),median=xs.length%2?xs[(xs.length-1)/2]:(xs[xs.length/2-1]+xs[xs.length/2])/2;return [k,{median,p95:quantile(xs,.95)}]}))}));
writeFileSync(output,JSON.stringify({baseline,source:'actual portal + synthetic Auth/API/Google boundaries; not production or Render cold start',model:{authMs:400,firstTokenMs:100,meMs:350,otherMs:250,slowSecondaryMs:2500,mobileCpu:4,mobileMbps:1.6,desktopMbps:10,cache:'new context; interception disables HTTP cache'},summary,rows},null,2));
