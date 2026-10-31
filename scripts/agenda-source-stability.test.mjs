import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync,writeFileSync} from 'node:fs';
import {stabilityFixture,stabilityArtifact,denseWeek} from './helpers/agenda-stability-fixture.mjs';
import {setView} from './helpers/agenda-presentation-fixture.mjs';
import {delay} from './helpers/performance-portal-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
async function fixture(t,options){const f=await stabilityFixture(browser,{...options,artifact:stabilityArtifact({baseline:process.env.FORJA_STABILITY_BASELINE==='1'})});t.after(async()=>{if(process.env.FORJA_STABILITY_EVIDENCE){mkdirSync(process.env.FORJA_STABILITY_EVIDENCE,{recursive:true});writeFileSync(resolve(process.env.FORJA_STABILITY_EVIDENCE,t.name.replace(/[^a-z0-9]/gi,'_')+'.json'),JSON.stringify(await f.page.evaluate(()=>__agendaTransitions||[]),null,2));}await f.close();});return f;}
for(const role of ['admin','teacher'])test(`independent source validity ${role}`,async t=>{
 let partial=false;const f=await fixture(t,{role,transformItem:x=>partial?{...x,status:'unavailable',personal:{...x.personal,status:'unavailable'},busy:x.busy.filter(b=>b.source==='google-central')}:x,transformSnapshot:v=>partial?{...v,collectionStartedAt:v.servedAt,checkedAt:new Date(Date.parse(v.servedAt)-20000).toISOString(),expiresAt:new Date(Date.parse(v.servedAt)+5000).toISOString()}:v}),p=f.page;
 await setView(f,role,'day');await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));
 partial=true;await p.evaluate(()=>{window.__scenarioStep='personal-failed';return forjaAgenda2Refresh();});await p.clock.runFor(6000);
 assert.equal(await p.locator('.forja2-busy:not(.google):not(.forja2-historical)').count(),2,'a personal failure cannot expire current native manual/school blocks');
 assert.equal(await p.locator('.forja2-busy.google:not(.forja2-historical)').count(),1,'current central Google source remains confirmed independently');
 assert.equal(await p.locator('.v621-block.availability').count(),0,'partial sources cannot authorize a slot');
 await f.context.setOffline(true);await p.clock.runFor(20000);assert.equal(await p.locator('.forja2-busy:not(.forja2-historical)').count(),0,'each original 25s source deadline still expires without renewal');
 partial=false;await f.context.setOffline(false);await p.evaluate(()=>{window.__scenarioStep='recovered';return forjaAgenda2Refresh();});assert.equal(await p.locator('.forja2-historical').count(),0);assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher'])test(`a native SSE change cannot revoke healthy Google sources ${role}`,async t=>{
 const f=await fixture(t,{role}),p=f.page;await setView(f,role,'day');await f.waitStreams(1);f.emit('ready');await delay(80);await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));const original=await p.locator('.forja2-busy.google').first().elementHandle();
 let release,entered;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r);t.after(()=>release());await p.route('**/agenda/snapshot?**',async route=>{entered(route.request());await gate;await route.fallback();});
 await p.evaluate(()=>window.__scenarioStep='native-change');f.emit('changed',['native']);await delay(80);await p.clock.runFor(300);const request=await entry;
 try{assert.equal(await p.locator('.forja2-busy.google.forja2-historical').count(),0,'Google source is not invalidated by a native-only event');assert.equal(await original.evaluate(el=>el.isConnected),true,'healthy Google DOM node survives a native update');assert.equal(await p.locator('.forja2-busy.google[data-forja2-start="13:00"]:not(.forja2-historical)').count(),1,'a historical lesson cannot mask independently confirmed Google occupancy');assert.equal(await p.locator('.forja2-busy:not(.google):not(.forja2-historical)').count(),0,'affected native source is pending revalidation');assert.equal(await p.locator('.v621-block.availability').count(),0);}
 finally{release();const response=await request.response();if(response)await response.finished();}
 await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]').textContent));assert.deepEqual(f.errors,[]);
});
test('source Retry-After does not stop authorized native reads; HTTP 429 still stops all requests',async t=>{
 let limited=false;const f=await fixture(t,{transformItem:x=>limited?{...x,status:'unavailable',personal:{...x.personal,status:'unavailable',reason:'personal_rate_limit',retryAfterMs:75000},busy:x.busy.filter(b=>b.source==='google-central')}:x,transformSnapshot:v=>limited?{...v,retryAfterMs:75000,collectionStartedAt:v.servedAt}:v}),p=f.page;await setView(f,'teacher','day');await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));limited=true;await p.evaluate(()=>forjaAgenda2Refresh());const n=f.reads();await p.clock.runFor(20010);await p.waitForFunction(()=>!document.querySelector('[data-forja2-status]').textContent.startsWith('Consultando'));assert.equal(f.reads(),n+1,'native data may be reread while the Google provider retains its cooldown');assert.equal(await p.locator('.forja2-busy:not(.google):not(.forja2-historical)').count(),2);assert.equal(await p.locator('.v621-block.availability').count(),0);
 const deny=route=>route.fulfill({status:429,contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin,'Access-Control-Expose-Headers':'Retry-After','Retry-After':'75'},body:'{"code":"AGENDA_QUERY_BUSY"}'});await p.route('**/agenda/snapshot?**',deny);await p.evaluate(()=>forjaAgenda2Refresh());const count=f.reads();await p.clock.runFor(74000);assert.equal(f.reads(),count,'HTTP rate limit never produces repeated snapshot requests');assert.equal(await p.locator('.v621-block.availability').count(),0);assert.deepEqual(f.errors,[]);
});
test('institutional transport loss preserves the original source lease, not green',async t=>{
 const f=await fixture(t,{transformItem:x=>({...x,busy:x.busy.filter(b=>b.source==='google-central'),personal:{status:'not_applicable',connected:false,checkedAt:null,sourceMode:'institutional-events-v1'}}),transformSnapshot:v=>({...v,refreshMode:'events',sourceExpiresAt:new Date(Date.parse(v.servedAt)+300000).toISOString()})}),p=f.page;await setView(f,'teacher','day');await f.waitStreams(1);f.emit('ready');await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]').textContent));assert.ok(await p.locator('.forja2-busy:not(.forja2-historical)').count()>0);await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));
 await p.evaluate(()=>window.__scenarioStep='unexpected-eof');f.disconnect();await f.waitStreams(0);await delay(80);
 assert.equal(await p.locator('.forja2-busy.forja2-historical').count(),0,'brief transport failure cannot revoke all current source data before its original lease');
 assert.equal(await p.locator('.v621-block.availability').count(),0,'broken transport suspends booking availability');
 await p.clock.runFor(5001);await f.waitStreams(1);f.emit('ready');await delay(80);await p.clock.runFor(300);await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]').textContent));assert.deepEqual(f.errors,[]);
});
test('institutional Google expiry cannot expire a healthy native source or leave a green slot',async t=>{
 let deadline=null;const f=await fixture(t,{transformItem:x=>({...x,busy:x.busy.filter(b=>b.source==='google-central'),central:{...x.central,...(deadline?{expiresAt:new Date(deadline).toISOString()}:{})},personal:{status:'not_applicable',connected:false,checkedAt:null,sourceMode:'institutional-events-v1'}}),transformSnapshot:v=>({...v,collectionStartedAt:v.servedAt,refreshMode:'events',sourceExpiresAt:new Date(deadline||Date.parse(v.servedAt)+300000).toISOString()})}),p=f.page;
 await setView(f,'teacher','day');await f.waitStreams(1);f.emit('ready');await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]').textContent));await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));deadline=await p.evaluate(()=>Date.now()+2000);await p.evaluate(()=>forjaAgenda2Refresh());
 let release;const gate=new Promise(r=>release=r);await p.route('**/agenda/snapshot?**',async route=>{await gate;await route.fallback();});
 try{await p.clock.runFor(2010);assert.equal(await p.locator('.forja2-native-history').count(),0);assert.equal(await p.locator('.forja2-busy:not(.google):not(.forja2-historical)').count(),2);assert.ok(await p.locator('.forja2-busy.google.forja2-historical').count()>0);assert.equal(await p.locator('.v621-block.availability').count(),0);}
 finally{deadline=null;release();}
 await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]').textContent));assert.deepEqual(f.errors,[]);
});
test('renewal anticipates an observed eight-second read inside the unchanged 25s lifetime',async t=>{
 let latency=0;const f=await fixture(t,{transformSnapshot:v=>latency?{...v,collectionStartedAt:new Date(Date.parse(v.servedAt)-latency).toISOString(),deliveryStartedAt:new Date(Date.parse(v.servedAt)-latency).toISOString(),checkedAt:new Date(Date.parse(v.servedAt)-latency).toISOString(),expiresAt:new Date(Date.parse(v.servedAt)-latency+25000).toISOString(),items:v.items.map(x=>({...x,personal:{...x.personal,checkedAt:new Date(Date.parse(v.servedAt)-latency).toISOString()},central:{...x.central,checkedAt:new Date(Date.parse(v.servedAt)-latency).toISOString()}}))}:v}),p=f.page;
 await setView(f,'teacher','day');await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));latency=8000;
 let gate,entry,release,entered;const arm=()=>{gate=new Promise(r=>release=r);entry=new Promise(r=>entered=r);};arm();let starts=0;
 await p.route('**/agenda/snapshot?**',async route=>{starts++;const held=gate;entered(route.request());await held;await route.fallback();});t.after(()=>release());
 const reading=p.evaluate(()=>{window.__scenarioStep='normal-latency';return forjaAgenda2Refresh();});await entry;await p.clock.runFor(8000);release();await reading;arm();
 await p.clock.runFor(7010);await delay(80);assert.equal(starts,2,'next read must start with enough time for the measured latency, without increasing source TTL');const request=await entry;await p.clock.runFor(8000);release();const response=await request.response();await response.finished();await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]').textContent));
 assert.equal(await p.evaluate(()=>__agendaTransitions.filter(x=>x.step==='normal-latency'&&x.historical>0).length),0,'ordinary slow renewal cannot introduce a historical flash');assert.deepEqual(f.errors,[]);
});
test('institutional ordinary renewal starts before the original deadline without a historical flash',async t=>{
 const f=await fixture(t,{transformItem:x=>({...x,busy:x.busy.filter(b=>b.source==='google-central'),personal:{status:'not_applicable',connected:false,checkedAt:null,sourceMode:'institutional-events-v1'}}),transformSnapshot:v=>({...v,collectionStartedAt:v.servedAt,refreshMode:'events',sourceExpiresAt:new Date(Date.parse(v.servedAt)+300000).toISOString()})}),p=f.page;
 await setView(f,'teacher','day');await f.waitStreams(1);f.emit('ready');await delay(80);await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));await p.evaluate(()=>{window.__scenarioStep='institutional-normal-renewal';window.__agendaTransitions=[];});
 const before=f.reads();for(let i=0;i<300;i++){if(i%10===0){f.emit('heartbeat');await delay(3);}await p.clock.runFor(1000);await delay(3);if(f.reads()>before){await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]').textContent));break;}}
 assert.equal(f.reads(),before+1,'exactly one anticipatory institutional snapshot');assert.equal(await p.evaluate(()=>__agendaTransitions.filter(x=>x.step==='institutional-normal-renewal'&&x.historical>0).length),0,'a healthy institutional source must not expire while its normal renewal starts');assert.deepEqual(f.errors,[]);
});
test('a freshness-only central event revalidates without revoking a still-valid original proof',async t=>{
 const f=await fixture(t),p=f.page;await setView(f,'teacher','day');await f.waitStreams(1);f.emit('ready');await delay(80);await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));
 let release;const gate=new Promise(r=>release=r);t.after(()=>release());await p.route('**/agenda/snapshot?**',async route=>{await gate;await route.fallback();});
 const before=await p.evaluate(()=>__agendaTransitions.at(-1).remainingMs),request=p.waitForRequest(r=>new URL(r.url()).pathname==='/agenda/snapshot',{timeout:5000});
 f.emit('changed',['central'],true);await delay(80);await p.clock.runFor(300);const started=await request;
 try{assert.equal(await p.locator('.forja2-historical').count(),0);assert.ok(await p.locator('.v621-block.availability').count()>0,'the original current proof remains valid during an identical projection refresh');const remaining=await p.evaluate(()=>__agendaTransitions.at(-1).remainingMs);assert.ok(remaining<=before&&remaining>0,'refresh-only cannot extend the original deadline');await p.clock.runFor(1000);}finally{release();const response=await started.response();if(response)await response.finished();}
 await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]').textContent));assert.deepEqual(f.errors,[]);
});
test('dense synthetic week contains short, overlapping native and Google commitments',()=>{const x=denseWeek({professionalId:'SYNTHETIC',days:Object.fromEntries(Array.from({length:7},(_,i)=>['2026-10-'+(19+i),[]]))});assert.ok(x.lessons.length+x.busy.length+x.blocks.length>=30);assert.equal(x.lessons.length,21);});
