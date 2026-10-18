import {withoutPerformanceChanges} from './performance-scope.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Review guard: restore the exact published portal, preserving every older guard.
// Neither this snapshot nor any test fixture is part of the Hosting allowlist.
const changes=JSON.parse(readFileSync(new URL('./google-integration-changes.json',import.meta.url),'utf8'));
export function withoutGoogleIntegration(html){
 html=withoutPerformanceChanges(html);
 for(const {before,after,positions,count} of [...changes].reverse()){
  assert.equal(positions.length,count);
  for(const at of [...positions].reverse()){
   assert.equal(html.slice(at,at+after.length),after,'Google integration review guard mismatch.');
   html=html.slice(0,at)+before+html.slice(at+after.length);
  }
 }
 return html;
}
