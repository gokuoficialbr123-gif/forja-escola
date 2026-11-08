import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';
import {buildHostingArtifact} from './prepare-hosting.mjs';
import {performancePortal} from './helpers/performance-portal-fixture.mjs';

const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.FORJA_CHROMIUM_PATH})});
after(async()=>browser?.close());
const artifact=buildHostingArtifact();

for(const mobile of [false,true]) test('admin portal observes real status contract and requeues Sheets only, mobile='+mobile,async t=>{
  const f=await performancePortal({browser,bytes:artifact.bytes,resources:artifact.resources,mobile,requestDelay:0,secondaryDelay:0});
  t.after(()=>f.close());
  const calls=[];
  const summary={ok:true,controls:{configuration:true,reprocess:true},
    integrations:{sheets:{state:'falha',error:'SHEETS_API_INDISPONIVEL'},calendar:{state:'configurado'},
      n8n:{state:'desativado'},whatsapp:{state:'configuracao_pendente'}},
    metrics:{accepted:3,delivered:1,failed:2,pending:1},review:[]};
  await f.page.route('https://forja-api-m1kq.onrender.com/admin/automacao**',route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    const headers={'Access-Control-Allow-Origin':f.origin,'Access-Control-Allow-Headers':'authorization,content-type',
      'Access-Control-Allow-Methods':'GET,POST,PATCH'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    calls.push([path,req.method()]);
    const response=path.endsWith('/cadastros')?{ok:true,next:null,items:[
      {id:'TEST_UID',name:'Professor sintético',role:'teacher',active:true,sync:'falha',authorized:false,validPhone:true},
    ]}:req.method()==='POST'?{ok:true,status:'pendente'}:summary;
    return route.fulfill({status:req.method()==='POST'?202:200,headers,json:response});
  });
  await f.login();
  await f.page.waitForFunction(()=>state.profile?.role==='admin'&&!state.loading);
  assert.equal(await f.page.locator('#sideNav [data-page="automacao-aulas"]').count(),1);
  if(mobile){
    await f.page.evaluate(()=>mobileMore());
    await f.page.locator('#modal [data-mobile-page="automacao-aulas"]').click();
  }else await f.page.locator('#sideNav [data-page="automacao-aulas"]').click();
  await f.page.getByText('Professor sintético',{exact:true}).waitFor();
  assert.match(await f.page.locator('[data-auto-area]').innerText(),/Mensagens aceitas pela API/);
  assert.match(await f.page.locator('[data-auto-area]').innerText(),/Mensagens entregues/);
  await f.page.getByRole('button',{name:'Reprocessar Sheets'}).click();
  await f.page.waitForFunction(()=>document.body.textContent.includes('Reprocessamento do Sheets enfileirado.'));
  assert.deepEqual(calls.filter(([,method])=>method!=='GET'),[['/admin/automacao/cadastros/TEST_UID/reprocessar','POST']]);
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(f.errors,[]);
});

test('teacher navigation omits the administrative page and makes no automation request',async t=>{
  const f=await performancePortal({browser,bytes:artifact.bytes,resources:artifact.resources,role:'teacher',requestDelay:0,secondaryDelay:0});
  t.after(()=>f.close());
  await f.login();
  await f.page.waitForFunction(()=>state.role==='teacher'&&!state.loading);
  assert.equal(await f.page.locator('[data-page="automacao-aulas"]').count(),0);
  await f.page.evaluate(()=>navigate('automacao-aulas'));
  assert.notEqual(await f.page.evaluate(()=>state.page),'automacao-aulas');
  assert.equal(f.calls.some(call=>call.path.startsWith('/admin/automacao')),false);
});

test('public cancellation opens a single occurrence, strips fragment, and requires reason plus confirmation',async t=>{
  const f=await performancePortal({browser,bytes:artifact.bytes,resources:artifact.resources,mobile:true,requestDelay:0});
  t.after(()=>f.close());
  const token='a'.repeat(43), requests=[];
  const page=readFileSync(new URL('../cancelar/index.html',import.meta.url));
  await f.page.route(f.origin+'/cancelar/',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:page}));
  await f.page.route('https://forja-api-m1kq.onrender.com/cancelamento/**',route=>{
    const req=route.request();
    const headers={'Access-Control-Allow-Origin':f.origin,'Access-Control-Allow-Headers':'authorization,content-type',
      'Access-Control-Allow-Methods':'GET,POST'};
    if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
    requests.push([new URL(req.url()).pathname,req.method(),req.postDataJSON()]);
    assert.equal(req.headers().authorization,'Bearer '+token);
    const json=req.method()==='GET'?{aula:{aluno:'Aluno sintético',professor:'Professor sintético',inicio:'2026-12-02T17:00:00Z',cancelada:false}}:
      {ok:true,googleSyncStatus:'cancelamento_pendente'};
    return route.fulfill({headers,json});
  });
  await f.page.goto(f.origin+'/cancelar/#token='+token);
  await f.page.getByText('Aluno sintético',{exact:true}).waitFor();
  assert.equal(new URL(f.page.url()).hash,'');
  await f.page.getByRole('button',{name:'Confirmar desmarcação'}).click();
  assert.equal(requests.length,1);
  await f.page.getByLabel('Justificativa obrigatória').fill('Justificativa sintética');
  await f.page.getByRole('checkbox').check();
  await f.page.getByRole('button',{name:'Confirmar desmarcação'}).click();
  await f.page.getByText(/Cancelamento registrado/).waitFor();
  assert.deepEqual(requests,[['/cancelamento/aula','GET',null],['/cancelamento/confirmar','POST',{motivo:'Justificativa sintética',confirmacao:true}]]);
  assert.equal(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
});
