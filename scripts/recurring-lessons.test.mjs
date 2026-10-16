import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test,before,after} from 'node:test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {withoutRecurringLessons} from './recurring-lessons-scope.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=['forja-v630-script','forja-recurring-lessons-script'].map(id=>html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))[1]).join('\n');
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));after(async()=>browser?.close());
async function fixture(t, { mobile = false, linksFail = false, portalSource = html } = {}) {
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 660 } : { width: 1100, height: 720 } });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.setContent('<div id="background" style="height:2200px"><button id="launch">Abrir</button><div class="v621-week-wrap" style="height:250px;overflow:auto"><div style="height:1800px">Calendário</div></div></div>');
  await page.evaluate(source => {
    // HTML parsing treats <script> contents as opaque text, including template
    // strings used by exportReport. Only real DOM styles affect this fixture.
    const portal = new DOMParser().parseFromString(source, 'text/html');
    document.head.replaceChildren(...[...portal.querySelectorAll('style')].map(el=>el.cloneNode(true)));
    const fixtureStyle=document.createElement('style');
    fixtureStyle.textContent='html,body{height:auto;overflow:visible;scroll-behavior:auto}body{min-height:2200px}';
    document.head.appendChild(fixtureStyle);
  }, portalSource);
  await page.evaluate(({ script, linksFail }) => {
    window.state = { role: 'admin', page: 'agenda', users: [
      { uid: 't1', fullName: 'Professor 1', role: 'teacher', active: true, disciplinaIds: ['math','science'] },
      { uid: 't2', fullName: 'Professor 2', role: 'teacher', active: true, disciplinaIds: ['math'] },
      { uid: 't3', fullName: 'Professor 3', role: 'teacher', active: true, disciplinaIds: ['science'] },
    ], students: [
      { uid: 's1', fullName: 'Aluno elegível', role: 'student', active: true, serieId: 'g1' },
      { uid: 's2', fullName: 'Aluno sem pacote', role: 'student', active: true, serieId: 'g1' },
      { uid: 's3', fullName: 'Aluno série errada', role: 'student', active: true, serieId: 'g2' },
      { uid: 's4', fullName: 'Aluno inativo', role: 'student', active: false, serieId: 'g1' },
      { uid: 's5', fullName: 'Aluno active ausente', role: 'student', serieId: 'g1' },
      { uid: 's6', fullName: 'Vínculo inativo', role: 'student', active: true, serieId: 'g1' },
      { uid: 's7', fullName: 'Outra matéria', role: 'student', active: true, serieId: 'g1' },
    ], subjects: [{ id:'math', nome:'Matemática', seriesIds:['g1'], active:true }, { id:'science', nome:'Ciências', seriesIds:[], active:true }], secretarySubjectLinksLoadedD:false };
    window.links = ['s1','s3','s4','s5','s6'].map(alunoId => ({ alunoId, disciplinaId:'math', status:alunoId === 's6' ? 'inativo':'ativo' }));
    links.push({ alunoId:'s7',disciplinaId:'science',status:'ativo' });
    window.pending = []; window.calls = []; window.renders = 0; window.messages = [];
    window.api = (url,options={}) => { calls.push({ url,method:options.method||'GET',body:options.body });
      if(url==='/admin/aluno-materias')return linksFail?Promise.reject(new Error('Pacotes indisponíveis')):Promise.resolve({items:links});
      return new Promise((resolve,reject)=>pending.push({url,resolve,reject}));
    };
    window.esc = v => String(v ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.$ = q => document.querySelector(q); window.$$ = q => [...document.querySelectorAll(q)];
    window.subjectLabel = id => state.subjects.find(s=>s.id===id)?.nome || id;
    window.googleProfessionalConnected = () => true;
    window.crypto.randomUUID ||= ()=> '11111111-1111-4111-8111-111111111111';window.todayKey = () => '2026-10-03'; window.fmtDate = v => v;
    window.bindPage = () => {}; window.polishPortalBlockE = () => {};
    window.renderPage = () => { renders++;const calendar=document.querySelector('.v621-week-wrap');calendar.replaceWith(calendar.cloneNode(true)); }; window.reloadAndRender = async () => renderPage();
    window.toast = (...args) => messages.push(args);
    window.setBusy = (button,busy) => {button.disabled=busy};
    window.studentSubjects = () => state.subjects; // The old permissive fallback must never run.
    document.querySelector('.v621-week-wrap').scrollTop=420;window.scrollTo(0,220);
    window.lessonSub=l=>l.dataAula;window.sessionUid='ADMIN_A';window.sessionEpoch=1;window.forjaCaptureSession=()=>({uid:sessionUid,generation:sessionEpoch});window.forjaSessionCurrent=s=>s.uid===sessionUid&&s.generation===sessionEpoch;(0,eval)(script); bindPage();
    document.querySelector('#launch').focus({preventScroll:true});
    document.querySelector('#v630EdgeTab').click();
  }, { script, linksFail });
  await page.waitForFunction(() => document.querySelector('#v631StudentHelp').textContent !== 'Pacotes ainda não validados.');
  await page.evaluate(() => {
    window.nodes = Object.fromEntries(['v630Teacher','v630Subject','v630Student','v630Date','v630Duration','v630Mode','v630Place','v630Meet','v631Slots'].map(id=>[id,document.getElementById(id)]));
    nodes.scroll=document.querySelector('.v630-drawer-scroll');nodes.drawer=document.querySelector('.v630-drawer');
    window.rootReplacements=0;
    new MutationObserver(records=>{rootReplacements+=records.filter(r=>r.target===nodes.drawer||r.target===nodes.scroll).length}).observe(nodes.drawer,{childList:true,subtree:true});
  });
  return page;
}
const policy='bounded-weekly-lessons-v1';
const result={policy,configurationFingerprint:'TEST_FINGERPRINT',count:3,canConfirm:true,occurrences:['2030-01-07','2030-01-14','2030-01-21'].map(date=>({date,status:'available'}))};
async function setup(t,options={}){const p=await fixture(t,options);await p.selectOption('#v630Subject','math');await p.selectOption('#v630Student','s1');await p.fill('#v630Date','2030-01-07');await p.locator('#v630Date').dispatchEvent('change');await p.fill('#v630Place','Sala sintética');await p.selectOption('#recurringMode','weekly');await p.fill('#recurringTime','13:33');await p.fill('#recurringEnd','2030-01-21');return p;}
async function respondRecurring(p,path,body){await p.evaluate(({path,body})=>{const q=pending.find(x=>x.url===path&&!x.done);if(!q)throw Error('missing '+path);q.done=true;q.resolve(body)},{path,body});}
async function reviewed(p,body=result){await p.click('#recurringValidate');await respondRecurring(p,'/aulas-recorrentes/validar',body);await p.waitForFunction(()=>!document.getElementById('recurringValidate').disabled);}
test('recurrence is a strictly scoped addition; previous portal bytes preserved',()=>assert.equal(createHash('sha256').update(withoutRecurringLessons(html)).digest('hex'),'1e3ba1324a73027d7a6c9b8b565338d86eca2424045a8fe308e02d844f7f0e69'));
for(const mobile of [false,true])test('weekly form '+(mobile?'mobile':'desktop')+': unchecked confirmation, exact input, review scroll and double click',async t=>{
 const p=await setup(t,{mobile});await reviewed(p);assert.equal(await p.isChecked('#recurringAccept'),false);assert.equal(await p.locator('#recurringSave').isDisabled(),true);assert.equal(await p.inputValue('#recurringTime'),'13:33');assert.equal(await p.locator('#recurringLessonForm').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
 const identity=await p.evaluate(()=>{window.savedDrawer=document.querySelector('.v630-drawer-scroll');savedDrawer.scrollTop=200;return savedDrawer.scrollTop;});
 await p.check('#recurringAccept');await p.click('#recurringSave');await p.evaluate(()=>document.getElementById('recurringSave').click());assert.equal(await p.evaluate(()=>calls.filter(x=>x.url==='/aulas-recorrentes').length),1);assert.equal(await p.isDisabled('#recurringTime'),true);assert.equal(await p.evaluate(()=>savedDrawer===document.querySelector('.v630-drawer-scroll')),true);
 const sent=await p.evaluate(()=>calls.find(x=>x.url==='/aulas-recorrentes').body);assert.equal(sent.horaAula,'13:33');assert.equal(sent.duration,60);assert.equal(sent.confirmation.accepted,true);assert.match(sent.bookingRequestId,/^[a-f0-9-]{36}$/);
 await respondRecurring(p,'/aulas-recorrentes',{bookingState:'created',seriesId:'recurring_TEST',items:[{id:'l1',dataAula:'2030-01-07',professorId:'t1',recurringSeriesId:'recurring_TEST'}],warnings:['Sincronização pendente.']});await p.waitForFunction(()=>!state.v630Booking.open);assert.equal(await p.evaluate(()=>state.lessons.some(x=>x.id==='l1')),true);
});
test('conflict/unavailable rows cannot confirm and editing invalidates review',async t=>{const p=await setup(t);await reviewed(p,{...result,canConfirm:false,occurrences:[{date:'2030-01-14',status:'unavailable',message:'Google não verificado'}]});assert.match(await p.locator('#recurringReview').innerText(),/Google não verificado/);await p.check('#recurringAccept');assert.equal(await p.isDisabled('#recurringSave'),true);await p.fill('#recurringEnd','2030-02-01');assert.equal(await p.isChecked('#recurringAccept'),false);assert.equal(await p.locator('[data-recurring-status]').count(),0);});
test('ambiguous response and in-progress retain immutable key and recover same request',async t=>{const p=await setup(t);await reviewed(p);await p.check('#recurringAccept');await p.click('#recurringSave');const first=await p.evaluate(()=>calls.find(x=>x.url==='/aulas-recorrentes').body);await p.evaluate(()=>{const q=pending.find(x=>x.url==='/aulas-recorrentes');q.done=true;q.reject(Object.assign(Error('in progress'),{status:409,code:'AGENDA_EM_PROCESSAMENTO',bookingState:'in_progress'}));});await p.waitForFunction(()=>document.getElementById('recurringSave').textContent.includes('Recuperar'));assert.equal(await p.isDisabled('#recurringMode'),true);await p.click('#recurringSave');assert.deepEqual(await p.evaluate(()=>calls.filter(x=>x.url==='/aulas-recorrentes')[1].body),first);await respondRecurring(p,'/aulas-recorrentes',{bookingState:'created',seriesId:'recurring_TEST',items:[]});});
test('definitive conflict preserves values, displays dates and permits a fresh review',async t=>{const p=await setup(t);await reviewed(p);await p.check('#recurringAccept');await p.click('#recurringSave');await p.evaluate(()=>pending.find(x=>x.url==='/aulas-recorrentes').reject(Object.assign(Error('Nenhuma aula criada'),{bookingState:'not_created',occurrences:[{date:'2030-01-14',status:'conflict',message:'Conflito do aluno'}]})));await p.waitForFunction(()=>!document.getElementById('recurringValidate').disabled);assert.match(await p.locator('#recurringReview').innerText(),/Conflito do aluno/);assert.equal(await p.inputValue('#recurringTime'),'13:33');assert.equal(await p.isDisabled('#recurringTime'),false);});
test('late response from previous UID/session cannot populate or close a new session',async t=>{const p=await setup(t);await p.evaluate(()=>state.lessons=[]);await p.click('#recurringValidate');await p.evaluate(()=>{sessionUid='PSYCHOLOGIST_B';sessionEpoch++;state.role='psychologist';});await respondRecurring(p,'/aulas-recorrentes/validar',result);await p.waitForTimeout(30);assert.equal(await p.locator('[data-recurring-status]').count(),0);assert.deepEqual(await p.evaluate(()=>state.lessons),[]);});
test('single option keeps original native confirmation and hides weekly-only inputs',async t=>{const p=await fixture(t);assert.equal(await p.inputValue('#recurringMode'),'none');assert.equal(await p.locator('#recurringFields').isVisible(),false);assert.equal(await p.locator('[data-v630-save]').isVisible(),true);assert.equal(await p.evaluate(()=>calls.some(x=>x.url.startsWith('/aulas-recorrentes'))),false);});
test('changed receipt recovers existing series through read-only lookup, without a new UUID',async t=>{const p=await setup(t);await reviewed(p);await p.check('#recurringAccept');await p.click('#recurringSave');const id='recurring_'+'a'.repeat(64);await p.evaluate(id=>pending.find(x=>x.url==='/aulas-recorrentes').reject(Object.assign(Error('changed'),{status:409,code:'RECURRING_REQUEST_CHANGED',seriesId:id,bookingState:'existing_request'})),id);await p.waitForFunction(id=>calls.some(x=>x.url==='/aulas-recorrentes/'+id),id);await respondRecurring(p,'/aulas-recorrentes/'+id,{id,items:[{id:'existing',dataAula:'2030-01-07'}]});await p.waitForFunction(()=>!state.v630Booking.open);assert.equal(await p.evaluate(()=>calls.filter(x=>x.url==='/aulas-recorrentes').length),1);});
test('late successful creation cannot inject lessons into the next session',async t=>{const p=await setup(t);await reviewed(p);await p.check('#recurringAccept');await p.click('#recurringSave');await p.evaluate(()=>{state.lessons=[];sessionUid='OTHER_UID';sessionEpoch++;state.role='teacher';});await respondRecurring(p,'/aulas-recorrentes',{bookingState:'created',seriesId:'OLD_UID_SERIES',items:[{id:'PRIVATE_OLD_LESSON'}]});await p.waitForTimeout(20);assert.deepEqual(await p.evaluate(()=>state.lessons),[]);});
test('Agenda reload failure after commit reports recovery warning, never retries creation',async t=>{const p=await setup(t);await reviewed(p);await p.check('#recurringAccept');await p.evaluate(()=>reloadAndRender=async()=>{throw Error('LOCAL_RELOAD_FAILURE')});await p.click('#recurringSave');await respondRecurring(p,'/aulas-recorrentes',{bookingState:'created',seriesId:'TEST',items:[{id:'COMMITTED'}]});await p.waitForFunction(()=>messages.some(x=>x[0].includes('Recarregue a Agenda sem criar outra série')));assert.equal(await p.evaluate(()=>state.lessons[0].id),'COMMITTED');assert.equal(await p.evaluate(()=>calls.filter(x=>x.url==='/aulas-recorrentes').length),1);});
test('navigation during an ambiguous creation retains UID/session key and unlocks recovery on the remounted drawer',async t=>{const p=await setup(t);await reviewed(p);await p.check('#recurringAccept');await p.click('#recurringSave');const original=await p.evaluate(()=>calls.find(x=>x.url==='/aulas-recorrentes').body);await p.evaluate(()=>{state.page='inicio';bindPage();state.page='agenda';bindPage();document.getElementById('v630EdgeTab').click();});await p.evaluate(()=>{const q=pending.find(x=>x.url==='/aulas-recorrentes');q.done=true;q.reject(Error('LOST_RESPONSE'));});await p.waitForFunction(()=>!document.getElementById('recurringSave').disabled);assert.equal(await p.inputValue('#recurringTime'),'13:33');assert.equal(await p.isDisabled('#recurringMode'),true);await p.click('#recurringSave');assert.deepEqual(await p.evaluate(()=>calls.filter(x=>x.url==='/aulas-recorrentes')[1].body),original);await respondRecurring(p,'/aulas-recorrentes',{bookingState:'created',seriesId:'TEST',items:[]});});
test('a new UID/generation never inherits a pending recurring body from the previous session',async t=>{const p=await setup(t);await reviewed(p);await p.check('#recurringAccept');await p.click('#recurringSave');await p.evaluate(()=>{state.page='inicio';bindPage();sessionUid='ADMIN_B';sessionEpoch++;state.page='agenda';bindPage();document.getElementById('v630EdgeTab').click();});assert.equal(await p.inputValue('#recurringMode'),'none');assert.equal(await p.isDisabled('#recurringMode'),false);assert.equal(await p.evaluate(()=>state.recurringBookingDraft.body),null);});
for(const mobile of [false,true])test('continuous '+(mobile?'mobile':'desktop')+': no end required, v2 authorization, bounded review, existing period preserved',async t=>{
 const p=await setup(t,{mobile});assert.deepEqual(await p.locator('#recurringMode option').evaluateAll(xs=>xs.map(x=>x.value)),['none','weekly','continuous']);
 await p.selectOption('#recurringMode','continuous');assert.equal(await p.locator('#recurringEnd').isVisible(),false);assert.match(await p.locator('#recurringExplanation').innerText(),/84 dias/);
 const preview={...result,policy:'rolling-weekly-lessons-v1',count:12,reservationWindowEnd:'2030-03-25'};await reviewed(p,preview);
 const sent=await p.evaluate(()=>calls.find(x=>x.url==='/aulas-recorrentes/validar').body);assert.equal(sent.endDate,null);assert.equal(sent.recurrenceMode,'continuous');assert.equal(await p.isChecked('#recurringAccept'),false);assert.match(await p.locator('#recurringReview').innerText(),/primeira reserva proposta até 2030-03-25/);
 await p.check('#recurringAccept');await p.click('#recurringSave');assert.equal(await p.evaluate(()=>calls.find(x=>x.url==='/aulas-recorrentes').body.confirmation.version),2);
 await respondRecurring(p,'/aulas-recorrentes',{bookingState:'created',seriesId:'TEST_CONTINUOUS',reservedThrough:'2030-03-25',items:[]});await p.waitForFunction(()=>messages.some(x=>x[0].includes('efetivamente reservadas até 2030-03-25')));
});
test('switching continuous back to period restores explicit end and v1 semantics',async t=>{
 const p=await setup(t);await p.selectOption('#recurringMode','continuous');await p.selectOption('#recurringMode','weekly');assert.equal(await p.inputValue('#recurringEnd'),'2030-01-21');assert.equal(await p.locator('#recurringEnd').isVisible(),true);await reviewed(p);assert.equal(await p.evaluate(()=>calls.find(x=>x.url==='/aulas-recorrentes/validar').body.recurrenceMode),undefined);await p.check('#recurringAccept');await p.click('#recurringSave');assert.equal(await p.evaluate(()=>calls.find(x=>x.url==='/aulas-recorrentes').body.confirmation.version),1);
});
test('continuous blocked automation is not simulated and cannot confirm',async t=>{
 const p=await setup(t);await p.selectOption('#recurringMode','continuous');await p.click('#recurringValidate');await p.evaluate(()=>pending.find(x=>x.url==='/aulas-recorrentes/validar').reject(Object.assign(Error('Automação não configurada; aula única e por período disponíveis.'),{status:503,bookingState:'not_created'})));await p.waitForFunction(()=>!document.getElementById('recurringValidate').disabled);assert.equal(await p.isDisabled('#recurringSave'),true);assert.match(await p.locator('#recurringFeedback').innerText(),/Automação não configurada/);
});
test('continuous operational listing shows only reserved through, blocked date and explicit safe end',async t=>{
 const p=await fixture(t),id='recurring_'+'a'.repeat(64);await p.evaluate(()=>window.confirm=()=>true);await p.click('#recurringListRefresh');
 const item={id,config:{professorId:'t1',alunoId:'s1',horaAula:'13:33'},continuousStatus:'blocked',reservedThrough:'2030-03-25',nextOccurrenceDate:'2030-04-01',lastBlock:{date:'2030-04-01',message:'Google não verificado'}};
 await respondRecurring(p,'/aulas-recorrentes',{automation:{ready:true},items:[item]});await p.waitForFunction(()=>!!document.querySelector('[data-series-id]'));assert.match(await p.locator('#recurringSeriesList').innerText(),/Reservado até 2030-03-25.*2030-04-01/s);
 await p.getByText('Encerrar próximas extensões',{exact:true}).click();assert.deepEqual(await p.evaluate(()=>calls.find(x=>x.url.endsWith('/encerrar')).body),{accepted:true});await respondRecurring(p,'/aulas-recorrentes/'+id+'/encerrar',{ok:true,existingLessonsPreserved:true});await p.waitForFunction(()=>calls.filter(x=>x.url==='/aulas-recorrentes').length===2);await respondRecurring(p,'/aulas-recorrentes',{automation:{ready:true},items:[{...item,continuousStatus:'ended'}]});await p.waitForFunction(()=>!document.querySelector('#recurringSeriesList button'));assert.match(await p.locator('#recurringSeriesList').innerText(),/Encerrado/);assert.equal(await p.evaluate(()=>calls.some(x=>x.method==='DELETE')),false);
});
test('late continuous list cannot leak into another UID/session',async t=>{
 const p=await fixture(t);await p.click('#recurringListRefresh');await p.evaluate(()=>{sessionUid='OTHER_ADMIN';sessionEpoch++;});await respondRecurring(p,'/aulas-recorrentes',{items:[{id:'PRIVATE_SERIES'}],automation:{ready:true}});await p.waitForTimeout(20);assert.equal(await p.locator('#recurringSeriesList').innerText(),'');
});
