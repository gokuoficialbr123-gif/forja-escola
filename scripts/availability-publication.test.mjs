import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test, before, after } from 'node:test';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
// Bounded real function declarations, never extract CSS from JavaScript strings.
const between=(start,end)=>{const a=html.indexOf(start),b=html.indexOf(end,a);assert.ok(a>=0&&b>a);return html.slice(a,b)};
const confirmCode=between('async function forjaConfirmAvailabilityWeek(', 'async function v616SaveWeek(');
const addCode=between('  async function v625SaveAvailability(', '  function v625SetSlotType(');
const copyCode=between('async function v616CopyPreviousWeek(', '// Status de aula');
const modulePath=process.env.FORJA_PLAYWRIGHT_MODULE;
const {chromium}=await import(modulePath?pathToFileURL(resolve(modulePath)).href:'playwright');
let browser;
before(async()=>{browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})})});
after(async()=>browser?.close());
const legacy={6:[{inicio:'19:58',fim:'23:58'}]};
const expectedHash=semana=>createHash('sha256').update(JSON.stringify({version:1,timeZone:'America/Sao_Paulo',professionalId:'teacher-local',weekStart:'2026-09-28',semana})).digest('hex');

async function fixture(t,{accept=true,semana=legacy}={}){
 const page=await browser.newPage();t.after(()=>page.close());
 await page.route('**/*',route=>route.request().url()==='https://forja-publication-test.invalid/'?route.fulfill({contentType:'text/html',body:'<html><body></body></html>'}):route.abort());
 await page.goto('https://forja-publication-test.invalid/');
 const prompts=[];page.on('dialog',async dialog=>{prompts.push(dialog.message());await(accept?dialog.accept():dialog.dismiss())});
 await page.evaluate(({confirmCode,addCode,copyCode,semana})=>{
  window.state={user:{uid:'teacher-local'},availabilityWeekStartV616:'2026-09-28',v621TeacherWeekCache:{'2026-09-28':semana}};
  window.calls=[];window.messages=[];
  window.api=async(url,options)=>{calls.push({url,...options});return {items:options.body?.semana||{},googleSync:{status:'nao_conectado'}}};
  window.v616CurrentWeek=()=> '2026-09-28';window.gWeekStart=()=> '2026-09-28';
  window.v621DayCode=day=>String(new Date(day+'T12:00:00Z').getUTCDay());
  window.v625AvailabilityHasConflict=()=>'';
  window.v625MergePeriods=periods=>periods.sort((a,b)=>a.inicio.localeCompare(b.inicio));
  window.renderPage=()=>{};window.setBusy=()=>{};window.toast=text=>messages.push(text);
  (0,eval)(confirmCode+addCode+copyCode);
 },{confirmCode,addCode,copyCode,semana});
 return {page,prompts};
}
test('confirmation in Chromium displays exact inherited window and produces deterministic fingerprint',async t=>{
 const {page,prompts}=await fixture(t);
 const receipt=await page.evaluate(semana=>forjaConfirmAvailabilityWeek('2026-09-28',semana),legacy);
 assert.deepEqual(receipt,{version:1,fingerprint:expectedHash(legacy)});
 assert.equal(prompts.length,1);assert.match(prompts[0],/2026-10-03: 19:58–23:58/);assert.match(prompts[0],/TODOS os períodos/);
});
test('adding one period requires explicit confirmation of ALL inherited periods',async t=>{
 const {page,prompts}=await fixture(t);
 await page.evaluate(()=>v625SaveAvailability('2026-10-04','13:00','14:00'));
 const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,1);
 const semana={0:[{inicio:'13:00',fim:'14:00'}],6:[{inicio:'19:58',fim:'23:58'}]};
 assert.deepEqual(calls[0].body.semana,semana);
 assert.equal(calls[0].body.publicationConfirmation.fingerprint,expectedHash(semana));
 assert.match(prompts[0],/2026-10-03: 19:58–23:58/);assert.match(prompts[0],/2026-10-04: 13:00–14:00/);
});
test('canceling add does not PATCH or mutate cached week',async t=>{
 const {page}=await fixture(t,{accept:false});
 const result=await page.evaluate(async()=>{try{await v625SaveAvailability('2026-10-04','13:00','14:00')}catch(e){return e.message}});
 assert.match(result,/cancelada/);assert.deepEqual(await page.evaluate(()=>calls),[]);
 assert.deepEqual(await page.evaluate(()=>state.v621TeacherWeekCache['2026-09-28']),legacy);
});
test('removing a period confirms exact remainder without retaining deleted legacy day',async t=>{
 const {page,prompts}=await fixture(t,{semana:{0:[{inicio:'13:00',fim:'14:00'}],...legacy}});
 await page.evaluate(()=>v625RemoveAvailability('2026-10-03','19:58','23:58'));
 const body=await page.evaluate(()=>calls[0].body);
 assert.deepEqual(body.semana,{0:[{inicio:'13:00',fim:'14:00'}]});assert.equal(body.publicationConfirmation.fingerprint,expectedHash(body.semana));
 assert.doesNotMatch(prompts[0],/19:58/);assert.match(prompts[0],/2026-10-04: 13:00–14:00/);
});
test('copy button explicitly keeps a draft, never sends a publication confirmation',async t=>{
 const {page}=await fixture(t);await page.evaluate(()=>v616CopyPreviousWeek({}));
 const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,1);
 assert.deepEqual(calls[0].body,{weekStart:'2026-09-28'});assert.equal(calls[0].body.publicationConfirmation,undefined);
 assert.match((await page.evaluate(()=>messages))[0],/rascunho/);
});
