import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {EventEmitter,once} from 'node:events';
import {agendaPresentationFixture,nextSnapshot,ready,reviewDay} from './helpers/agenda-presentation-fixture.mjs';
import {buildHostingArtifact} from './prepare-hosting.mjs';
import {delay} from './helpers/performance-portal-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
function artifact(){const value=buildHostingArtifact();if(process.env.FORJA_AGENDA_EVENT_BASELINE==='1'){const before=execFileSync('git',['show','8d7c3cee3a07acd7a9b543a6df1f5077b873bfef:index.html'],{encoding:'utf8',maxBuffer:4e6}),pattern=/<script id="forja-agenda2-script">[\s\S]*?<\/script>/;value.bytes=Buffer.from(value.bytes.toString().replace(pattern,()=>before.match(pattern)[0]));}return value;}
async function fixture(t,options={}){
 const sockets=new Set(),events=new EventEmitter();let connections=0,version=0;const f=await agendaPresentationFixture(browser,{...options,artifact:artifact(),mode:'free',changeVersion:()=>String(version).padStart(64,'0'),agendaEvents:(req,res)=>{assert.equal(req.headers.authorization,'Bearer SYNTHETIC');connections++;res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.flushHeaders();sockets.add(res);events.emit('stream');res.on('close',()=>{sockets.delete(res);events.emit('stream');});}});
 t.after(async()=>{for(const socket of sockets)socket.end();await f.close();});
 return {...f,connections:()=>connections,activeStreams:()=>sockets.size,async waitStreams(opened,active){const signal=AbortSignal.timeout(5000);while(connections!==opened||sockets.size!==active)await once(events,'stream',{signal});},emit:kind=>{if(kind==='changed')version++;for(const socket of sockets)socket.write('data: '+JSON.stringify({kind,version:String(version).padStart(64,'0')})+'\n\n');},disconnect:()=>{for(const socket of sockets)socket.end();}};
}
async function eventCycle(f,kind='changed'){
 const request=nextSnapshot(f.page);f.emit(kind);await delay(80);await f.page.clock.runFor(300);await ready(f.page,{request});
}
for(const role of ['admin','teacher'])for(const mobile of [false,true])test(`native event: five updates, create/change/cancel without F5 ${role} ${mobile?'mobile':'desktop'}`,async t=>{
 let lesson=null;const f=await fixture(t,{role,mobile,transformItem:item=>({...item,lessons:lesson?[{...lesson,professorId:item.professionalId}]:[]})}),p=f.page;
 await p.waitForFunction(()=>document.querySelectorAll('.v621-block.availability').length>0);await delay(150);assert.equal(f.connections(),1);await eventCycle(f,'ready');const initial=f.reads();
 if(role==='admin'){await p.locator('[data-v630-open]').first().click();await p.locator('#v630Place').fill('Formulário preservado por evento');}
 for(let i=0;i<5;i++){
  lesson=i===0?{id:'EVENT_LESSON',alunoId:'PERF_STUDENT',nomeAluno:'Aluno simulado',disciplinaId:'MATH',dataAula:reviewDay,horaAula:'10:00',horaFim:'11:00',status:'confirmada'}:i===1?{...lesson,horaAula:'11:00',horaFim:'12:00'}:i===2?{...lesson,status:'cancelada_admin'}:lesson;
  const request=nextSnapshot(p);f.emit('changed');f.emit('changed');f.emit('changed');await delay(80);await p.clock.runFor(300);await ready(p,{request});assert.equal(f.reads()-initial,i+1,'burst of notifications produces one read');
  if(i<2){const cards=p.locator('button[data-lesson="EVENT_LESSON"]');assert.ok(await cards.count()>0);assert.match(await cards.first().textContent(),new RegExp(i===0?'10:00':'11:00'));}
  if(role==='admin')assert.equal(await p.locator('#v630Place').inputValue(),'Formulário preservado por evento');
 }
 assert.equal(f.reads()-initial,5);assert.deepEqual(f.errors,[]);
 if(role==='admin')await p.locator('button[data-v630-close]').first().click();
 const root=process.env.FORJA_AGENDA_EVIDENCE_DIR;if(root){mkdirSync(root,{recursive:true});await p.screenshot({path:resolve(root,`agenda-events-${role}-${mobile?'mobile':'desktop'}.png`),fullPage:true});}
});

