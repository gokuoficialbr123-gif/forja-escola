import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const {chromium}=await import(pathToFileURL(resolve(process.env.FORJA_PLAYWRIGHT_MODULE||'/tmp/forja-browser-tests/node_modules/playwright/index.mjs')).href);
test('Chromium: elapsed time never fabricates cancellation; operational pending label is non-mutating',async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FORJA_CHROMIUM_PATH?{executablePath:process.env.FORJA_CHROMIUM_PATH}:{})});
 try{
  const page=await browser.newPage();await page.setContent('<main id="result"></main>');
  const status=html.match(/function lessonOperationalStatus\(l\)\{[\s\S]*?\n\}/)[0],script=html.match(/<script id="forja-lesson-read-policy-script">([\s\S]*?)<\/script>/)[1];
  await page.addScriptTag({content:`const state={role:'admin'};function lessonSub(){return 'Aula sintética'};${status}\n${script}`});
  const results=await page.evaluate(()=>{
   const items=['agendada','confirmada','realizada','concluida','cancelada_automaticamente'].map(status=>({status,dataAula:'2001-01-01',horaAula:'09:00',horaFim:'10:00',confirmacaoAluno:null}));
   const before=JSON.stringify(items),statuses=items.map(lessonOperationalStatus),l={...items[0],operationalReview:{required:true}},labels={};
   for(const role of ['admin','teacher','student','parent']){state.role=role;labels[role]=lessonSub(l);}
   document.getElementById('result').textContent=labels.admin;
   return {statuses,labels,unchanged:JSON.stringify(items)===before};
  });
  assert.deepEqual(results.statuses,['agendada','confirmada','realizada','concluida','cancelada_automaticamente']);assert.equal(results.unchanged,true);
  assert.match(results.labels.admin,/pendente/);assert.match(results.labels.teacher,/pendente/);assert.doesNotMatch(results.labels.student,/pendente/);assert.doesNotMatch(results.labels.parent,/pendente/);assert.match(await page.locator('#result').innerText(),/conferir com a Secretaria/);
 }finally{await browser.close();}
});
