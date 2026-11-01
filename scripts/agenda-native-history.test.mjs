import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdirSync} from 'node:fs';
import {agendaPresentationFixture,setView} from './helpers/agenda-presentation-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
async function fixture(t,{role,mobile,nativeInitial='success'}={}){
 let mode=nativeInitial;const f=await agendaPresentationFixture(browser,{role,mobile,transformItem:item=>mode==='unavailable'?{...item,status:'unavailable',nativeStatus:'unavailable',days:{},lessons:[],blocks:[],school:[],busy:[]}:mode==='google-failure'?{...item,status:'unavailable',personal:{status:'unavailable'},busy:[]}:item});
 t.after(()=>f.close());return {...f,native:value=>mode=value};
}
const cards=p=>p.locator('[data-lesson="REVIEW_LESSON"]');
async function historical(p){
 assert.ok(await cards(p).count()>0,'native lesson remains visible');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'history does not add page overflow');
 for(const card of await cards(p).all()){
  assert.equal(await card.evaluate(el=>el.classList.contains('forja2-native-history')),true,'old native lesson must be explicitly historical');
  assert.match(await card.getAttribute('aria-label'),/Última informação conhecida/);
  assert.match(await card.getAttribute('aria-label'),/13:00–14:00/,'historical cancellation retains the full native period');
  assert.match(await card.innerText(),/Histórico|Hist\./,'historical state must be visible, including the compact month label');
  assert.equal(await card.evaluate(el=>getComputedStyle(el).color),'rgb(71, 85, 105)');
  for(const notice of await card.locator('.forja2-native-notice').all())assert.equal(await notice.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'monthly history label remains complete');
 }
 assert.equal(await p.locator('.v621-block.availability,.v621-month-tag.availability,.v629-month-tag.availability').count(),0,'unknown native data cannot provide slots');
}
async function capture(p,name){if(!process.env.FORJA_NATIVE_HISTORY_EVIDENCE_DIR)return;mkdirSync(process.env.FORJA_NATIVE_HISTORY_EVIDENCE_DIR,{recursive:true});await p.screenshot({path:resolve(process.env.FORJA_NATIVE_HISTORY_EVIDENCE_DIR,name+'.png'),fullPage:true});}
for(const role of ['admin','teacher'])test(`native initial outage preserves authorized cached lessons only as history ${role}`,async t=>{
 const f=await fixture(t,{role,nativeInitial:'unavailable'}),p=f.page;await setView(f,role,'day');const uid=f.snapshot().items[0].professionalId;
 await p.evaluate(uid=>{state.lessons=[{id:'SYNTHETIC_LOADED',professorId:uid,dataAula:'2026-10-20',horaAula:'10:30',horaFim:'11:00',status:'confirmada',modalidade:'presencial',nomeAluno:'Aluno fictício'}];forjaAgenda2Paint();},uid);
 const card=p.locator('[data-lesson="SYNTHETIC_LOADED"]');assert.equal(await card.count(),1,'the authorized account cache remains visible during an initial native outage');assert.equal(await card.evaluate(el=>el.classList.contains('forja2-native-history')),true);assert.match(await card.getAttribute('aria-label'),/Última informação conhecida/);assert.equal(await p.locator('.v621-block.availability').count(),0);
 f.native('success');f.setMode('free');await p.evaluate(()=>forjaAgenda2Refresh());assert.equal(await card.count(),0);f.native('unavailable');await p.evaluate(()=>forjaAgenda2Refresh());assert.equal(await card.count(),0,'authoritative empty proof prevents stale account cache resurrection');await p.evaluate(()=>executeLogout());assert.equal(await p.locator('[data-lesson="SYNTHETIC_LOADED"]:visible').count(),0);assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher'])test(`native write receipt survives an unavailable snapshot as history, never as availability ${role}`,async t=>{
 const f=await fixture(t,{role}),p=f.page;await setView(f,role,'day');await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));f.native('unavailable');await p.evaluate(()=>forjaAgenda2Refresh());
 const lesson={id:'SYNTHETIC_RECEIPT',professorId:f.snapshot().items[0].professionalId,dataAula:'2026-10-20',horaAula:'10:30',horaFim:'11:00',status:'confirmada',modalidade:'presencial',nomeAluno:'Aluno fictício'};
 // The unavailable fixture intentionally has no native lessons; use the
 // authenticated successful HTTP result, not a mutation of the snapshot cache.
 await p.route('**/aulas**',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({ok:true,item:lesson})}));
 await p.evaluate(async({lesson,role})=>{const result=await api(role==='admin'?'/aulas':'/aulas/'+lesson.id,{method:role==='admin'?'POST':'PATCH',body:lesson});state.lessons=[result.item];},{lesson,role});
 const receipt=p.locator('[data-lesson="SYNTHETIC_RECEIPT"]');assert.equal(await receipt.count(),1,'successful canonical receipt cannot disappear because the snapshot native source is unavailable');assert.equal(await receipt.evaluate(el=>el.classList.contains('forja2-native-history')),true);assert.match(await receipt.getAttribute('aria-label'),/Última informação conhecida/);assert.equal(await p.locator('.v621-block.availability').count(),0);
 f.native('success');f.setMode('free');await p.evaluate(()=>forjaAgenda2Refresh());assert.equal(await receipt.count(),0,'fresh authoritative empty source replaces the receipt');f.native('unavailable');await p.evaluate(()=>forjaAgenda2Refresh());assert.equal(await receipt.count(),0,'old state cache cannot resurrect a receipt cleared by the source');await p.evaluate(()=>executeLogout());assert.equal(await p.locator('[data-lesson="SYNTHETIC_RECEIPT"]:visible').count(),0);assert.deepEqual(f.errors,[]);
});
for(const role of ['admin','teacher'])for(const mobile of [false,true])for(const view of ['day','week','month'])test(`native history: unavailable/expiry/recovery/cancel ${role} ${mobile?'mobile':'desktop'} ${view}`,async t=>{
 const f=await fixture(t,{role,mobile}),p=f.page;await setView(f,role,view);assert.ok(await cards(p).count()>0);
 // Real response/DOM work must not advance a second clock while the test also
 // advances timers. All expiry checkpoints below use this one paused clock.
 await p.clock.pauseAt(new Date(await p.evaluate(()=>Date.now())+1000));
 f.native('unavailable');assert.equal(await p.evaluate(()=>forjaAgenda2Refresh()),false);await capture(p,`${role}-${mobile?'mobile':'desktop'}-${view}-unavailable`);await historical(p);
 if(mobile){await p.setViewportSize({width:360,height:800});await historical(p);await p.setViewportSize({width:390,height:844});}
 // Snapshot success restores the actual native status. Google is independent.
 f.native('success');assert.equal(await p.evaluate(()=>forjaAgenda2Refresh()),true);assert.equal(await p.locator('.forja2-native-history').count(),0);
 let release,entered;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r),held=async route=>{entered();await gate;await route.fallback();};await p.route('**/agenda/snapshot?**',held);
 try{
  await p.clock.runFor(20010);await entry;await p.clock.runFor(5010);await historical(p);assert.match(await p.locator('[data-forja2-status]').textContent(),/Consultando/);
 }finally{release();await p.unroute('**/agenda/snapshot?**',held);}
 await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]')?.textContent||''));assert.equal(await p.locator('.forja2-native-history').count(),0);
 f.setMode('cancelled');assert.equal(await p.evaluate(()=>forjaAgenda2Refresh()),true);assert.ok(await p.locator('[data-lesson="REVIEW_LESSON"].cancelled,[data-lesson="REVIEW_LESSON"].forja2-cancelled').count()>0);assert.equal(await p.locator('.v621-block.lesson[data-lesson="REVIEW_LESSON"]').count(),0,'cancelled lesson does not remain an active occupied card');
 f.native('unavailable');await p.evaluate(()=>forjaAgenda2Refresh());await historical(p);assert.match(await cards(p).first().innerText(),/Cancelada/,'a remembered cancellation is not rendered as an active confirmed lesson');f.native('success');await p.evaluate(()=>forjaAgenda2Refresh());
 f.setMode('free');assert.equal(await p.evaluate(()=>forjaAgenda2Refresh()),true);assert.equal(await cards(p).count(),0,'confirmed empty native source clears a removed lesson');
 await p.evaluate(()=>executeLogout());assert.equal(await p.locator('[data-lesson="REVIEW_LESSON"]:visible').count(),0);assert.deepEqual(f.errors,[]);
});

