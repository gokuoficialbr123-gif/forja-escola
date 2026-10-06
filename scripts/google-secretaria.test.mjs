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
async function fixture(t,{mobile=false,role='admin',active=true,connected=false,error=false,configured=true,unsafeUrl=false,reauth=false,calendars=[],ageMs=0,refreshStatus='success',calendarError=false,initialPage='configuracoes',revision=1,oauthReturn=false,freeBusySupported=false,freeBusyAuthorized=false,previewStorage=null,previewApi=false}={}){
 const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});t.after(()=>page.close());
 await page.route('**/*',r=>r.abort());
 if(oauthReturn){await page.route('https://forja-fixture.invalid/**',r=>r.fulfill({contentType:'text/html',body:'<main id="settings"></main><div id="feedback" role="status"></div>'}));await page.goto('https://forja-fixture.invalid/?googleSecretaria=connected')}
 else await page.setContent('<main id="settings"></main><div id="feedback" role="status"></div>');
 await page.evaluate(({html,role,active,connected,error,configured,unsafeUrl,reauth,calendars,base,ageMs,refreshStatus,calendarError,initialPage,revision,freeBusySupported,freeBusyAuthorized,previewStorage,previewApi})=>{
  const parsed=new DOMParser().parseFromString(html,'text/html');
  for(const original of parsed.querySelectorAll('style')){const style=document.createElement('style');style.textContent=original.textContent;document.head.appendChild(style)}
  const code=parsed.getElementById('forja-google-secretaria-script')?.textContent;if(!code)throw Error('Central script missing');
  if(previewApi)window.FORJA_API_URL='https://forja-api-pr-6.onrender.com';
  window.state={role,profile:{active},user:{uid:'LOCAL_ADMIN'},page:initialPage};window.calls=[];
  window.esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  window.fmtDateTime=()=> '04/10/2026 12:00';window.$$=s=>[...document.querySelectorAll(s)];
  window.setBusy=(b,v)=>{if(b)b.disabled=v};window.toast=x=>document.getElementById('feedback').textContent=x;
  window.confirm=()=>true;window.settingsPage=()=>'<section id="personal">Conexões dos profissionais</section>';
  window.loadRoleData=async()=>{};window.bindPage=()=>{};
  window.provider={previewStorage,freeBusySupported,freeBusyAuthorized,busyMode:'success',connected,error,configured,unsafeUrl,reauth,calendars,calendarError,lastRefreshStatus:refreshStatus,lastRefreshAt:{seconds:(Date.now()-ageMs)/1000},revision};
  const teachers=[{id:'TEACHER_A',fullName:'Professor A',role:'teacher',active:true},{id:'TEACHER_B',fullName:'Professor B',role:'teacher',active:true},{id:'TEACHER_INACTIVE',fullName:'Inativo',role:'teacher',active:false},{id:'PSYCH',fullName:'Psicólogo',role:'psychologist',active:true}];
  const calendarData=()=>({connected:provider.connected,requiresReauthorization:provider.reauth,items:provider.calendars,teachers,lastRefreshStatus:provider.lastRefreshStatus,lastRefreshAt:provider.lastRefreshAt,connectionRevision:provider.revision});
  window.api=async(path,options={})=>{
   calls.push({path,method:options.method||'GET',body:options.body});
   if(path===base+'/status'){
    if(provider.error)throw Error('TEST_ONLY_CREDENTIAL_IN_ERROR');
    return {storage:provider.previewStorage,configured:provider.configured,policy:'calendarlist-association-v2',...(provider.freeBusySupported?{freeBusyPolicy:'central-freebusy-query-v1'}:{}),item:{connected:provider.connected,requiresReauthorization:provider.reauth,freeBusyAuthorized:provider.freeBusyAuthorized,maskedEmail:provider.connected?'s***@f***.example':'',lastStatusAt:'2026-10-04T15:00:00Z'}};
   }
   if(path===base+'/calendars')return calendarData();
   if(path===base+'/calendars/refresh'){
    if(provider.refreshGate)await provider.refreshGate;
    if(provider.calendarError){provider.lastRefreshStatus='error';provider.calendars.forEach(x=>x.effectiveEnabled=false);throw Error('PRIVATE_TEST_GOOGLE_ERROR')}
    provider.lastRefreshStatus='success';provider.lastRefreshAt={seconds:Date.now()/1000};return calendarData();
   }
   if(path.startsWith(base+'/calendars/')&&options.method==='PATCH'){
    const row=provider.calendars.find(x=>path.endsWith('/'+x.id));if(!row)throw Error('Missing calendar');
    if(options.body.teacherId!==undefined){
     if(provider.calendars.some(x=>x!==row&&x.teacherId===options.body.teacherId&&options.body.teacherId))throw Error('Este professor já está associado a outro calendário. Remova o vínculo anterior antes de associar.');
     row.teacherId=options.body.teacherId;row.enabled=false;
    }
    if(options.body.enabled!==undefined)row.enabled=options.body.enabled;
    row.effectiveEnabled=row.enabled&&row.accessStatus==='accessible';return calendarData();
   }
   if(path===base+'/freebusy'){
    if(provider.busyGate)await provider.busyGate;
    if(provider.busyMode==='error')throw Error('PRIVATE_TEST_GOOGLE_ERROR_WITH_TOKEN');
    const unavailable=provider.busyMode==='unavailable',ignored=provider.busyMode==='ignored';
    return {policy:provider.busyMode==='old-policy'?'OLD_POLICY':'central-freebusy-query-v1',status:unavailable?'unavailable':ignored?'ignored':'success',complete:!unavailable,timeMin:options.body.timeMin,timeMax:options.body.timeMax,timeZone:'America/Sao_Paulo',checkedAt:'2026-10-05T18:00:00Z',items:[{teacherId:'TEACHER_A',status:unavailable?'unavailable':ignored?'ignored':'success',reason:ignored?'disabled':'PRIVATE_REASON',...(unavailable||ignored?{}:{busy:provider.busyMode==='empty'?[]:[{start:new Date(Date.parse(options.body.timeMin)+13*3600000+33*60000).toISOString(),end:new Date(Date.parse(options.body.timeMin)+14*3600000+44*60000).toISOString(),label:'Ocupado',summary:'PRIVATE_EVENT_TITLE'}]}),description:'PRIVATE_EVENT_DESCRIPTION'}],access_token:'PRIVATE_TEST_TOKEN'};
   }
   if(path===base+'/disconnect'){provider.connected=false;return {ok:true}}
   if(path===base+'/connect'){if(window.onConnect)await window.onConnect(options.body);return {authUrl:provider.unsafeUrl?'https://attacker.invalid/':'https://accounts.google.com/o/oauth2/v2/auth?scope='+encodeURIComponent('openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly'+(options.body?.purpose==='central-freebusy-v1'?' https://www.googleapis.com/auth/calendar.events.freebusy':''))+'&state=TEST_ONLY_STATE'};}
   throw Error('Unexpected personal/Calendar endpoint');
  };
  (0,eval)(code);
 },{html,role,active,connected,error,configured,unsafeUrl,reauth,calendars,base,ageMs,refreshStatus,calendarError,initialPage,revision,freeBusySupported,freeBusyAuthorized,previewStorage,previewApi});
 await page.evaluate(async()=>{await loadRoleData();document.getElementById('settings').innerHTML=settingsPage();bindPage()});
 await page.waitForFunction(()=>!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
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
  const calls=await page.evaluate(()=>calls);assert.deepEqual(calls.map(x=>x.path),[base+'/status',base+'/calendars',base+'/disconnect',base+'/status']);
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
  state.page='inicio';bindPage();state.page='configuracoes';bindPage();
 });
 await page.waitForFunction(()=>window.resolveStatus!==null);
 await page.evaluate(async()=>{
  state.role='teacher';state.user={uid:'LOCAL_TEACHER'};
  resolveStatus({configured:true,policy:'calendarlist-association-v2',...(provider.freeBusySupported?{freeBusyPolicy:'central-freebusy-query-v1'}:{}),item:{connected:true,maskedEmail:'a***@f***.invalid'}});
  await Promise.resolve();document.getElementById('settings').innerHTML=settingsPage();bindPage();
 });
 assert.equal(await page.locator('#googleSecretariaCard').count(),0);
 assert.ok(!(await page.locator('body').textContent()).includes('a***@'));
});
for(const mobile of [false,true])test(`connect ${mobile?'mobile':'desktop'} follows only CalendarList-only Google authorization`,async t=>{
 const page=await fixture(t,{mobile});
 const navigation=page.waitForRequest(r=>r.url().startsWith('https://accounts.google.com/'));
 await page.click('[data-secretaria-google=connect]');
 const request=await navigation,url=new URL(request.url());
 assert.equal(url.origin,'https://accounts.google.com');assert.equal(url.searchParams.get('scope'),'openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly');
});
test('cancel disconnect preserves central and personal cards without writes',async t=>{
 const page=await fixture(t,{connected:true});await page.evaluate(()=>window.confirm=()=>false);
 await page.click('[data-secretaria-google=disconnect]');
 assert.deepEqual(await page.evaluate(()=>calls.map(x=>x.path)),[base+'/status',base+'/calendars']);
 assert.equal(await page.locator('#googleSecretariaCard .status').textContent(),'Conectado');
 assert.equal(await page.locator('#personal').count(),1);
});
const calendar=(id,patch={})=>({id:id.repeat(64),displayName:'Calendário '+id,accessRole:'reader',primary:false,teacherId:'',enabled:false,effectiveEnabled:false,accessStatus:'accessible',...patch});
for(const mobile of [false,true])test(`CalendarList ${mobile?'mobile':'desktop'}: explicit association, enable/disable and safe display`,async t=>{
 const page=await fixture(t,{mobile,connected:true,calendars:[calendar('a',{primary:true,accessRole:'owner'}),calendar('b')]});
 assert.equal(await page.locator('.central-calendar').count(),2);
 assert.match(await page.locator('.central-calendar').nth(0).textContent(),/Principal/);assert.match(await page.locator('.central-calendar').nth(1).textContent(),/Compartilhado/);
 const first=page.locator('.central-calendar').nth(0),select=first.locator('select'),toggle=first.locator('input[type=checkbox]');
 assert.equal(await select.locator('option').count(),3);assert.equal(await toggle.isDisabled(),true);
 await select.selectOption('TEACHER_A');assert.equal(await page.evaluate(()=>calls.filter(x=>x.method==='PATCH').length),0);
 await first.locator('[data-central-associate]').click();
 await page.waitForFunction(()=>state.googleSecretaria.calendars[0].teacherId==='TEACHER_A');
 assert.equal(await first.locator('input').isChecked(),false);
 await first.locator('input').check();await page.waitForFunction(()=>state.googleSecretaria.calendars[0].enabled);
 await first.locator('input').uncheck();await page.waitForFunction(()=>!state.googleSecretaria.calendars[0].enabled);
 await first.locator('select').selectOption('TEACHER_B');await first.locator('[data-central-associate]').click();
 await page.waitForFunction(()=>state.googleSecretaria.calendars[0].teacherId==='TEACHER_B');
 assert.equal(await first.locator('input').isChecked(),false);
 const bounds=await first.boundingBox();assert.ok(bounds.width<=(mobile?390:1280));
 assert.ok((await page.evaluate(()=>calls)).every(x=>x.path.startsWith(base)));
});
test('old scope prompts reauthorization and disables refresh without losing saved configuration',async t=>{
 const page=await fixture(t,{connected:true,reauth:true,calendars:[calendar('a',{teacherId:'TEACHER_A',enabled:true})]});
 assert.match(await page.locator('#googleSecretariaCard').textContent(),/Reconecte a conta central para autorizar/);
 assert.equal(await page.locator('[data-secretaria-google=calendars]').isDisabled(),true);
 assert.equal(await page.locator('[data-secretaria-google=connect]').textContent(),'Reconectar');
 assert.equal(await page.locator('.central-calendar select').inputValue(),'TEACHER_A');
 assert.equal(await page.locator('.central-calendar input').isChecked(),true);
});
test('lost access never hides association or becomes free; explicit disable remains available',async t=>{
 const page=await fixture(t,{connected:true,calendars:[calendar('a',{teacherId:'TEACHER_A',enabled:true,accessStatus:'removed'}),calendar('b',{accessStatus:'no_permission'})]});
 assert.match(await page.locator('.central-calendar').nth(0).textContent(),/Não está mais na lista Google/);
 assert.match(await page.locator('.central-calendar').nth(1).textContent(),/Sem permissão/);
 assert.equal(await page.locator('.central-calendar').nth(0).locator('select').inputValue(),'TEACHER_A');
 assert.equal(await page.locator('.central-calendar').nth(1).locator('input').isDisabled(),true);
 await page.locator('.central-calendar').nth(0).locator('input').uncheck();
 await page.waitForFunction(()=>!state.googleSecretaria.calendars[0].enabled);
});
test('refresh failures preserve rows, show persistent warning and hide provider errors',async t=>{
 const page=await fixture(t,{connected:true,calendars:[calendar('a',{teacherId:'TEACHER_A',enabled:true,effectiveEnabled:true})]});
 await page.evaluate(()=>provider.calendarError=true);await page.click('[data-secretaria-google=calendars]');
 await page.waitForFunction(()=>state.googleSecretaria.lastRefreshStatus==='error'&&!state.googleSecretaria.listLoading);
 assert.equal(await page.locator('.central-calendar').count(),1);
 assert.match(await page.locator('#googleSecretariaCard').textContent(),/uso estão suspensos/);
 assert.ok(!(await page.locator('body').textContent()).includes('PRIVATE_TEST_GOOGLE_ERROR'));
});
test('duplicate association gives clear feedback; calendar display is escaped',async t=>{
 const page=await fixture(t,{connected:true,calendars:[calendar('a',{teacherId:'TEACHER_A'}),calendar('b',{displayName:'<img src=x onerror=alert(1)>'})]});
 assert.equal(await page.locator('.central-calendar img').count(),0);
 const second=page.locator('.central-calendar').nth(1);
 await second.locator('select').selectOption('TEACHER_A');await second.locator('[data-central-associate]').click();
 await page.waitForFunction(()=>document.querySelector('#feedback').textContent.includes('já está associado'));
 assert.equal(await second.locator('select').inputValue(),'');
});

