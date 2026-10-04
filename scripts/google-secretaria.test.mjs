import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, before, after } from 'node:test';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const {chromium}=await import(process.env.FORJA_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href:'playwright');
let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));
after(async()=>browser?.close());
const base='/admin/google-calendar/central';
async function fixture(t,{mobile=false,role='admin',active=true,connected=false,error=false,configured=true,unsafeUrl=false}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});t.after(()=>page.close());
 await page.route('**/*',r=>r.abort());
 await page.setContent('<main id="settings"></main><div id="feedback" role="status"></div>');
 await page.evaluate(({html,role,active,connected,error,configured,unsafeUrl,base})=>{
  const parsed=new DOMParser().parseFromString(html,'text/html');
  for(const original of parsed.querySelectorAll('style')){const style=document.createElement('style');style.textContent=original.textContent;document.head.appendChild(style)}
  const code=parsed.getElementById('forja-google-secretaria-script')?.textContent;if(!code)throw Error('Central script missing');
  window.state={role,profile:{active},user:{uid:'LOCAL_ADMIN'}};window.calls=[];
  window.esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  window.fmtDateTime=()=> '04/10/2026 12:00';window.$$=s=>[...document.querySelectorAll(s)];
  window.setBusy=(b,v)=>{if(b)b.disabled=v};window.toast=x=>document.getElementById('feedback').textContent=x;
  window.confirm=()=>true;window.settingsPage=()=>'<section id="personal">Conexões dos profissionais</section>';
  window.loadRoleData=async()=>{};window.bindPage=()=>{};
  window.provider={connected,error,configured,unsafeUrl};
  window.api=async(path,options={})=>{
   calls.push({path,method:options.method||'GET'});
   if(path===base+'/status'){
    if(provider.error)throw Error('TEST_ONLY_CREDENTIAL_IN_ERROR');
    return {configured:provider.configured,policy:'identity-only-v1',item:{connected:provider.connected,maskedEmail:provider.connected?'s***@f***.example':'',lastStatusAt:'2026-10-04T15:00:00Z'}};
   }
   if(path===base+'/disconnect'){provider.connected=false;return {ok:true}}
   if(path===base+'/connect')return {authUrl:provider.unsafeUrl?'https://attacker.invalid/':'https://accounts.google.com/o/oauth2/v2/auth?scope=openid+email&state=TEST_ONLY_STATE'};
   throw Error('Unexpected personal/Calendar endpoint');
  };
  (0,eval)(code);
 },{html,role,active,connected,error,configured,unsafeUrl,base});
 await page.evaluate(async()=>{await loadRoleData();document.getElementById('settings').innerHTML=settingsPage();bindPage()});
 return page;
}
for(const mobile of [false,true]){
 test(`central card ${mobile?'mobile':'desktop'}: disconnected, connected and same-account reconnect`,async t=>{
  const page=await fixture(t,{mobile,connected:true});
  assert.equal(await page.locator('#googleSecretariaCard h3').textContent(),'Google Calendar da Secretaria');
  assert.equal(await page.locator('#googleSecretariaCard .status').textContent(),'Conectado');
  assert.equal(await page.locator('[data-secretaria-google=connect]').textContent(),'Reconectar');
  assert.match(await page.locator('#googleSecretariaCard').textContent(),/s\*\*\*@f\*\*\*.example/);
  const bounds=await page.locator('#googleSecretariaCard').boundingBox();assert.ok(bounds.width<= (mobile?390:1280));
  assert.equal(await page.locator('#personal').count(),1);
  await page.click('[data-secretaria-google=disconnect]');
  await page.waitForFunction(()=>document.querySelector('#googleSecretariaCard .status').textContent==='Não conectado');
  assert.equal(await page.locator('[data-secretaria-google=disconnect]').count(),0);
  assert.equal(await page.locator('[data-secretaria-google=connect]').textContent(),'Conectar');
  assert.ok(!(await page.locator('#googleSecretariaCard').textContent()).includes('s***@'));
  const calls=await page.evaluate(()=>calls);assert.deepEqual(calls.map(x=>x.path),[base+'/status',base+'/disconnect',base+'/status']);
 });
}
for(const [role,active] of [['teacher',true],['psychologist',true],['student',true],['parent',true],['admin',false]])test(`central hidden and no calls for ${role} active=${active}`,async t=>{
 const page=await fixture(t,{role,active});assert.equal(await page.locator('#googleSecretariaCard').count(),0);assert.deepEqual(await page.evaluate(()=>calls),[]);
});
test('status failures remain local, expose no raw error and permit retry',async t=>{
 const page=await fixture(t,{error:true});assert.equal(await page.locator('[data-secretaria-google=connect]').isDisabled(),true);
 assert.ok(!(await page.locator('body').textContent()).includes('TEST_ONLY_CREDENTIAL'));
 await page.evaluate(()=>provider.error=false);await page.click('[data-secretaria-google=status]');
 await page.waitForFunction(()=>!document.querySelector('[data-secretaria-google=connect]').disabled);
});
test('unconfigured central OAuth cannot start consent',async t=>{
 const page=await fixture(t,{configured:false});assert.equal(await page.locator('[data-secretaria-google=connect]').isDisabled(),true);
 assert.equal(await page.locator('#personal').count(),1);
});
test('connect targets only Google identity; unsafe auth URL never navigates',async t=>{
 const page=await fixture(t,{unsafeUrl:true});await page.click('[data-secretaria-google=connect]');
 await page.waitForFunction(()=>document.getElementById('feedback').textContent.length>0);
 assert.match(await page.locator('#feedback').textContent(),/Não foi possível/);
 assert.equal(await page.evaluate(()=>calls.at(-1).path),base+'/connect');
 assert.equal(page.url(),'about:blank');
});
test('stale admin response cannot expose central status after switching role',async t=>{
 const page=await fixture(t);
 await page.evaluate(()=>{
  window.resolveStatus=null;window.api=()=>new Promise(resolve=>window.resolveStatus=resolve);
  window.pending=loadRoleData();
 });
 await page.waitForFunction(()=>window.resolveStatus!==null);
 await page.evaluate(async()=>{
  state.role='teacher';state.user={uid:'LOCAL_TEACHER'};
  resolveStatus({configured:true,policy:'identity-only-v1',item:{connected:true,maskedEmail:'a***@f***.invalid'}});
  await pending;document.getElementById('settings').innerHTML=settingsPage();
 });
 assert.equal(await page.locator('#googleSecretariaCard').count(),0);
 assert.ok(!(await page.locator('body').textContent()).includes('a***@'));
});
for(const mobile of [false,true])test(`connect ${mobile?'mobile':'desktop'} follows only identity-only Google authorization`,async t=>{
 const page=await fixture(t,{mobile});
 const navigation=page.waitForRequest(r=>r.url().startsWith('https://accounts.google.com/'));
 await page.click('[data-secretaria-google=connect]');
 const request=await navigation,url=new URL(request.url());
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('scope'),'openid email');
});
test('cancel disconnect preserves central and personal cards without writes',async t=>{
 const page=await fixture(t,{connected:true});await page.evaluate(()=>window.confirm=()=>false);
 await page.click('[data-secretaria-google=disconnect]');
 assert.deepEqual(await page.evaluate(()=>calls.map(x=>x.path)),[base+'/status']);
 assert.equal(await page.locator('#googleSecretariaCard .status').textContent(),'Conectado');
 assert.equal(await page.locator('#personal').count(),1);
});