for(const role of ['admin','teacher'])for(const mobile of [false,true])test(`native detail: canonical read alone authorizes actions, independent Google failure ${role} ${mobile}`,async t=>{
 const f=await fixture(t,{role,mobile}),p=f.page;await setView(f,role,'day');f.native('google-failure');await p.evaluate(()=>forjaAgenda2Refresh());
 assert.equal(await p.evaluate(()=>forjaAgenda2LessonClass(undefined)),'forja2-lesson forja2-unknown','missing lesson keeps the existing unclassified fallback');
 assert.equal(await p.locator('.forja2-native-history').count(),0,'fresh native source stays confirmed despite Google failure');
 const item=f.snapshot().items[0].lessons[0],writes=[];p.on('request',r=>{if(!['GET','HEAD','OPTIONS'].includes(r.method()))writes.push(r.method()+' '+new URL(r.url()).pathname);});let mode='held',release,entered,posts=0,lateRelease,lateEntered,ended=false;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r),lateGate=new Promise(r=>lateRelease=r),lateEntry=new Promise(r=>lateEntered=r);t.after(()=>{release();lateRelease();});
 await p.route('**/aulas/REVIEW_LESSON',async route=>{if(route.request().method()!=='GET'){posts++;return route.abort();}if(mode==='held'){entered();await gate;}if(mode==='session-held'){lateEntered();await lateGate;}try{await route.fulfill({status:mode==='failure'?503:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify(mode==='failure'?{error:'Fonte sintética indisponível'}:{item:mode==='cancelled'?{...item,status:'cancelada_admin'}:item})});}catch(error){if(!ended)throw error;}});
 await p.evaluate(()=>{const official=openLesson;openLesson=function(...args){return window.nativeDetailCompletion=official(...args);};});
 f.native('unavailable');await p.evaluate(()=>forjaAgenda2Refresh());await cards(p).first().click();await entry;
 assert.equal(await p.locator('#modal [data-cancel-lesson],#modal [data-reschedule-lesson],#modal [data-start-lesson]').count(),0,'a historical card cannot authorize actions while detail is pending');
 mode='failure';release();await p.evaluate(()=>nativeDetailCompletion);assert.equal(await p.locator('#modal [data-cancel-lesson],#modal [data-reschedule-lesson],#modal [data-start-lesson]').count(),0,'failed canonical read exposes no cached actions');
 await p.locator('#modal [data-close-modal]').first().click();mode='success';await cards(p).first().click();await p.evaluate(()=>nativeDetailCompletion);assert.ok(await p.locator('#modal [data-cancel-lesson]').count()>0,'fresh canonical native read preserves the official permitted actions');
 assert.equal(await p.evaluate(()=>Object.hasOwn(state.lessons.find(l=>l.id==='REVIEW_LESSON'),'forja2NativeHistorical')),false,'presentation quality cannot contaminate the canonical lesson');
 await p.locator('#modal [data-close-modal]').first().click();mode='cancelled';await cards(p).first().click();await p.evaluate(()=>nativeDetailCompletion);assert.equal(await p.locator('#modal [data-cancel-lesson],#modal [data-reschedule-lesson],#modal [data-start-lesson]').count(),0,'canonical cancellation overrides an old active card');
 f.native('success');f.setMode('free');await p.evaluate(()=>forjaAgenda2Refresh());assert.equal(await cards(p).count(),0,'a removed lesson cannot return from the canonical state cache');
 await p.locator('#modal [data-close-modal]').first().click();f.setMode('mixed');await p.evaluate(()=>forjaAgenda2Refresh());mode='session-held';await cards(p).first().click();await lateEntry;ended=true;await p.evaluate(()=>executeLogout());mode='success';lateRelease();await p.evaluate(()=>nativeDetailCompletion);
 assert.equal(await p.locator('[data-lesson="REVIEW_LESSON"]:visible').count(),0);assert.equal(await p.locator('#modal:not(.hidden)').count(),0,'late canonical detail cannot reopen after logout');assert.equal(await p.evaluate(()=>state.lessons.some(l=>l.id==='REVIEW_LESSON')),false,'a previous session cannot seed the native cache');
 assert.equal(posts,0,'opening a historical lesson never performs a mutation');assert.deepEqual(writes,[],'all detail requests are read-only');assert.deepEqual(f.errors,[]);
});

