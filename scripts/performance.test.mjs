import assert from 'node:assert/strict';import{test,before,after}from'node:test';import{resolve}from'node:path';import{pathToFileURL}from'node:url';import{readFileSync}from'node:fs';
import{performancePortal,delay}from'./helpers/performance-portal-fixture.mjs';import{buildHostingArtifact}from'./prepare-hosting.mjs';import{withoutPerformanceChanges}from'./performance-scope.mjs';import{sha256}from'./validate.mjs';
const{chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser.close());
const artifact=buildHostingArtifact();
async function setup(t,options={}){const f=await performancePortal({browser,...artifact,requestDelay:10,secondaryDelay:10,...options});t.after(()=>f.close());return f}
test('performance edits restore exact published source, preserving every older integrity guard',()=>assert.equal(sha256(withoutPerformanceChanges(readFileSync(new URL('../index.html',import.meta.url),'utf8'))),'43731860d9923001c68f097a76068e082c2c7aeaebc5cbe77161cd2732b790eb'));
for(const mobile of[false,true])test(`artifact ${mobile?'mobile':'desktop'}: authenticated navigation works while secondary data is pending, no fake empty data`,async t=>{
 const f=await setup(t,{mobile}),release=f.hold('/admin/familias');await f.login();
 await f.page.waitForFunction(()=>document.querySelector('#workspacePage')?.textContent&&state.role==='admin'&&state.loading);
 assert.equal(await f.page.locator('#processOverlay').isVisible(),false);
 await f.page.evaluate(()=>navigate('usuarios'));assert.match(await f.page.locator('#workspaceContent').textContent(),/Carregando/);assert.equal(await f.page.locator('[data-action=newUser]').count(),0);
 release();await f.page.waitForFunction(()=>!state.loading);assert.equal(await f.page.evaluate(()=>state.page),'usuarios');await f.page.locator('[data-action=newUser]').waitFor({state:'visible'});assert.deepEqual(f.errors,[]);
 const before=f.calls.length;await f.page.evaluate(()=>navigate('agenda'));await f.page.waitForFunction(()=>Object.values(state.v631CentralRanges||{}).some(r=>r.valid));
 assert.equal(f.calls.slice(0,before).filter(x=>x.path.includes('google-central-busy')).length,0);
 const releaseWeek=f.hold('/admin/disponibilidades-semana'),weekStart=f.calls.length;
 await f.page.locator('[data-v621-nav=next][data-role=admin]').click();for(let i=0;i<300&&!f.calls.slice(weekStart).some(x=>x.path==='/admin/disponibilidades-semana');i++)await delay(10);
 await f.page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(f.calls.slice(weekStart).filter(x=>x.path==='/admin/disponibilidades-semana').length,1);
 releaseWeek();await f.page.waitForFunction(()=>Object.values(state.v631CentralRanges||{}).filter(r=>r.valid).length>=2);assert.deepEqual(f.errors,[]);
});
test('old concurrent family/package loads cannot erase the next UID/session after logout',async t=>{
 const f=await setup(t),releaseFamily=f.hold('/admin/familias'),releasePackage=f.hold('/admin/aluno-materias');await f.login();await f.page.waitForFunction(()=>state.role==='admin'&&state.loading);
 await f.page.evaluate(()=>{forjaEndSession();auth.currentUser={uid:'NEXT_USER',getIdToken:async()=>'SYNTHETIC_NEXT'};forjaBeginSession(auth.currentUser);state.role='teacher';state.user=auth.currentUser;state.familyDataG={marker:'next'};state.secretarySubjectLinksD=[{id:'next'}]});releaseFamily();releasePackage();await f.page.evaluate(()=>__perfActivation);
 assert.deepEqual(await f.page.evaluate(()=>state.familyDataG),{marker:'next'});assert.deepEqual(await f.page.evaluate(()=>state.secretarySubjectLinksD),[{id:'next'}]);
});
test('non-admin role loaders remain sequential and do not run the next dataset after session invalidation',async t=>{
 const f=await setup(t);await f.page.evaluate(async()=>{window.order=[];state.role='teacher';auth.currentUser={uid:'LOCAL_TEACHER',getIdToken:async()=>'SYNTHETIC'};forjaBeginSession(auth.currentUser);state.role='teacher';await forjaParallelRoleLoad(async()=>{order.push('previous');await Promise.resolve();order.push('ready')},async()=>{order.push('secondary')})});assert.deepEqual(await f.page.evaluate(()=>order),['previous','ready','secondary']);
 await f.page.evaluate(async()=>{window.stale=false;try{await forjaParallelRoleLoad(async()=>{forjaEndSession()},async()=>{order.push('must-not-run')})}catch(e){stale=e.code==='FORJA_STALE_SESSION'}});assert.equal(await f.page.evaluate(()=>stale),true);assert.equal(await f.page.evaluate(()=>order.includes('must-not-run')),false);
});

test('failed central source remains unknown in the actual artifact; it never reveals published periods as free',async t=>{
 const f=await setup(t);await f.login();await f.page.waitForFunction(()=>!state.loading);await f.page.evaluate(()=>navigate('agenda'));
 await f.page.waitForFunction(()=>Object.values(state.v631CentralRanges||{}).some(r=>r.valid===true));
 assert.ok(await f.page.locator('.v629-block.availability').count()>0,'positive control: published periods really appear before failure');
 f.fail('/admin/agenda/google-central-busy');await f.page.locator('[data-v629-refresh]').click();
 await f.page.waitForFunction(()=>Object.values(state.v631CentralRanges||{}).some(r=>r.valid===false));
 assert.match(await f.page.locator('#workspaceContent').textContent(),/não confirmada|desconhecidos/);
 assert.equal(await f.page.locator('.v629-block.availability').count(),0);assert.deepEqual(f.errors,[]);
});
for(const mobile of[false,true])test(`public, login and cadastro ${mobile?'mobile':'desktop'} retain exact computed appearance`,async t=>{
 const snapshots=[];
 for(const candidate of [{bytes:Buffer.from(withoutPerformanceChanges(readFileSync(new URL('../index.html',import.meta.url),'utf8'))),resources:[]},artifact]){
  const f=await performancePortal({browser,...candidate,mobile,requestDelay:10,secondaryDelay:10});t.after(()=>f.close());
  await f.page.waitForFunction(()=>document.querySelector('.public-header img').complete&&document.querySelector('.public-header img').naturalWidth>0);
  const publicStyle=await f.page.locator('.public-header').evaluate(el=>{const c=getComputedStyle(el);return {color:c.color,background:c.backgroundColor,padding:c.padding,height:el.getBoundingClientRect().height,logo:el.querySelector('img').naturalWidth}});
  await f.page.evaluate(()=>showLogin());await f.page.locator('#loginEmail').waitFor({state:'visible'});
  const loginStyle=await f.page.locator('#loginEmail').evaluate(el=>{const c=getComputedStyle(el);return {color:c.color,background:c.backgroundColor,padding:c.padding,radius:c.borderRadius,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height}});
  await f.login();await f.page.waitForFunction(()=>!state.loading);await f.page.evaluate(()=>{navigate('usuarios');newUserModal()});
  const formStyle=await f.page.locator('#forjaNewUserDialog').evaluate(el=>{const c=getComputedStyle(el);return {color:c.color,background:c.backgroundColor,padding:c.padding,radius:c.borderRadius,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,profiles:el.querySelectorAll('[name=newUserProfile]').length}});
  snapshots.push({publicStyle,loginStyle,formStyle});assert.deepEqual(f.errors,[]);
 }
 assert.deepEqual(snapshots[1],snapshots[0]);
});
