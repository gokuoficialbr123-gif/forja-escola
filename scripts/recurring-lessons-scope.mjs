import assert from 'node:assert/strict';
import {withoutLessonConfirmation} from './lesson-confirmation-scope.mjs';
export function withoutRecurringLessons(html){
 html=withoutLessonConfirmation(html);
 for(const [tag,id] of [['style','forja-recurring-lessons-style'],['script','forja-recurring-lessons-script']]){
  assert.equal(html.split(`<${tag} id="${id}">`).length,2,'Bloco de recorrência deve existir exatamente uma vez.');
  html=html.replace(new RegExp(`<${tag} id="${id}">[\\s\\S]*?<\\/${tag}>\\n${tag==='script'?'\\n':''}`),'');
 }
 const added="if(String(data.code||'').startsWith('RECURRING_')){e.occurrences=data.occurrences;e.seriesId=data.seriesId;}";
 assert.equal(html.split(added).length,2);
 return html.replace(added,'');
}
