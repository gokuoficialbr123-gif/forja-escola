import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {premiumFixture} from './helpers/agenda-premium-fixture.mjs';
import {setView,reviewDay} from './helpers/agenda-presentation-fixture.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const touch=async(f,width)=>{await f.cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await f.page.setViewportSize({width,height:width===360?640:844});};
for(const width of [360,390])for(const role of ['admin','teacher','student'])test(`mobile month keeps a complete readable start time ${role} ${width}`,async t=>{
 const f=await premiumFixture(browser,{role,width,height:width===360?640:844});t.after(()=>f.close());await touch(f,width);const p=f.page;
 await p.route('**/aulas/PREMIUM_ONSITE',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({item:{id:'PREMIUM_ONSITE',professorId:role==='teacher'?'PERF_ADMIN':'PERF_TEACHER',alunoId:role==='student'?'PERF_ADMIN':'PREMIUM_CHILD',nomeAluno:'Aluno simulado',dataAula:reviewDay,horaAula:'13:00',horaFim:'14:00',modalidade:'presencial',status:'confirmada'}})}));
 if(role==='student')await p.locator('[data-g-cal-view="month"]').click();else await setView(f,role,'month');
 const selector=role==='student'?'.cal18-month-grid [data-lesson="PREMIUM_ONSITE"]':`.v621-month-tags [data-lesson="PREMIUM_ONSITE"]`;
 const data=await p.locator(selector).evaluate(el=>{const time=el.querySelector('.forja2-month-time'),s=time&&getComputedStyle(time);return {text:time?.textContent,visible:!!time&&time.getBoundingClientRect().width>0&&s.display!=='none',cut:time&&time.scrollWidth>time.clientWidth+1,font:s?.fontSize,label:el.getAttribute('aria-label')||el.getAttribute('title')};});
 assert.equal(data.visible,true,'native month must show an untruncated start time');assert.equal(data.text,'13h');assert.equal(data.cut,false);assert.ok(parseFloat(data.font)>=(role==='student'?10:12));assert.match(data.label||'',/13:00–14:00/);
 const minutes=await p.locator(selector).evaluate(el=>{const original=el.querySelector('.forja2-month-time'),template=document.createElement('template');template.innerHTML=window.forjaAgenda2MonthTime({horaAula:'13:30',horaFim:'14:30'});const time=template.content.firstElementChild;original.replaceWith(time);const result={text:time.textContent,cut:time.scrollWidth>time.clientWidth,label:time.getAttribute('aria-label')};time.replaceWith(original);return result;});
 assert.equal(minutes.text,'13h30');assert.equal(minutes.cut,false,'non-zero minutes must also fit');assert.equal(minutes.label,'13:30–14:30');
 await p.locator(selector).click();await p.waitForFunction(()=>document.querySelector('#modalTitle')?.textContent==='Central da Aula');assert.deepEqual(f.errors,[]);
});
for(const width of [360,390])for(const role of ['student','parent','psychologist'])test(`mobile details and More menu fit and expose their last action ${role} ${width}`,async t=>{
 const height=width===360?640:844,f=await premiumFixture(browser,{role,width,height});t.after(()=>f.close());await touch(f,width);const p=f.page;
 await p.route('**/aulas/PREMIUM_ONSITE',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({item:{id:'PREMIUM_ONSITE',professorId:'PERF_TEACHER',alunoId:role==='student'?'PERF_ADMIN':'PREMIUM_CHILD',nomeAluno:'Aluno simulado',dataAula:reviewDay,horaAula:'13:00',horaFim:'14:00',modalidade:'presencial',status:'confirmada'}})}));
 await p.route('**/sessoes-terapia/PREMIUM_THERAPY',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':f.origin},body:JSON.stringify({item:{id:'PREMIUM_THERAPY',psicologoId:'PERF_ADMIN',nomeAluno:'Paciente simulado',dataSessao:reviewDay,horaSessao:'10:00',horaFim:'11:00',status:'agendada'}})}));
 await p.locator(role==='psychologist'?'[data-session="PREMIUM_THERAPY"]':'[data-lesson="PREMIUM_ONSITE"]').first().click();await p.waitForFunction(()=>document.querySelector('#modal')?.textContent.includes('simulado'));
 async function bounded(){const r=await p.locator('#modal .modal').boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=height+1,JSON.stringify(r));assert.equal(await p.locator('#modal .modal-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);}
 await bounded();await p.locator('#modal [data-close-modal]').first().click();await p.locator('#mobileNav [data-action="mobileMore"]').click();await bounded();
 const last=p.locator('[data-mobile-page]').last();await last.scrollIntoViewIfNeeded();assert.equal(await last.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);}),true,'footer must not cover the last menu action');
 await p.locator('#modal [data-close-modal]').first().click();assert.equal(await p.evaluate(()=>state.page),'agenda');assert.deepEqual(f.errors,[]);
});
