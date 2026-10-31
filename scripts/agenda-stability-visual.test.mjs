import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {stabilityFixture,stabilityArtifact,denseWeek} from './helpers/agenda-stability-fixture.mjs';
import {setView,nextSnapshot,ready} from './helpers/agenda-presentation-fixture.mjs';
import {delay} from './helpers/performance-portal-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const directory=process.env.FORJA_STABILITY_EVIDENCE,baseline=process.env.FORJA_STABILITY_BASELINE==='1';
async function capture(p,name){if(!directory)return;await delay(300);await p.screenshot({path:resolve(directory,name+'.png'),fullPage:true});}
for(const role of ['admin','teacher'])for(const mobile of [false,true])test(`dense Agenda visual ${role} ${mobile?'mobile':'desktop'}`,async()=>{
 if(directory)mkdirSync(directory,{recursive:true});const recorder=directory?{newContext:options=>browser.newContext({...options,recordVideo:{dir:directory,size:mobile?{width:390,height:844}:{width:1920,height:1080}}})}:browser;
 const f=await stabilityFixture(recorder,{role,mobile,artifact:stabilityArtifact({baseline}),transformItem:denseWeek}),p=f.page,name=role+'-'+(mobile?'mobile':'desktop');
 try{
  if(!mobile)await p.setViewportSize({width:1920,height:1080});await setView(f,role,'week');await f.waitStreams(1);f.emit('ready');await delay(80);
  assert.ok(f.snapshot().items[0].lessons.length+f.snapshot().items[0].busy.length+f.snapshot().items[0].blocks.length>=30);await capture(p,name+'-week-confirmed');
  const retained=await p.locator('[data-lesson]').first().elementHandle();await p.evaluate(()=>{window.__scenarioStep='normal-renewal';return forjaAgenda2Refresh();});if(!baseline)assert.equal(await retained.evaluate(el=>el.isConnected),true,'ordinary renewal keeps lesson DOM identity');await capture(p,name+'-renewal');
  f.emit('reconnect');await delay(100);await p.clock.runFor(5001);await f.waitStreams(1);f.emit('ready');await delay(80);await capture(p,name+'-sse-reconnection');
  await p.locator('.v621-week-wrap').evaluate((el,top)=>el.scrollTop=top,baseline?240:480);await capture(p,name+'-week-afternoon');
  await setView(f,role,'day');await p.locator('.v621-week-wrap').evaluate((el,top)=>el.scrollTop=top,baseline?240:480);await capture(p,name+'-day');
  if(!baseline){assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.equal(await p.locator('.forja2-state').evaluateAll(xs=>xs.some(x=>x.textContent.includes('Fora da publicação'))),false);const card=p.locator('.v621-block.lesson').first();assert.ok(parseFloat(await card.locator('b').evaluate(x=>getComputedStyle(x).fontSize))>=12);}
  await f.context.setOffline(true);await p.evaluate(()=>window.__scenarioStep='really-expired');await p.clock.runFor(26000);assert.equal(await p.locator('.v621-block.availability').count(),0);await capture(p,name+'-expired');
  await f.context.setOffline(false);await p.evaluate(()=>{window.__scenarioStep='recovered';return forjaAgenda2Refresh();});await capture(p,name+'-recovered');
  await setView(f,role,'month');await capture(p,name+'-month');
  if(!baseline){assert.equal(await p.locator('.v621-month-grid').evaluate(x=>x.scrollWidth<=x.clientWidth+1),true);const more=p.locator('.forja2-more-lessons').first();assert.ok(await more.count()>0);const request=nextSnapshot(p,{view:'day'});await more.click();await ready(p,{request});assert.ok(await p.locator('.v621-block.lesson').count()>=3,'all summarized lessons remain reachable through the native day view');}
  assert.deepEqual(f.errors,[]);
 }finally{
  if(directory)writeFileSync(resolve(directory,name+'-transitions.json'),JSON.stringify(await p.evaluate(()=>__agendaTransitions||[]),null,2));const video=p.video();await f.close();if(directory&&video)copyFileSync(await video.path(),resolve(directory,name+'.webm'));
 }
});