for(const mobile of [false,true])test(`automatic CalendarList ${mobile?'mobile':'desktop'}: stale view refreshes once, fresh reopen skips and manual forces`,async t=>{
 const page=await fixture(t,{mobile,connected:true,ageMs:301000,calendars:[calendar('a')]});
 let refreshes=await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/calendars/refresh')));assert.equal(refreshes.length,1);assert.deepEqual(refreshes[0].body,{automatic:true});
 await page.evaluate(()=>{bindPage();bindPage();state.page='agenda';state.page='configuracoes';bindPage()});
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/calendars/refresh')).length),1);
 await page.click('[data-secretaria-google=calendars]');await page.waitForFunction(()=>!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
 refreshes=await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/calendars/refresh')));assert.equal(refreshes.length,2);assert.deepEqual(refreshes[1].body,{});
});
test('freshness expires on next view opening, without any background timer',async t=>{
 const page=await fixture(t,{connected:true,ageMs:60000,calendars:[calendar('a')]});
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),0);
 await page.evaluate(()=>{provider.lastRefreshAt={_seconds:(Date.now()-301000)/1000};state.page='inicio';bindPage();state.page='configuracoes';bindPage()});
 await page.waitForFunction(()=>!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),1);
});
test('stale list refreshes only in Secretaria settings, never on Agenda or background role load',async t=>{
 const page=await fixture(t,{connected:true,ageMs:301000,initialPage:'agenda',calendars:[calendar('a')]});
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),0);
 await page.evaluate(()=>{state.page='configuracoes';bindPage()});await page.waitForFunction(()=>!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),1);
});
test('successful OAuth return invalidates old freshness and automatically loads list for the new connection',async t=>{
 const page=await fixture(t,{connected:true,ageMs:0,refreshStatus:'not_refreshed',revision:2,initialPage:'agenda',oauthReturn:true,calendars:[calendar('a')]});
 assert.equal(await page.evaluate(()=>state.page),'configuracoes');assert.equal(new URL(page.url()).searchParams.has('googleSecretaria'),false);
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),1);
});
test('automatic failure preserves associations and enabled intent, suppresses repeat attempts and manual retry still works',async t=>{
 const page=await fixture(t,{connected:true,ageMs:301000,calendarError:true,calendars:[calendar('a',{teacherId:'TEACHER_A',enabled:true,effectiveEnabled:true})]});
 assert.equal(await page.locator('.central-calendar').count(),1);assert.equal(await page.locator('.central-calendar select').inputValue(),'TEACHER_A');assert.equal(await page.locator('.central-calendar input').isChecked(),true);
 assert.equal(await page.evaluate(()=>state.googleSecretaria.calendars[0].accessStatus),'accessible');assert.equal(await page.evaluate(()=>state.googleSecretaria.calendars[0].effectiveEnabled),false);
 assert.match(await page.locator('#googleSecretariaCard').textContent(),/uso estão suspensos/);assert.ok(!(await page.locator('body').textContent()).includes('PRIVATE_TEST_GOOGLE_ERROR'));
 await page.evaluate(async()=>{bindPage();bindPage();await loadRoleData();bindPage()});
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),1);
 await page.evaluate(()=>provider.calendarError=false);await page.click('[data-secretaria-google=calendars]');await page.waitForFunction(()=>!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),2);assert.equal(await page.evaluate(()=>state.googleSecretaria.lastRefreshStatus),'success');
});
test('automatic refresh never runs without a configured, connected and authorized account',async t=>{
 for(const opts of [{connected:false},{connected:true,reauth:true},{connected:true,configured:false}]){
  const page=await fixture(t,{...opts,ageMs:301000,calendars:[calendar('a')]});assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),0);
 }
});
test('in-flight automatic refresh is shared by rebindings and cannot expose data after switching profile',async t=>{
 const page=await fixture(t,{connected:true,calendars:[calendar('a')]});
 await page.evaluate(()=>{provider.refreshGate=new Promise(resolve=>window.finishRefresh=resolve);provider.lastRefreshAt={seconds:(Date.now()-301000)/1000};state.page='inicio';bindPage();state.page='configuracoes';bindPage();bindPage();bindPage()});
 await page.waitForFunction(()=>state.googleSecretaria.listLoading);
 assert.equal(await page.evaluate(()=>calls.filter(x=>x.path.endsWith('/refresh')).length),1);
 await page.evaluate(async()=>{state.role='teacher';state.user={uid:'LOCAL_TEACHER'};document.getElementById('settings').innerHTML=settingsPage();finishRefresh()});
 assert.equal(await page.locator('#googleSecretariaCard').count(),0);assert.ok(!(await page.locator('body').textContent()).includes('Calendário a'));
});

