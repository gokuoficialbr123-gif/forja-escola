import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const navigationBaseline='a148938c144636b84efc58f269d8e7c60026540698d65d502fb9eb4bee48682b';
export function withoutNavigationStudent(html){
 html=html.replace(/\r\n/g,'\n');
 if(!html.includes('<script id="forja-navigation-script">'))return html;
 const {changes}=JSON.parse(readFileSync(new URL('./navigation-student-changes.json',import.meta.url),'utf8'));
 for(const {before,after,positions} of [...changes].reverse())for(const at of [...positions].reverse()){
  assert.equal(html.slice(at,at+after.length),after,'Navigation/student review boundary changed');html=html.slice(0,at)+before+html.slice(at+after.length);
 }
 assert.equal(createHash('sha256').update(html).digest('hex'),navigationBaseline,'Navigation/student changes must restore exact published main');return html;
}
