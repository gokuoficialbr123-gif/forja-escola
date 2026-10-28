import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {withoutInstitutionalCalendar}from './institutional-calendar-scope.mjs';
export const navigationBaseline='c02349ff20693c0051dda06386643099ac6e3fbd2eb49f120347cd2199a686a1';
export function withoutNavigationStudent(html){
 html=withoutInstitutionalCalendar(html).replace(/\r\n/g,'\n');
 if(!html.includes('<script id="forja-navigation-script">'))return html;
 const {changes}=JSON.parse(readFileSync(new URL('./navigation-student-changes.json',import.meta.url),'utf8'));
 for(const {before,after,positions} of [...changes].reverse())for(const at of [...positions].reverse()){
  assert.equal(html.slice(at,at+after.length),after,'Navigation/student review boundary changed');html=html.slice(0,at)+before+html.slice(at+after.length);
 }
 assert.equal(createHash('sha256').update(html).digest('hex'),navigationBaseline,'Navigation/student changes must restore exact published main');return html;
}
