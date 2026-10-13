import {withoutSessionIsolation} from './session-isolation-scope.mjs';
import {withoutPersonalGoogleChanges} from './personal-google-scope.mjs';
import assert from 'node:assert/strict';
import {test, before, after} from 'node:test';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {rootDir, sha256} from './validate.mjs';
import {legalFiles, legalReviewStatus, legalNavigation, portalBeforeLegalSha256, withoutLegalNavigation, validateLegalPages} from './legal-pages.mjs';
import {prepareHosting} from './prepare-hosting.mjs';
import {verifyLegalPages} from './verify-legal-pages.mjs';

const html = readFileSync(join(rootDir,'index.html'),'utf8');
const {chromium} = await import(process.env.FORJA_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href : 'playwright');
let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));
after(async()=>browser?.close());

test('portal completo, scripts, CSS, API e formulários iguais ao main; somente navegação legal acrescentada',()=>{
  assert.equal(sha256(withoutPersonalGoogleChanges(withoutLegalNavigation(withoutSessionIsolation(html)))),portalBeforeLegalSha256);
  assert.throws(()=>withoutLegalNavigation(html+legalNavigation),/exatamente uma vez/);
  assert.throws(()=>withoutLegalNavigation(html.replace(legalNavigation,'')),/exatamente uma vez/);
});
test('artefato permite somente os arquivos públicos explícitos, sem documentos ou credenciais',t=>{
  const root=mkdtempSync(join(tmpdir(),'forja-legal-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const file of ['index.html','firebase.json','.firebaserc',...legalFiles]) {
    mkdirSync(dirname(join(root,file)),{recursive:true});copyFileSync(join(rootDir,file),join(root,file));
  }
  writeFileSync(join(root,'nao-publicar.json'),'documento privado de fixture');
  prepareHosting(root);
  const files=readdirSync(join(root,'.firebase-public'),{recursive:true}).filter(x=>x.includes('.')&&x!=='assets').sort();
  assert.deepEqual(files,['index.html',...legalFiles].sort());
  for(const file of legalFiles) assert.equal(sha256(readFileSync(join(root,'.firebase-public',file))),sha256(readFileSync(join(root,file))));
  writeFileSync(join(root,'privacidade/index.html'),readFileSync(join(root,'privacidade/index.html'),'utf8').replace('</body>','<script>console.log("injetado")</script></body>'));
  assert.throws(()=>validateLegalPages(root),/não executam scripts/);
});
test('verificação pública sem Authorization confere páginas reais e recusa fallback da SPA mesmo com HTTP 200',async()=>{
  const calls=[];
  const request=async(target,options)=>{
    calls.push({url:target.href,headers:options.headers});
    const file=legalFiles.find(file=>new URL(target).pathname==='/'+file.replace(/index\.html$/,''));
    assert.ok(file);
    return new Response(readFileSync(join(rootDir,file)),{status:200});
  };
  assert.equal((await verifyLegalPages('https://forja-legal-fixture.invalid',{request,attempts:1})).length,3);
  assert.ok(calls.every(c=>!Object.keys(c.headers).some(h=>h.toLowerCase()==='authorization')));
  await assert.rejects(verifyLegalPages('https://forja-legal-fixture.invalid',{request:async()=>new Response(html),attempts:1}),/fallback da SPA/);
  await assert.rejects(verifyLegalPages('https://forja-legal-fixture.invalid',{request:async()=>new Response('restrito',{status:401}),attempts:1}),/HTTP 401/);
});
test('aprovação temporária dos documentos não se torna definitiva nem remove o estado institucional',t=>{
  const root=mkdtempSync(join(tmpdir(),'forja-legal-status-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
  for(const file of legalFiles) {
    mkdirSync(dirname(join(root,file)),{recursive:true});copyFileSync(join(rootDir,file),join(root,file));
  }
  assert.equal(validateLegalPages(root).length,3);
  for(const [file,wrongStatuses] of [
    ['privacidade/index.html',['approved','pending']],
    ['termos/index.html',['approved','pending']],
  ]) {
    const original=readFileSync(join(root,file),'utf8');
    for(const status of wrongStatuses) {
      writeFileSync(join(root,file),original.replace(`data-legal-review="${legalReviewStatus[file]}"`,`data-legal-review="${status}"`));
      assert.throws(()=>validateLegalPages(root),/Status institucional incorreto/);
    }
    writeFileSync(join(root,file),original.replace(/data-legal-review="[^"]*"/,''));
    assert.throws(()=>validateLegalPages(root),/Status institucional incorreto/);
    writeFileSync(join(root,file),original);
  }
});
test('links e âncoras públicos navegam sem JavaScript; contato e links externos não iniciam OAuth',async t=>{
  const external=new Set(['https://developers.google.com/terms/api-services-user-data-policy','https://developers.google.com/workspace/workspace-api-user-data-developer-policy','https://myaccount.google.com/permissions']);
  for(const mobile of [false,true]) {
    const context=await browser.newContext({javaScriptEnabled:false,viewport:mobile?{width:390,height:844}:{width:1280,height:1000}});
    t.after(()=>context.close());
    const page=await context.newPage();
    await page.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.hostname!=='forja-legal-fixture.invalid')return route.abort();
      if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
      const file=legalFiles.find(f=>url.pathname==='/'+f.replace(/index\.html$/,''));
      return file?route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/html',body:readFileSync(join(rootDir,file))}):route.abort();
    });
    for(const name of ['privacidade','termos']) {
      const start=`https://forja-legal-fixture.invalid/${name}/`;
      await page.goto(start);
      const hrefs=await page.locator('a').evaluateAll(links=>[...new Set(links.map(a=>a.getAttribute('href')))]);
      for(const href of hrefs) {
        assert.ok(href);
        const target=new URL(href,start);
        assert.equal(target.username+target.password,'');
        if(target.protocol==='mailto:') {assert.equal(href,'mailto:adm@forjaescola.com.br');continue;}
        assert.equal(target.protocol,'https:');
        if(target.origin!==new URL(start).origin) {assert.ok(external.has(target.href));continue;}
        assert.ok(['/','/privacidade/','/termos/'].includes(target.pathname));
        assert.equal(target.search,'');
        await page.goto(start);
        const link=page.locator(`a[href="${href}"]`).first();
        await link.focus();await link.click();await page.waitForURL(target.href);
        if(target.hash)assert.ok(await page.evaluate(id=>Boolean(document.getElementById(id)),decodeURIComponent(target.hash.slice(1))));
        else if(target.pathname==='/')assert.equal(await page.locator('footer #forja-public-legal').count(),1);
        else assert.equal(await page.locator('[data-legal-review="temporary-approved"]').count(),1);
      }
    }
  }
});

for(const mobile of [false,true])for(const name of ['privacidade','termos'])test(`${mobile?'mobile':'desktop'} ${name}: público, legível, sem autenticação, scripts ou chamadas API`,async t=>{
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:1000},locale:'pt-BR'});
  t.after(()=>context.close());
  const page=await context.newPage(), requests=[], errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());requests.push(url.pathname);
    const file=legalFiles.find(file=>url.pathname==='/'+file.replace(/index\.html$/,''));
    if(url.hostname!=='forja-legal-fixture.invalid'||!file) return route.abort();
    return route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/html',body:readFileSync(join(rootDir,file))});
  });
  await page.goto(`https://forja-legal-fixture.invalid/${name}/`);
  await page.waitForFunction(()=>getComputedStyle(document.body).backgroundColor==='rgb(246, 247, 249)');
  assert.equal(await page.locator('h1').textContent(),name==='privacidade'?'Política de Privacidade':'Termos de Serviço');
  assert.equal(await page.locator(`[data-legal-review="${legalReviewStatus[name+'/index.html']}"]`).count(),1);
  assert.equal(await page.locator('script,iframe,form').count(),0);
  const sizes=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,main:document.querySelector('main').getBoundingClientRect().width,font:parseFloat(getComputedStyle(document.body).fontSize)}));
  assert.ok(!sizes.overflow);assert.ok(sizes.main<=(mobile?390:1280));assert.ok(sizes.font>=16);
  assert.deepEqual(requests.sort(),[`/${name}/`,'/assets/forja-legal.css'].sort());
  assert.deepEqual(errors,[]);
  const other=name==='privacidade'?'termos':'privacidade';
  await page.locator(`header a[href="/${other}/"]`).click();await page.waitForURL(`**/${other}/`);
  assert.equal(await page.locator(`[data-legal-review="${legalReviewStatus[other+'/index.html']}"]`).count(),1);
  if(process.env.FORJA_LEGAL_SCREENSHOTS) {
    mkdirSync(process.env.FORJA_LEGAL_SCREENSHOTS,{recursive:true});
    await page.goto(`https://forja-legal-fixture.invalid/${name}/`);
    await page.screenshot({path:join(process.env.FORJA_LEGAL_SCREENSHOTS,`${mobile?'mobile':'desktop'}-${name}.png`),fullPage:true});
  }
});
test('links do rodapé pertencem ao DOM público real do portal e navegam sem JavaScript',async t=>{
  for(const mobile of [false,true]) {
  const context=await browser.newContext({javaScriptEnabled:false,viewport:mobile?{width:390,height:844}:{width:1280,height:1000}});t.after(()=>context.close());
  const page=await context.newPage();
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
    const file=legalFiles.find(f=>url.pathname==='/'+f.replace(/index\.html$/,''));
    return file?route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/html',body:readFileSync(join(rootDir,file))}):route.abort();
  });
  await page.goto('https://forja-legal-fixture.invalid/');
  assert.equal(await page.locator('footer #forja-public-legal').count(),1);
  const layout=await page.locator('#forja-public-legal').evaluate(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,viewport:innerWidth,overflow:el.scrollWidth>el.clientWidth,color:getComputedStyle(el.querySelector('a')).color}));
  assert.ok(layout.left>0&&layout.right<layout.viewport&&!layout.overflow, 'Rodapé legal alinhado ao public-wrap em desktop/mobile.');
  assert.equal(layout.color,'rgb(255, 255, 255)');
  await page.locator('#forja-public-legal a[href="/privacidade/"]').click();
  await page.waitForURL('**/privacidade/');
  assert.equal(await page.locator('h1').textContent(),'Política de Privacidade');
  }
});
