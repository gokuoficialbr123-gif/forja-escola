import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {withoutGoogleIntegration} from './google-integration-scope.mjs';

// Review guard only: restore the exact published portal before this scoped change.
// This file and its snapshots are never copied into the Hosting artifact.
const changes=JSON.parse(readFileSync(new URL('./lesson-confirmation-changes.json',import.meta.url),'utf8'));
export function withoutLessonConfirmation(html){
 html=withoutGoogleIntegration(html);
 for(const {before,after,count,positions} of [...changes].reverse()){
  assert.equal(positions.length,count);
  for(const at of [...positions].reverse()){
   assert.equal(html.slice(at,at+after.length),after,'Alteração de confirmação fora do escopo aprovado.');
   html=html.slice(0,at)+before+html.slice(at+after.length);
  }
 }
 return html;
}
