import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Execute the actual release code in Chromium; fixtures never contact Firebase or Render.
const modulePath = process.env.FORJA_PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(resolve(modulePath)).href : 'playwright');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const script = html.match(/<script id="forja-v630-script">([\s\S]*?)<\/script>/)[1];

let browser;
before(async () => { browser = await chromium.launch({ headless: true, ...(process.env.FORJA_CHROMIUM_PATH ? { executablePath: process.env.FORJA_CHROMIUM_PATH } : {}) }); });
after(async () => { await browser?.close(); });

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
    window.todayKey = () => '2026-10-03'; window.fmtDate = v => v;
    window.bindPage = () => {}; window.polishPortalBlockE = () => {};
    window.renderPage = () => { renders++;const calendar=document.querySelector('.v621-week-wrap');calendar.replaceWith(calendar.cloneNode(true)); }; window.reloadAndRender = async () => renderPage();
    window.toast = (...args) => messages.push(args);
    window.setBusy = (button,busy) => {button.disabled=busy};
    window.studentSubjects = () => state.subjects; // The old permissive fallback must never run.
    document.querySelector('.v621-week-wrap').scrollTop=420;window.scrollTo(0,220);
    (0,eval)(script); bindPage();
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
async function choose(page,id,value) { await page.locator('#'+id).focus();await page.locator('#'+id).selectOption(value); }
async function eligible(page) { await choose(page,'v630Subject','math');await choose(page,'v630Student','s1'); }
async function respond(page,index=0,slots=[{inicio:'10:00',fim:'11:00',status:'disponivel'},{inicio:'11:00',fim:'12:00',status:'ocupado'}]) {
  await page.evaluate(({index,slots})=>pending[index].resolve({availabilityPolicy:'confirmed-week-v2',items:[{uid:'t1',slots}]}),{index,slots});
  await page.waitForTimeout(20);
}
async function identity(page) {
  assert.equal(await page.evaluate(()=>Object.entries(nodes).every(([id,node])=>node===(id==='scroll'?document.querySelector('.v630-drawer-scroll'):id==='drawer'?document.querySelector('.v630-drawer'):document.getElementById(id)))),true);
  assert.equal(await page.evaluate(()=>rootReplacements),0);
}

