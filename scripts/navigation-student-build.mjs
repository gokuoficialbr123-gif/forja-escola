import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {withoutNavigationStudent,navigationBaseline} from './navigation-student-scope.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
let html=execFileSync('git',['show','c659f4fa0fcde823b8a7b84eac396c90294b8b11:index.html'],{encoding:'utf8',maxBuffer:4*1024*1024}).replace(/\r\n/g,'\n');
assert.equal(hash(html),navigationBaseline);
assert.equal(withoutNavigationStudent(readFileSync(new URL('../index.html',import.meta.url),'utf8')),html,'Refuse unrecorded source edits');
const changes=[];
function replace(before,after){const positions=[];let at=0;while((at=html.indexOf(before,at))>=0){positions.push(at);at+=before.length}assert.equal(positions.length,1,'Unique boundary: '+before.slice(0,90));changes.push({before,after,positions});html=html.replace(before,()=>after)}
replace('if(e.key==="Escape"){e.preventDefault();closeModal();return}','if(e.key==="Escape"){e.preventDefault();e.stopPropagation();closeModal();return}');
// Student-only renderers: no diagnosis, calculation or stored status is changed.
const summary=html.slice(html.indexOf('function studentMathSummaryB('),html.indexOf('function studentTaskStatusB('));
let neutral=summary.replace(/<span class="student-b-chip \$\{x.status[\s\S]*?<\/span>/,'<span class="student-b-chip">Conteúdo para praticar</span>');
neutral=neutral.replace(/<div class="student-b-traffic">[\s\S]*?<\/small><\/div><\/div>/,'');
assert.notEqual(neutral,summary);replace(summary,neutral);
replace('"Matemática, nível e semáforo."','"Matérias e conteúdo para praticar."');
replace('<span><small>Semáforo</small><b>${esc(`🔴 ${r} · 🟡 ${y} · 🟢 ${g}`)}</b></span>','<span><small>Conteúdo para praticar</small><b>${skills.length} tópico(s)</b></span>');
replace("${math?'warn':'info'}","${math?'':'info'}");
const diagnostic=html.slice(html.indexOf('function studentMathDiagnosticPage(){'),html.indexOf('const studentPageBeforeMathV68='));
replace(diagnostic,diagnostic.replace(/    `<div class="math-status-grid">[\s\S]*?<\/div>`\+\n/,''));
// A shared list result remains fully classified for professionals; students get a neutral label/class.
replace('function mathTopicStateLabel(v){return v===','function mathTopicStateLabel(v){if(state.role==="student")return "Conteúdo para praticar";return v===');
replace('function mathTopicStateClass(v){return v===','function mathTopicStateClass(v){if(state.role==="student")return "neutral";return v===');
replace('function topicStatusLabel(status,forStudent=false){const s=', 'function topicStatusLabel(status,forStudent=false){if(forStudent||state.role==="student")return "Conteúdo para praticar";const s=');
replace('function topicStatusClass(status){return status===','function topicStatusClass(status){if(state.role==="student")return "neutral";return status===');
replace('<i class="competency-dot"></i>${esc(topicStatusLabel(c.status,studentView))}','${studentView?"":`<i class="competency-dot"></i>`}${esc(topicStatusLabel(c.status,studentView))}');
replace('<div class="competency-legend"><span>🔴 ${studentView?"Em desenvolvimento":"Precisa de reforço"}</span><span>🟡 Em atenção</span><span>🟢 Bom domínio</span></div>','${studentView?"":`<div class="competency-legend"><span>🔴 Precisa de reforço</span><span>🟡 Em atenção</span><span>🟢 Bom domínio</span></div>`}');
// The official drawer retains its own draft, locks and submit path; only report its lifecycle.
replace('returnFocus:document.activeElement;b.open=true;','returnFocus:document.activeElement;b.open=true;window.forjaNavigationDrawer?.(true);');
replace('    v630UnlockBackground();','    v630UnlockBackground();window.forjaNavigationDrawer?.(false);');
replace('</body>\n</html>','<script id="forja-navigation-script">\n'+readFileSync(new URL('./navigation-client.js',import.meta.url),'utf8').replace(/\r\n/g,'\n')+'\n</script>\n</body>\n</html>');
writeFileSync(new URL('./navigation-student-changes.json',import.meta.url),JSON.stringify({baseline:navigationBaseline,changes},null,2)+'\n');
writeFileSync(new URL('../index.html',import.meta.url),html);
const validator=new URL('./validate.mjs',import.meta.url);writeFileSync(validator,readFileSync(validator,'utf8').replace(/export const referenceSha256 = '[a-f0-9]{64}';/,`export const referenceSha256 = '${hash(html)}';`));
console.log(JSON.stringify({baseline:navigationBaseline,sha256:hash(html),changes:changes.length}));