test('automatic failure plus failed recovery read preserves the visible list and suspends effective use',async t=>{
 const page=await fixture(t,{connected:true,calendars:[calendar('a',{teacherId:'TEACHER_A',enabled:true,effectiveEnabled:true})]});
 await page.evaluate(()=>{const previous=api;window.api=(path,options)=>{if(path.endsWith('/calendars')&&calls.some(x=>x.path.endsWith('/refresh')))throw Error('PRIVATE_TEST_RECOVERY_ERROR');return previous(path,options)};provider.calendarError=true;provider.lastRefreshAt={seconds:(Date.now()-301000)/1000};state.page='inicio';bindPage();state.page='configuracoes';bindPage()});
 await page.waitForFunction(()=>!state.googleSecretaria.loading&&!state.googleSecretaria.listLoading);
 assert.equal(await page.locator('.central-calendar').count(),1);assert.equal(await page.locator('.central-calendar select').inputValue(),'TEACHER_A');assert.equal(await page.locator('.central-calendar input').isChecked(),true);
 assert.equal(await page.evaluate(()=>state.googleSecretaria.calendars[0].effectiveEnabled),false);assert.equal(await page.evaluate(()=>state.googleSecretaria.calendars[0].accessStatus),'accessible');
 assert.match(await page.locator('#googleSecretariaCard').textContent(),/uso estão suspensos/);assert.ok(!(await page.locator('body').textContent()).includes('PRIVATE_TEST'));
});

