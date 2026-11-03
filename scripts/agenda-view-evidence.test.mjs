import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {stabilityFixture,stabilityArtifact,denseWeek} from './helpers/agenda-stability-fixture.mjs';
import {setView,nextSnapshot,ready} from './helpers/agenda-presentation-fixture.mjs';
import {delay} from './helpers/performance-portal-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const directory=process.env.FORJA_VIEW_EVIDENCE,baseline=process.env.FORJA_VIEW_BASELINE==='1';
const artifact=()=>stabilityArtifact({baseline:baseline?'e4d1aeb1aef2835a145b01ce2c2a3f7e91408ff9':false});
async function capture(p,name){if(directory)await p.screenshot({path:resolve(directory,name+'.png'),fullPage:true});}
async function evidence(f,name,video){if(directory){writeFileSync(resolve(directory,name+'.json'),JSON.stringify({requests:f.requestTransitions,transitions:await f.page.evaluate(()=>__agendaTransitions||[]),broadcast:await f.page.evaluate(()=>window.__agendaBroadcast||[])},null,2));}await f.close();if(directory&&video)copyFileSync(await video.path(),resolve(directory,name+'.webm'));}
for(const role of ['admin','teacher'])for(const mobile of [false,true])test(`view transition visual ${role} ${mobile?'mobile':'desktop'}`,async()=>{
 if(directory)mkdirSync(directory,{recursive:true});let removed=false;
 const name=(baseline?'before-':'after-')+role+'-'+(mobile?'mobile':'desktop'),f=await stabilityFixture(browser,{role,mobile,artifact:artifact(),transformItem:x=>removed?{...x,lessons:[],blocks:[],school:[],busy:[]}:denseWeek(x),...(directory?{recordVideo:{dir:directory,size:mobile?{width:390,height:844}:{width:1365,height:900}}}:{})}),p=f.page,video=p.video();let release=()=>{};
 try{
  await setView(f,role,'week');await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));
  await p.evaluate(()=>{const tag=document.createElement('div');tag.textContent='DEMONSTRAÇÃO — DADOS SIMULADOS';tag.style.cssText='position:fixed;right:8px;bottom:70px;background:#fff;color:#334155;font:11px sans-serif;z-index:99999;padding:3px;pointer-events:none';document.body.append(tag);});
  const red=await p.locator('.forja2-busy.google:not(.forja2-historical)').count();assert.ok(red>=14);await capture(p,name+'-01-confirmed-week');
  let enter;const entry=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const month=async route=>{const q=new URL(route.request().url()).searchParams;if(Date.parse(q.get('to'))-Date.parse(q.get('from'))!==41*86400000)return route.fallback();enter();await gate;await route.fulfill({status:409,contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:'{"code":"AGENDA_QUERY_CHANGED"}'}).catch(()=>{});};await p.route('**/agenda/snapshot?**',month);
  const request=nextSnapshot(p,{view:'month'});await p.evaluate(()=>window.__scenarioStep='month-pending');await p.locator(`[data-v621-view="month"][data-role="${role}"]`).click();await entry;await capture(p,name+'-02-month-pending');
  const occupied=await p.locator('.v621-month-tag.busy,.v629-month-tag.busy').count();assert.equal(occupied>0,!baseline);release();await (await(await request).response()).finished();await p.waitForFunction(()=>document.querySelector('[data-forja2-status]').textContent.includes('Alteração detectada durante a consulta'));await capture(p,name+'-03-month-409');
  await p.unroute('**/agenda/snapshot?**',month);let enterWeek;const entered=new Promise(r=>enterWeek=r),held=new Promise(r=>release=r),hold=async route=>{enterWeek(route.request());await held;await route.fallback().catch(()=>{});};await p.route('**/agenda/snapshot?**',hold);
  await p.evaluate(()=>window.__scenarioStep='week-return-pending');await p.locator(`[data-v621-view="week"][data-role="${role}"]`).click();const weekRequest=await entered;assert.equal(await p.locator('.forja2-busy.google:not(.forja2-historical)').count(),baseline?0:red);await capture(p,name+'-04-return-week');
  await p.evaluate(()=>window.__scenarioStep='legitimate-expiry');await p.clock.runFor(26000);assert.equal(await p.locator('.v621-block.availability').count(),0);if(!baseline)assert.ok(await p.locator('.forja2-busy.google.forja2-historical').count()>0);await capture(p,name+'-05-original-expiry');
  await p.unroute('**/agenda/snapshot?**',hold);release();await p.evaluate(()=>{window.__scenarioStep='recovery';return forjaAgenda2Refresh();});await ready(p);await capture(p,name+'-06-recovered');
  removed=true;await p.evaluate(()=>{window.__scenarioStep='authoritative-removal';return forjaAgenda2Refresh();});assert.equal(await p.locator('.forja2-busy.google').count(),0);await capture(p,name+'-07-real-removal');assert.deepEqual(f.errors,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 }finally{release();await evidence(f,name,video);}
});
test('prolonged view navigation with two tabs, reconnect, latency and source recovery', {skip:process.env.FORJA_VIEW_SOAK!=='1'},async()=>{
 assert.ok(directory,'long session requires an evidence directory');mkdirSync(directory,{recursive:true});
 let failed=false;const f=await stabilityFixture(browser,{role:'admin',autoReady:true,transformItem:x=>{const d=denseWeek(x);return failed?{...d,status:'unavailable',central:{status:'unavailable',reason:'central_unavailable'},busy:d.busy.filter(b=>b.source!=='google-central')}:d;},recordVideo:{dir:directory,size:{width:1365,height:900}}}),p=f.page,video=p.video(),start=Date.now(),samples=[],remote=[],received=[];f.cdp.on('Network.responseReceived',e=>{if(e.response.remoteIPAddress)remote.push(e.response.remoteIPAddress)});
 let tab;
 const until=async(predicate,label)=>{const deadline=Date.now()+5000;while(Date.now()<deadline){if(await predicate())return;await delay(20);}assert.fail(label);};
 const receipt=(event,cursor)=>until(()=>p.evaluate(({event,cursor})=>window.__agendaReceived?.slice(cursor).some(e=>e.applied&&e.kind===event.kind&&e.version===event.version),{event,cursor}),'current tab must receive '+event.kind);
 const emit=async(kind,sources)=>{
  // BrowserContext test clocks drift after creating another page. Align them
  // as the existing handoff regression does; never relax the production age fence.
  const dates=await Promise.all([p.evaluate(()=>Date.now()),tab.evaluate(()=>Date.now())]);await p.clock.pauseAt(new Date(Math.max(...dates)+1000));
  received.push({kind:'clock-aligned',differenceMs:dates[1]-dates[0],atMs:Date.now()-start});
  let cursor=await p.evaluate(()=>window.__agendaReceived?.length||0);await receipt(f.emit('heartbeat'),cursor);
  cursor=await p.evaluate(()=>window.__agendaReceived.length);const event=f.emit(kind,sources);await receipt(event,cursor);received.push({kind,version:event.version,atMs:Date.now()-start});return event;
 };
 try{
  await setView(f,'admin','week');await f.waitStreams(1);f.emit('ready');
  tab=await f.openTab();await f.prepareTab(tab);await tab.evaluate(()=>__perfSignIn());await tab.waitForFunction(()=>state.profile&&!state.loading);const first=nextSnapshot(tab);await tab.evaluate(()=>{state.adminLessonAgendaDateG='2026-10-20';navigate('agenda')});await ready(tab,{request:first});
  let iteration=0;while(Date.now()-start<600000){
   const view=['day','week','month','week'][iteration%4];await p.evaluate(n=>window.__scenarioStep='navigation-'+n,iteration);await setView(f,'admin',view);
   if(iteration%12===3){await p.evaluate(()=>window.__scenarioStep='sse-reconnect');const before=f.connections();await emit('reconnect');await until(async()=>f.streams()===0&&await p.evaluate(async()=>!(await navigator.locks.query()).held.some(l=>l.name.startsWith('forja-agenda-events:'))),'former stream and Web Lock must close');const cursor=await p.evaluate(()=>window.__agendaReceived.length);await p.clock.runFor(5001);await until(()=>p.evaluate(cursor=>window.__agendaReceived?.slice(cursor).some(e=>e.applied&&e.kind==='ready'),cursor),'new authenticated ready after reconnect');assert.ok(f.connections()>before,'new authenticated HTTP stream after reconnect');assert.equal(f.streams(),1,'same-session tabs share the replacement stream');received.push({kind:'reconnected-ready',atMs:Date.now()-start});await p.clock.resume();}
   if(iteration%12===5){failed=true;await p.evaluate(()=>window.__scenarioStep='central-failure');await emit('changed',['central']);await p.evaluate(()=>forjaAgenda2Refresh());assert.equal(await p.locator('.v621-block.availability,.v621-month-tag.availability,.v629-month-tag.availability').count(),0);await p.clock.resume();}
   if(iteration%12===6){failed=false;await p.evaluate(()=>window.__scenarioStep='central-recovery');await p.evaluate(()=>forjaAgenda2Refresh());}
   if(iteration%12===8){const hold=async route=>{await delay(1200);await route.fallback().catch(()=>{});};await p.route('**/agenda/snapshot?**',hold);await p.evaluate(()=>{window.__scenarioStep='delayed-read';void forjaAgenda2Refresh()});await delay(1500);await p.unroute('**/agenda/snapshot?**',hold);}
   if(iteration%12===10){await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))});await delay(150);await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'))});}
   samples.push({iteration,elapsedMs:Date.now()-start,view,...await p.evaluate(()=>({red:document.querySelectorAll('.forja2-busy.google:not(.forja2-historical)').length,historical:document.querySelectorAll('.forja2-busy.google.forja2-historical').length,green:document.querySelectorAll('.v621-block.availability').length}))});if(iteration%12===0)await capture(p,'soak-'+iteration+'-'+view);iteration++;await delay(5000);
  }
  assert.ok(samples.length>=40);assert.ok(Date.now()-start>=600000);for(const kind of ['reconnect','reconnected-ready','changed'])assert.ok(received.filter(e=>e.kind===kind).length>=3,'received '+kind);assert.ok(remote.every(ip=>['127.0.0.1','::1'].includes(ip)));assert.deepEqual(f.errors,[]);
 }finally{writeFileSync(resolve(directory,'soak-summary.json'),JSON.stringify({elapsedMs:Date.now()-start,samples,received,connections:f.connections(),remoteAddresses:[...new Set(remote)]},null,2));await evidence(f,'soak',video);}
});
