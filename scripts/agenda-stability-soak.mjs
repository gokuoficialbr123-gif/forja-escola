// Manual QA: ten REAL minutes. Local portal + synthetic provider edges only.
import './helpers/qa-isolation-guard.mjs';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stabilityFixture,denseWeek} from './helpers/agenda-stability-fixture.mjs';
import {setView,ready,nextSnapshot,reviewDay} from './helpers/agenda-presentation-fixture.mjs';
import {delay} from './helpers/performance-portal-fixture.mjs';
assert.equal(process.versions.node.split('.')[0],'22');
const directory=resolve(process.env.FORJA_STABILITY_EVIDENCE);mkdirSync(directory,{recursive:true});
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href),browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH});
const recorder={newContext:options=>browser.newContext({...options,recordVideo:{dir:directory,size:options.viewport.width<600?{width:390,height:844}:{width:1920,height:1080}}})};
let rateUntil=0,cancelled=false,slow=false,sourceReads=0,nativeFailure=false,receipt=null;
const transform=item=>{let x=denseWeek(item);const at=Date.parse(item.personal.checkedAt);if(at<rateUntil)x={...x,status:'unavailable',personal:{...x.personal,status:'unavailable',checkedAt:null,reason:'personal_rate_limit',retryAfterMs:rateUntil-at},busy:x.busy.filter(b=>b.source==='google-central')};else sourceReads++;if(cancelled)x.lessons=x.lessons.map((l,i)=>i===0?{...l,status:'cancelada_admin'}:l);if(receipt)x.lessons.push(receipt);if(nativeFailure)x={...x,status:'unavailable',nativeStatus:'unavailable',days:{},lessons:[],blocks:[],school:[]};return x;};
let admin,teacher,tab,failure,soakStart=null;const start=performance.now(),phases=[],samples=[];
async function mark(name){phases.push({name,elapsedMs:Math.round(performance.now()-start)});for(const p of [admin?.page,tab,teacher?.page].filter(Boolean))await p.evaluate(name=>window.__scenarioStep=name,name);console.log(JSON.stringify({phase:name,elapsedMs:phases.at(-1).elapsedMs}));}
async function capture(page,name){await page.screenshot({path:resolve(directory,name+'.png'),fullPage:true});await page.locator('.v629-calendar-card,.v621-calendar-card').first().screenshot({path:resolve(directory,name+'-calendar.png')});}
async function visible(page,value){await page.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>!value});document.dispatchEvent(new Event('visibilitychange'));},value);}
async function state(page){return page.evaluate(()=>({visible:!document.hidden,green:document.querySelectorAll('.v621-block.availability').length,nativeConfirmed:document.querySelectorAll('.v621-block.lesson:not(.forja2-native-history)').length,historical:document.querySelectorAll('.forja2-historical,.forja2-native-history').length,scroll:document.querySelector('.v621-week-wrap')?.scrollTop,view:forjaAgenda2Context()?.view,selection:forjaAgenda2Context()?.ids.length,status:document.querySelector('[data-forja2-status]')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth+1}));}
try{
 console.log(JSON.stringify({node:process.version,project:'demo-forja',providers:'synthetic edges; real emulator integration is a separate suite',network:'external providers blocked',durationRequiredMs:600000}));
 admin=await stabilityFixture(recorder,{role:'admin',transformItem:transform,transformSnapshot:v=>({...v,collectionStartedAt:v.servedAt,...(v.complete?{}:{retryAfterMs:Math.max(0,rateUntil-Date.parse(v.servedAt))})})});
 await admin.page.setViewportSize({width:1920,height:1080});await setView(admin,'admin','week');await admin.waitStreams(1);admin.emit('ready');
 teacher=await stabilityFixture(recorder,{role:'teacher',mobile:true,transformItem:denseWeek});await setView(teacher,'teacher','week');await teacher.waitStreams(1);teacher.emit('ready');
 await admin.page.locator('.v621-week-wrap').evaluate(el=>el.scrollTop=480);await teacher.page.locator('.v621-week-wrap').evaluate(el=>el.scrollTop=480);
 tab=await admin.openTab();await admin.prepareTab(tab);await tab.evaluate(()=>__perfSignIn());await tab.waitForFunction(()=>state.profile&&!state.loading);const initial=nextSnapshot(tab);await tab.evaluate(day=>{state.teacherLessonAgendaDateG=day;state.adminLessonAgendaDateG=day;navigate('agenda');},reviewDay);await ready(tab,{request:initial});await visible(tab,false);await visible(admin.page,true);
 const delayRoute=async route=>{if(slow)await delay(8000);await route.fallback();};await admin.page.route('**/agenda/snapshot?**',delayRoute);await tab.route('**/agenda/snapshot?**',delayRoute);
 await mark('initial-confirmed');await capture(admin.page,'initial-confirmed');await capture(teacher.page,'teacher-week');
 let tick=0;soakStart=performance.now();
 while(performance.now()-soakStart<600000){
  tick++;await delay(10000);const seconds=(performance.now()-start)/1000;
  if(tick===6){await mark('SSE-reconnect');admin.disconnect();await admin.waitStreams(0);}
  if(tick===7){await admin.waitStreams(1);admin.emit('ready');await capture(admin.page,'SSE-reconnected');}
  if(tick===12){await mark('visible-follower-takes-lock');await visible(tab,true);await visible(admin.page,false);}
  if(tick===13){await admin.waitStreams(1);admin.emit('ready');assert.equal(admin.streams(),1);}
  if(tick===17){await mark('former-owner-visible');await visible(admin.page,true);await visible(tab,false);}
  if(tick===18){await admin.waitStreams(1);admin.emit('ready');}
  if(tick===20){await mark('mobile-day-navigation');await setView(teacher,'teacher','day');await teacher.page.locator('.v621-week-wrap').evaluate(el=>el.scrollTop=480);await capture(teacher.page,'teacher-day');}
  if(tick===23){await mark('personal-source-rate-limit');rateUntil=await admin.page.evaluate(()=>Date.now()+75000);await admin.page.evaluate(()=>forjaAgenda2Refresh());await capture(admin.page,'personal-rate-limit');}
  if(tick===31){await mark('source-recovered');await admin.page.evaluate(()=>forjaAgenda2Refresh());await capture(admin.page,'source-recovered');}
  if(tick===34){await mark('eight-second-API');slow=true;}
  if(tick===39){await mark('normal-network');slow=false;}
  if(tick===41){await mark('offline');await admin.context.setOffline(true);}
  if(tick===44){const s=await state(admin.page);assert.equal(s.green,0);assert.ok(s.historical>0);await mark('really-expired');await capture(admin.page,'really-expired');}
  if(tick===46){await mark('network-recovered');await admin.context.setOffline(false);await admin.page.evaluate(()=>forjaAgenda2Refresh());await capture(admin.page,'network-recovered');}
  if(tick===48){await mark('synthetic-receipt-during-native-failure');nativeFailure=true;await admin.page.evaluate(()=>forjaAgenda2Refresh());receipt={id:'SYNTHETIC_RECEIPT',professorId:admin.snapshot().items[0].professionalId,dataAula:reviewDay,horaAula:'14:15',horaFim:'14:45',status:'confirmada',modalidade:'presencial',nomeAluno:'Aluno fictício'};await admin.page.route('**/aulas',route=>route.request().method()==='POST'?route.fulfill({status:201,contentType:'application/json',headers:{'Access-Control-Allow-Origin':admin.origin},body:JSON.stringify({ok:true,item:receipt})}):route.fallback());await admin.page.evaluate(lesson=>api('/aulas',{method:'POST',body:lesson}),receipt);assert.equal(await admin.page.locator('[data-lesson="SYNTHETIC_RECEIPT"].forja2-native-history').count(),1);assert.equal((await state(admin.page)).green,0);await capture(admin.page,'native-receipt-history');}
  if(tick===49){await mark('native-source-recovered');nativeFailure=false;await admin.page.evaluate(()=>forjaAgenda2Refresh());assert.equal(await admin.page.locator('[data-lesson="SYNTHETIC_RECEIPT"].forja2-native-history').count(),0);assert.equal(await admin.page.locator('[data-lesson="SYNTHETIC_RECEIPT"]').count(),1);}
  if(tick===50){await mark('synthetic-cancellation');cancelled=true;admin.emit('changed',['native']);}
  if(tick===53){await mark('normal-renewal');await capture(admin.page,'normal-renewal');}
  if(tick!==6&&tick!==41&&admin.streams())admin.emit('heartbeat');if(teacher.streams())teacher.emit('heartbeat');
  const a=await state(admin.page),b=await state(teacher.page);samples.push({elapsedMs:Math.round(performance.now()-start),admin:a,teacher:b,streams:admin.streams(),snapshotReads:admin.reads()});
  assert.equal(a.overflow,false);assert.equal(b.overflow,false);assert.ok(admin.streams()<=1,'same-session tabs must never own two active SSE streams');assert.equal(a.view,'week');assert.equal(a.selection,1);assert.equal(a.scroll,480,'refresh/focus/network must preserve internal scroll');
  if(tick>=24&&tick<=29){assert.equal(a.green,0);assert.ok(a.nativeConfirmed>0,'healthy native lessons survive independent Google failure');}
  if(tick%6===0)console.log(JSON.stringify({elapsedSeconds:Math.round(seconds),snapshots:admin.reads(),streams:admin.streams(),historical:a.historical}));
 }
 assert.ok(performance.now()-soakStart>=600000);assert.ok(admin.reads()<=55,'no uncontrolled snapshot request growth');assert.deepEqual(admin.errors,[]);assert.deepEqual(teacher.errors,[]);
 await mark('completed');await capture(admin.page,'completed');
}catch(error){failure=error;console.error(error.message);process.exitCode=1;}
finally{
 const report={elapsedMs:soakStart?Math.round(performance.now()-soakStart):0,totalElapsedMs:Math.round(performance.now()-start),passed:!failure,failure:failure?.message||null,phases,samples,sourceReads,snapshotReads:admin?.reads(),connections:admin?.connections(),transitions:{},requests:admin?.requestTransitions||[]};
 for(const [name,p] of [['admin',admin?.page],['follower',tab],['teacher',teacher?.page]])if(p)report.transitions[name]=await p.evaluate(()=>window.__agendaTransitions||[]).catch(()=>[]);
 writeFileSync(resolve(directory,'report.json'),JSON.stringify(report,null,2));
 const videos=[['admin-10min',admin?.page?.video()],['follower-10min',tab?.video()],['teacher-mobile-10min',teacher?.page?.video()]];
 await admin?.close();await teacher?.close();await browser.close();for(const [name,video] of videos)if(video)copyFileSync(await video.path(),resolve(directory,name+'.webm'));
 console.log(JSON.stringify({passed:report.passed,elapsedMs:report.elapsedMs,snapshotReads:report.snapshotReads,connections:report.connections,phases:phases.length}));
}