test('alunos exigem pacote liberado, série compatível e active estritamente true', async t => {
  const page=await fixture(t);await choose(page,'v630Subject','math');
  assert.deepEqual(await page.locator('#v630Student option').evaluateAll(options=>options.map(x=>x.value)),['','s1']);
  await choose(page,'v630Subject','science');
  assert.deepEqual(await page.locator('#v630Student option').evaluateAll(options=>options.map(x=>x.value)),['','s7']);
  await identity(page);
});
test('falha de pacotes bloqueia aluno e não recorre ao catálogo',async t=>{
  const page=await fixture(t,{linksFail:true});await choose(page,'v630Subject','math');
  assert.equal(await page.locator('#v630Student').isDisabled(),true);
  assert.deepEqual(await page.locator('#v630Student option').evaluateAll(options=>options.map(x=>x.value)),['']);
  assert.equal(await page.evaluate(()=>calls.some(x=>x.url.startsWith('/profissionais'))),false);
});
for(const mobile of [false,true])test(`drawer mantém nós, foco e scroll nas seleções e consultas (${mobile?'mobile':'desktop'})`,async t=>{
  const page=await fixture(t,{mobile});await eligible(page);
  await respond(page);await page.locator('#v630Place').fill('Sala 1');
  const top=await page.evaluate(()=>{nodes.scroll.scrollTop=230;return nodes.scroll.scrollTop});
  await choose(page,'v630Duration','90');
  assert.equal(await page.evaluate(()=>nodes.scroll.scrollTop),top);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'v630Duration');
  await respond(page,1,[{inicio:'10:00',fim:'11:30',status:'disponivel'}]);
  assert.equal(await page.evaluate(()=>nodes.scroll.scrollTop),top);
  await page.locator('[data-v630-slot]').click();
  assert.equal(await page.locator('#v630Place').inputValue(),'Sala 1');
  assert.equal(await page.locator('#v630Subject').inputValue(),'math');
  assert.equal(await page.locator('#v630Student').inputValue(),'s1');
  await identity(page);
});
test('professor preserva matéria/aluno compatíveis, limpa somente incompatíveis',async t=>{
  const page=await fixture(t);await eligible(page);await respond(page);
  await choose(page,'v630Teacher','t2');
  assert.equal(await page.locator('#v630Subject').inputValue(),'math');assert.equal(await page.locator('#v630Student').inputValue(),'s1');
  await choose(page,'v630Teacher','t3');
  assert.equal(await page.locator('#v630Subject').inputValue(),'');assert.equal(await page.locator('#v630Student').inputValue(),'');
  await identity(page);
});
test('resposta antiga não repõe horários após troca de professor/matéria/fechamento',async t=>{
  const page=await fixture(t);await eligible(page);await choose(page,'v630Subject','science');
  await respond(page);assert.equal(await page.locator('[data-v630-slot]').count(),0);
  await choose(page,'v630Subject','math');await choose(page,'v630Student','s1');
  await page.locator('.v630-close').click();await respond(page,1);
  assert.equal(await page.evaluate(()=>state.v630Booking.slots.length),0);
  assert.equal(await page.locator('#v630BookingRoot').getAttribute('aria-hidden'),'true');
});
test('respostas fora de ordem exibem apenas a data/duração mais recente',async t=>{
  const page=await fixture(t);await eligible(page);await page.locator('#v630Date').fill('2026-10-04');
  await respond(page,1,[{inicio:'14:00',fim:'15:00',status:'disponivel'}]);await respond(page,0);
  assert.deepEqual(await page.locator('[data-v630-slot]').evaluateAll(xs=>xs.map(x=>x.dataset.v630Slot)),['14:00']);
});
test('loading só nos horários, indisponíveis nunca viram opções, nenhuma rerenderização ao selecionar slot',async t=>{
  const page=await fixture(t);await eligible(page);
  assert.equal(await page.locator('#v631Slots').getAttribute('aria-busy'),'true');
  assert.equal(await page.locator('#v630Student').isDisabled(),false);
  await respond(page);assert.equal(await page.locator('[data-v630-slot]').count(),1);
  await page.locator('[data-v630-slot]').click();
  if(process.env.FORJA_DRAWER_SCREENSHOT)await page.screenshot({path:process.env.FORJA_DRAWER_SCREENSHOT});
  assert.equal(await page.locator('[data-v630-slot]').getAttribute('aria-pressed'),'true');
  await identity(page);
});
test('scroll do fundo bloqueado, auto sync não renderiza calendário, fechar restaura fundo/foco',async t=>{
  const page=await fixture(t);const before=await page.evaluate(()=>({top:document.body.style.top,calendar:document.querySelector('.v621-week-wrap').scrollTop}));
  await page.mouse.move(100,200);await page.mouse.wheel(0,600);await page.waitForTimeout(80);
  assert.deepEqual(await page.evaluate(()=>({top:document.body.style.top,calendar:document.querySelector('.v621-week-wrap').scrollTop})),before);
  await page.evaluate(()=>renderPage());assert.equal(await page.evaluate(()=>renders),0);
  await page.locator('.v630-close').click();
  assert.equal(await page.evaluate(()=>renders),1);assert.equal(await page.evaluate(()=>document.querySelector('.v621-week-wrap').scrollTop),420);assert.equal(await page.evaluate(()=>window.scrollY),220);
  assert.equal(await page.evaluate(()=>document.querySelector('#background').inert),false);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'launch');
});
test('modalidade preserva local/Meet, reabertura preserva valores elegíveis e mesmo drawer',async t=>{
  const page=await fixture(t);await eligible(page);await respond(page);await page.locator('#v630Place').fill('Sala A');
  await choose(page,'v630Mode','online');await page.locator('#v630Meet').fill('https://meet.google.com/abc-defg-hij');await choose(page,'v630Mode','presencial');
  assert.equal(await page.locator('#v630Place').inputValue(),'Sala A');
  await page.locator('.v630-close').click();await page.evaluate(()=>document.querySelector('#v630EdgeTab').click());
  await page.waitForFunction(()=>state.v630Booking.studentId==='s1');
  assert.equal(await page.locator('#v630Place').inputValue(),'Sala A');assert.equal(await page.locator('#v630Meet').inputValue(),'https://meet.google.com/abc-defg-hij');
  await identity(page);
});
test('confirmação envia contrato existente; conflito final mantém drawer e consulta horários de novo',async t=>{
  const page=await fixture(t);await eligible(page);await respond(page);await page.locator('#v630Place').fill('Sala A');await page.locator('[data-v630-slot]').click();
  await page.locator('[data-v630-save]').click();
  const call=await page.evaluate(()=>calls.find(x=>x.url==='/aulas'));
  assert.equal(call.method,'POST');assert.deepEqual(call.body,{alunoId:'s1',professorId:'t1',disciplinaId:'math',serieId:'g1',dataAula:'2026-10-03',horaAula:'10:00',horaFim:'11:00',modalidade:'presencial',localAula:'Sala A',meetLink:'',criarMeet:false});
  await page.evaluate(()=>pending[1].reject(new Error('HORARIO_OCUPADO')));await respond(page,2,[]);
  assert.equal(await page.locator('#v630BookingRoot').getAttribute('aria-hidden'),'false');
  assert.equal(await page.locator('[data-v630-save]').isDisabled(),true);await identity(page);
});


