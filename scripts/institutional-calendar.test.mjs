import{test,before,after}from'node:test';
import assert from'node:assert/strict';
import{readFileSync,mkdirSync}from'node:fs';
import{resolve}from'node:path';
import{pathToFileURL}from'node:url';
import{buildHostingArtifact}from'./prepare-hosting.mjs';
import{agendaPresentationFixture,ready}from'./helpers/agenda-presentation-fixture.mjs';
import{performancePortal,delay}from'./helpers/performance-portal-fixture.mjs';
import{withoutInstitutionalCalendar}from'./institutional-calendar-scope.mjs';
import{withoutAgendaIntelligence}from'./agenda-intelligence-scope.mjs';
const nextSnapshot=page=>page.waitForRequest(r=>r.method()==='GET'&&new URL(r.url()).pathname==='/agenda/snapshot',{timeout:5000});
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
test('institutional layer is reversible and preserves every prior scope/integrity guard',()=>{const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.ok(!withoutInstitutionalCalendar(html).includes('forja-institutional-script'));assert.ok(!withoutAgendaIntelligence(html).includes('forja-agenda2-script'));assert.throws(()=>withoutInstitutionalCalendar(html.replace('Agenda Google institucional','Vinculação alterada')),/boundary/);});
async function eventFixture(t,{role='teacher',mobile=false}={}){
 const sockets=new Set();let version=0,until,lesson=null;
 const f=await agendaPresentationFixture(browser,{...buildHostingArtifact(),role,mobile,mode:'free',changeVersion:()=>String(version).padStart(64,'0'),transformItem:item=>({...item,personal:{status:'not_applicable',connected:false,checkedAt:null,sourceMode:'institutional-events-v1'},lessons:lesson?[{...lesson,professorId:item.professionalId}]:[]}),transformSnapshot:value=>{until??=Date.parse(value.servedAt)+300000;return {...value,refreshMode:'events',sourceExpiresAt:new Date(until).toISOString()};},agendaEvents:(req,res)=>{assert.equal(req.headers.authorization,'Bearer SYNTHETIC');res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store'});res.flushHeaders();sockets.add(res);res.on('close',()=>sockets.delete(res));}});
 const emit=async(kind='heartbeat')=>{if(kind==='changed')version++;for(const res of sockets)res.write('data: '+JSON.stringify({kind,version:String(version).padStart(64,'0')})+'\n\n');await delay(60);};
 t.after(async()=>{for(const res of sockets)res.end();await f.close();});
 const deadline=Date.now()+5000;while(!sockets.size&&Date.now()<deadline)await delay(20);assert.ok(sockets.size,'authenticated stream must open before its ready frame');await delay(150);const request=nextSnapshot(f.page);await emit('ready');await f.page.clock.runFor(350);await ready(f.page,{request});await f.page.waitForFunction(()=>/^Consulta confirmada/.test(document.querySelector('[data-forja2-status]')?.textContent||''));
 return {...f,emit,setLesson:value=>lesson=value,disconnect:()=>{for(const s of sockets)s.end();}};
}
for(const role of ['admin','teacher'])for(const mobile of [false,true])test(`institutional ${role} ${mobile?'mobile':'desktop'}: no 20s reads at rest, five events, form preserved`,async t=>{
 const f=await eventFixture(t,{role,mobile}),p=f.page,initial=f.reads();
 if(role==='teacher'){assert.equal(await p.locator('.v622-sync [data-google-action="connect"]').count(),0);assert.equal(await p.locator('.v622-sync .sync-copy b').textContent(),'Agenda institucional');}
 if(role==='admin'){await p.locator('[data-v630-open]').first().click();await p.locator('#v630Place').fill('Dado digitado preservado');}
 for(let i=0;i<10;i++){await f.emit();await p.clock.runFor(10000);assert.equal(f.reads(),initial,'healthy institutional stream must not trigger 20s snapshots');}
 for(let i=0;i<5;i++){f.setLesson({id:'INSTITUTIONAL_LESSON',alunoId:'PERF_STUDENT',nomeAluno:'Aluno simulado',dataAula:'2026-10-20',horaAula:i%2?'11:00':'10:00',horaFim:i%2?'12:00':'11:00',status:i===4?'cancelada_admin':'confirmada'});const request=nextSnapshot(p);await f.emit('changed');await p.clock.runFor(350);await ready(p,{request});assert.equal(f.reads(),initial+i+1);if(role==='admin')assert.equal(await p.locator('#v630Place').inputValue(),'Dado digitado preservado');}
 assert.deepEqual(f.errors,[]);const folder=new URL('../docs/evidence/institutional-calendar/',import.meta.url);mkdirSync(folder,{recursive:true});if(role==='admin'){await p.locator('.v630-close').click();await p.clock.runFor(350);}await p.screenshot({path:new URL(`agenda-${role}-${mobile?'mobile':'desktop'}.png`,folder).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
});
test('institutional transport loss immediately removes confirmed green; source TTL is never renewed by snapshots',async t=>{
 const f=await eventFixture(t);assert.ok(await f.page.locator('.v621-block.availability').count()>0);f.disconnect();await delay(150);await f.page.waitForFunction(()=>!document.querySelector('.v621-block.availability'));assert.match(await f.page.locator('[data-forja2-status]').textContent(),/interrompido|incompleta|não confirmado/i);
});
test('institutional hidden tab cannot resume green before its event transport and native read are revalidated',async t=>{
 const f=await eventFixture(t),p=f.page;assert.ok(await p.locator('.v621-block.availability').count()>0);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await delay(100);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await p.locator('.v621-block.availability').count(),0,'events missed while hidden require a new authenticated stream/read, even within the source TTL');
});
for(const mobile of [false,true])test(`new teacher chooses institutional calendar by name/ID; other profiles keep their existing fields ${mobile?'mobile':'desktop'}`,async t=>{
 const f=await performancePortal({browser,...buildHostingArtifact(),role:'admin',mobile,requestDelay:5,secondaryDelay:5});t.after(()=>f.close());const p=f.page;
 await p.route('**/admin/google-calendar/central/calendars',route=>route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({ok:true,institutionalAuthorized:false,items:[{id:'a'.repeat(64),calendarId:'teacher-one@group.calendar.google.com',displayName:'Professor um',accessRole:'writer',accessStatus:'accessible',teacherId:''},{id:'b'.repeat(64),calendarId:'PRIVATE_OTHER',displayName:'Outro vinculado',accessRole:'owner',accessStatus:'accessible',teacherId:'OTHER_TEACHER'}]})}));
 await f.login();await p.waitForFunction(()=>state.profile&&!state.loading);await p.evaluate(()=>newUserModal());await p.waitForFunction(()=>[...document.querySelectorAll('#newUserInstitutionalCalendar option')].some(o=>o.textContent.includes('Professor um')));assert.equal(await p.locator('#newUserInstitutionalCalendar option').filter({hasText:'PRIVATE_OTHER'}).count(),0);assert.equal(await p.locator('#newUserInstitutionalCalendar').getAttribute('type'),null);
 await p.locator('input[name="newUserProfile"][value="psychologist"]').check();assert.equal(await p.locator('#institutionalNewUser').isVisible(),false);await p.locator('input[name="newUserProfile"][value="teacher"]').check();assert.equal(await p.locator('#institutionalNewUser').isVisible(),true);assert.deepEqual(f.errors,[]);
});
