import assert from 'node:assert/strict';
import {withoutNavigationStudent} from './navigation-student-scope.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const {baseline,changes}=JSON.parse(readFileSync(new URL('./agenda-intelligence-changes.json',import.meta.url),'utf8'));
export function withoutAgendaIntelligence(html){
 html=withoutNavigationStudent(html);
 html=html.replace(/\r\n/g,'\n');
 if(!html.includes('<script id="forja-agenda2-script">')){assert.equal(createHash('sha256').update(html).digest('hex'),baseline,'Unmodified Agenda baseline required');return html;}
 for(const {before,after,positions} of [...changes].reverse())for(const at of [...positions].reverse()){
  assert.equal(html.slice(at,at+after.length),after,'Agenda 2.0 review boundary changed');html=html.slice(0,at)+before+html.slice(at+after.length);
 }
 assert.equal(createHash('sha256').update(html).digest('hex'),baseline,'Agenda 2.0 must restore the exact audited main');return html;
}