test('troca de filtros/loading preserva scroll até no fim de muitos horários',async t=>{
  const page=await fixture(t);await eligible(page);
  await respond(page,0,Array.from({length:30},(_,i)=>({inicio:`${String(7+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`,fim:`${String(8+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`,status:'disponivel'})));
  const top=await page.evaluate(()=>{nodes.scroll.scrollTop=nodes.scroll.scrollHeight;return nodes.scroll.scrollTop});
  await page.evaluate(()=>{nodes.v630Duration.value='90';nodes.v630Duration.dispatchEvent(new Event('change',{bubbles:true}))});
  assert.equal(await page.evaluate(()=>nodes.scroll.scrollTop),top);
  await respond(page,1,[]);assert.equal(await page.evaluate(()=>nodes.scroll.scrollTop),top);await identity(page);
});


test('Tab fica no drawer, Escape fecha e devolve foco sem mover a página',async t=>{
  const page=await fixture(t);await page.locator('.v630-close').focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.hasAttribute('data-v630-close')),true);
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('v630-cancel')),true);
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('v630-close')),true);
  await page.keyboard.press('Escape');assert.equal(await page.locator('#v630BookingRoot').getAttribute('aria-hidden'),'true');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'launch');assert.equal(await page.evaluate(()=>window.scrollY),220);
});


test('Meet preservado mas oculto não impede confirmação presencial',async t=>{
  const page=await fixture(t);await eligible(page);await respond(page);await choose(page,'v630Mode','online');
  await page.locator('#v630Meet').fill('rascunho incompleto');await choose(page,'v630Mode','presencial');
  await page.locator('#v630Place').fill('Sala A');await page.locator('[data-v630-slot]').click();await page.locator('[data-v630-save]').click();
  assert.equal(await page.evaluate(()=>calls.find(x=>x.url==='/aulas')?.body.meetLink),'');
  await page.evaluate(()=>pending[1].resolve({ok:true}));await page.waitForFunction(()=>!state.v630Booking.open);
  assert.equal(await page.evaluate(()=>document.querySelector('#background').inert),false);
});


for(const mobile of [false,true])test(`CSS real: largura, padding, seis passos, scroll e slots (${mobile?'mobile':'desktop'})`,async t=>{
 const page=await fixture(t,{mobile});
 const style=await page.evaluate(()=>{
  const drawer=getComputedStyle(nodes.drawer),scroll=getComputedStyle(nodes.scroll),head=getComputedStyle(document.querySelector('.v630-drawer-head')),steps=getComputedStyle(document.querySelector('.v630-steps'));
  return {width:drawer.width,padding:scroll.padding,headPadding:head.padding,columns:steps.gridTemplateColumns.split(' ').length,overflow:scroll.overflowY,overscroll:scroll.overscrollBehaviorY,flex:scroll.flexGrow,anchor:scroll.overflowAnchor,styleInPortal:document.getElementById('forja-v630-style').textContent.includes('/* 6.31: scoped')};
 });
 assert.equal(style.styleInPortal,true);assert.equal(style.width,mobile?'390px':'440px');assert.equal(style.padding,'12px 16px');assert.equal(style.headPadding,'14px 16px 10px');assert.equal(style.columns,6);assert.equal(style.overflow,'auto');assert.equal(style.overscroll,'none');assert.equal(style.flex,'1');assert.equal(style.anchor,'none');
 await eligible(page);
 await respond(page,0,Array.from({length:30},(_,i)=>({inicio:`${String(7+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`,fim:`${String(8+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}`,status:'disponivel'})));
 const grid=await page.locator('.v630-slots').evaluate(el=>({height:el.getBoundingClientRect().height,max:getComputedStyle(el).maxHeight,overflow:getComputedStyle(el).overflowY,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}));
 assert.equal(grid.max,'180px');assert.ok(grid.height<=182);assert.equal(grid.overflow,'auto');assert.ok(grid.scrollHeight>grid.clientHeight);
 await page.locator('[data-v630-slot]').first().click();
 const selected=await page.locator('[data-v630-slot]').first().evaluate(el=>({bg:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,pressed:el.getAttribute('aria-pressed')}));
 assert.deepEqual(selected,{bg:'rgb(47, 138, 96)',color:'rgb(255, 255, 255)',pressed:'true'});
 await identity(page);
 if(process.env.FORJA_VISUAL_DIR)await page.screenshot({path:`${process.env.FORJA_VISUAL_DIR}/drawer-${mobile?'mobile':'desktop'}.png`});
});

