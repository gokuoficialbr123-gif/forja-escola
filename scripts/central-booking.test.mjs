import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test,before,after} from 'node:test';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
const session=slice('// FORJA session isolation:', 'async function getProfile(');
const code=slice('  // BEGIN FORJA central booking presentation:', '  async function v621EnsureVisibleWeeks(');
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);
let browser;before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser.close());
async function fixture(t,{failed=false,days=7,hold=false}={}){
 const page=await browser.newPage();t.after(()=>page.close());let count=0,release;
 const gate=hold?new Promise(r=>release=r):null;
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname==='portal.forja.invalid')return route.fulfill({contentType:'text/html',body:'<div></div>'});
   if(url.hostname!=='api.forja.invalid')return route.abort();
   if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'https://portal.forja.invalid','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET'}});
   count++;if(gate)await gate;
   const from=url.searchParams.get('from'),to=url.searchParams.get('to');
   const response={policy:'central-booking-fail-closed-v1',from,to,complete:!failed,status:failed?'unavailable':'success',unavailable:failed?[{professionalId:'TEACHER',reason:'central_unavailable'}]:[],items:failed?[]:[{professionalId:'TEACHER',startAt:from+'T17:00:00Z',endAt:from+'T18:00:00Z',title:'Ocupado',source:'google-central'}]};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(response),headers:{'Access-Control-Allow-Origin':'*'}}).catch(()=>{});
 });
 await page.goto('https://portal.forja.invalid');
 await page.evaluate(({session,code,days})=>{
   window.state={role:'admin',user:{uid:'ADMIN'},googleBusy:[],profile:{active:true}};
   window.auth={currentUser:{uid:'ADMIN',getIdToken:async()=>'SYNTHETIC_TEST'}};
   window.FORJA_API_URL='https://api.forja.invalid';window.$=()=>null;window.$$=()=>[];
   window.v621RangeDays=()=>Array.from({length:days},(_,i)=>{const d=new Date('2026-10-19T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);return d.toISOString().slice(0,10)});
   (0,eval)(session+'\n'+code+'\nwindow.fixtureCentralFlightSize=()=>v631CentralFlights.size;');forjaBeginSession(auth.currentUser);state.role='admin';state.user={uid:'ADMIN'};
 },{session,code,days});
 return {page,count:()=>count,release};
}
test('Chromium central busy loads once under concurrency and repeats after reload',async t=>{
 const f=await fixture(t);await f.page.evaluate(()=>Promise.all([v631LoadCentralRange(),v631LoadCentralRange(),v631LoadCentralRange()]));assert.equal(f.count(),1);
 assert.equal(await f.page.evaluate(()=>v631CentralKnown('TEACHER','2026-10-19')),true);assert.equal(await f.page.evaluate(()=>v631CentralBusy()[0].title),'Ocupado');
 await f.page.evaluate(()=>v631LoadCentralRange());assert.equal(f.count(),1);
 const second=await fixture(t);await second.page.evaluate(()=>v631LoadCentralRange());assert.equal(second.count(),1);
});
test('Chromium unknown Google never makes a teacher available; unaffected professional stays isolated',async t=>{
 const f=await fixture(t,{failed:true});await f.page.evaluate(()=>v631LoadCentralRange());assert.equal(await f.page.evaluate(()=>v631CentralKnown('TEACHER','2026-10-19')),false);
 assert.equal(await f.page.evaluate(()=>v631CentralKnown('OTHER','2026-10-19')),true);assert.deepEqual(await f.page.evaluate(()=>v631CentralBusy()),[]);
});
test('Chromium month queries partition at 31 days and preserve occupied intervals',async t=>{
 const f=await fixture(t,{days:42});await f.page.evaluate(()=>v631LoadCentralRange());assert.equal(f.count(),2);assert.equal(await f.page.evaluate(()=>v631CentralBusy().length),2);
});
test('Chromium uncancellable late central response cannot cross UID or session generation',async t=>{
 const f=await fixture(t,{hold:true});await f.page.evaluate(()=>{const native=fetch;window.fetch=(url,options)=>native(url,{...options,signal:undefined});window.oldQuery=v631LoadCentralRange();});
 await f.page.waitForFunction(()=>fixtureCentralFlightSize()===1);
 await f.page.evaluate(()=>{forjaEndSession();auth.currentUser={uid:'PSYCH',getIdToken:async()=>'SYNTHETIC_TEST'};forjaBeginSession(auth.currentUser);state.role='admin';state.user={uid:'ADMIN'};state.role='psychologist';});
 f.release();await f.page.evaluate(()=>oldQuery);assert.deepEqual(await f.page.evaluate(()=>state.v631CentralRanges),{});assert.deepEqual(await f.page.evaluate(()=>v631CentralBusy()),[]);
});