for(const mobile of [false,true])test(`freeBusy ${mobile?'mobile':'desktop'}: explicit consent preserves CalendarList until grant`,async t=>{
 const page=await fixture(t,{mobile,connected:true,freeBusySupported:true});
 assert.equal(await page.locator('[data-secretaria-google=authorize-busy]').count(),1);assert.equal(await page.locator('[data-secretaria-google=busy]').count(),0);
 assert.ok(!(await page.evaluate(()=>calls)).some(x=>x.path===base+'/freebusy'));
 let body;await page.exposeFunction('onConnect',value=>body=value);const navigation=page.waitForRequest(r=>r.url().startsWith('https://accounts.google.com/'));await page.click('[data-secretaria-google=authorize-busy]');
 const url=new URL((await navigation).url());assert.equal(url.searchParams.get('scope'),'openid email https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.freebusy');
 assert.deepEqual(body,{purpose:'central-freebusy-v1'});
});
for(const mobile of [false,true])test(`freeBusy ${mobile?'mobile':'desktop'}: on-demand query is private, bounded and separate from Agenda`,async t=>{
 const page=await fixture(t,{mobile,connected:true,freeBusySupported:true,freeBusyAuthorized:true});
 assert.ok(!(await page.evaluate(()=>calls)).some(x=>x.path===base+'/freebusy'));
 await page.locator('[data-central-busy=from]').fill('2026-10-04');await page.locator('[data-central-busy=to]').fill('2026-10-04');await page.locator('[data-central-busy=teacher]').selectOption('TEACHER_A');
 await page.click('[data-secretaria-google=busy]');await page.waitForFunction(()=>!state.googleSecretaria.freeBusyLoading&&state.googleSecretaria.busyResult);
 const call=await page.evaluate(()=>calls.find(x=>x.path.endsWith('/freebusy')));assert.deepEqual(call.body,{timeMin:'2026-10-04T03:00:00.000Z',timeMax:'2026-10-05T03:00:00.000Z',teacherIds:['TEACHER_A']});
 assert.match(await page.locator('#centralFreeBusyResults').textContent(),/Ocupado/);
 const result=await page.evaluate(()=>state.googleSecretaria.busyResult);assert.deepEqual(result.items[0].busy,[{start:'2026-10-04T16:33:00.000Z',end:'2026-10-04T17:44:00.000Z',label:'Ocupado'}]);assert.ok(!JSON.stringify(result).includes('PRIVATE'));
 assert.ok(!(await page.locator('#googleSecretariaCard').textContent()).includes('PRIVATE'));
 const bounds=await page.locator('.central-freebusy').boundingBox();assert.ok(bounds.width<=(mobile?390:1280));assert.equal(await page.locator('#personal').count(),1);
});
for(const mode of ['unavailable','ignored','empty','error','old-policy'])test('freeBusy UI handles '+mode+' without claiming available',async t=>{
 const page=await fixture(t,{connected:true,freeBusySupported:true,freeBusyAuthorized:true});await page.evaluate(mode=>provider.busyMode=mode,mode);await page.click('[data-secretaria-google=busy]');
 await page.waitForFunction(()=>!state.googleSecretaria.freeBusyLoading);const text=await page.locator('#centralFreeBusyResults').textContent();assert.ok(!text.includes('PRIVATE'));
 if(mode==='empty')assert.match(text,/Nenhum ocupado retornado/);else if(mode==='ignored')assert.match(text,/Ignorado/);else assert.match(text,/indisponível|Não foi possível/);
 assert.ok(!text.includes('Disponível'));assert.ok(!text.includes('Nenhum horário disponível'));
});
test('freeBusy request does not repeat while pending; changing calendar config clears previous result',async t=>{
 const page=await fixture(t,{connected:true,freeBusySupported:true,freeBusyAuthorized:true});
 await page.evaluate(()=>{provider.busyGate=new Promise(r=>window.releaseBusy=r)});await page.click('[data-secretaria-google=busy]');
 await page.evaluate(()=>document.querySelector('[data-secretaria-google=busy]').click());assert.equal((await page.evaluate(()=>calls)).filter(x=>x.path.endsWith('/freebusy')).length,1);
 await page.evaluate(()=>releaseBusy());await page.waitForFunction(()=>!state.googleSecretaria.freeBusyLoading);assert.ok(await page.evaluate(()=>state.googleSecretaria.busyResult));
 await page.click('[data-secretaria-google=calendars]');await page.waitForFunction(()=>!state.googleSecretaria.listLoading);assert.equal(await page.evaluate(()=>state.googleSecretaria.busyResult),null);
});
test('freeBusy invalid window is stopped before any provider call',async t=>{
 const page=await fixture(t,{connected:true,freeBusySupported:true,freeBusyAuthorized:true});await page.locator('[data-central-busy=from]').fill('2026-10-01');await page.locator('[data-central-busy=to]').fill('2026-12-01');await page.click('[data-secretaria-google=busy]');
 await page.waitForFunction(()=>!state.googleSecretaria.freeBusyLoading);assert.match(await page.locator('#centralFreeBusyResults').textContent(),/31 dias/);assert.ok(!(await page.evaluate(()=>calls)).some(x=>x.path.endsWith('/freebusy')));
});
test('late freeBusy response cannot expose intervals after role switch',async t=>{
 const page=await fixture(t,{connected:true,freeBusySupported:true,freeBusyAuthorized:true});await page.evaluate(()=>{provider.busyGate=new Promise(r=>window.releaseBusy=r)});await page.click('[data-secretaria-google=busy]');
 await page.evaluate(async()=>{state.role='teacher';state.profile.active=true;state.user={uid:'OTHER'};await loadRoleData();document.getElementById('settings').innerHTML=settingsPage();bindPage();releaseBusy()});await page.evaluate(async()=>{await Promise.resolve();await Promise.resolve()});
 assert.equal(await page.locator('#googleSecretariaCard').count(),0);assert.equal(await page.evaluate(()=>state.googleSecretaria.busyResult),null);
});


