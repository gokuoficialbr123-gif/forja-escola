import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const tag = /\n<script id="forja-automation-script">\n[\s\S]*?<\/script>\n/;
const source = new URL('./automation-client.js',import.meta.url);
export function withoutAutomation(html) {
  return html.replace(tag,'\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = new URL('../index.html',import.meta.url);
  const validation = new URL('./validate.mjs',import.meta.url);
  const raw = withoutAutomation(readFileSync(index,'utf8'));
  assert.match(raw,/<\/body>\s*<\/html>\s*$/);
  const html = raw.replace(/<\/body>(?=\s*<\/html>\s*$)/,'<script id="forja-automation-script">\n'+
    readFileSync(source,'utf8').trimEnd()+'\n</script>\n</body>');
  assert.equal(withoutAutomation(html),raw);
  writeFileSync(index,html);
  const hash = createHash('sha256').update(html).digest('hex');
  const check = readFileSync(validation,'utf8').replace(/(export const referenceSha256 = ')[a-f0-9]{64}(';)/,
    (_,before,after)=>before+hash+after);
  writeFileSync(validation,check);
}
