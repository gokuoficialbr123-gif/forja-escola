import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {readFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {buildHostingArtifact,hostingOptionsFromArgs} from './prepare-hosting.mjs';
import {previewConfigFromEvent} from './preview-config.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url));
const {chromium}=await import(process.env.FORJA_PLAYWRIGHT_MODULE?pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href:'playwright');let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));after(()=>browser?.close());
test('demo is explicit, Preview-only and cannot enter the production artifact',()=>{
 const event={repository:{full_name:'owner/repo'},pull_request:{head:{repo:{full_name:'owner/repo'}},body:'<!-- FORJA_PREVIEW_BACKEND=invitation-demo -->'}};
 assert.deepEqual(previewConfigFromEvent(event),{mode:'invitation-demo',apiUrl:''});
 assert.deepEqual(hostingOptionsFromArgs([]),{});assert.ok(buildHostingArtifact().bytes.equals(html));assert.ok(!buildHostingArtifact().bytes.includes('forja-invitation-demo'));
 assert.throws(()=>buildHostingArtifact(undefined,{invitationDemo:true,previewApiUrl:'https://forja-api-pr-7.onrender.com'}));
 const demo=buildHostingArtifact(undefined,{invitationDemo:true});assert.equal(demo.result.apiUrl,null);assert.ok(demo.bytes.includes('forja-invitation-demo'));assert.ok(!demo.bytes.includes('src="https://www.gstatic.com/firebasejs'));
});
for(const mobile of [false,true])test(`safe demo ${mobile?'mobile':'desktop'} creates/resends in memory; zero real API/Auth/email requests`,async t=>{
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:1000},locale:'pt-BR',reducedMotion:'reduce'});t.after(()=>page.close());const network=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const demo=buildHostingArtifact(undefined,{invitationDemo:true}).bytes.toString('utf8');
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin==='https://forja-demo-fixture.invalid'&&url.pathname==='/')return route.fulfill({contentType:'text/html',body:demo});network.push(url.hostname);return route.abort()});
 await page.goto('https://forja-demo-fixture.invalid');await page.waitForFunction(()=>typeof state!=='undefined'&&state.role==='admin'&&!state.loading);await page.evaluate(()=>navigate('usuarios'));
 assert.ok(await page.locator('#forjaInvitationDemo').isVisible());
 await page.locator('#forjaDemoOutcome').selectOption('unavailable');await page.locator('[data-action=newUser]').click();await page.locator('[name=newUserProfile][value=parent]').check();
 await page.locator('#newUserName').fill('Pessoa de demonstração');await page.locator('#newUserCpf').fill('52998224725');await page.locator('#newUserEmail').fill('teste@forja.invalid');await page.locator('#newUserPhone').fill('11999990000');await page.locator('#modalSave').click();await page.waitForSelector('#generatedLink');
 assert.ok((await page.locator('#modal').innerText()).includes('Cadastro concluído'));assert.ok(await page.getByRole('button',{name:'Copiar link de ativação',exact:true}).isVisible());
 if(process.env.FORJA_USER_SCREENSHOTS){mkdirSync(process.env.FORJA_USER_SCREENSHOTS,{recursive:true});await page.screenshot({path:join(process.env.FORJA_USER_SCREENSHOTS,`${mobile?'mobile':'desktop'}-safe-preview-fallback.png`)})}
 await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.locator('#forjaDemoOutcome').selectOption('accepted');await page.evaluate(()=>openUser('DEMO_USER_1'));await page.locator('[data-v616-user-tab=seguranca]').click();
 if(process.env.FORJA_USER_SCREENSHOTS)await page.screenshot({path:join(process.env.FORJA_USER_SCREENSHOTS,`${mobile?'mobile':'desktop'}-resend-action.png`)});
 await page.getByRole('button',{name:'Reenviar convite',exact:true}).click();await page.waitForFunction(()=>document.getElementById('modalTitle')?.textContent==='Reenviar convite');assert.ok((await page.locator('#modal').innerText()).includes('não confirma a entrega'));
 const before=network.length;const result=await page.evaluate(async()=>{
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=SHOULD_NEVER_LEAVE',{method:'POST',body:'{}'});let xhr=false;try{new XMLHttpRequest()}catch{ xhr=true }return {status:r.status,xhr,beacon:navigator.sendBeacon('https://forja-api-m1kq.onrender.com/blocked','blocked')};
 });assert.deepEqual(result,{status:403,xhr:true,beacon:false});assert.equal(network.length,before);
 assert.equal(network.filter(x=>/onrender|googleapis|gstatic|firebaseapp/.test(x)).length,0);assert.deepEqual(errors,[]);
});
