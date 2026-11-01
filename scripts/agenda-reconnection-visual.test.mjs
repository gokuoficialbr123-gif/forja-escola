import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {agendaPresentationFixture,setView,reviewDay} from './helpers/agenda-presentation-fixture.mjs';
import {buildHostingArtifact} from './prepare-hosting.mjs';
import {extractStaticResources} from './static-resources.mjs';
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE)).href);let browser;
before(async()=>browser=await chromium.launch({headless:true,executablePath:process.env.FORJA_CHROMIUM_PATH}));after(()=>browser?.close());
const baseline=process.env.FORJA_RECONNECTION_BASELINE==='1',evidence=process.env.FORJA_RECONNECTION_EVIDENCE_DIR;
function artifact(){return baseline?extractStaticResources(execFileSync('git',['show','471429518213dc3e450263ba07eb82eb03e4d150:index.html'],{maxBuffer:4e6})):buildHostingArtifact();}
for(const role of ['admin','teacher'])for(const width of [1366,1920,360,390])test(`reconnection cards: ${role} ${width}, day/week/month without private data`,async t=>{
 const f=await agendaPresentationFixture(browser,{role,mobile:width<900,artifact:artifact(),transformItem:item=>({...item,busy:[
  {startAt:reviewDay+'T10:30:00-03:00',endAt:reviewDay+'T11:30:00-03:00',source:'google-central'},
  {startAt:reviewDay+'T11:00:00-03:00',endAt:reviewDay+'T11:45:00-03:00',source:'google-central'},
  {startAt:reviewDay+'T12:00:00-03:00',endAt:reviewDay+'T12:30:00-03:00',source:'google-central'},
 ]})});t.after(()=>f.close());const p=f.page;await p.setViewportSize({width,height:width<900?844:900});
 for(const view of ['day','week','month']){
  await setView(f,role,view);
  if(evidence){mkdirSync(evidence,{recursive:true});await p.screenshot({path:resolve(evidence,`${role}-${width}-${view}.png`),fullPage:true});}
  const geometry=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,private:document.querySelector('#workspaceContent').textContent.includes('PRIVATE_GOOGLE_TITLE'),cards:[...document.querySelectorAll('.forja2-busy.google')].map(el=>{const b=el.querySelector('b'),range=document.createRange();range.selectNodeContents(b);return {text:b.textContent,clipped:range.getBoundingClientRect().right>b.getBoundingClientRect().right+1,origin:el.querySelector('.forja2-origin').textContent,label:el.getAttribute('aria-label')};})}));
  assert.equal(geometry.overflow,false);assert.equal(geometry.private,false);
  if(!baseline&&view!=='month'){
   assert.equal(geometry.cards.length,2,'overlapping busy intervals form one block plus the short block');
   for(const card of geometry.cards){assert.match(card.text,/^\d{2}:\d{2}–\d{2}:\d{2}$/);assert.equal(card.clipped,false);assert.equal(card.origin,'Google central');assert.match(card.label,/Google central/);assert.match(card.label,/Ocupado/);if(role==='admin')assert.match(card.label,/Professor sintético/);}
  }
  assert.deepEqual(f.errors,[]);
  if(evidence)writeFileSync(resolve(evidence,`${role}-${width}-${view}.json`),JSON.stringify(geometry,null,2));
 }
});
