import assert from 'node:assert/strict';import{test,before,after}from'node:test';import{resolve}from'node:path';import{pathToFileURL}from'node:url';
import{performancePortal,delay}from'./helpers/performance-portal-fixture.mjs';import{buildHostingArtifact}from'./prepare-hosting.mjs';
const{chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
async function fixture(t,options={}){const f=await performancePortal({browser,...buildHostingArtifact(),requestDelay:10,secondaryDelay:10,...options});t.after(()=>f.close());return f;}
async function ready(p,page){await p.waitForFunction(page=>state.role==='admin'&&state.page===page&&!state.loading,page);assert.equal(await p.locator('[data-admin-data-retry]').count(),0);}
test('home loads 14 GETs and no secondary/Google request; every allowed page has an explicit dependency map',async t=>{
 const f=await fixture(t);await f.login();await ready(f.page,'inicio');assert.equal(f.calls.filter(x=>x.method==='GET').length,14);
 for(const path of ['/auditoria','/relatorios/resumo','/admin/familias','/treinamentos','/google/calendar/busy','/admin/google-calendar/connections'])assert.equal(f.calls.filter(x=>x.path===path).length,0,path);
 assert.deepEqual(await f.page.evaluate(()=>[...new Set([...MENUS.admin.map(x=>x[0]),...ADMIN_INTERNAL_PAGES_A,...Object.keys(SPECIAL_PAGES)])].filter(x=>!Object.hasOwn(FORJA_ADMIN_PAGE_READS,x))),[]);assert.deepEqual(f.errors,[]);
});
for(const mobile of [false,true])test(`Agenda ${mobile?'mobile':'desktop'} is usable while an unrelated family request is held`,async t=>{
 const f=await fixture(t,{mobile}),p=f.page;await f.login();await ready(p,'inicio');const release=f.hold('/admin/familias');await p.evaluate(()=>navigate('vinculos'));await p.waitForFunction(()=>state.loading);assert.match(await p.locator('#workspaceContent').textContent(),/Carregando/);assert.equal(await p.locator('#workspaceContent').getByText('Nenhum vínculo').count(),0);
 await p.evaluate(()=>navigate('agenda'));await ready(p,'agenda');await p.waitForFunction(()=>Object.values(state.v631CentralRanges||{}).some(x=>x.valid));await p.locator('[data-v630-open]').first().waitFor({state:'visible'});release();await delay(30);assert.equal(await p.evaluate(()=>state.page),'agenda');assert.deepEqual(f.errors,[]);
});
test('essential failure blocks only that screen, never displays empty KPIs; retry recovers without new authentication',async t=>{
 const f=await fixture(t),p=f.page;let failed=true;await p.route('**/admin/aluno-materias',route=>failed?route.fulfill({status:503,contentType:'application/json',body:'{}',headers:{'Access-Control-Allow-Origin':f.origin}}):route.fallback());await f.login();await p.locator('[data-admin-data-retry]').waitFor({state:'visible'});assert.equal(await p.locator('.secretary-d-hero').count(),0);assert.equal(await p.locator('#processOverlay').isVisible(),false);assert.equal(await p.evaluate(()=>state.profile.role),'admin');
 await p.evaluate(()=>navigate('conta'));await ready(p,'conta');await p.evaluate(()=>navigate('inicio'));await p.locator('[data-admin-data-retry]').waitFor({state:'visible'});failed=false;await p.click('[data-admin-data-retry]');await ready(p,'inicio');assert.deepEqual(f.errors,[]);
});
test('simultaneous views coalesce shared reads, and committed mutation invalidates data without changing Auth',async t=>{
 const f=await fixture(t),p=f.page,release=f.hold('/admin/usuarios');await f.login();await p.waitForFunction(()=>state.role==='admin'&&state.loading);await p.evaluate(()=>{navigate('agenda');renderPage();renderPage()});for(let i=0;i<100&&!f.calls.some(x=>x.path==='/admin/usuarios');i++)await delay(10);assert.equal(f.calls.filter(x=>x.path==='/admin/usuarios').length,1);release();await ready(p,'agenda');
 await p.evaluate(async()=>{await api('/indisponibilidades',{method:'POST',body:{synthetic:true}});await reloadAndRender()});await ready(p,'agenda');assert.equal(f.calls.filter(x=>x.path==='/admin/usuarios').length,2);assert.equal(await p.evaluate(()=>auth.currentUser.uid),'PERF_ADMIN');assert.deepEqual(f.errors,[]);
});
test('late old UID or invalidated-generation data cannot replace the new session',async t=>{
 const f=await fixture(t),p=f.page;await f.login();await ready(p,'inicio');const release=f.hold('/admin/familias');await p.evaluate(()=>navigate('vinculos'));await p.waitForFunction(()=>state.loading);await p.evaluate(()=>{forjaEndSession();auth.currentUser={uid:'NEW_USER',getIdToken:async()=>'SYNTHETIC'};forjaBeginSession(auth.currentUser);state.user=auth.currentUser;state.profile={role:'teacher',active:true};state.role='teacher';state.familyDataG={marker:'NEW_SESSION'}});release();await delay(100);assert.deepEqual(await p.evaluate(()=>state.familyDataG),{marker:'NEW_SESSION'});assert.deepEqual(f.errors,[]);
});
test('essential read timeout is recoverable, retains a validated account and leaves navigation available',async t=>{
 const f=await fixture(t),p=f.page;await p.clock.install();await f.login();await ready(p,'inicio');await p.evaluate(()=>{const previous=fetch;window.fetch=(url,opts)=>String(url).endsWith('/auditoria')?new Promise(()=>{}):previous(url,opts);navigate('auditoria')});await p.clock.fastForward(20001);await p.locator('[data-admin-data-retry]').waitFor({state:'visible'});assert.equal(await p.locator('#processOverlay').isVisible(),false);await p.evaluate(()=>navigate('conta'));await ready(p,'conta');assert.deepEqual(f.errors,[]);
});
test('new calendar week cannot reuse the previous week even inside the 30-second cache window',async t=>{
 const f=await fixture(t),p=f.page;await p.clock.install();await f.login();await ready(p,'inicio');const previous=await p.evaluate(()=>state.adminAvailabilityWeekStartV616),next=await p.evaluate(()=>Date.now()+7*86400000);await p.clock.setFixedTime(new Date(next));await p.evaluate(()=>navigate('agenda'));await ready(p,'agenda');assert.notEqual(await p.evaluate(()=>state.adminAvailabilityWeekStartV616),previous);assert.equal(f.calls.filter(x=>x.path==='/admin/disponibilidades-semana').length,2);assert.deepEqual(f.errors,[]);
});
test('same UID changing role cannot receive a late administrative dataset',async t=>{
 const f=await fixture(t),p=f.page;await f.login();await ready(p,'inicio');const release=f.hold('/admin/familias');await p.evaluate(()=>navigate('vinculos'));await p.waitForFunction(()=>state.loading);await p.evaluate(async()=>{state.role='teacher';state.profile={...state.profile,role:'teacher'};await loadRoleData();state.familyDataG={marker:'ROLE_CHANGED'}});release();await delay(50);assert.deepEqual(await p.evaluate(()=>state.familyDataG),{marker:'ROLE_CHANGED'});assert.deepEqual(f.errors,[]);
});
test('an older refresh cannot redirect or replace the screen selected during its read',async t=>{
 const f=await fixture(t),p=f.page;await f.login();await ready(p,'inicio');const release=f.hold('/aulas');await p.evaluate(()=>{window.oldRefresh=reloadAndRender()});await p.locator('#workspaceContent').getByText('Atualizando dados...',{exact:true}).waitFor();await p.evaluate(()=>navigate('conta'));await ready(p,'conta');release();await p.evaluate(()=>oldRefresh);assert.equal(await p.evaluate(()=>state.page),'conta');assert.equal(await p.evaluate(()=>state.loading),false);assert.deepEqual(f.errors,[]);
});
