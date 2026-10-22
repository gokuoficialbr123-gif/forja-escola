import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {agendaPresentationFixture,nextSnapshot,ready,reviewDay} from './helpers/agenda-presentation-fixture.mjs';
import {buildHostingArtifact} from './prepare-hosting.mjs';
import {delay} from './helpers/performance-portal-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
function artifact(){const value=buildHostingArtifact();if(process.env.FORJA_AGENDA_EVENT_BASELINE==='1'){const before=execFileSync('git',['show','8d7c3cee3a07acd7a9b543a6df1f5077b873bfef:index.html'],{encoding:'utf8',maxBuffer:4e6}),pattern=/<script id="forja-agenda2-script">[\s\S]*?<\/script>/;value.bytes=Buffer.from(value.bytes.toString().replace(pattern,()=>before.match(pattern)[0]));}return value;}
async function fixture(t,options={}){
 const sockets=new Set();let connections=0,version=0;const f=await agendaPresentationFixture(browser,{...options,artifact:artifact(),mode:'free',changeVersion:()=>String(version).padStart(64,'0'),agendaEvents:(req,res)=>{assert.equal(req.headers.authorization,'Bearer SYNTHETIC');connections++;res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.flushHeaders();sockets.add(res);res.on('close',()=>sockets.delete(res));}});
 t.after(async()=>{for(const socket of sockets)socket.end();await f.close();});
 return {...f,connections:()=>connections,emit:kind=>{if(kind==='changed')version++;for(const socket of sockets)socket.write('data: '+JSON.stringify({kind,version:String(version).padStart(64,'0')})+'\n\n');},disconnect:()=>{for(const socket of sockets)socket.end();}};
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

test('same-session tabs share one authenticated stream and one concurrent snapshot; stale broadcasts cannot revive green',async t=>{
 const f=await fixture(t,{role:'teacher'}),p=f.page;await delay(150);await eventCycle(f,'ready');
 const tab=await f.openTab();await tab.clock.install({time:new Date(await p.evaluate(()=>Date.now()))});await f.prepareTab(tab);await tab.evaluate(()=>__perfSignIn());await tab.waitForFunction(()=>state.profile&&!state.loading);const initial=nextSnapshot(tab);await tab.evaluate(day=>{state.teacherLessonAgendaDateG=day;navigate('agenda');},reviewDay);await ready(tab,{request:initial});await delay(150);assert.equal(f.connections(),1);
 const before=f.reads();await Promise.all([p.evaluate(()=>forjaAgenda2Refresh()),tab.evaluate(()=>forjaAgenda2Refresh())]);await delay(100);assert.equal(f.reads()-before,1,'navigator lock coalesces simultaneous snapshot GETs');await ready(tab);
 const old=f.snapshot();
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await delay(100);
 await tab.clock.runFor(6000);await delay(150);assert.equal(f.connections(),2,'visible follower takes ownership after former owner hides');
 const request=nextSnapshot(tab);f.emit('changed');await delay(80);assert.equal(await tab.locator('.v621-block.availability').count(),0);
 await tab.evaluate(value=>{const scope=forjaCaptureSession(),key=JSON.stringify([scope.uid,scope.generation,state.role,forjaAgenda2Context()]),channel=new BroadcastChannel('forja-agenda-readonly-v1:'+key);channel.postMessage({kind:'snapshot',key,value,ttlMs:18000,sentAt:Date.now()});channel.close();},old);await delay(80);assert.equal(await tab.locator('.v621-block.availability').count(),0,'old snapshot cannot override a known native change');
 await p.clock.runFor(6000);await tab.clock.runFor(300);await ready(tab,{request});assert.ok(await tab.locator('.v621-block.availability').count()>0);assert.deepEqual(f.errors,[]);
});

for(const role of ['admin','teacher'])test(`central consent is explicit and never offers green ${role}`,async t=>{
 const f=await fixture(t,{role,transformItem:item=>({...item,status:'unavailable',central:{status:'unavailable',checkedAt:null,reason:'central_consent_required'}})});
 assert.match(await f.page.locator('[data-forja2-status]').textContent(),/Google central precisa de autorização/);assert.equal(await f.page.locator('.v621-block.availability').count(),0);assert.ok(await f.page.locator('.forja2-band.unknown').count()>0);
});

test('partial HTTP 200 retains source quota timing and retries at its deadline, never before',async t=>{
 const f=await fixture(t,{role:'teacher'}),p=f.page,value=f.snapshot(),partial={...value,complete:false,retryAfterMs:17000,items:value.items.map(x=>({...x,status:'unavailable',personal:{status:'unavailable',reason:'personal_rate_limit',retryAfterMs:17000}}))};
 const respond=route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify(partial)});await p.route('**/agenda/snapshot?**',respond);assert.equal(await p.evaluate(()=>forjaAgenda2Refresh()),false);await p.unroute('**/agenda/snapshot?**',respond);const count=f.reads();
 assert.equal(await p.locator('.v621-block.availability').count(),0);assert.match(await p.locator('[data-forja2-status]').textContent(),/Limite temporário na fonte Google/);await p.clock.runFor(16000);assert.equal(f.reads(),count);const request=nextSnapshot(p);await p.clock.runFor(1100);await ready(p,{request});assert.equal(f.reads(),count+1);assert.ok(await p.locator('.v621-block.availability').count()>0);
});