for(const role of ['admin','teacher'])for(const condition of ['missing-row','forbidden'])test(`native cached fallback: ${condition} ${role}`,async t=>{
 const f=await fixture(t,{role}),p=f.page,item=f.snapshot().items[0].lessons[0];await p.evaluate(item=>{state.lessons=[item];},item);
 if(condition==='forbidden'){
  const denied=route=>route.fulfill({status:403,contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:'{"code":"SEM_PERMISSAO"}'});await p.route('**/agenda/snapshot?**',denied);await p.evaluate(()=>forjaAgenda2Refresh());
  assert.equal(await cards(p).count(),0,'denied snapshot cannot resurrect the old native state cache');await p.unroute('**/agenda/snapshot?**',denied);await p.evaluate(()=>forjaAgenda2Refresh());assert.ok(await cards(p).count()>0);assert.equal(await p.locator('.forja2-native-history').count(),0);
 }else{
  let release,entered;const gate=new Promise(r=>release=r),entry=new Promise(r=>entered=r),held=async route=>{entered(route.request());await gate;await route.fallback();};await p.route('**/agenda/snapshot?**',held);
  await p.locator(`[data-v621-view="day"][data-role="${role}"]`).click();const request=await entry;
  try{
   await historical(p);
   // Legacy cached lessons can lack an end time; presentation must not crash or
   // invent one while waiting for a structurally valid native snapshot.
   await p.evaluate(()=>{delete state.lessons[0].horaFim;forjaAgenda2Paint();});
   assert.ok(await cards(p).count()>0);assert.doesNotMatch(await cards(p).first().getAttribute('aria-label'),/undefined/);
   await p.evaluate(item=>{state.lessons=[item];forjaAgenda2Paint();},item);
  }finally{release();const response=await request.response();if(response)await response.finished();await p.unroute('**/agenda/snapshot?**',held);}
  await p.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]')?.textContent||''));assert.equal(await p.locator('.forja2-native-history').count(),0,'native confirmation replaces the unconfirmed cached presentation');
 }
 assert.deepEqual(f.errors,[]);
});
