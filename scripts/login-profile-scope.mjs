import {withoutLoginCriticalPath} from './login-critical-path-scope.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const changes=JSON.parse(readFileSync(new URL('./login-profile-changes.json',import.meta.url),'utf8'));
export const portalBeforeLoginSha256='d95d470c4fc20e217af91b178a41ddfa20d4d8ffb241be48a6bb7d00bd8fd341';
export function withoutLoginProfileChanges(html){
 html=withoutLoginCriticalPath(html);
 for(const {before,after,positions}of [...changes].reverse())for(const at of [...positions].reverse()){
  assert.equal(html.slice(at,at+after.length),after,'Login profile review boundary changed');
  html=html.slice(0,at)+before+html.slice(at+after.length);
 }
 assert.equal(createHash('sha256').update(html).digest('hex'),portalBeforeLoginSha256,'Only the reviewed login changes may differ from published main');
 return html;
}
