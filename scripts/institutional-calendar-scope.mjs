import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export function withoutInstitutionalCalendar(input){
 let html=input.replace(/\r\n/g,'\n');if(!html.includes('<script id="forja-institutional-script">'))return html;
 const {baseline,before,after,position}=JSON.parse(readFileSync(new URL('./institutional-calendar-changes.json',import.meta.url),'utf8'));
 assert.equal(html.slice(position,position+after.length),after,'Institutional calendar review boundary changed');
 html=html.slice(0,position)+before+html.slice(position+after.length);
 assert.equal(createHash('sha256').update(html).digest('hex'),baseline,'Institutional changes must restore the exact reviewed portal');return html;
}
