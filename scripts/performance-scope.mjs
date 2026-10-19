import {withoutLoginProfileChanges} from './login-profile-scope.mjs';
import assert from 'node:assert/strict';import{readFileSync}from'node:fs';
const changes=JSON.parse(readFileSync(new URL('./performance-changes.json',import.meta.url),'utf8'));
export function withoutPerformanceChanges(html){html=withoutLoginProfileChanges(html);for(const {before,after,positions}of [...changes].reverse())for(const at of [...positions].reverse()){assert.equal(html.slice(at,at+after.length),after,'Performance review boundary changed');html=html.slice(0,at)+before+html.slice(at+after.length)}return html;}