for(const mobile of [false,true])test('isolated Preview central card is explicit and starts empty '+(mobile?'mobile':'desktop'),async t=>{
 const page=await fixture(t,{mobile,previewApi:true,previewStorage:{policy:'central-preview-isolation-v1',environment:'preview',namespace:'pr-6',ready:true,personalGoogleEnabled:false}});
 assert.match(await page.locator('#googleSecretariaCard').textContent(),/Ambiente de teste · pr-6/);
 assert.equal(await page.locator('[data-secretaria-google=connect]').isDisabled(),false);
 assert.deepEqual(await page.evaluate(()=>calls.map(x=>x.path)),[base+'/status']);
});
for(const storage of [null,{policy:'central-preview-isolation-v1',environment:'production',namespace:'production',ready:true,personalGoogleEnabled:true},{policy:'central-preview-isolation-v1',environment:'preview',namespace:'pr-6',ready:false,personalGoogleEnabled:false},{policy:'central-preview-isolation-v1',environment:'preview',namespace:'pr-5',ready:true,personalGoogleEnabled:false}])test('Preview refuses unsafe storage '+JSON.stringify(storage),async t=>{
 const page=await fixture(t,{previewApi:true,previewStorage:storage,connected:true,freeBusySupported:true,freeBusyAuthorized:true});
 assert.equal(await page.locator('[data-secretaria-google=connect]').isDisabled(),true);
 assert.equal(await page.locator('[data-secretaria-google=disconnect]').count(),0);
 assert.equal(await page.locator('[data-secretaria-google=busy]').count(),0);
 assert.ok(!(await page.locator('#googleSecretariaCard').textContent()).includes('s***@'));
 assert.deepEqual(await page.evaluate(()=>calls.map(x=>x.path)),[base+'/status']);
});


test('production status failure preserves prior connection while disabling actions, as in Etapa2',async t=>{
 const page=await fixture(t,{connected:true});
 await page.evaluate(async()=>{provider.error=true;await loadRoleData()});
 const g=await page.evaluate(()=>state.googleSecretaria);assert.equal(g.item.connected,true);assert.equal(g.configured,true);assert.ok(g.error);
 assert.match(await page.locator('#googleSecretariaCard').textContent(),/s\*\*\*@f\*\*\*.example/);
 assert.equal(await page.locator('[data-secretaria-google=connect]').isDisabled(),true);
});
