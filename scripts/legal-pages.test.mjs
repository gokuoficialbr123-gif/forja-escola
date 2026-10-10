import assert from 'node:assert/strict';
import {test, before, after} from 'node:test';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {rootDir, sha256} from './validate.mjs';
import {legalFiles, legalNavigation, portalBeforeLegalSha256, withoutLegalNavigation, validateLegalPages} from './legal-pages.mjs';
import {prepareHosting} from './prepare-hosting.mjs';
import {verifyLegalPages} from './verify-legal-pages.mjs';

const html = readFileSync(join(rootDir,'index.html'),'utf8');
const {chromium} = await import(process.env.FORJA_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href : 'playwright');
let browser;
before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));
after(async()=>browser?.close());

test('portal completo, scripts, CSS, API e formulários iguais ao main; somente navegação legal acrescentada',()=>{
  assert.equal(sha256(withoutLegalNavigation(html)),portalBeforeLegalSha256);
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
  assert.equal(await page.locator('[data-legal-review=pending]').count(),1);
  assert.equal(await page.locator('script,iframe,form').count(),0);
  const sizes=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,main:document.querySelector('main').getBoundingClientRect().width,font:parseFloat(getComputedStyle(document.body).fontSize)}));
  assert.ok(!sizes.overflow);assert.ok(sizes.main<=(mobile?390:1280));assert.ok(sizes.font>=16);
  assert.deepEqual(requests.sort(),[`/${name}/`,'/assets/forja-legal.css'].sort());
  assert.deepEqual(errors,[]);
  const other=name==='privacidade'?'termos':'privacidade';
  await page.locator(`header a[href="/${other}/"]`).click();await page.waitForURL(`**/${other}/`);
  assert.equal(await page.locator('[data-legal-review=pending]').count(),1);
  if(process.env.FORJA_LEGAL_SCREENSHOTS) {
    mkdirSync(process.env.FORJA_LEGAL_SCREENSHOTS,{recursive:true});
    await page.goto(`https://forja-legal-fixture.invalid/${name}/`);
    await page.screenshot({path:join(process.env.FORJA_LEGAL_SCREENSHOTS,`${mobile?'mobile':'desktop'}-${name}.png`),fullPage:true});
  }
});
test('links do rodapé pertencem ao DOM público real do portal e navegam sem JavaScript',async t=>{
  const context=await browser.newContext({javaScriptEnabled:false});t.after(()=>context.close());
  const page=await context.newPage();
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
    const file=legalFiles.find(f=>url.pathname==='/'+f.replace(/index\.html$/,''));
    return file?route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/html',body:readFileSync(join(rootDir,file))}):route.abort();
  });
  await page.goto('https://forja-legal-fixture.invalid/');
  assert.equal(await page.locator('footer #forja-public-legal').count(),1);
  await page.locator('#forja-public-legal a[href="/privacidade/"]').click();
  await page.waitForURL('**/privacidade/');
  assert.equal(await page.locator('h1').textContent(),'Política de Privacidade');
});