test('429 Retry-After survives manual refresh, visibility and native events, then recovers',async t=>{
 const f=await fixture(t,{role:'teacher'}),p=f.page;let requests=0;
 p.on('request',r=>{if(new URL(r.url()).pathname==='/agenda/snapshot')requests++;});
 const quota=route=>route.fulfill({status:429,contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin,'Access-Control-Expose-Headers':'Retry-After','Retry-After':'75'},body:'{"code":"AGENDA_QUERY_BUSY"}'});
 await p.route('**/agenda/snapshot?**',quota);assert.equal(await p.evaluate(()=>forjaAgenda2Refresh()),false);await p.unroute('**/agenda/snapshot?**',quota);const count=requests;
 assert.equal(await p.locator('.v621-block.availability').count(),0);assert.match(await p.locator('[data-forja2-status]').textContent(),/Limite temporário/);
 f.emit('changed');await p.clock.runFor(41000);await p.evaluate(()=>forjaAgenda2Refresh());await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await delay(100);assert.equal(requests,count,'no request before Retry-After even after the old 40s retry');
 const request=nextSnapshot(p);await p.clock.runFor(35000);await ready(p,{request});assert.equal(requests,count+1);assert.ok(await p.locator('.v621-block.availability').count()>0);assert.deepEqual(f.errors,[]);
});

test('offline expires safely; returning online revalidates without F5 and leaving agenda closes stream',async t=>{
 const f=await fixture(t,{role:'admin'}),p=f.page;await delay(150);assert.equal(f.connections(),1);await f.context.setOffline(true);await p.waitForFunction(()=>!navigator.onLine);assert.equal(await p.locator('.v621-block.availability').count(),0);
 const count=f.reads();await p.clock.runFor(30000);assert.equal(f.reads(),count);const request=nextSnapshot(p);await f.context.setOffline(false);await ready(p,{request});assert.ok(await p.locator('.v621-block.availability').count()>0);await p.evaluate(()=>navigate('inicio'));const before=f.reads();f.emit('changed');await p.clock.runFor(1000);assert.equal(f.reads(),before);assert.deepEqual(f.errors,[]);
});

async function sharedStreamHandoff(t,{contendAgain=false,institutional=false}={}){
 let sourceUntil;const f=await fixture(t,{role:'teacher',...(institutional?{transformItem:item=>({...item,personal:{status:'not_applicable',connected:false,checkedAt:null,sourceMode:'institutional-events-v1'}}),transformSnapshot:value=>{sourceUntil??=Date.parse(value.servedAt)+300000;return {...value,refreshMode:'events',sourceExpiresAt:new Date(sourceUntil).toISOString()};}}:{})}),p=f.page;await delay(150);await eventCycle(f,'ready');
 await f.context.addInitScript(()=>{
  window.__streamLockTrace=[];const request=navigator.locks.request.bind(navigator.locks);
  navigator.locks.request=(name,options,callback)=>request(name,options,name.startsWith('forja-agenda-events:')?async lock=>{
   __streamLockTrace.push({kind:lock?'acquired':'contended',at:Date.now()});try{return await callback(lock);}finally{if(lock)__streamLockTrace.push({kind:'released',at:Date.now()});}
  }:callback);
 });
 // Playwright's clock belongs to BrowserContext, not to an individual page.
 // The new tab inherits it; reinstalling it would reset the owner's clock too.
 const tab=await f.openTab();await tab.evaluate(()=>{const timeout=window.setTimeout;window.setTimeout=(callback,ms,...args)=>{if(String(callback).includes('startChanges(c)'))__streamLockTrace.push({kind:'retry',delay:ms,at:Date.now()});return timeout(callback,ms,...args);};});await f.prepareTab(tab);await tab.evaluate(()=>__perfSignIn());await tab.waitForFunction(()=>state.profile&&!state.loading);const initial=nextSnapshot(tab);await tab.evaluate(day=>{state.teacherLessonAgendaDateG=day;navigate('agenda');},reviewDay);await ready(tab,{request:initial});await delay(150);assert.equal(f.connections(),1);
 // Align both frames at one absolute instant before exchanging timestamped
 // broadcasts, then advance the context only by the explicit test budgets.
 await p.clock.pauseAt(new Date(Math.max(await p.evaluate(()=>Date.now()),await tab.evaluate(()=>Date.now()))+1000));
 if(institutional){f.emit('heartbeat');await delay(80);await tab.clock.runFor(300);await tab.waitForFunction(()=>document.querySelector('[data-forja2-status]')?.textContent.startsWith('Consulta confirmada'));assert.ok(await tab.locator('.v621-block.availability').count()>0,'institutional follower requires a confirmed stream and source');}
 // Promise.all of two browser evaluations does not guarantee overlapping HTTP
 // work. Hold the first response until the follower has actually tried its lock.
 let release,heldRequests=0;const held=new Promise(resolve=>release=resolve),hold=async route=>{if(++heldRequests>1)release();await held;await route.fallback();};
 await p.route('**/agenda/snapshot?**',hold);await tab.route('**/agenda/snapshot?**',hold);
 const before=f.reads(),firstRequest=nextSnapshot(p),first=p.evaluate(()=>forjaAgenda2Refresh());
 try{await firstRequest;assert.equal(await tab.evaluate(()=>forjaAgenda2Refresh()),false,'follower joins the pending read instead of starting another GET');release();await first;}
 finally{release();await first.catch(()=>{});await p.unroute('**/agenda/snapshot?**',hold);await tab.unroute('**/agenda/snapshot?**',hold);}
 await delay(100);assert.equal(f.reads()-before,1,'navigator lock coalesces simultaneous snapshot GETs');await ready(tab);
 const old=f.snapshot();
 await tab.waitForFunction(()=>__streamLockTrace.some(x=>x.kind==='contended'));
 if(contendAgain){const next=await tab.evaluate(()=>{const retry=__streamLockTrace.findLast(x=>x.kind==='retry');return Math.max(0,retry.at+retry.delay-Date.now())+1;});await tab.clock.runFor(next);await tab.waitForFunction(()=>__streamLockTrace.filter(x=>x.kind==='contended').length>=2&&__streamLockTrace.at(-1).kind==='retry');assert.equal(f.connections(),1,'lock contention never opens another connection');}
 // Both clocks are already paused: no election can race the assertions about
 // the former connection's closure and lock release.
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await delay(100);
 await p.waitForFunction(async()=>!(await navigator.locks.query()).held.some(x=>x.name.startsWith('forja-agenda-events:')));
 await f.waitStreams(1,0);
 // Keep the scheduling budget at six seconds. Network and Web Lock callbacks
 // complete asynchronously; wait for the actual server connection, not 150ms.
 const takeover=f.waitStreams(2,1);await tab.clock.runFor(6000);try{await takeover;}catch{assert.fail(JSON.stringify({message:'visible follower takes ownership after former owner hides',connections:f.connections(),active:f.activeStreams(),trace:await tab.evaluate(()=>__streamLockTrace),locks:await tab.evaluate(()=>navigator.locks.query())}));}assert.equal(f.connections(),2,'visible follower takes ownership after former owner hides');
 assert.equal(await tab.evaluate(()=>__streamLockTrace.filter(x=>x.kind==='acquired').length),1,'one exclusive Web Lock grants one stream');
 const request=nextSnapshot(tab);f.emit('changed');await delay(80);assert.equal(await tab.locator('.v621-block.availability').count(),0);
 await tab.evaluate(value=>{const scope=forjaCaptureSession(),key=JSON.stringify([scope.uid,scope.generation,state.role,forjaAgenda2Context()]),channel=new BroadcastChannel('forja-agenda-readonly-v1:'+key);channel.postMessage({kind:'snapshot',key,value,ttlMs:18000,sentAt:Date.now()});channel.close();},old);await delay(80);assert.equal(await tab.locator('.v621-block.availability').count(),0,'old snapshot cannot override a known native change');
 await p.clock.runFor(6000);await tab.clock.runFor(300);await ready(tab,{request});assert.ok(await tab.locator('.v621-block.availability').count()>0);assert.equal(f.connections(),2,'hidden former owner must not reconnect');assert.deepEqual(f.errors,[]);
 await tab.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await f.waitStreams(2,0);await tab.waitForFunction(()=>__streamLockTrace.some(x=>x.kind==='released'));
}
test('same-session tabs share one authenticated stream and one concurrent snapshot; stale broadcasts cannot revive green',t=>sharedStreamHandoff(t));
test('same-session tabs transfer the stream within six seconds after repeated Web Lock contention',t=>sharedStreamHandoff(t,{contendAgain:true}));
test('same-session tabs preserve institutional confirmation and reject stale broadcasts after stream takeover',t=>sharedStreamHandoff(t,{contendAgain:true,institutional:true}));