test('DOMParser exclui estilos dentro de strings de script (regressão do falso positivo)',async t=>{
 const page=await fixture(t);
 assert.deepEqual(await page.evaluate(()=>{
  const source='<html><head><style id="real">body{color:red}</style></head><body><script>const report=`<style id="fake">body{color:blue}</style>`;</script></body></html>';
  return [...new DOMParser().parseFromString(source,'text/html').querySelectorAll('style')].map(x=>x.id);
 }),['real']);
 const report=html.slice(html.indexOf('function exportReport('),html.indexOf('async function reloadAndRender()',html.indexOf('function exportReport(')));
 assert.equal(report.includes('6.31: scoped'),false);assert.equal(report.includes('#v630BookingRoot'),false);
});

test('relatório/PDF conserva seu CSS original e não recebe o estilo do drawer',async t=>{
 const page=await fixture(t);
 const report=html.slice(html.indexOf('function exportReport('),html.indexOf('async function reloadAndRender()',html.indexOf('function exportReport(')));
 const styles=await page.evaluate(report=>{
  window.reportRows=()=>[['Nome','Aulas'],['Exemplo','1']];window.schoolDisplayName=()=> 'FORJA';window.downloadBlob=()=>{};
  let output='';const original=window.open;
  window.open=()=>({document:{write:s=>output=s,close:()=>{}},focus:()=>{},print:()=>{}});
  (0,eval)(report);exportReport('pdf');window.open=original;
  const parsed=new DOMParser().parseFromString(output,'text/html');
  return [...parsed.querySelectorAll('style')].map(x=>x.textContent.trim());
 },report);
 assert.deepEqual(styles,['body{font-family:Arial;padding:40px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:10px}h1{color:#081f2e}']);
});

test('backend antigo sem política de publicação gera erro explícito, nunca slots legados',async t=>{
 const page=await fixture(t);await eligible(page);
 await page.evaluate(()=>pending[0].resolve({items:[{uid:'t1',slots:[{inicio:'20:00',fim:'21:00',status:'disponivel'}]}]}));
 await page.waitForFunction(()=>state.v630Booking.error.includes('disponibilidade publicada'));
 assert.equal(await page.locator('[data-v630-slot]').count(),0);assert.equal(await page.locator('[data-v630-save]').isDisabled(),true);
});


test('CSS colocado só na string do relatório não estiliza o portal (controle negativo)',async t=>{
 const a=html.indexOf('/* 6.31: scoped'),z=html.indexOf('</style>',a),block=html.slice(a,z);
 let wrong=html.slice(0,a)+html.slice(z);
 const exportIndex=wrong.indexOf('function exportReport('),reportStyleEnd=wrong.indexOf('</style>',exportIndex);
 wrong=wrong.slice(0,reportStyleEnd)+block+wrong.slice(reportStyleEnd);
 const page=await fixture(t,{portalSource:wrong});
 const actual=await page.evaluate(()=>({width:getComputedStyle(nodes.drawer).width,columns:getComputedStyle(document.querySelector('.v630-steps')).gridTemplateColumns.split(' ').length,realStylesContainBlock:[...document.querySelectorAll('style')].some(el=>el.textContent.includes('/* 6.31: scoped'))}));
 assert.deepEqual(actual,{width:'470px',columns:4,realStylesContainBlock:false});
});
