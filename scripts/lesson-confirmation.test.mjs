import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {withoutLessonConfirmation} from './lesson-confirmation-scope.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})}));after(()=>browser?.close());
test('all portal changes are reversible to the exact published SHA; public legal pages remain separately hash-guarded',()=>assert.equal(createHash('sha256').update(withoutLessonConfirmation(html)).digest('hex'),'2ce1681d866ec4a5100dea11a89035a9bf040a6d6c5f3f480bc68d48fe64893b'));
async function fixture(t){
 const page=await browser.newPage({viewport:{width:390,height:844}});t.after(()=>page.close());
 await page.setContent('<button id="launch">Aula sintética</button><div id="modal" class="modal-backdrop hidden"></div>');
 const source=html.slice(html.indexOf('const lessonCancellationDrafts=new Map();'),html.indexOf('\nfunction requestRescheduleModal('));
 const modal=html.slice(html.indexOf('function modal(title,'),html.indexOf('\nfunction selectOptions('));
 await page.evaluate(({source,modal,html})=>{
  const portal=new DOMParser().parseFromString(html,'text/html');document.head.append(...[...portal.querySelectorAll('style')].map(x=>x.cloneNode(true)));
  window.$=s=>document.querySelector(s);window.$$=s=>[...document.querySelectorAll(s)];window.lastModalFocus=null;
  window.esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.state={user:{uid:'STUDENT'},role:'student',page:'agenda',lessons:[{id:'SYNTHETIC_LESSON',alunoId:'STUDENT',dataAula:'2030-01-07',horaAula:'13:33',horaFim:'15:03',nomeProfessor:'Prof. sintético',status:'confirmada',studentCancellationAllowed:true}]};
  window.generation=1;window.forjaCaptureSession=()=>({uid:state.user.uid,generation});window.forjaSessionCurrent=s=>s.uid===state.user.uid&&s.generation===generation;window.studentCanCancelLesson=l=>l.studentCancellationAllowed;
  window.lessonTitle=()=> 'Matemática sintética';window.fmtDate=x=>x;window.messages=[];window.toast=(...x)=>messages.push(x);window.setBusy=(b,busy)=>b.disabled=busy;
  window.requests=[];window.pending=[];window.api=(path,options={})=>{requests.push({path,options});return new Promise((resolve,reject)=>pending.push({resolve,reject}))};window.reloadAndRender=async()=>{};
  (0,eval)(modal);(0,eval)(source);cancelLessonModal('SYNTHETIC_LESSON');
 },{source,modal,html});
 return page;
}
test('reason required, precise lesson identity, singleflight and committed cancellation despite reload failure',async t=>{
 const p=await fixture(t);assert.match(await p.locator('#modal').innerText(),/13:33–15:03/);assert.equal(await p.getByRole('textbox',{name:'Motivo do cancelamento'}).count(),1);
 await p.click('#modalSave');assert.equal(await p.evaluate(()=>requests.length),0);await p.fill('#cancelReason','Motivo sintético');await p.locator('#modalSave').evaluate(b=>{b.onclick();b.onclick()});assert.equal(await p.evaluate(()=>requests.length),1);
 await p.evaluate(()=>{reloadAndRender=async()=>{throw Error('TEST_LOCAL_RELOAD_FAILED')};pending[0].resolve({cancellationState:'cancelled',item:{id:'SYNTHETIC_LESSON',status:'cancelada_aluno'},warnings:['Google pendente']})});await p.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));
 assert.equal(await p.evaluate(()=>state.lessons[0].status),'cancelada_aluno');assert.match((await p.evaluate(()=>messages)).flat().join(' '),/registrado/);
});
test('ambiguous response retains reason and recovers the same lesson before retry, without another cancellation',async t=>{
 const p=await fixture(t);await p.fill('#cancelReason','Motivo sintético preservado');await p.click('#modalSave');await p.evaluate(()=>pending[0].reject(Error('TEST_NETWORK_LOSS')));await p.waitForFunction(()=>document.getElementById('modalSave').textContent==='Verificar cancelamento');assert.equal(await p.inputValue('#cancelReason'),'Motivo sintético preservado');
 await p.click('#modalSave');assert.equal(await p.evaluate(()=>requests[1].path),'/aulas/SYNTHETIC_LESSON');await p.evaluate(()=>pending[1].resolve({item:{id:'SYNTHETIC_LESSON',status:'cancelada_aluno'}}));await p.waitForFunction(()=>document.getElementById('modal').classList.contains('hidden'));assert.equal(await p.evaluate(()=>requests.filter(x=>x.options.method==='PATCH').length),1);
});
test('late cancellation result cannot overwrite another UID or same-UID new session',async t=>{
 for(const other of [true,false]){const p=await fixture(t);await p.fill('#cancelReason','Motivo sintético');await p.click('#modalSave');await p.evaluate(other=>{generation++;if(other)state.user.uid='OTHER_STUDENT';state.lessons=[{id:'OTHER_LESSON',status:'confirmada'}];closeModal();pending[0].resolve({cancellationState:'cancelled',item:{id:'SYNTHETIC_LESSON',status:'cancelada_aluno'}})},other);await p.waitForFunction(()=>!document.querySelector('#cancelReason'));assert.deepEqual(await p.evaluate(()=>state.lessons.map(x=>x.id)),['OTHER_LESSON']);assert.deepEqual(await p.evaluate(()=>messages),[]);}
});
test('starting/completing a lesson never reports a failed mutation when only the refresh failed',async t=>{
 const p=await fixture(t),source=html.slice(html.indexOf('async function applyConfirmedLessonChange('),html.indexOf('\nconst lessonCancellationDrafts='));
 await p.evaluate(source=>{(0,eval)(source);reloadAndRender=async()=>{throw Error('TEST_REFRESH_FAILED')};window.operation=applyConfirmedLessonChange('SYNTHETIC_LESSON',{ok:true,item:{id:'SYNTHETIC_LESSON',status:'concluida'}},'Aula finalizada.',forjaCaptureSession());},source);await p.evaluate(()=>operation);
 assert.equal(await p.evaluate(()=>state.lessons[0].status),'concluida');const messages=await p.evaluate(()=>window.messages);assert.equal(messages[0][0],'Aula finalizada.');assert.match(messages[1][0],/alteração foi registrada/);assert.ok(messages.every(x=>x[1]!=='bad'));
});
test('disconnect shows partial local/Google outcome instead of an unqualified success',async t=>{
 const p=await fixture(t),source=html.slice(html.indexOf('async function googleAction(action,button){'),html.indexOf('\nfunction googleMeetControl('));
 await p.evaluate(source=>{(0,eval)(source);window.confirm=()=>true;api=async()=>({ok:true,disconnectState:'partial',warnings:['Revogação Google não confirmada.']});window.disconnect=googleAction('disconnect',document.getElementById('launch'));},source);await p.evaluate(()=>disconnect);
 const messages=await p.evaluate(()=>window.messages);assert.equal(messages[0][1],'warn');assert.match(messages.flat().join(' '),/pendência no Google/);assert.match(messages.flat().join(' '),/não confirmada/);
});
test('cancellation failures preserve inputs and distinguish definitive refusal from uncertain result',async t=>{
 for(const status of [400,401,403,404,409,429,500]){
  const p=await fixture(t);await p.fill('#cancelReason','Motivo preservado');await p.click('#modalSave');await p.evaluate(status=>pending[0].reject(Object.assign(Error('Erro sintético'),{status})),status);await p.waitForFunction(()=>!document.getElementById('modalSave').disabled);
  assert.equal(await p.inputValue('#cancelReason'),'Motivo preservado');assert.equal(await p.locator('#modalSave').innerText(),[429,500].includes(status)?'Verificar cancelamento':'Confirmar cancelamento');assert.equal(await p.evaluate(()=>requests.length),1);
 }
});