for(const role of ['admin','teacher'])test(`central consent is explicit and never offers green ${role}`,async t=>{
 const f=await fixture(t,{role,transformItem:item=>({...item,status:'unavailable',central:{status:'unavailable',checkedAt:null,reason:'central_consent_required'}})});
 assert.match(await f.page.locator('[data-forja2-status]').textContent(),/Google central precisa de autorização/);assert.equal(await f.page.locator('.v621-block.availability').count(),0);assert.ok(await f.page.locator('.forja2-band.unknown').count()>0);
});

test('partial HTTP 200 retains source quota timing and retries at its deadline, never before',async t=>{
 const f=await fixture(t,{role:'teacher'}),p=f.page,value=f.snapshot(),partial={...value,complete:false,retryAfterMs:17000,items:value.items.map(x=>({...x,status:'unavailable',personal:{status:'unavailable',reason:'personal_rate_limit',retryAfterMs:17000}}))};
 const respond=route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify(partial)});await p.route('**/agenda/snapshot?**',respond);assert.equal(await p.evaluate(()=>forjaAgenda2Refresh()),false);await p.unroute('**/agenda/snapshot?**',respond);const count=f.reads();
 assert.equal(await p.locator('.v621-block.availability').count(),0);assert.match(await p.locator('[data-forja2-status]').textContent(),/Limite temporário na fonte Google/);await p.clock.runFor(16000);assert.equal(f.reads(),count);const request=nextSnapshot(p);await p.clock.runFor(1100);await ready(p,{request});assert.equal(f.reads(),count+1);assert.ok(await p.locator('.v621-block.availability').count()>0);
});
